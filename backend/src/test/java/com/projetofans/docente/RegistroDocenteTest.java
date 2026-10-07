package com.projetofans.docente;

import com.fasterxml.jackson.databind.JsonNode;
import com.projetofans.domain.DocenteStatus;
import com.projetofans.domain.TipoConta;
import com.projetofans.domain.Usuario;
import com.projetofans.support.TesteDeApi;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * PC2 (parte do registro) — P1 pela API: o tipo da conta e escolhido UMA vez, no
 * cadastro, e docente nasce PENDENTE. O que protege o produto aqui e que declarar-se
 * professor NAO da poder: so o admin aprova (AdminDocentesTest). O Google continua
 * criando ALUNO (spec 8): o token dele prova o e-mail, nao o que a pessoa leciona.
 */
class RegistroDocenteTest extends TesteDeApi {

    @Autowired private EntityManager em;

    private MvcResult registrar(TipoConta tipo) throws Exception {
        Map<String, Object> pedido = new HashMap<>(Map.of(
                "nome", "Fulano", "email", "r-" + UUID.randomUUID() + "@ex.dev", "senha", "senha-boa-123"));
        if (tipo != null) {
            pedido.put("tipoConta", tipo.name());
        }
        return http.perform(post("/api/v1/auth/registrar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(pedido)))
                .andReturn();
    }

    private JsonNode corpoDe(MvcResult r) throws Exception {
        return json.readTree(r.getResponse().getContentAsString());
    }

    private Usuario gravado(MvcResult r) throws Exception {
        em.flush();
        em.clear();   // flush antes: o save() do service so vira SQL ai
        return usuarios.findById(UUID.fromString(corpoDe(r).get("usuario").get("id").asText())).orElseThrow();
    }

    @Test
    @DisplayName("P1 — sem tipoConta a conta e ALUNO, sem status (o app de aluno nao muda)")
    void semTipoEAluno() throws Exception {
        MvcResult r = registrar(null);

        assertThat(r.getResponse().getStatus()).isEqualTo(200);
        JsonNode usuario = corpoDe(r).get("usuario");
        assertThat(usuario.get("tipoConta").asText()).isEqualTo("ALUNO");
        assertThat(usuario.has("docenteStatus")).as("aluno nao tem status; jackson omite o nulo").isFalse();
        Usuario salvo = gravado(r);
        assertThat(salvo.getTipoConta()).isEqualTo(TipoConta.ALUNO);
        assertThat(salvo.getDocenteStatus()).isNull();
    }

    @Test
    @DisplayName("P1 — tipoConta=ALUNO explicito e igual a omitir")
    void alunoExplicito() throws Exception {
        MvcResult r = registrar(TipoConta.ALUNO);

        Usuario salvo = gravado(r);
        assertThat(salvo.getTipoConta()).isEqualTo(TipoConta.ALUNO);
        assertThat(salvo.getDocenteStatus()).isNull();
    }

    @ParameterizedTest
    @EnumSource(value = TipoConta.class, names = {"PROFESSOR", "COORDENADOR"})
    @DisplayName("P1 — professor ou coordenador nasce PENDENTE, sem decisao registrada, e nao e admin")
    void docenteNasceComTipoEPendente(TipoConta tipo) throws Exception {
        MvcResult r = registrar(tipo);

        assertThat(r.getResponse().getStatus()).isEqualTo(200);
        JsonNode usuario = corpoDe(r).get("usuario");
        assertThat(usuario.get("tipoConta").asText()).isEqualTo(tipo.name());
        assertThat(usuario.get("docenteStatus").asText()).isEqualTo("PENDENTE");
        Usuario salvo = gravado(r);
        assertThat(salvo.getTipoConta()).isEqualTo(tipo);
        assertThat(salvo.getDocenteStatus()).isEqualTo(DocenteStatus.PENDENTE);
        assertThat(salvo.getDocenteDecididoPor()).isNull();
        assertThat(salvo.getDocenteDecididoEm()).isNull();
        assertThat(salvo.isAdminPlataforma()).isFalse();
    }

    @Test
    @DisplayName("tipoConta fora da lista -> 400 e nenhuma conta criada")
    void tipoForaDaListaDa400() throws Exception {
        String email = "x-" + UUID.randomUUID() + "@ex.dev";

        http.perform(post("/api/v1/auth/registrar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(Map.of("nome", "Fulano", "email", email,
                                "senha", "senha-boa-123", "tipoConta", "DIRETOR"))))
                .andExpect(status().isBadRequest());

        assertThat(usuarios.findByEmail(email)).isEmpty();
    }

    @Test
    @DisplayName("GET /eu devolve tipoConta e docenteStatus (aluno sem status)")
    void perfilTrazTipoEStatus() throws Exception {
        String jwtDocente = corpoDe(registrar(TipoConta.PROFESSOR)).get("jwt").asText();
        String jwtAluno = corpoDe(registrar(null)).get("jwt").asText();

        JsonNode docente = json.readTree(http.perform(
                        get("/api/v1/eu").header("Authorization", "Bearer " + jwtDocente))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        JsonNode aluno = json.readTree(http.perform(
                        get("/api/v1/eu").header("Authorization", "Bearer " + jwtAluno))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());

        assertThat(docente.get("tipoConta").asText()).isEqualTo("PROFESSOR");
        assertThat(docente.get("docenteStatus").asText()).isEqualTo("PENDENTE");
        assertThat(aluno.get("tipoConta").asText()).isEqualTo("ALUNO");
        assertThat(aluno.has("docenteStatus")).isFalse();
    }

    @Test
    @DisplayName("spec 8 — a primeira entrada pelo Google cria ALUNO, sem status")
    void googleCriaAluno() throws Exception {
        String sub = "google-sub-" + UUID.randomUUID();

        JsonNode usuario = json.readTree(http.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(Map.of("idToken", sub))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("usuario");

        assertThat(usuario.get("tipoConta").asText()).isEqualTo("ALUNO");
        assertThat(usuario.has("docenteStatus")).isFalse();
        em.flush();
        em.clear();   // flush antes: o save() do service so vira SQL ai
        Usuario salvo = usuarios.findByGoogleSub(sub).orElseThrow();
        assertThat(salvo.getTipoConta()).isEqualTo(TipoConta.ALUNO);
        assertThat(salvo.getDocenteStatus()).isNull();
    }
}
