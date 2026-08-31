package com.projetofans.evento;

import com.fasterxml.jackson.databind.JsonNode;
import com.projetofans.domain.Materia;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.repo.EventoMaterialRepository;
import com.projetofans.support.TesteDeApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * O vinculo N:N e a regra 11 do AGENTS.md: a tela de prova mostra APENAS os
 * materiais vinculados aquele evento.
 *
 * Os dois testes do meio — o positivo e o negativo — sao o par que garante isso.
 * Sozinho, o positivo passaria numa implementacao que devolvesse a materia
 * inteira; e devolver a materia inteira e exatamente o erro que este app existe
 * para nao cometer.
 */
class VinculoMaterialTest extends TesteDeApi {

    @Autowired private EventoMaterialRepository vinculos;

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

    private JsonNode postar(String rota, String bearer, Map<String, Object> pedido) throws Exception {
        MvcResult resultado = http.perform(post(rota)
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(pedido)))
                .andExpect(status().isCreated())
                .andReturn();
        return json.readTree(resultado.getResponse().getContentAsString());
    }

    private UUID novoEvento() throws Exception {
        Map<String, Object> pedido = new HashMap<>();
        pedido.put("materiaId", materia.getId().toString());
        pedido.put("tipo", "PROVA");
        pedido.put("titulo", "Prova 1");
        pedido.put("data", LocalDate.now().plusDays(5).toString());
        pedido.put("hora", null);
        return UUID.fromString(postar("/api/v1/eventos", bearerAutor, pedido).get("id").asText());
    }

    private UUID novoMaterial(String bearer, Materia daMateria, String titulo) throws Exception {
        Map<String, Object> pedido = new HashMap<>();
        pedido.put("materiaId", daMateria.getId().toString());
        pedido.put("tipo", "AULA");
        pedido.put("titulo", titulo);
        pedido.put("url", "https://exemplo.dev/" + UUID.randomUUID());
        return UUID.fromString(postar("/api/v1/materiais", bearer, pedido).get("id").asText());
    }

    private JsonNode detalhe(UUID eventoId) throws Exception {
        MvcResult resultado = http.perform(get("/api/v1/eventos/" + eventoId)
                        .header("Authorization", bearerAutor))
                .andExpect(status().isOk())
                .andReturn();
        return json.readTree(resultado.getResponse().getContentAsString());
    }

    @Test
    @DisplayName("vincula material ao evento")
    void vinculaMaterialAoEvento() throws Exception {
        UUID evento = novoEvento();
        UUID material = novoMaterial(bearerAutor, materia, "Slides aula 3");

        http.perform(post("/api/v1/eventos/" + evento + "/materiais/" + material)
                        .header("Authorization", bearerAutor))
                .andExpect(status().isNoContent());

        assertThat(vinculos.existsByChaveEventoIdAndChaveMaterialId(evento, material)).isTrue();
    }

    @Test
    @DisplayName("buscar evento devolve APENAS os materiais vinculados")
    void buscarEventoDevolveApenasMateriaisVinculados() throws Exception {
        UUID evento = novoEvento();
        UUID vinculado = novoMaterial(bearerAutor, materia, "Slides aula 3");
        novoMaterial(bearerAutor, materia, "Lista extra da materia");

        http.perform(post("/api/v1/eventos/" + evento + "/materiais/" + vinculado)
                        .header("Authorization", bearerAutor))
                .andExpect(status().isNoContent());

        http.perform(get("/api/v1/eventos/" + evento).header("Authorization", bearerAutor))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(evento.toString()))
                .andExpect(jsonPath("$.materiais.length()").value(1))
                .andExpect(jsonPath("$.materiais[0].id").value(vinculado.toString()));
    }

    @Test
    @DisplayName("material da mesma materia, mas nao vinculado, nao aparece no evento")
    void materialNaoVinculadoNaoApareceNoEvento() throws Exception {
        UUID evento = novoEvento();
        UUID solto = novoMaterial(bearerAutor, materia, "Lista extra da materia");

        JsonNode detalhe = detalhe(evento);

        assertThat(detalhe.get("materiais")).isEmpty();
        assertThat(detalhe.get("materiais").toString()).doesNotContain(solto.toString());
    }

    @Test
    @DisplayName("desvincular remove o material do evento")
    void desvincularRemoveDoEvento() throws Exception {
        UUID evento = novoEvento();
        UUID material = novoMaterial(bearerAutor, materia, "Slides aula 3");

        http.perform(post("/api/v1/eventos/" + evento + "/materiais/" + material)
                        .header("Authorization", bearerAutor))
                .andExpect(status().isNoContent());
        http.perform(delete("/api/v1/eventos/" + evento + "/materiais/" + material)
                        .header("Authorization", bearerAutor))
                .andExpect(status().isNoContent());

        assertThat(vinculos.existsByChaveEventoIdAndChaveMaterialId(evento, material)).isFalse();
        assertThat(detalhe(evento).get("materiais")).isEmpty();
    }

    @Test
    @DisplayName("quem nao e autor do evento nao consegue desvincular material dele")
    void naoAutorNaoDesvinculaMaterialDeEventoAlheio() throws Exception {
        // O furo que este teste fecha: ate 2026-08-31 desvincular so checava
        // escopo de turma. Qualquer colega arrancava todos os materiais da prova
        // de outra pessoa, e sumia sem rastro — a linha do vinculo e apagada de
        // verdade, entao nem revisao ficava. Nao-negociavel 10.
        UUID evento = novoEvento();
        UUID material = novoMaterial(bearerAutor, materia, "Slides aula 3");
        http.perform(post("/api/v1/eventos/" + evento + "/materiais/" + material)
                        .header("Authorization", bearerAutor))
                .andExpect(status().isNoContent());

        Usuario intruso = membroDe(turma, "Intruso", PapelMembro.ALUNO);

        http.perform(delete("/api/v1/eventos/" + evento + "/materiais/" + material)
                        .header("Authorization", bearer(intruso)))
                .andExpect(status().isForbidden());

        assertThat(vinculos.existsByChaveEventoIdAndChaveMaterialId(evento, material))
                .as("o vinculo tem de continuar la depois da tentativa")
                .isTrue();
    }

    @Test
    @DisplayName("qualquer membro ainda pode VINCULAR material — a assimetria e deliberada")
    void qualquerMembroVinculaMaterial() throws Exception {
        // Contrapeso do teste acima: juntar material na prova de alguem e o
        // espirito do app (qualquer membro posta) e nao pode ser barrado junto.
        UUID evento = novoEvento();
        Usuario colega = membroDe(turma, "Colega", PapelMembro.ALUNO);
        UUID material = novoMaterial(bearer(colega), materia, "Foto do quadro");

        http.perform(post("/api/v1/eventos/" + evento + "/materiais/" + material)
                        .header("Authorization", bearer(colega)))
                .andExpect(status().isNoContent());

        assertThat(vinculos.existsByChaveEventoIdAndChaveMaterialId(evento, material)).isTrue();
    }

    @Test
    @DisplayName("vincular material de outra turma devolve 404")
    void vincularMaterialDeOutraTurmaDevolve404() throws Exception {
        UUID evento = novoEvento();
        Turma outraTurma = novaTurma();
        Materia outraMateria = novaMateria(outraTurma);
        String forasteiro = bearer(membroDe(outraTurma, "Forasteiro", PapelMembro.ALUNO));
        UUID materialAlheio = novoMaterial(forasteiro, outraMateria, "Material de outra turma");

        http.perform(post("/api/v1/eventos/" + evento + "/materiais/" + materialAlheio)
                        .header("Authorization", bearerAutor))
                .andExpect(status().isNotFound());

        assertThat(vinculos.existsByChaveEventoIdAndChaveMaterialId(evento, materialAlheio)).isFalse();
    }

    @Test
    @DisplayName("vincular duas vezes e idempotente, nao estoura PK duplicada")
    void vincularDuasVezesEIdempotente() throws Exception {
        UUID evento = novoEvento();
        UUID material = novoMaterial(bearerAutor, materia, "Slides aula 3");
        String rota = "/api/v1/eventos/" + evento + "/materiais/" + material;

        http.perform(post(rota).header("Authorization", bearerAutor))
                .andExpect(status().isNoContent());
        http.perform(post(rota).header("Authorization", bearerAutor))
                .andExpect(status().isNoContent());

        assertThat(vinculos.countByChaveEventoId(evento)).isEqualTo(1);
        assertThat(detalhe(evento).get("materiais")).hasSize(1);
    }
}
