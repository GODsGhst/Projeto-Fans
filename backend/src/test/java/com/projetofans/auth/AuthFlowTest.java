package com.projetofans.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.repo.MembroRepository;
import com.projetofans.repo.TurmaRepository;
import com.projetofans.repo.UsuarioRepository;
import com.projetofans.support.TesteComPostgres;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Os dois caminhos de identidade (senha e Google) e a entrada na turma.
 *
 * Nenhuma credencial real e usada: o Google entra pelo FakeGoogleTokenVerifier e o
 * e-mail de reset cai no LogEmailSender. Nao ha conta a provisionar para rodar isto.
 *
 * O teste do "esqueci a senha" e requisito de seguranca, nao cortesia: resposta
 * diferente para e-mail existente e inexistente transformaria o endpoint num
 * enumerador da lista de quem tem conta no app.
 */
@Transactional
@AutoConfigureMockMvc
class AuthFlowTest extends TesteComPostgres {

    @Autowired private MockMvc http;
    @Autowired private ObjectMapper json;
    @Autowired private UsuarioRepository usuarios;
    @Autowired private TurmaRepository turmas;
    @Autowired private MembroRepository membros;

    private String email() {
        return "u-" + UUID.randomUUID() + "@ex.dev";
    }

    private MvcResult postJson(String rota, Map<String, Object> corpo) throws Exception {
        return http.perform(post(rota)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(corpo)))
                .andReturn();
    }

    private JsonNode corpoDe(MvcResult resultado) throws Exception {
        return json.readTree(resultado.getResponse().getContentAsString());
    }

    private String registra(String email, String senha) throws Exception {
        MvcResult resultado = postJson("/api/v1/auth/registrar",
                Map.of("nome", "Fulano", "email", email, "senha", senha));
        assertThat(resultado.getResponse().getStatus()).isEqualTo(200);
        return corpoDe(resultado).get("jwt").asText();
    }

    @Test
    @DisplayName("registrar com e-mail e senha devolve JWT e o usuario criado")
    void registraComEmailESenhaEDevolveJwt() throws Exception {
        String email = email();

        http.perform(post("/api/v1/auth/registrar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(
                                Map.of("nome", "Fulano", "email", email, "senha", "senha-boa-123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jwt").isNotEmpty())
                .andExpect(jsonPath("$.usuario.email").value(email))
                .andExpect(jsonPath("$.usuario.nome").value("Fulano"))
                .andExpect(jsonPath("$.usuario.senhaHash").doesNotExist());

        Usuario criado = usuarios.findByEmail(email).orElseThrow();
        assertThat(criado.getSenhaHash()).isNotBlank().isNotEqualTo("senha-boa-123");
    }

    @Test
    @DisplayName("login com a senha correta devolve JWT")
    void loginComSenhaCorretaDevolveJwt() throws Exception {
        String email = email();
        registra(email, "senha-boa-123");

        http.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("email", email, "senha", "senha-boa-123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jwt").isNotEmpty())
                .andExpect(jsonPath("$.usuario.email").value(email));
    }

    @Test
    @DisplayName("login com a senha errada devolve 401")
    void loginComSenhaErradaDevolve401() throws Exception {
        String email = email();
        registra(email, "senha-boa-123");

        http.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("email", email, "senha", "senha-errada"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("registrar com e-mail ja usado devolve 409")
    void registrarComEmailJaUsadoDevolve409() throws Exception {
        String email = email();
        registra(email, "senha-boa-123");

        http.perform(post("/api/v1/auth/registrar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(
                                Map.of("nome", "Outro", "email", email, "senha", "outra-senha-123"))))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("login por Google cria o usuario na primeira vez")
    void loginPorGoogleCriaUsuarioNaPrimeiraVez() throws Exception {
        String sub = "google-sub-" + UUID.randomUUID();
        assertThat(usuarios.findByGoogleSub(sub)).isEmpty();

        http.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("idToken", sub))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jwt").isNotEmpty());

        Usuario criado = usuarios.findByGoogleSub(sub).orElseThrow();
        assertThat(criado.getSenhaHash()).isNull();
    }

    @Test
    @DisplayName("login por Google reusa o mesmo usuario na segunda vez")
    void loginPorGoogleReusaUsuarioNaSegundaVez() throws Exception {
        String sub = "google-sub-" + UUID.randomUUID();

        String primeiro = corpoDe(postJson("/api/v1/auth/google", Map.of("idToken", sub)))
                .get("usuario").get("id").asText();
        String segundo = corpoDe(postJson("/api/v1/auth/google", Map.of("idToken", sub)))
                .get("usuario").get("id").asText();

        assertThat(segundo).isEqualTo(primeiro);
        assertThat(usuarios.findByGoogleSub(sub)).isPresent();
    }

    @Test
    @DisplayName("esqueci a senha devolve 204 mesmo para e-mail inexistente")
    void esqueciSenhaDevolve204MesmoParaEmailInexistente() throws Exception {
        String existente = email();
        registra(existente, "senha-boa-123");

        http.perform(post("/api/v1/auth/senha/esqueci")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("email", existente))))
                .andExpect(status().isNoContent());

        http.perform(post("/api/v1/auth/senha/esqueci")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("email", email()))))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("entrar na turma com codigo valido cria membro ALUNO")
    void entrarNaTurmaComCodigoValidoCriaMembroAluno() throws Exception {
        String codigo = "CONV-" + UUID.randomUUID();
        Turma turma = turmas.saveAndFlush(new Turma(UUID.randomUUID(), "Turma", "2026.2", codigo));
        String jwt = registra(email(), "senha-boa-123");

        http.perform(post("/api/v1/turmas/entrar")
                        .header("Authorization", "Bearer " + jwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("codigoConvite", codigo))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.turmaId").value(turma.getId().toString()))
                .andExpect(jsonPath("$.papel").value("ALUNO"));

        assertThat(membros.findByTurmaId(turma.getId()))
                .singleElement()
                .extracting(Membro::getPapel)
                .isEqualTo(PapelMembro.ALUNO);
    }

    @Test
    @DisplayName("entrar na turma com codigo invalido devolve 404")
    void entrarNaTurmaComCodigoInvalidoDevolve404() throws Exception {
        String jwt = registra(email(), "senha-boa-123");

        http.perform(post("/api/v1/turmas/entrar")
                        .header("Authorization", "Bearer " + jwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("codigoConvite", "NAO-EXISTE"))))
                .andExpect(status().isNotFound());
    }
}
