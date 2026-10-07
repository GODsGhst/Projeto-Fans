package com.projetofans.docente;

import com.fasterxml.jackson.databind.JsonNode;
import com.projetofans.domain.Evento;
import com.projetofans.domain.Materia;
import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.ProfessorMateria;
import com.projetofans.domain.TipoConta;
import com.projetofans.domain.TipoEvento;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * GET /api/v1/painel (spec 7, P20): o painel do docente.
 *
 * O painel e da CONTA, nao da turma: ignora X-Turma-Id e lista todas as turmas dela. Ler
 * nao e poder, entao o tipo da conta e que abre a porta (aluno leva 403) e o status so
 * decide se ha selo. Os "proximos" sao os da Home — mesma janela de 14 dias, mesma ordem,
 * mesmo teto de 6 — com um unico acrescimo: o professor so ve as materias que declarou.
 */
class PainelDocenteTest extends CenarioDocente {

    private JsonNode painel(Usuario quem) throws Exception {
        return corpoDe(lerComo(quem, "/api/v1/painel").andExpect(status().isOk()));
    }

    /** A entrada da turma no painel; a ordem das turmas nao e contrato (entrou_em e now() da transacao). */
    private static JsonNode daTurma(JsonNode painel, Turma t) {
        for (JsonNode entrada : painel.get("turmas")) {
            if (t.getId().toString().equals(entrada.get("turmaId").asText())) {
                return entrada;
            }
        }
        throw new AssertionError("turma " + t.getId() + " fora do painel: " + painel);
    }

    private static List<String> titulos(JsonNode proximos) {
        List<String> saida = new ArrayList<>();
        proximos.forEach(item -> saida.add(item.get("titulo").asText()));
        return saida;
    }

    private static LocalDate emDias(int dias) {
        return LocalDate.now().plusDays(dias);
    }

    // ---- quem entra -------------------------------------------------------------------

    @Test
    @DisplayName("P20 — conta ALUNO leva 403, inclusive o lider; sem token, 401")
    void alunoNaoTemPainel() throws Exception {
        lerComo(aluno, "/api/v1/painel").andExpect(status().isForbidden());
        lerComo(lider, "/api/v1/painel").andExpect(status().isForbidden());
        http.perform(get("/api/v1/painel")).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @EnumSource(SemPoder.class)
    @DisplayName("P20 — professor pendente, recusado ou contestado: 200, SEM selo; as materias declaradas e os proximos delas aparecem (ler nao e poder)")
    void docenteSemPoderVeOPainelSemSelo(SemPoder situacao) throws Exception {
        Usuario docente = professorSemPoder(situacao, "Sem poder", calculo);
        evento(calculo, aluno, "de calculo", emDias(2));
        evento(fisica, aluno, "de fisica", emDias(2));

        JsonNode entrada = daTurma(painel(docente), turma);

        assertThat(entrada.has("selo")).isFalse();
        assertThat(entrada.get("papel").asText()).isEqualTo("PROFESSOR");
        assertThat(entrada.get("contestado").asBoolean()).isEqualTo(situacao == SemPoder.CONTESTADO);
        assertThat(entrada.get("lecionadas")).hasSize(1);
        assertThat(entrada.get("lecionadas").get(0).get("sigla").asText()).isEqualTo("CAL");
        assertThat(titulos(entrada.get("proximos"))).containsExactly("de calculo");
    }

    @Test
    @DisplayName("professor aprovado: selo PROFESSOR, as materias com sigla e cor, papel e nome da turma")
    void professorAprovadoVeSeuSelo() throws Exception {
        JsonNode entrada = daTurma(painel(prof), turma);

        assertThat(entrada.get("selo").asText()).isEqualTo("PROFESSOR");
        assertThat(entrada.get("papel").asText()).isEqualTo("PROFESSOR");
        assertThat(entrada.get("contestado").asBoolean()).isFalse();
        assertThat(entrada.get("nome").asText()).isEqualTo(turma.getNome());
        assertThat(entrada.get("semestre").asText()).isEqualTo(turma.getSemestre());
        assertThat(entrada.get("lecionadas").get(0).get("materiaId").asText()).isEqualTo(calculo.getId().toString());
        assertThat(entrada.get("lecionadas").get(0).get("corHex").asText()).isEqualTo("#1F6FB2");
    }

    @Test
    @DisplayName("professor aprovado que ainda nao declarou materia: sem selo e sem proximos (nao tem poder em lugar nenhum)")
    void professorSemDeclaracaoNaoTemSeloNemProximos() throws Exception {
        Usuario novo = docenteAprovado(turma, "Novo", TipoConta.PROFESSOR);
        evento(calculo, aluno, "de calculo", emDias(2));

        JsonNode entrada = daTurma(painel(novo), turma);

        assertThat(entrada.has("selo")).isFalse();
        assertThat(entrada.get("lecionadas")).isEmpty();
        assertThat(entrada.get("proximos")).isEmpty();
    }

    @Test
    @DisplayName("docente sem turma nenhuma: 200 com lista vazia")
    void docenteSemTurma() throws Exception {
        Usuario solto = usuarios.saveAndFlush(Usuario.comSenha(UUID.randomUUID(), "Solto",
                "s-" + UUID.randomUUID() + "@ex.dev", "hash", TipoConta.PROFESSOR));

        assertThat(painel(solto).get("turmas")).isEmpty();
    }

    // ---- o que aparece em "proximos" ---------------------------------------------------

    @Test
    @DisplayName("P20 — professor ve proximos so das materias declaradas; coordenador ve a turma toda, na ordem da Home")
    void professorFiltraPorMateriaCoordenadorVeTudo() throws Exception {
        evento(fisica, aluno, "F1", emDias(1));
        evento(calculo, aluno, "C1", emDias(2));
        evento(fisica, aluno, "F2", emDias(3));
        Evento oculto = evento(calculo, aluno, "C oculto", emDias(2));
        oculto.definirVisibilidadeTurma(false);
        eventos.saveAndFlush(oculto);

        assertThat(titulos(daTurma(painel(prof), turma).get("proximos"))).containsExactly("C1");
        JsonNode doCoordenador = daTurma(painel(coord), turma);
        assertThat(titulos(doCoordenador.get("proximos"))).containsExactly("F1", "C1", "F2");
        assertThat(doCoordenador.get("papel").asText()).isEqualTo("COORDENADOR");
        assertThat(doCoordenador.get("selo").asText()).isEqualTo("COORDENACAO");
        assertThat(doCoordenador.get("lecionadas")).isEmpty();
    }

    @Test
    @DisplayName("P20 — o filtro de materia vem ANTES do teto: com 6 eventos de outra materia na frente, o professor ainda recebe os dele")
    void filtroDeMateriaAntesDoTeto() throws Exception {
        for (int dia = 1; dia <= 6; dia++) {
            evento(fisica, aluno, "F" + dia, emDias(dia));
        }
        evento(calculo, aluno, "C7", emDias(7));
        evento(calculo, aluno, "C8", emDias(8));

        // se o corte de 6 viesse antes do filtro, o professor receberia uma lista vazia
        assertThat(titulos(daTurma(painel(prof), turma).get("proximos"))).containsExactly("C7", "C8");
    }

    @Test
    @DisplayName("P20 — teto de 6 por turma (os 6 mais urgentes, nao 6 quaisquer)")
    void tetoDeSeisPorTurma() throws Exception {
        for (int dia = 8; dia >= 1; dia--) {
            evento(calculo, aluno, "C" + dia, emDias(dia));
        }

        assertThat(titulos(daTurma(painel(prof), turma).get("proximos")))
                .containsExactly("C1", "C2", "C3", "C4", "C5", "C6");
        assertThat(titulos(daTurma(painel(coord), turma).get("proximos"))).hasSize(6);
    }

    @Test
    @DisplayName("P20 — janela de 14 dias como a Home: ontem fora, hoje e hoje+14 dentro, hoje+15 fora")
    void janelaDeQuatorzeDias() throws Exception {
        evento(calculo, aluno, "ontem", emDias(-1));
        evento(calculo, aluno, "hoje", emDias(0));
        evento(calculo, aluno, "dia 14", emDias(14));
        evento(calculo, aluno, "dia 15", emDias(15));

        assertThat(titulos(daTurma(painel(prof), turma).get("proximos"))).containsExactly("hoje", "dia 14");
    }

    @Test
    @DisplayName("P20 — a ordem dos proximos e a da Home: data, hora (sem hora por ultimo), PROVA antes de ENTREGA")
    void mesmaOrdemDaHome() throws Exception {
        Instant agora = Instant.now();
        criarEvento("entrega 9h", TipoEvento.ENTREGA, emDias(2), LocalTime.of(9, 0), agora);
        criarEvento("prova sem hora", TipoEvento.PROVA, emDias(2), null, agora);
        criarEvento("entrega sem hora", TipoEvento.ENTREGA, emDias(2), null, agora);
        criarEvento("prova 14h", TipoEvento.PROVA, emDias(2), LocalTime.of(14, 0), agora);
        criarEvento("amanha", TipoEvento.ENTREGA, emDias(1), null, agora);

        List<String> daHome = titulos(corpoDe(lerComo(coord, "/api/v1/home").andExpect(status().isOk())));

        assertThat(daHome).hasSize(5);
        assertThat(titulos(daTurma(painel(coord), turma).get("proximos"))).containsExactlyElementsOf(daHome);
        assertThat(titulos(daTurma(painel(prof), turma).get("proximos"))).containsExactlyElementsOf(daHome);
    }

    private void criarEvento(String titulo, TipoEvento tipo, LocalDate dia, LocalTime hora, Instant agora) {
        eventos.saveAndFlush(new Evento(UUID.randomUUID(), turma.getId(), calculo.getId(), tipo, titulo,
                dia, hora, aluno.getId(), agora));
    }

    @Test
    @DisplayName("os proximos do painel carregam a autoria com selo, como a Home")
    void proximosTrazemASeloDaAutoria() throws Exception {
        evento(calculo, prof, "do professor", emDias(1));
        evento(calculo, coord, "da coordenacao", emDias(2));
        evento(calculo, aluno, "da Ana", emDias(3));

        JsonNode proximos = daTurma(painel(prof), turma).get("proximos");

        assertThat(proximos.get(0).get("autoria").get("autorSelo").asText()).isEqualTo("PROFESSOR");
        assertThat(proximos.get(1).get("autoria").get("autorSelo").asText()).isEqualTo("COORDENACAO");
        assertThat(proximos.get(2).get("autoria").has("autorSelo")).isFalse();
    }

    // ---- varias turmas, X-Turma-Id ---------------------------------------------------------

    /** O professor Paulo tambem da aula na turma B, onde declarou Quimica. */
    private record TurmaB(Turma turma, Materia quimica, Materia biologia) {
    }

    private TurmaB professorTambemNaTurmaB() {
        Turma b = novaTurma();
        Materia quimica = materias.saveAndFlush(new Materia(UUID.randomUUID(), b.getId(), "Quimica", "QUI", "#1F6FB2"));
        Materia biologia = materias.saveAndFlush(new Materia(UUID.randomUUID(), b.getId(), "Biologia", "BIO", "#1F6FB2"));
        membros.saveAndFlush(new Membro(UUID.randomUUID(), prof.getId(), b.getId(), PapelMembro.PROFESSOR));
        lecionadas.saveAndFlush(new ProfessorMateria(prof.getId(), quimica.getId()));
        return new TurmaB(b, quimica, biologia);
    }

    private void eventoNaTurmaB(TurmaB b, Materia m, String titulo) {
        eventos.saveAndFlush(new Evento(UUID.randomUUID(), b.turma().getId(), m.getId(), TipoEvento.PROVA,
                titulo, emDias(2), null, aluno.getId(), Instant.now()));
    }

    @Test
    @DisplayName("professor de duas turmas: cada entrada com as materias e os proximos DA PROPRIA turma, sem vazar de uma para a outra")
    void duasTurmasNaoSeMisturam() throws Exception {
        TurmaB b = professorTambemNaTurmaB();
        evento(calculo, aluno, "calculo da A", emDias(1));
        evento(fisica, aluno, "fisica da A", emDias(1));
        eventoNaTurmaB(b, b.quimica(), "quimica da B");
        eventoNaTurmaB(b, b.biologia(), "biologia da B");

        JsonNode resposta = painel(prof);

        assertThat(resposta.get("turmas")).hasSize(2);
        assertThat(titulos(daTurma(resposta, turma).get("proximos"))).containsExactly("calculo da A");
        assertThat(titulos(daTurma(resposta, b.turma()).get("proximos"))).containsExactly("quimica da B");
        assertThat(daTurma(resposta, b.turma()).get("lecionadas").get(0).get("sigla").asText()).isEqualTo("QUI");
        assertThat(daTurma(resposta, turma).get("lecionadas")).hasSize(1);
    }

    @Test
    @DisplayName("P20 — o painel ignora X-Turma-Id: malformado, de turma alheia ou de uma das dele, a resposta e a mesma")
    void ignoraXTurmaId() throws Exception {
        TurmaB b = professorTambemNaTurmaB();
        evento(calculo, aluno, "calculo da A", emDias(1));
        eventoNaTurmaB(b, b.quimica(), "quimica da B");
        JsonNode semCabecalho = painel(prof);

        for (String cabecalho : List.of("isto-nao-e-uuid", UUID.randomUUID().toString(),
                turma.getId().toString(), b.turma().getId().toString())) {
            JsonNode com = corpoDe(http.perform(get("/api/v1/painel")
                            .header("Authorization", bearer(prof)).header("X-Turma-Id", cabecalho))
                    .andExpect(status().isOk()));
            assertThat(com).as("X-Turma-Id: " + cabecalho).isEqualTo(semCabecalho);
        }
        assertThat(semCabecalho.get("turmas")).hasSize(2);
    }
}
