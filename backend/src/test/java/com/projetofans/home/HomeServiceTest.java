package com.projetofans.home;

import com.projetofans.domain.Evento;
import com.projetofans.domain.Materia;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.TipoEvento;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.service.HomeService;
import com.projetofans.support.TesteDeApi;
import com.projetofans.web.dto.ItemHomeResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tres nao-negociaveis vivem aqui, e so aqui: teto de 6 (R6), janela de 14 dias
 * (R7) e ordenacao por urgencia (R8) — mais R9, que diz que semana vazia devolve
 * vazio e nada mais.
 *
 * Estes testes sao a especificacao executavel dessas regras. O mais importante do
 * arquivo e ordenaPorDataCrescenteIndependenteDoTipo: se ele falhar com a prova
 * na frente da entrega, alguem transformou o desempate por tipo em agrupamento
 * por tipo, que a Secao 2.1 do handoff proibe.
 *
 * Todos os cenarios sao montados em datas relativas a hoje de proposito: a janela
 * e calculada com current_date no banco, entao data fixa quebraria amanha.
 */
class HomeServiceTest extends TesteDeApi {

    @Autowired
    private HomeService home;

    private Turma turma;
    private Materia materia;
    private Usuario autor;
    private UsuarioAtual eu;

    @BeforeEach
    void cenario() {
        turma = novaTurma();
        materia = novaMateria(turma);
        autor = membroDe(turma, "Autor", PapelMembro.ALUNO);
        eu = new UsuarioAtual(autor.getId(), autor.getNome());
    }

    private Evento evento(TipoEvento tipo, String titulo, LocalDate data, LocalTime hora) {
        return eventos.saveAndFlush(new Evento(UUID.randomUUID(), turma.getId(), materia.getId(),
                tipo, titulo, data, hora, autor.getId(), Instant.now()));
    }

    private static LocalDate emDias(int dias) {
        return LocalDate.now().plusDays(dias);
    }

    private List<String> titulos(List<ItemHomeResponse> itens) {
        return itens.stream().map(ItemHomeResponse::titulo).toList();
    }

    @Test
    @DisplayName("R6 — dez eventos na janela, a Home devolve seis")
    void devolveNoMaximoSeisItens() {
        for (int dia = 1; dia <= 10; dia++) {
            evento(TipoEvento.ENTREGA, "Entrega " + dia, emDias(dia), null);
        }

        assertThat(home.home(eu)).hasSize(6);
    }

    @Test
    @DisplayName("R7 — o dia 15 esta fora da janela")
    void naoDevolveEventoDepoisDeQuatorzeDias() {
        evento(TipoEvento.PROVA, "Prova do dia 15", emDias(15), null);

        assertThat(home.home(eu)).isEmpty();
    }

    @Test
    @DisplayName("R7 — o dia 14 esta dentro: a fronteira e inclusiva")
    void devolveEventoNoDecimoQuartoDia() {
        evento(TipoEvento.PROVA, "Prova do dia 14", emDias(14), null);

        assertThat(titulos(home.home(eu))).containsExactly("Prova do dia 14");
    }

    @Test
    @DisplayName("evento de ontem nao aparece na Home")
    void naoDevolveEventoPassado() {
        evento(TipoEvento.PROVA, "Prova de ontem", emDias(-1), null);

        assertThat(home.home(eu)).isEmpty();
    }

    @Test
    @DisplayName("evento de hoje aparece: a fronteira de baixo tambem e inclusiva")
    void devolveEventoDeHoje() {
        evento(TipoEvento.ENTREGA, "Entrega de hoje", emDias(0), null);

        assertThat(titulos(home.home(eu))).containsExactly("Entrega de hoje");
    }

    /**
     * O teste que mais importa do arquivo. Uma ENTREGA amanha e uma PROVA em dez
     * dias: a entrega TEM de vir primeiro. Se a prova vier na frente, o criterio
     * de tipo saiu do terceiro lugar do order by e virou agrupamento.
     */
    @Test
    @DisplayName("R8 — ordena por data, e o tipo nao fura a fila")
    void ordenaPorDataCrescenteIndependenteDoTipo() {
        evento(TipoEvento.PROVA, "Prova em dez dias", emDias(10), null);
        evento(TipoEvento.ENTREGA, "Entrega de amanha", emDias(1), null);

        assertThat(titulos(home.home(eu)))
                .containsExactly("Entrega de amanha", "Prova em dez dias");
    }

    @Test
    @DisplayName("R8 — mesmo dia: hora crescente, sem hora por ultimo")
    void empateDeDataOrdenaPorHoraComNulosPorUltimo() {
        LocalDate mesmoDia = emDias(3);
        evento(TipoEvento.ENTREGA, "Sem hora", mesmoDia, null);
        evento(TipoEvento.ENTREGA, "As 14h", mesmoDia, LocalTime.of(14, 0));
        evento(TipoEvento.ENTREGA, "As 8h", mesmoDia, LocalTime.of(8, 0));

        assertThat(titulos(home.home(eu)))
                .containsExactly("As 8h", "As 14h", "Sem hora");
    }

    @Test
    @DisplayName("R8 — empate de data e hora: prova antes de entrega")
    void empateDeDataEHoraColocaProvaAntesDeEntrega() {
        LocalDate mesmoDia = emDias(4);
        LocalTime mesmaHora = LocalTime.of(10, 0);
        evento(TipoEvento.ENTREGA, "Entrega as 10h", mesmoDia, mesmaHora);
        evento(TipoEvento.PROVA, "Prova as 10h", mesmoDia, mesmaHora);

        assertThat(titulos(home.home(eu)))
                .containsExactly("Prova as 10h", "Entrega as 10h");
    }

    /**
     * R9. Lista vazia e resposta correta e informativa — nada de preencher com
     * sugestao, dica ou item de fora da janela para "nao deixar a tela vazia".
     */
    @Test
    @DisplayName("R9 — semana vazia devolve lista vazia, sem preenchimento")
    void semanaVaziaDevolveListaVazia() {
        assertThat(home.home(eu)).isEmpty();
    }
}
