package com.projetofans.evento;

import com.fasterxml.jackson.databind.JsonNode;
import com.projetofans.domain.Evento;
import com.projetofans.domain.Materia;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.RegistroTipo;
import com.projetofans.domain.Revisao;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.support.TesteDeApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Onze testes, um por assercao da Secao 7 do spec que a Task 4 cobre.
 *
 * O que este arquivo protege, em ordem de importancia:
 *
 *  - postar e livre (R10): nenhum status pendente, nenhuma fila;
 *  - o lider NAO edita conteudo alheio (R11) — ele so muda visibilidade, e isso
 *    e a Task 7. O quinto teste e o que impede o lider de virar editor;
 *  - editar nao apaga historico (R2);
 *  - excluir nunca remove linha (regra 2 do handoff);
 *  - registro de outra turma some, nao da 403 (R17).
 */
class EventoCrudTest extends TesteDeApi {

    private Turma turma;
    private Materia materia;
    private Usuario autor;
    private String bearerAutor;

    @BeforeEach
    void cenario() {
        turma = novaTurma();
        materia = novaMateria(turma);
        autor = membroDe(turma, "Autor", PapelMembro.ALUNO);
        bearerAutor = bearer(autor);
    }

    private Map<String, Object> pedidoDeEvento() {
        Map<String, Object> pedido = new HashMap<>();
        pedido.put("materiaId", materia.getId().toString());
        pedido.put("tipo", "PROVA");
        pedido.put("titulo", "Prova 1");
        pedido.put("data", LocalDate.now().plusDays(3).toString());
        pedido.put("hora", "14:00:00");
        return pedido;
    }

    private JsonNode criar(String bearer, Map<String, Object> pedido) throws Exception {
        MvcResult resultado = http.perform(post("/api/v1/eventos")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(pedido)))
                .andExpect(status().isCreated())
                .andReturn();
        return json.readTree(resultado.getResponse().getContentAsString());
    }

    private JsonNode eventoCriado() throws Exception {
        return criar(bearerAutor, pedidoDeEvento());
    }

    @Test
    @DisplayName("qualquer aluno cria evento e ele ja nasce visivel, sem aprovacao")
    void alunoQualquerCriaEventoSemAprovacao() throws Exception {
        JsonNode criado = eventoCriado();

        assertThat(criado.get("id").asText()).isNotBlank();
        assertThat(criado.get("visivelTurma").asBoolean()).isTrue();
        // Nenhum campo de fila/aprovacao pode existir na resposta: postar e livre.
        assertThat(criado.has("status")).isFalse();
        assertThat(criado.has("pendente")).isFalse();
        assertThat(criado.has("aprovado")).isFalse();
    }

    @Test
    @DisplayName("toda resposta de evento traz autor, nome do autor e criadoEm")
    void respostaSempreTrazAutorECriadoEm() throws Exception {
        JsonNode criado = eventoCriado();

        assertThat(criado.get("autoria").get("autorId").asText()).isEqualTo(autor.getId().toString());
        assertThat(criado.get("autoria").get("autorNome").asText()).isEqualTo("Autor");
        assertThat(criado.get("autoria").get("criadoEm").asText()).isNotBlank();
        assertThat(criado.get("autoria").get("atualizadoEm").asText()).isNotBlank();
    }

    @Test
    @DisplayName("o autor atualiza com a version correta e recebe 200 com a version nova")
    void autorAtualizaComVersionCorreta() throws Exception {
        JsonNode criado = eventoCriado();
        Map<String, Object> mudanca = pedidoDeEvento();
        mudanca.put("titulo", "Prova 1 - adiada");

        http.perform(patch("/api/v1/eventos/" + criado.get("id").asText())
                        .header("Authorization", bearerAutor)
                        .header("If-Match", criado.get("version").asInt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(mudanca)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.titulo").value("Prova 1 - adiada"))
                .andExpect(jsonPath("$.version").value(criado.get("version").asInt() + 1));
    }

    @Test
    @DisplayName("quem nao e o autor recebe 403 ao tentar atualizar")
    void naoAutorRecebe403AoAtualizar() throws Exception {
        JsonNode criado = eventoCriado();
        String outro = bearer(membroDe(turma, "Outro", PapelMembro.ALUNO));

        http.perform(patch("/api/v1/eventos/" + criado.get("id").asText())
                        .header("Authorization", outro)
                        .header("If-Match", criado.get("version").asInt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(pedidoDeEvento())))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("nem o lider edita conteudo alheio: 403 tambem para ele")
    void liderTambemRecebe403AoEditarEventoAlheio() throws Exception {
        JsonNode criado = eventoCriado();
        String lider = bearer(membroDe(turma, "Lider", PapelMembro.LIDER));
        Map<String, Object> mudanca = pedidoDeEvento();
        mudanca.put("titulo", "titulo do lider");

        http.perform(patch("/api/v1/eventos/" + criado.get("id").asText())
                        .header("Authorization", lider)
                        .header("If-Match", criado.get("version").asInt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(mudanca)))
                .andExpect(status().isForbidden());

        http.perform(delete("/api/v1/eventos/" + criado.get("id").asText())
                        .header("Authorization", lider)
                        .header("If-Match", criado.get("version").asInt()))
                .andExpect(status().isForbidden());

        Evento intacto = eventos.findById(UUID.fromString(criado.get("id").asText())).orElseThrow();
        assertThat(intacto.getTitulo()).isEqualTo("Prova 1");
    }

    @Test
    @DisplayName("PATCH sem If-Match recebe 428, nunca sobrescreve em silencio")
    void patchSemIfMatchRecebe428() throws Exception {
        JsonNode criado = eventoCriado();

        http.perform(patch("/api/v1/eventos/" + criado.get("id").asText())
                        .header("Authorization", bearerAutor)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(pedidoDeEvento())))
                .andExpect(status().isPreconditionRequired());
    }

    @Test
    @DisplayName("PATCH com version divergente recebe 409")
    void patchComVersionDivergenteRecebe409() throws Exception {
        JsonNode criado = eventoCriado();

        http.perform(patch("/api/v1/eventos/" + criado.get("id").asText())
                        .header("Authorization", bearerAutor)
                        .header("If-Match", criado.get("version").asInt() + 7)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(pedidoDeEvento())))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("evento de outra turma responde 404, nunca 403")
    void eventoDeOutraTurmaRecebe404() throws Exception {
        JsonNode criado = eventoCriado();
        String forasteiro = bearer(membroDe(novaTurma(), "Forasteiro", PapelMembro.ALUNO));
        String rota = "/api/v1/eventos/" + criado.get("id").asText();

        http.perform(get(rota).header("Authorization", forasteiro))
                .andExpect(status().isNotFound());

        http.perform(patch(rota)
                        .header("Authorization", forasteiro)
                        .header("If-Match", criado.get("version").asInt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(pedidoDeEvento())))
                .andExpect(status().isNotFound());

        http.perform(delete(rota)
                        .header("Authorization", forasteiro)
                        .header("If-Match", criado.get("version").asInt()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("excluir marca excluido_em e nao remove a linha do banco")
    void excluirNaoRemoveLinhaDoBanco() throws Exception {
        JsonNode criado = eventoCriado();
        UUID id = UUID.fromString(criado.get("id").asText());

        http.perform(delete("/api/v1/eventos/" + id)
                        .header("Authorization", bearerAutor)
                        .header("If-Match", criado.get("version").asInt()))
                .andExpect(status().isNoContent());

        Evento apagado = eventos.findById(id).orElseThrow();
        assertThat(apagado.getExcluidoEm()).isNotNull();
        assertThat(apagado.getTitulo()).isEqualTo("Prova 1");
    }

    @Test
    @DisplayName("evento excluido some pelo id direto para quem nao e o autor, e continua para o autor")
    void eventoExcluidoSoRespondeParaOAutor() throws Exception {
        // O furo que este teste fecha: ate 2026-08-31 GET /eventos/{id} checava
        // turma mas nao visibilidade. O lider ocultava, ou o autor excluia, e
        // qualquer colega que soubesse o id continuava lendo o registro inteiro —
        // e os ids ja estao em todo aparelho que sincronizou (snapshot local).
        // Secao 6.5 do handoff: "visivel apenas para o autor", sem restringir a
        // listas. 404 e nao 403, senao a moderacao vazaria pelo status.
        JsonNode criado = eventoCriado();
        UUID id = UUID.fromString(criado.get("id").asText());
        Usuario colega = membroDe(turma, "Colega", PapelMembro.ALUNO);

        http.perform(get("/api/v1/eventos/" + id).header("Authorization", bearer(colega)))
                .andExpect(status().isOk());

        http.perform(delete("/api/v1/eventos/" + id)
                        .header("Authorization", bearerAutor)
                        .header("If-Match", criado.get("version").asInt()))
                .andExpect(status().isNoContent());

        http.perform(get("/api/v1/eventos/" + id).header("Authorization", bearer(colega)))
                .andExpect(status().isNotFound());

        http.perform(get("/api/v1/eventos/" + id).header("Authorization", bearerAutor))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("editar grava revisao com o snapshot ANTERIOR a mudanca")
    void editarGravaRevisaoComSnapshotAnterior() throws Exception {
        JsonNode criado = eventoCriado();
        UUID id = UUID.fromString(criado.get("id").asText());
        Map<String, Object> mudanca = pedidoDeEvento();
        mudanca.put("titulo", "titulo novo");

        http.perform(patch("/api/v1/eventos/" + id)
                        .header("Authorization", bearerAutor)
                        .header("If-Match", criado.get("version").asInt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(mudanca)))
                .andExpect(status().isOk());

        List<Revisao> historico =
                revisoes.findByRegistroTipoAndRegistroIdOrderByEmDesc(RegistroTipo.EVENTO, id);
        assertThat(historico).hasSize(1);
        assertThat(historico.get(0).getAutorId()).isEqualTo(autor.getId());
        // O snapshot guarda o que HAVIA antes, nao o que passou a haver.
        assertThat(historico.get(0).getSnapshot()).contains("Prova 1").doesNotContain("titulo novo");
    }

    @Test
    @DisplayName("hora e opcional: criar sem hora funciona e a resposta nao inventa horario")
    void horaOpcionalAceitaNulo() throws Exception {
        Map<String, Object> semHora = pedidoDeEvento();
        semHora.put("hora", null);

        JsonNode criado = criar(bearerAutor, semHora);

        // default-property-inclusion=non_null: campo nulo simplesmente nao aparece.
        assertThat(criado.hasNonNull("hora")).isFalse();
        assertThat(eventos.findById(UUID.fromString(criado.get("id").asText())).orElseThrow()
                .getHoraEvento()).isNull();
    }

    @Test
    @DisplayName("editar grava a sala — PATCH nao pode ignorar campo em silencio")
    void editarPreservaASala() throws Exception {
        // Perda silenciosa de dado, encontrada rodando contra o servidor de
        // verdade: `Evento.editar` foi escrito antes de a coluna `sala` existir,
        // e quando ela chegou so o caminho de CRIAR foi ligado. Editar o titulo
        // de uma prova apagava a sala dela, sem erro nenhum — o pior tipo de
        // defeito, porque a resposta e 200 e quem editou nao tem como saber.
        // Criar SEM sala e editar COM ela: este e o caminho que expoe o defeito.
        // Criar com A-101 e editar mantendo A-101 passaria por acidente, porque
        // `editar` simplesmente nao toca no campo — o valor antigo sobrevive e o
        // teste aplaude o bug.
        JsonNode criado = criar(bearerAutor, pedidoDeEvento());

        Map<String, Object> edicao = pedidoDeEvento();
        edicao.put("titulo", "Prova 1 — corrigida");
        edicao.put("sala", "A-101");

        MvcResult r = http.perform(patch("/api/v1/eventos/" + criado.get("id").asText())
                        .header("Authorization", bearerAutor)
                        .header("If-Match", criado.get("version").asText())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(edicao)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode depois = json.readTree(r.getResponse().getContentAsString());

        assertThat(depois.get("titulo").asText()).isEqualTo("Prova 1 — corrigida");
        assertThat(depois.get("sala"))
                .as("a sala foi enviada na edicao e o servidor a ignorou")
                .isNotNull();
        assertThat(depois.get("sala").asText()).isEqualTo("A-101");
    }

    @Test
    @DisplayName("editar sem sala LIMPA a sala — PATCH substitui, nao mescla")
    void editarSemSalaLimpaASala() throws Exception {
        // O outro lado da mesma regra, e ele tambem precisa de teste: PATCH aqui
        // SUBSTITUI o objeto inteiro (A13). Campo ausente vira nulo de proposito
        // — e assim que se tira a sala de excecao de uma prova que mudou de volta
        // para a sala de sempre.
        Map<String, Object> pedido = pedidoDeEvento();
        pedido.put("sala", "A-101");
        JsonNode criado = criar(bearerAutor, pedido);

        MvcResult r = http.perform(patch("/api/v1/eventos/" + criado.get("id").asText())
                        .header("Authorization", bearerAutor)
                        .header("If-Match", criado.get("version").asText())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(pedidoDeEvento())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode depois = json.readTree(r.getResponse().getContentAsString());

        assertThat(depois.get("sala") == null || depois.get("sala").isNull())
                .as("sem sala no corpo, a prova volta para a sala da materia")
                .isTrue();
    }
}
