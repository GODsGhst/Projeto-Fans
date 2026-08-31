package com.projetofans.material;

import com.fasterxml.jackson.databind.JsonNode;
import com.projetofans.domain.Material;
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

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Material segue exatamente as mesmas regras de evento: autor-only, If-Match,
 * exclusao logica e revisao com snapshot anterior. Os testes sao os equivalentes
 * porque as regras sao as mesmas — se um dia divergirem, e bug, nao feature.
 *
 * O ultimo teste marca uma fronteira do MVP: `url` e obrigatoria e `arquivo_ref`
 * fica sempre nulo. Upload e a Task 15.
 */
class MaterialCrudTest extends TesteDeApi {

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

    private Map<String, Object> pedidoDeMaterial() {
        Map<String, Object> pedido = new HashMap<>();
        pedido.put("materiaId", materia.getId().toString());
        pedido.put("tipo", "AULA");
        pedido.put("titulo", "Slides aula 3");
        pedido.put("url", "https://exemplo.dev/slides-3");
        return pedido;
    }

    private JsonNode materialCriado() throws Exception {
        MvcResult resultado = http.perform(post("/api/v1/materiais")
                        .header("Authorization", bearerAutor)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(pedidoDeMaterial())))
                .andExpect(status().isCreated())
                .andReturn();
        return json.readTree(resultado.getResponse().getContentAsString());
    }

    @Test
    @DisplayName("qualquer aluno cria material e ele ja nasce visivel, sem aprovacao")
    void alunoQualquerCriaMaterialSemAprovacao() throws Exception {
        JsonNode criado = materialCriado();

        assertThat(criado.get("id").asText()).isNotBlank();
        assertThat(criado.get("visivelTurma").asBoolean()).isTrue();
        assertThat(criado.has("status")).isFalse();
        assertThat(criado.has("pendente")).isFalse();
    }

    @Test
    @DisplayName("toda resposta de material traz autor, nome do autor e criadoEm")
    void respostaDeMaterialSempreTrazAutorECriadoEm() throws Exception {
        JsonNode criado = materialCriado();

        assertThat(criado.get("autoria").get("autorId").asText()).isEqualTo(autor.getId().toString());
        assertThat(criado.get("autoria").get("autorNome").asText()).isEqualTo("Autor");
        assertThat(criado.get("autoria").get("criadoEm").asText()).isNotBlank();
    }

    @Test
    @DisplayName("o autor atualiza material com a version correta e a revisao guarda o anterior")
    void autorAtualizaMaterialComVersionCorreta() throws Exception {
        JsonNode criado = materialCriado();
        UUID id = UUID.fromString(criado.get("id").asText());
        Map<String, Object> mudanca = pedidoDeMaterial();
        mudanca.put("titulo", "Slides aula 3 (corrigidos)");

        http.perform(patch("/api/v1/materiais/" + id)
                        .header("Authorization", bearerAutor)
                        .header("If-Match", criado.get("version").asInt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(mudanca)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.titulo").value("Slides aula 3 (corrigidos)"))
                .andExpect(jsonPath("$.version").value(criado.get("version").asInt() + 1));

        List<Revisao> historico =
                revisoes.findByRegistroTipoAndRegistroIdOrderByEmDesc(RegistroTipo.MATERIAL, id);
        assertThat(historico).hasSize(1);
        assertThat(historico.get(0).getSnapshot())
                .contains("Slides aula 3").doesNotContain("corrigidos");
    }

    @Test
    @DisplayName("quem nao e o autor recebe 403 ao atualizar material, inclusive o lider")
    void naoAutorRecebe403AoAtualizarMaterial() throws Exception {
        JsonNode criado = materialCriado();
        String lider = bearer(membroDe(turma, "Lider", PapelMembro.LIDER));

        http.perform(patch("/api/v1/materiais/" + criado.get("id").asText())
                        .header("Authorization", lider)
                        .header("If-Match", criado.get("version").asInt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(pedidoDeMaterial())))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("PATCH de material sem If-Match recebe 428 e com version divergente 409")
    void patchDeMaterialSemIfMatchRecebe428EDivergenteRecebe409() throws Exception {
        JsonNode criado = materialCriado();
        String rota = "/api/v1/materiais/" + criado.get("id").asText();

        http.perform(patch(rota)
                        .header("Authorization", bearerAutor)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(pedidoDeMaterial())))
                .andExpect(status().isPreconditionRequired());

        http.perform(patch(rota)
                        .header("Authorization", bearerAutor)
                        .header("If-Match", criado.get("version").asInt() + 7)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(pedidoDeMaterial())))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("excluir material marca excluido_em e nao remove a linha do banco")
    void excluirMaterialNaoRemoveLinhaDoBanco() throws Exception {
        JsonNode criado = materialCriado();
        UUID id = UUID.fromString(criado.get("id").asText());

        http.perform(delete("/api/v1/materiais/" + id)
                        .header("Authorization", bearerAutor)
                        .header("If-Match", criado.get("version").asInt()))
                .andExpect(status().isNoContent());

        Material apagado = materiais.findById(id).orElseThrow();
        assertThat(apagado.getExcluidoEm()).isNotNull();
        assertThat(apagado.getTitulo()).isEqualTo("Slides aula 3");
    }

    @Test
    @DisplayName("material de outra turma responde 404, nunca 403")
    void materialDeOutraTurmaRecebe404() throws Exception {
        JsonNode criado = materialCriado();
        String forasteiro = bearer(membroDe(novaTurma(), "Forasteiro", PapelMembro.ALUNO));

        http.perform(patch("/api/v1/materiais/" + criado.get("id").asText())
                        .header("Authorization", forasteiro)
                        .header("If-Match", criado.get("version").asInt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(pedidoDeMaterial())))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("url e obrigatoria no MVP e arquivo_ref nunca e preenchido")
    void urlEObrigatoriaEArquivoRefFicaNulo() throws Exception {
        Map<String, Object> semUrl = pedidoDeMaterial();
        semUrl.put("url", null);

        http.perform(post("/api/v1/materiais")
                        .header("Authorization", bearerAutor)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(semUrl)))
                .andExpect(status().isBadRequest());

        JsonNode criado = materialCriado();
        assertThat(criado.hasNonNull("arquivoRef")).isFalse();
        assertThat(materiais.findById(UUID.fromString(criado.get("id").asText())).orElseThrow()
                .getArquivoRef()).isNull();
    }
}
