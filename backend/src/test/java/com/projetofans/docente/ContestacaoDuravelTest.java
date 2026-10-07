package com.projetofans.docente;

import com.fasterxml.jackson.databind.JsonNode;
import com.projetofans.domain.Evento;
import com.projetofans.domain.Materia;
import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.ProfessorMateria;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.ResultActions;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A contestacao do lider sobrevive a remocao do docente (achado MEDIUM da revisao
 * de 07/10/2026).
 *
 * Ela morava so no vinculo, e remover o docente apaga o vinculo: contestar, remover
 * e deixar a pessoa voltar pelo codigo de convite devolvia o poder dela sem o lider
 * restaurar nada. Tudo aqui passa pelo HTTP de verdade; o unico atalho e montar o
 * cenario pelos repositorios (CenarioDocente).
 */
class ContestacaoDuravelTest extends CenarioDocente {

    @Autowired private JdbcTemplate jdbc;

    private Turma outra;
    private Materia quimica;

    @BeforeEach
    void outraTurmaDoProfessor() {
        // O professor tambem da aula na turma B: remover dela nao pode levar o que ele declarou la.
        outra = novaTurma();
        quimica = materias.saveAndFlush(new Materia(
                UUID.randomUUID(), outra.getId(), "Quimica", "QUI", "#1F6FB2"));
        membros.saveAndFlush(new Membro(
                UUID.randomUUID(), prof.getId(), outra.getId(), PapelMembro.PROFESSOR));
        lecionadas.saveAndFlush(new ProfessorMateria(prof.getId(), quimica.getId()));
    }

    // ---- chamadas ----------------------------------------------------------------

    private ResultActions contestarHttp(Usuario alvo) throws Exception {
        return http.perform(post("/api/v1/turmas/minha/docentes/" + alvo.getId() + "/contestar")
                .header("Authorization", bearer(lider)));
    }

    private ResultActions restaurarHttp(Usuario alvo) throws Exception {
        return http.perform(post("/api/v1/turmas/minha/docentes/" + alvo.getId() + "/restaurar")
                .header("Authorization", bearer(lider)));
    }

    private ResultActions remover(Usuario alvo) throws Exception {
        return http.perform(delete("/api/v1/turmas/minha/membros/" + alvo.getId())
                .header("Authorization", bearer(lider)));
    }

    private ResultActions reentrar(Usuario docente) throws Exception {
        return http.perform(post("/api/v1/turmas/entrar")
                .header("Authorization", bearer(docente))
                .contentType(MediaType.APPLICATION_JSON)
                .content(corpo(Map.of("codigoConvite", turma.getCodigoConvite()))));
    }

    private ResultActions declarar(Usuario professor, Materia... doTurma) throws Exception {
        return http.perform(put("/api/v1/turmas/minha/lecionadas")
                .header("Authorization", bearer(professor))
                .header("X-Turma-Id", turma.getId().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(corpo(Map.of("materiaIds",
                        Arrays.stream(doTurma).map(Materia::getId).toList()))));
    }

    /** A turma A como o docente a ve (X-Turma-Id: ele tem mais de uma turma). */
    private JsonNode minhaTurma(Usuario quem) throws Exception {
        return corpoDe(http.perform(get("/api/v1/turmas/minha")
                        .header("Authorization", bearer(quem))
                        .header("X-Turma-Id", turma.getId().toString()))
                .andExpect(status().isOk()));
    }

    private JsonNode membro(JsonNode turmaJson, Usuario quem) {
        for (JsonNode m : turmaJson.get("membros")) {
            if (m.get("usuarioId").asText().equals(quem.getId().toString())) {
                return m;
            }
        }
        throw new AssertionError("membro nao esta na resposta: " + quem.getNome());
    }

    /**
     * Status do PATCH em um evento alheio da materia dada. Um evento novo a cada
     * chamada: um 200 sobe a version e o proximo reaproveitaria um If-Match velho.
     */
    private int patchAlheio(Usuario quem, Materia m) throws Exception {
        Evento e = evento(m, aluno);
        return patchEvento(quem, e, m, "Corrigido", 0).andReturn().getResponse().getStatus();
    }

    private int declaracoesNaTurmaA(Usuario professor) {
        return jdbc.queryForObject("select count(*) from professor_materia pm "
                + "join materia m on m.id = pm.materia_id "
                + "where pm.usuario_id = ? and m.turma_id = ?", Integer.class,
                professor.getId(), turma.getId());
    }

    private int declaracoesNaTurmaB(Usuario professor) {
        return jdbc.queryForObject("select count(*) from professor_materia pm "
                + "join materia m on m.id = pm.materia_id "
                + "where pm.usuario_id = ? and m.turma_id = ?", Integer.class,
                professor.getId(), outra.getId());
    }

    // ---- o furo ------------------------------------------------------------------

    @Test
    @DisplayName("coordenacao: contestar -> remover -> reentrar pelo codigo continua contestada (PATCH 403, /turmas/minha contestado); restaurar devolve o poder")
    void coordenacaoReentraContestada() throws Exception {
        assertThat(patchAlheio(coord, calculo)).as("antes de tudo ela corrige").isEqualTo(200);

        contestarHttp(coord).andExpect(status().isOk());
        assertThat(patchAlheio(coord, calculo)).isEqualTo(403);

        remover(coord).andExpect(status().isNoContent());
        assertThat(patchAlheio(coord, calculo)).as("fora da turma nao tem nem escopo").isEqualTo(404);

        reentrar(coord).andExpect(status().isOk());

        assertThat(patchAlheio(coord, calculo))
                .as("o vinculo novo nasce contestado: voltar pelo codigo nao devolve o poder")
                .isEqualTo(403);
        JsonNode comoLider = minhaTurma(lider);
        assertThat(membro(comoLider, coord).get("contestado").asBoolean()).isTrue();
        assertThat(membro(comoLider, coord).has("selo")).isFalse();
        assertThat(minhaTurma(coord).get("meuAlcance").get("tipo").asText()).isEqualTo("NENHUM");

        restaurarHttp(coord).andExpect(status().isOk());

        assertThat(patchAlheio(coord, calculo)).as("restaurar devolve o poder").isEqualTo(200);
        assertThat(membro(minhaTurma(lider), coord).get("contestado").asBoolean()).isFalse();
    }

    @Test
    @DisplayName("restaurar apaga a memoria: remover e reentrar depois disso volta limpo")
    void restaurarApagaAMemoria() throws Exception {
        contestarHttp(coord).andExpect(status().isOk());
        restaurarHttp(coord).andExpect(status().isOk());

        remover(coord).andExpect(status().isNoContent());
        reentrar(coord).andExpect(status().isOk());

        assertThat(membro(minhaTurma(lider), coord).get("contestado").asBoolean()).isFalse();
        assertThat(patchAlheio(coord, calculo)).isEqualTo(200);
    }

    @Test
    @DisplayName("professor: remover leva as declaracoes DESTA turma (nao as da outra); a contestacao fica; restaurar devolve o poder depois de declarar de novo")
    void professorReentraContestadoESemDeclaracoes() throws Exception {
        assertThat(patchAlheio(prof, calculo)).isEqualTo(200);
        assertThat(declaracoesNaTurmaA(prof)).isEqualTo(1);
        assertThat(declaracoesNaTurmaB(prof)).isEqualTo(1);

        contestarHttp(prof).andExpect(status().isOk());
        remover(prof).andExpect(status().isNoContent());

        assertThat(declaracoesNaTurmaA(prof)).as("a declaracao daqui vai junto").isZero();
        assertThat(declaracoesNaTurmaB(prof)).as("a da outra turma e dele e fica").isEqualTo(1);

        reentrar(prof).andExpect(status().isOk());

        JsonNode comoLider = minhaTurma(lider);
        assertThat(membro(comoLider, prof).get("contestado").asBoolean()).isTrue();
        assertThat(membro(comoLider, prof).get("lecionadas")).as("nada reaparece sozinho").isEmpty();

        // declarar e livre (vale por turma, sem fila), mas contestado continua sem poder
        declarar(prof, calculo).andExpect(status().isOk());
        assertThat(patchAlheio(prof, calculo)).isEqualTo(403);

        restaurarHttp(prof).andExpect(status().isOk());
        assertThat(patchAlheio(prof, calculo)).isEqualTo(200);
    }

    @Test
    @DisplayName("remover um docente NAO contestado nao deixa rastro: ele volta limpo, e o lider ainda pode contestar de novo")
    void removerSemContestarNaoDeixaRastro() throws Exception {
        remover(coord).andExpect(status().isNoContent());
        reentrar(coord).andExpect(status().isOk());

        assertThat(membro(minhaTurma(lider), coord).get("contestado").asBoolean()).isFalse();
        assertThat(patchAlheio(coord, calculo)).isEqualTo(200);
        contestarHttp(coord).andExpect(status().isOk());
        assertThat(patchAlheio(coord, calculo)).isEqualTo(403);
    }

    @Test
    @DisplayName("a memoria e por turma: contestado na A, o mesmo docente entra limpo na B")
    void memoriaEPorTurma() throws Exception {
        contestarHttp(coord).andExpect(status().isOk());
        remover(coord).andExpect(status().isNoContent());

        // A chave da memoria e (turma, usuario): uma turma nova nao herda nada da A.
        Turma terceira = novaTurma();
        http.perform(post("/api/v1/turmas/entrar")
                        .header("Authorization", bearer(coord))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(Map.of("codigoConvite", terceira.getCodigoConvite()))))
                .andExpect(status().isOk());

        assertThat(membros.findByUsuarioIdAndTurmaId(coord.getId(), terceira.getId()).orElseThrow()
                .isContestado()).isFalse();
        List<String> contestadosNaA = jdbc.queryForList(
                "select usuario_id::text from contestacao_docente where turma_id = ?",
                String.class, turma.getId());
        assertThat(contestadosNaA).containsExactly(coord.getId().toString());
    }
}
