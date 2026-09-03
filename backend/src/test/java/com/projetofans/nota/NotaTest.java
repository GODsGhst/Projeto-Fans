package com.projetofans.nota;

import com.fasterxml.jackson.databind.JsonNode;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.support.TesteDeApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Anotacoes, com foco no que nao pode falhar: a nota PESSOAL nao sai para
 * ninguem alem de quem escreveu.
 *
 * O resto (autor-only, If-Match, exclusao logica) e o mesmo contrato ja coberto
 * para evento e material; aqui os casos existem para provar que a entidade nova
 * respeita o mesmo contrato, e nao para reprovar o contrato.
 */
class NotaTest extends TesteDeApi {

    private Turma turma;
    private Usuario eu;
    private Usuario colega;

    @BeforeEach
    void cenario() {
        turma = novaTurma();
        eu = membroDe(turma, "Eu", PapelMembro.LIDER);
        colega = membroDe(turma, "Colega", PapelMembro.ALUNO);
    }

    private String criar(Usuario autor, String alcance, String data, String texto) throws Exception {
        String corpo = http.perform(post("/api/v1/notas")
                        .header("Authorization", bearer(autor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(
                                Map.of("alcance", alcance, "data", data, "texto", texto))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(corpo).get("id").asText();
    }

    private JsonNode listar(Usuario quem) throws Exception {
        String corpo = http.perform(get("/api/v1/notas")
                        .param("de", "2026-09-01").param("ate", "2026-09-30")
                        .header("Authorization", bearer(quem)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(corpo);
    }

    @Test
    @DisplayName("a nota PESSOAL do colega NAO aparece para mim")
    void pessoalNaoVaza() throws Exception {
        criar(colega, "PESSOAL", "2026-09-10", "senha do wifi do lab");
        criar(colega, "TURMA", "2026-09-10", "aula cancelada quinta");

        JsonNode minhas = listar(eu);

        assertThat(minhas).hasSize(1);
        assertThat(minhas.get(0).get("texto").asText()).isEqualTo("aula cancelada quinta");
        assertThat(minhas.toString()).doesNotContain("senha do wifi");
    }

    @Test
    @DisplayName("a minha PESSOAL aparece para mim, junto com as da turma")
    void aMinhaPessoalApareceParaMim() throws Exception {
        criar(eu, "PESSOAL", "2026-09-11", "estudar cap 4");
        criar(colega, "TURMA", "2026-09-12", "prova adiada");

        assertThat(listar(eu)).hasSize(2);
        // E o colega ve so a dele: a minha pessoal nao atravessa.
        assertThat(listar(colega)).hasSize(1);
    }

    @Test
    @DisplayName("quem esta fora da turma nao ve nada dela")
    void outraTurmaNaoVe() throws Exception {
        criar(eu, "TURMA", "2026-09-13", "recado da turma");
        Usuario estranho = membroDe(novaTurma(), "Estranho", PapelMembro.LIDER);

        assertThat(listar(estranho)).isEmpty();
    }

    @Test
    @DisplayName("a nota da turma vem assinada; a pessoal, nao")
    void assinatura() throws Exception {
        criar(colega, "TURMA", "2026-09-14", "recado");
        criar(eu, "PESSOAL", "2026-09-14", "meu rascunho");

        JsonNode notas = listar(eu);
        boolean primeiraEhDaTurma = notas.get(0).get("alcance").asText().equals("TURMA");
        JsonNode daTurma = primeiraEhDaTurma ? notas.get(0) : notas.get(1);
        JsonNode minha = primeiraEhDaTurma ? notas.get(1) : notas.get(0);

        assertThat(daTurma.get("autorNome").asText()).isEqualTo("Colega");
        // `has`, e nao `isNull`: o Jackson do projeto omite campo nulo, entao o
        // autorNome nem chega no JSON. Assinar o proprio rascunho com o proprio
        // nome e ruido.
        assertThat(minha.has("autorNome")).isFalse();
    }

    @Test
    @DisplayName("so o autor edita — e o alcance pode mudar")
    void editar() throws Exception {
        String id = criar(eu, "PESSOAL", "2026-09-15", "rascunho");

        http.perform(patch("/api/v1/notas/" + id)
                        .header("Authorization", bearer(colega))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "alcance", "TURMA", "data", "2026-09-15", "texto", "sequestrado"))))
                .andExpect(status().isForbidden());

        // O erro que mais acontece: escrever como rascunho e perceber que era
        // recado. Sem poder trocar o alcance, a saida seria apagar e reescrever.
        http.perform(patch("/api/v1/notas/" + id)
                        .header("Authorization", bearer(eu))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "alcance", "TURMA", "data", "2026-09-15", "texto", "virou recado"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.alcance").value("TURMA"))
                .andExpect(jsonPath("$.autorNome").value("Eu"));

        assertThat(listar(colega)).hasSize(1);
    }

    @Test
    @DisplayName("PATCH sem If-Match e 428, e com versao velha e 409")
    void concorrencia() throws Exception {
        String id = criar(eu, "TURMA", "2026-09-16", "texto");
        String corpo = json.writeValueAsString(Map.of(
                "alcance", "TURMA", "data", "2026-09-16", "texto", "outro"));

        http.perform(patch("/api/v1/notas/" + id)
                        .header("Authorization", bearer(eu))
                        .contentType(MediaType.APPLICATION_JSON).content(corpo))
                .andExpect(status().isPreconditionRequired());

        http.perform(patch("/api/v1/notas/" + id)
                        .header("Authorization", bearer(eu)).header("If-Match", "7")
                        .contentType(MediaType.APPLICATION_JSON).content(corpo))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("apagada some da lista")
    void apagar() throws Exception {
        String id = criar(eu, "TURMA", "2026-09-17", "some");

        http.perform(delete("/api/v1/notas/" + id)
                        .header("Authorization", bearer(eu)).header("If-Match", "0"))
                .andExpect(status().isNoContent());

        assertThat(listar(eu)).isEmpty();
    }

    @Test
    @DisplayName("texto em branco e recusado antes de chegar ao banco")
    void textoEmBranco() throws Exception {
        http.perform(post("/api/v1/notas")
                        .header("Authorization", bearer(eu))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "alcance", "TURMA", "data", "2026-09-18", "texto", "   "))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("alcance e obrigatorio: nao ha padrao entre todos leem e so eu leio")
    void alcanceObrigatorio() throws Exception {
        http.perform(post("/api/v1/notas")
                        .header("Authorization", bearer(eu))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "data", "2026-09-19", "texto", "sem alcance"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("fora da janela nao vem")
    void janela() throws Exception {
        criar(eu, "TURMA", "2026-10-05", "mes que vem");

        assertThat(listar(eu)).isEmpty();
    }
}
