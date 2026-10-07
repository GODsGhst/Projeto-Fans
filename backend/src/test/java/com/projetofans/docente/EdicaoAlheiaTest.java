package com.projetofans.docente;

import com.fasterxml.jackson.databind.JsonNode;
import com.projetofans.domain.AcaoRevisao;
import com.projetofans.domain.AlcanceNota;
import com.projetofans.domain.Evento;
import com.projetofans.domain.Materia;
import com.projetofans.domain.Material;
import com.projetofans.domain.Nota;
import com.projetofans.domain.RegistroTipo;
import com.projetofans.domain.Revisao;
import com.projetofans.domain.TipoConta;
import com.projetofans.domain.ProfessorMateria;
import com.projetofans.domain.Usuario;
import com.projetofans.repo.NotaRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Edicao de registro ALHEIO por docente (spec 5 e 5.2): P2, P3, P4, P5 e P18.
 *
 * O que se prova, em ordem de importancia:
 *  - quem tem poder corrige (P3) e fica registrado: autor intacto, atualizado_por = quem
 *    editou, revisao com o estado ANTERIOR assinada pelo editor;
 *  - o poder e exato: so a materia declarada, e na mudanca de materia as DUAS pontas (P4);
 *  - sem poder (pendente, recusado, contestado) o docente e aluno: 403 e nada muda (P2);
 *  - ninguem exclui o que e dos outros, nem com alcance (P5), e o lider continua nao
 *    editando (P18);
 *  - a ordem das checagens e a de sempre: escopo (404) -> poder (403) -> version (409/428).
 *
 * Toda negativa confere que o registro ficou como estava — 403 que mexe em algo antes de
 * recusar seria pior que 200.
 */
class EdicaoAlheiaTest extends CenarioDocente {

    @Autowired private NotaRepository notas;

    private List<Revisao> revisoesDe(RegistroTipo tipo, UUID id) {
        return revisoes.findByRegistroTipoAndRegistroIdOrderByEmDesc(tipo, id);
    }

    // O teste e transacional e a instancia que o teste guarda e a MESMA que o service altera,
    // entao comparar o registro com "ele mesmo de antes" nao prova nada: o esperado vai por
    // argumento. Os registros do cenario nascem na version 0, e 0 so muda se alguem salvar.

    private void eventoIntacto(Evento e, Materia materia, String titulo) {
        Evento agora = eventos.findById(e.getId()).orElseThrow();
        assertThat(agora.getTitulo()).isEqualTo(titulo);
        assertThat(agora.getMateriaId()).isEqualTo(materia.getId());
        assertThat(agora.getVersion()).isZero();
        assertThat(agora.getAtualizadoPor()).isNull();
        assertThat(revisoesDe(RegistroTipo.EVENTO, e.getId())).isEmpty();
    }

    private void materialIntacto(Material m, Materia materia, String titulo) {
        Material agora = materiais.findById(m.getId()).orElseThrow();
        assertThat(agora.getTitulo()).isEqualTo(titulo);
        assertThat(agora.getMateriaId()).isEqualTo(materia.getId());
        assertThat(agora.getVersion()).isZero();
        assertThat(agora.getAtualizadoPor()).isNull();
        assertThat(revisoesDe(RegistroTipo.MATERIAL, m.getId())).isEmpty();
    }

    // ---- P2: sem poder, o docente e aluno ---------------------------------------

    @ParameterizedTest
    @EnumSource(SemPoder.class)
    @DisplayName("P2 — professor pendente, recusado ou contestado, com a materia declarada: editar e desvincular -> 403, nada muda")
    void docenteSemPoderEditaComoAluno(SemPoder situacao) throws Exception {
        Usuario docente = professorSemPoder(situacao, "Sem poder", calculo);
        Evento prova = evento(calculo, aluno);
        Material slides = material(calculo, aluno);
        vincular(prova, slides, aluno);

        patchEvento(docente, prova, calculo, "Corrigida", prova.getVersion())
                .andExpect(status().isForbidden());
        patchMaterial(docente, slides, calculo, "Corrigido", slides.getVersion())
                .andExpect(status().isForbidden());
        http.perform(delete("/api/v1/eventos/" + prova.getId() + "/materiais/" + slides.getId())
                        .header("Authorization", bearer(docente)))
                .andExpect(status().isForbidden());

        eventoIntacto(prova, calculo, "Prova 1");
        materialIntacto(slides, calculo, "Slides");
        assertThat(vinculos.existsByChaveEventoIdAndChaveMaterialId(prova.getId(), slides.getId())).isTrue();
    }

    // ---- P3: aprovado corrige, e fica registrado --------------------------------

    @Test
    @DisplayName("P3 — professor aprovado corrige evento alheio na materia dele: 200, autor intacto, atualizado_por, revisao e 'editado por'")
    void professorCorrigeEventoAlheio() throws Exception {
        Evento prova = evento(calculo, aluno);
        int versionAntes = prova.getVersion();

        JsonNode resposta = corpoDe(patchEvento(prof, prova, calculo, "Prova adiada", versionAntes)
                .andExpect(status().isOk()));

        assertThat(resposta.get("titulo").asText()).isEqualTo("Prova adiada");
        assertThat(resposta.get("version").asInt()).isEqualTo(versionAntes + 1);
        JsonNode autoria = resposta.get("autoria");
        // continua sendo da Ana: corrigir nao e assumir a autoria
        assertThat(autoria.get("autorId").asText()).isEqualTo(aluno.getId().toString());
        assertThat(autoria.get("autorNome").asText()).isEqualTo("Ana");
        assertThat(autoria.get("editadoPorNome").asText()).isEqualTo("Paulo");
        assertThat(autoria.get("editadoPorSelo").asText()).isEqualTo("PROFESSOR");

        Evento depois = eventos.findById(prova.getId()).orElseThrow();
        assertThat(depois.getAutorId()).isEqualTo(aluno.getId());
        assertThat(depois.getAtualizadoPor()).isEqualTo(prof.getId());

        List<Revisao> historico = revisoesDe(RegistroTipo.EVENTO, prova.getId());
        assertThat(historico).hasSize(1);
        assertThat(historico.get(0).getAcao()).isEqualTo(AcaoRevisao.EDITAR);
        assertThat(historico.get(0).getAutorId()).isEqualTo(prof.getId());
        // o snapshot e o estado ANTERIOR: quem corrigiu nao apaga o que a Ana tinha escrito
        assertThat(historico.get(0).getSnapshot()).contains("Prova 1").doesNotContain("Prova adiada");
    }

    @Test
    @DisplayName("P3 — idem para material (A25): professor corrige material alheio da materia dele")
    void professorCorrigeMaterialAlheio() throws Exception {
        Material slides = material(calculo, aluno);

        JsonNode resposta = corpoDe(patchMaterial(prof, slides, calculo, "Slides v2", slides.getVersion())
                .andExpect(status().isOk()));

        assertThat(resposta.get("autoria").get("autorId").asText()).isEqualTo(aluno.getId().toString());
        assertThat(resposta.get("autoria").get("editadoPorNome").asText()).isEqualTo("Paulo");
        assertThat(resposta.get("autoria").get("editadoPorSelo").asText()).isEqualTo("PROFESSOR");
        Material depois = materiais.findById(slides.getId()).orElseThrow();
        assertThat(depois.getAutorId()).isEqualTo(aluno.getId());
        assertThat(depois.getAtualizadoPor()).isEqualTo(prof.getId());
        List<Revisao> historico = revisoesDe(RegistroTipo.MATERIAL, slides.getId());
        assertThat(historico).hasSize(1);
        assertThat(historico.get(0).getAutorId()).isEqualTo(prof.getId());
        assertThat(historico.get(0).getSnapshot()).contains("Slides").doesNotContain("Slides v2");
    }

    @Test
    @DisplayName("quando o proprio autor edita, atualizado_por e ele mesmo e a resposta nao traz 'editado por'")
    void autorEditandoASiMesmoNaoVira_editadoPor() throws Exception {
        Evento prova = evento(calculo, aluno);

        JsonNode resposta = corpoDe(patchEvento(aluno, prova, calculo, "Prova 1 (rev)", prova.getVersion())
                .andExpect(status().isOk()));

        assertThat(eventos.findById(prova.getId()).orElseThrow().getAtualizadoPor()).isEqualTo(aluno.getId());
        assertThat(resposta.get("autoria").has("editadoPorNome")).isFalse();
        assertThat(resposta.get("autoria").has("editadoPorSelo")).isFalse();
    }

    // ---- P4: o alcance e exato ---------------------------------------------------

    @Test
    @DisplayName("P4 — professor aprovado: evento alheio de materia NAO declarada -> 403")
    void professorNaoCorrigeForaDaMateria() throws Exception {
        Evento deFisica = evento(fisica, aluno);
        Material deFisicaMat = material(fisica, aluno);

        patchEvento(prof, deFisica, fisica, "Corrigida", deFisica.getVersion()).andExpect(status().isForbidden());
        patchMaterial(prof, deFisicaMat, fisica, "Corrigido", deFisicaMat.getVersion())
                .andExpect(status().isForbidden());

        eventoIntacto(deFisica, fisica, "Prova 1");
        materialIntacto(deFisicaMat, fisica, "Slides");
    }

    @Test
    @DisplayName("P4 — mover para materia nao declarada -> 403; mover PARA a dele a partir de materia que nao e dele tambem")
    void professorNaoMoveEntreMaterias() throws Exception {
        Evento deCalculo = evento(calculo, aluno);
        Evento deFisica = evento(fisica, aluno);
        Material slides = material(calculo, aluno);

        // destino fora do alcance: tirar o evento da materia dele para a dos outros
        patchEvento(prof, deCalculo, fisica, "Prova 1", deCalculo.getVersion()).andExpect(status().isForbidden());
        patchMaterial(prof, slides, fisica, "Slides", slides.getVersion()).andExpect(status().isForbidden());
        // origem fora do alcance: puxar o evento dos outros para a materia dele
        patchEvento(prof, deFisica, calculo, "Prova 1", deFisica.getVersion()).andExpect(status().isForbidden());

        eventoIntacto(deCalculo, calculo, "Prova 1");
        eventoIntacto(deFisica, fisica, "Prova 1");
        materialIntacto(slides, calculo, "Slides");
    }

    @Test
    @DisplayName("P4 — professor que declarou as duas materias move entre elas")
    void professorMoveEntreMateriasDeclaradas() throws Exception {
        lecionadas.saveAndFlush(new ProfessorMateria(prof.getId(), fisica.getId()));
        Evento prova = evento(calculo, aluno);

        patchEvento(prof, prova, fisica, "Prova 1", prova.getVersion()).andExpect(status().isOk());

        assertThat(eventos.findById(prova.getId()).orElseThrow().getMateriaId()).isEqualTo(fisica.getId());
    }

    @Test
    @DisplayName("coordenador aprovado corrige em qualquer materia, e move entre elas, sem ter declarado nenhuma")
    void coordenadorCorrigeAMateriaQueQuiser() throws Exception {
        Evento deFisica = evento(fisica, aluno);
        Material deCalculoMat = material(calculo, aluno);

        JsonNode resposta = corpoDe(patchEvento(coord, deFisica, calculo, "Movida", deFisica.getVersion())
                .andExpect(status().isOk()));
        patchMaterial(coord, deCalculoMat, fisica, "Slides da Fisica", deCalculoMat.getVersion())
                .andExpect(status().isOk());

        assertThat(resposta.get("materiaId").asText()).isEqualTo(calculo.getId().toString());
        assertThat(resposta.get("autoria").get("editadoPorNome").asText()).isEqualTo("Carla");
        assertThat(resposta.get("autoria").get("editadoPorSelo").asText()).isEqualTo("COORDENACAO");
        assertThat(eventos.findById(deFisica.getId()).orElseThrow().getAtualizadoPor()).isEqualTo(coord.getId());
        assertThat(materiais.findById(deCalculoMat.getId()).orElseThrow().getMateriaId()).isEqualTo(fisica.getId());
    }

    @Test
    @DisplayName("coordenador nao leva o evento para a materia de OUTRA turma: 404 na ponta de destino")
    void coordenadorNaoMoveParaOutraTurma() throws Exception {
        Materia deOutraTurma = novaMateria(novaTurma());
        Evento prova = evento(calculo, aluno);

        patchEvento(coord, prova, deOutraTurma, "Prova 1", prova.getVersion()).andExpect(status().isNotFound());

        eventoIntacto(prova, calculo, "Prova 1");
    }

    // ---- desvincular -------------------------------------------------------------

    @Test
    @DisplayName("desvincular material de evento alheio: professor na materia do evento e coordenador -> 204; professor fora dela -> 403")
    void desvincularSegueOAlcance() throws Exception {
        Evento deCalculo = evento(calculo, aluno);
        Evento deFisica = evento(fisica, aluno);
        Material slides = material(calculo, aluno);
        Material outro = material(fisica, aluno);
        vincular(deCalculo, slides, aluno);
        vincular(deFisica, outro, aluno);

        http.perform(delete("/api/v1/eventos/" + deFisica.getId() + "/materiais/" + outro.getId())
                        .header("Authorization", bearer(prof)))
                .andExpect(status().isForbidden());
        assertThat(vinculos.existsByChaveEventoIdAndChaveMaterialId(deFisica.getId(), outro.getId())).isTrue();

        http.perform(delete("/api/v1/eventos/" + deCalculo.getId() + "/materiais/" + slides.getId())
                        .header("Authorization", bearer(prof)))
                .andExpect(status().isNoContent());
        http.perform(delete("/api/v1/eventos/" + deFisica.getId() + "/materiais/" + outro.getId())
                        .header("Authorization", bearer(coord)))
                .andExpect(status().isNoContent());

        assertThat(vinculos.existsByChaveEventoIdAndChaveMaterialId(deCalculo.getId(), slides.getId())).isFalse();
        assertThat(vinculos.existsByChaveEventoIdAndChaveMaterialId(deFisica.getId(), outro.getId())).isFalse();
    }

    // ---- P5: excluir e so do autor ----------------------------------------------

    @Test
    @DisplayName("P5 — professor e coordenador NAO excluem evento nem material alheio, mesmo dentro do alcance")
    void docenteNaoExcluiRegistroAlheio() throws Exception {
        Evento prova = evento(calculo, aluno);
        Material slides = material(calculo, aluno);

        for (Usuario docente : List.of(prof, coord)) {
            http.perform(delete("/api/v1/eventos/" + prova.getId())
                            .header("Authorization", bearer(docente)).header("If-Match", prova.getVersion()))
                    .andExpect(status().isForbidden());
            http.perform(delete("/api/v1/materiais/" + slides.getId())
                            .header("Authorization", bearer(docente)).header("If-Match", slides.getVersion()))
                    .andExpect(status().isForbidden());
        }

        assertThat(eventos.findById(prova.getId()).orElseThrow().getExcluidoEm()).isNull();
        assertThat(materiais.findById(slides.getId()).orElseThrow().getExcluidoEm()).isNull();
        assertThat(revisoesDe(RegistroTipo.EVENTO, prova.getId())).isEmpty();
    }

    @Test
    @DisplayName("P5 — o docente exclui o que ELE postou: o poder nao tirou o direito de autor")
    void docenteExcluiOProprio() throws Exception {
        Evento minha = evento(calculo, prof);

        http.perform(delete("/api/v1/eventos/" + minha.getId())
                        .header("Authorization", bearer(prof)).header("If-Match", minha.getVersion()))
                .andExpect(status().isNoContent());

        assertThat(eventos.findById(minha.getId()).orElseThrow().getExcluidoEm()).isNotNull();
    }

    @Test
    @DisplayName("nota alheia: nem coordenador edita ou exclui (a tabela da spec nao da esse poder a ninguem)")
    void docenteNaoMexeEmNotaAlheia() throws Exception {
        Nota recado = notas.saveAndFlush(new Nota(UUID.randomUUID(), turma.getId(), aluno.getId(),
                AlcanceNota.TURMA, LocalDate.now().plusDays(2), "Trazer calculadora", Instant.now()));

        http.perform(patch("/api/v1/notas/" + recado.getId())
                        .header("Authorization", bearer(coord)).header("If-Match", recado.getVersion())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"alcance\":\"TURMA\",\"data\":\"" + recado.getData() + "\",\"texto\":\"outro\"}"))
                .andExpect(status().isForbidden());
        http.perform(delete("/api/v1/notas/" + recado.getId())
                        .header("Authorization", bearer(coord)).header("If-Match", recado.getVersion()))
                .andExpect(status().isForbidden());

        assertThat(notas.findById(recado.getId()).orElseThrow().getTexto()).isEqualTo("Trazer calculadora");
    }

    // ---- P18: o lider continua nao editando --------------------------------------

    @Test
    @DisplayName("P18 — LIDER editar ou excluir registro alheio -> 403 (R11 continua); ALUNO cria direto -> 201 (R10 continua)")
    void liderContinuaSemEditarEAlunoContinuaPostandoLivre() throws Exception {
        Evento prova = evento(calculo, aluno);
        Material slides = material(calculo, aluno);

        patchEvento(lider, prova, calculo, "Corrigida", prova.getVersion()).andExpect(status().isForbidden());
        patchMaterial(lider, slides, calculo, "Corrigido", slides.getVersion()).andExpect(status().isForbidden());
        http.perform(delete("/api/v1/eventos/" + prova.getId())
                        .header("Authorization", bearer(lider)).header("If-Match", prova.getVersion()))
                .andExpect(status().isForbidden());
        eventoIntacto(prova, calculo, "Prova 1");

        http.perform(post("/api/v1/eventos").header("Authorization", bearer(aluno))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"materiaId\":\"" + fisica.getId() + "\",\"tipo\":\"ENTREGA\",\"titulo\":\"Lista 1\","
                                + "\"data\":\"" + LocalDate.now().plusDays(5) + "\"}"))
                .andExpect(status().isCreated());
    }

    // ---- ordem das checagens -----------------------------------------------------

    @Test
    @DisplayName("ordem escopo(404) -> poder(403) -> version(409): docente de outra turma leva 404; sem alcance leva 403 ANTES da version")
    void escopoAntesDoPoderAntesDaVersion() throws Exception {
        Evento deCalculo = evento(calculo, aluno);
        Evento deFisica = evento(fisica, aluno);
        Usuario deFora = docenteAprovado(novaTurma(), "Coord de fora", TipoConta.COORDENADOR);

        // coordenador APROVADO, mas de outra turma: o registro nao existe para ele
        patchEvento(deFora, deCalculo, calculo, "x", deCalculo.getVersion()).andExpect(status().isNotFound());
        // sem alcance + version velha: o 403 nao pode virar 409 (confirmaria que o registro existe e quanto vale)
        patchEvento(prof, deFisica, fisica, "x", 99).andExpect(status().isForbidden());
        // com alcance + version velha: agora sim o 409
        patchEvento(prof, deCalculo, calculo, "x", 99).andExpect(status().isConflict());
        // sem If-Match o docente tambem leva 428: o locking otimista vale para quem tem poder
        patchEvento(prof, deCalculo, calculo, "x", null).andExpect(status().isPreconditionRequired());

        eventoIntacto(deCalculo, calculo, "Prova 1");
        eventoIntacto(deFisica, fisica, "Prova 1");
    }

    @Test
    @DisplayName("evento oculto pelo lider continua existindo SO para o autor: o coordenador leva 404, nao edita")
    void docenteNaoEditaEventoOculto() throws Exception {
        Evento prova = evento(calculo, aluno);
        postar(lider, "/api/v1/moderacao/evento/" + prova.getId() + "/ocultar").andExpect(status().is2xxSuccessful());

        patchEvento(coord, prova, calculo, "x", prova.getVersion()).andExpect(status().isNotFound());

        assertThat(eventos.findById(prova.getId()).orElseThrow().getTitulo()).isEqualTo("Prova 1");
    }

    @Test
    @DisplayName("P16 — recusar um professor aprovado corta a edicao na requisicao seguinte, com o mesmo token")
    void recusarCortaAEdicaoNaHora() throws Exception {
        Evento prova = evento(calculo, aluno);
        String tokenDoProfessor = bearer(prof);
        ResultActions primeira = http.perform(patch("/api/v1/eventos/" + prova.getId())
                .header("Authorization", tokenDoProfessor).header("If-Match", prova.getVersion())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"materiaId\":\"" + calculo.getId() + "\",\"tipo\":\"PROVA\",\"titulo\":\"Adiada\","
                        + "\"data\":\"" + prova.getDataEvento() + "\"}"));
        primeira.andExpect(status().isOk());

        prof.decidirDocente(false, novoUsuario("Admin").getId(), Instant.now());
        usuarios.saveAndFlush(prof);

        http.perform(patch("/api/v1/eventos/" + prova.getId())
                        .header("Authorization", tokenDoProfessor).header("If-Match", prova.getVersion())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"materiaId\":\"" + calculo.getId() + "\",\"tipo\":\"PROVA\",\"titulo\":\"Outra\","
                                + "\"data\":\"" + prova.getDataEvento() + "\"}"))
                .andExpect(status().isForbidden());
        assertThat(eventos.findById(prova.getId()).orElseThrow().getTitulo()).isEqualTo("Adiada");
    }
}
