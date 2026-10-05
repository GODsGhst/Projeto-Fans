package com.projetofans.seguranca;

import com.projetofans.domain.Evento;
import com.projetofans.domain.Materia;
import com.projetofans.domain.Material;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.RegistroTipo;
import com.projetofans.domain.TipoEvento;
import com.projetofans.domain.TipoMaterial;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.repo.AcaoModeracaoRepository;
import com.projetofans.support.TesteDeApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Achados B1 e B2 da auditoria de 05/10/2026: caminhos que checavam a turma mas
 * nao a visibilidade, e respondiam sucesso (ou 403) onde deviam responder 404.
 * Nenhum vazava conteudo — vazavam EXISTENCIA, que e o que a moderacao esconde.
 *
 * O contrato de todos: registro que eu nao posso ler responde exatamente como
 * registro que nao existe.
 */
class OraculoDeExistenciaTest extends TesteDeApi {

    @Autowired private AcaoModeracaoRepository acoes;

    private Turma turma;
    private Materia materia;
    private Usuario lider;
    private Usuario autor;
    private Usuario outro;

    @BeforeEach
    void cenario() {
        turma = novaTurma();
        materia = novaMateria(turma);
        lider = membroDe(turma, "Lia", PapelMembro.LIDER);
        autor = membroDe(turma, "Ana", PapelMembro.ALUNO);
        outro = membroDe(turma, "Bruno", PapelMembro.ALUNO);
    }

    private Evento eventoOculto() {
        Evento evento = new Evento(UUID.randomUUID(), turma.getId(), materia.getId(),
                TipoEvento.PROVA, "P1", LocalDate.now().plusDays(3), null,
                autor.getId(), Instant.now());
        evento.definirVisibilidadeTurma(false);
        return eventos.saveAndFlush(evento);
    }

    private Evento eventoExcluido() {
        Evento evento = new Evento(UUID.randomUUID(), turma.getId(), materia.getId(),
                TipoEvento.ENTREGA, "Lista", LocalDate.now().plusDays(3), null,
                autor.getId(), Instant.now());
        evento.excluirLogicamente(Instant.now());
        return eventos.saveAndFlush(evento);
    }

    private Material material(boolean visivel) {
        Material material = new Material(UUID.randomUUID(), turma.getId(), materia.getId(),
                TipoMaterial.AULA, "Slides", "https://ex.dev/slides", autor.getId(), Instant.now());
        material.definirVisibilidadeTurma(visivel);
        return materiais.saveAndFlush(material);
    }

    private UUID notaPessoal(Usuario dono) throws Exception {
        String corpo = http.perform(post("/api/v1/notas")
                        .header("Authorization", bearer(dono))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(
                                Map.of("alcance", "PESSOAL", "data", "2026-10-06", "texto", "rascunho"))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(json.readTree(corpo).get("id").asText());
    }

    private void marcar(Usuario quem, UUID eventoId, int esperado) throws Exception {
        http.perform(put("/api/v1/eventos/" + eventoId + "/estado-pessoal")
                        .header("Authorization", bearer(quem))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"feito\":true}"))
                .andExpect(status().is(esperado));
    }

    private void vincular(Usuario quem, UUID eventoId, UUID materialId, int esperado) throws Exception {
        http.perform(post("/api/v1/eventos/" + eventoId + "/materiais/" + materialId)
                        .header("Authorization", bearer(quem)))
                .andExpect(status().is(esperado));
    }

    @Test
    @DisplayName("B1 — lider pedindo exclusao de nota PESSOAL alheia recebe 404 e nada e gravado")
    void pedirExclusaoDeNotaPessoalAlheia() throws Exception {
        UUID nota = notaPessoal(autor);

        http.perform(post("/api/v1/moderacao/nota/" + nota + "/pedir-exclusao")
                        .header("Authorization", bearer(lider))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"motivo\":\"x\"}"))
                .andExpect(status().isNotFound());

        assertThat(acoes.findByRegistroTipoAndRegistroIdOrderByEmDesc(RegistroTipo.NOTA, nota))
                .as("acao de moderacao sobre rascunho privado e rastro de algo que o lider nao pode ver")
                .isEmpty();
    }

    @Test
    @DisplayName("B1 — aluno moderando ou editando nota PESSOAL alheia recebe 404, nao 403")
    void alunoNaNotaPessoalAlheiaRecebe404() throws Exception {
        UUID nota = notaPessoal(autor);

        // 403 diria "existe, mas voce nao e lider/autor" — e confirmaria a nota.
        http.perform(post("/api/v1/moderacao/nota/" + nota + "/ocultar")
                        .header("Authorization", bearer(outro))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isNotFound());
        http.perform(patch("/api/v1/notas/" + nota)
                        .header("Authorization", bearer(outro))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(
                                Map.of("alcance", "TURMA", "data", "2026-10-06", "texto", "x"))))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("B2 — marcar feito em evento oculto ou excluido: 404 para os outros, 204 para o autor")
    void marcarEmEventoInvisivel() throws Exception {
        Evento oculto = eventoOculto();
        Evento excluido = eventoExcluido();

        marcar(outro, oculto.getId(), 404);
        marcar(outro, excluido.getId(), 404);
        marcar(autor, oculto.getId(), 204);
    }

    @Test
    @DisplayName("B2 — vincular a evento oculto, ou material oculto, responde 404 para os outros")
    void vincularComRegistroInvisivel() throws Exception {
        Evento oculto = eventoOculto();
        Evento visivel = eventos.saveAndFlush(new Evento(UUID.randomUUID(), turma.getId(),
                materia.getId(), TipoEvento.PROVA, "P2", LocalDate.now().plusDays(4), null,
                autor.getId(), Instant.now()));

        vincular(outro, oculto.getId(), material(true).getId(), 404);
        vincular(outro, visivel.getId(), material(false).getId(), 404);
        vincular(autor, oculto.getId(), material(false).getId(), 204);
    }

    @Test
    @DisplayName("B2 — editar evento oculto alheio responde 404, nao 403")
    void editarEventoOcultoAlheio() throws Exception {
        Evento oculto = eventoOculto();

        http.perform(patch("/api/v1/eventos/" + oculto.getId())
                        .header("Authorization", bearer(outro))
                        .header("If-Match", oculto.getVersion())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(Map.of("materiaId", materia.getId().toString(), "tipo", "PROVA",
                                "titulo", "P1", "data", LocalDate.now().plusDays(3).toString()))))
                .andExpect(status().isNotFound());
    }
}
