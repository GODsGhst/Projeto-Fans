package com.projetofans.materia;

import com.projetofans.domain.Evento;
import com.projetofans.domain.Materia;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.TipoEvento;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.support.TesteDeApi;
import com.projetofans.web.ProblemDetailHandler;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A corrida entre apagar uma materia e criar evento nela.
 *
 * A checagem de "materia vazia" e o INSERT nao sao atomicos, entao o banco e quem
 * decide no fim, pela FK. Aqui a violacao e REAL: vem do Postgres, atravessa o
 * Hibernate e o Spring como em producao, e so entao e entregue ao handler. Um
 * teste com excecao montada a mao passaria mesmo se o handler lesse o lugar errado
 * dela.
 */
class CorridaDeMateriaTest extends TesteDeApi {

    private final ProblemDetailHandler handler = new ProblemDetailHandler();

    private DataIntegrityViolationException violacao(Runnable acao) {
        try {
            acao.run();
        } catch (DataIntegrityViolationException e) {
            return e;
        }
        throw new AssertionError("o banco devia ter recusado");
    }

    @Test
    @DisplayName("apagar materia que ganhou evento no meio do caminho: 409 com frase, nao 500")
    void fkDeMateriaVira409() {
        Turma turma = novaTurma();
        Materia materia = novaMateria(turma);
        Usuario autor = membroDe(turma, "Ana", PapelMembro.ALUNO);
        eventos.saveAndFlush(new Evento(UUID.randomUUID(), turma.getId(), materia.getId(),
                TipoEvento.PROVA, "P1", LocalDate.now().plusDays(3), null, autor.getId(), Instant.now()));

        // Como se a checagem de "materia vazia" tivesse passado antes do evento existir.
        DataIntegrityViolationException erro = violacao(() -> {
            materias.delete(materia);
            materias.flush();
        });

        ProblemDetail p = handler.integridade(erro);
        assertThat(p.getStatus()).isEqualTo(HttpStatus.CONFLICT.value());
        assertThat(p.getDetail()).contains("materia mudou");
    }

    @Test
    @DisplayName("criar evento numa materia que sumiu no meio do caminho: tambem 409")
    void fkDoLadoDoInsertVira409() {
        Turma turma = novaTurma();
        Usuario autor = membroDe(turma, "Ana", PapelMembro.ALUNO);

        DataIntegrityViolationException erro = violacao(() ->
                eventos.saveAndFlush(new Evento(UUID.randomUUID(), turma.getId(), UUID.randomUUID(),
                        TipoEvento.PROVA, "P1", LocalDate.now().plusDays(3), null,
                        autor.getId(), Instant.now())));

        assertThat(handler.integridade(erro).getStatus()).isEqualTo(HttpStatus.CONFLICT.value());
    }

    @Test
    @DisplayName("qualquer OUTRA violacao de integridade continua 500: o 409 nao engole bug")
    void outrasViolacoesContinuam500() {
        Turma turma = novaTurma();
        novaMateria(turma);

        // Sigla repetida na turma: UNIQUE, nao FK de materia.
        DataIntegrityViolationException erro = violacao(() ->
                materias.saveAndFlush(new Materia(UUID.randomUUID(), turma.getId(),
                        "Outra", "CAL", "#1F6FB2")));

        assertThat(handler.integridade(erro).getStatus())
                .isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR.value());
    }
}
