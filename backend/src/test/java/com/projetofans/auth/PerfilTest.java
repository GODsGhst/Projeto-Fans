package com.projetofans.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.projetofans.security.JwtService;
import com.projetofans.support.TesteComPostgres;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * GET/PATCH /eu e a troca de senha.
 *
 * O teste que mais importa e o da senha atual errada: ele trava o 400. Se um dia
 * virar 401, o interceptor do app desloga quem so errou um campo do formulario.
 *
 * Sem @Transactional de proposito: com ele, o GET depois do PATCH lia o nome do
 * contexto de persistencia do proprio teste e passaria mesmo sem nada gravado.
 * Assim cada requisicao commita e a seguinte le do banco. Os e-mails sao UUID
 * aleatorio, entao as linhas que ficam nao colidem com nenhuma outra classe.
 */
@AutoConfigureMockMvc
class PerfilTest extends TesteComPostgres {

    @Autowired private MockMvc http;
    @Autowired private ObjectMapper json;
    @Autowired private JwtService jwt;

    private String email() {
        return "u-" + UUID.randomUUID() + "@ex.dev";
    }

    private MvcResult enviar(MockHttpServletRequestBuilder req,
                             String bearer, Map<String, Object> corpo) throws Exception {
        if (bearer != null) {
            req.header("Authorization", bearer);
        }
        if (corpo != null) {
            req.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(corpo));
        }
        return http.perform(req).andReturn();
    }

    private JsonNode corpoDe(MvcResult resultado) throws Exception {
        return json.readTree(resultado.getResponse().getContentAsString());
    }

    private String registra(String email, String senha) throws Exception {
        MvcResult r = enviar(post("/api/v1/auth/registrar"), null,
                Map.of("nome", "Fulano", "email", email, "senha", senha));
        assertThat(r.getResponse().getStatus()).isEqualTo(200);
        return "Bearer " + corpoDe(r).get("jwt").asText();
    }

    private int login(String email, String senha) throws Exception {
        return enviar(post("/api/v1/auth/login"), null, Map.of("email", email, "senha", senha))
                .getResponse().getStatus();
    }

    @Test
    @DisplayName("GET /eu devolve os campos do perfil, sem hash")
    void getDevolveOsCampos() throws Exception {
        String email = email();
        String bearer = registra(email, "senha-boa-123");

        http.perform(get("/api/v1/eu").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.nome").value("Fulano"))
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.adminPlataforma").value(false))
                .andExpect(jsonPath("$.temSenha").value(true))
                .andExpect(jsonPath("$.senhaHash").doesNotExist());
    }

    @Test
    @DisplayName("PATCH /eu troca o nome com trim e devolve JWT novo que ja carrega o nome")
    void patchTrocaONomeEDevolveJwtNovo() throws Exception {
        String bearer = registra(email(), "senha-boa-123");

        MvcResult r = enviar(patch("/api/v1/eu"), bearer, Map.of("nome", "  Ana Nova  "));
        assertThat(r.getResponse().getStatus()).isEqualTo(200);
        JsonNode corpo = corpoDe(r);
        assertThat(corpo.get("perfil").get("nome").asText()).isEqualTo("Ana Nova");
        String novo = corpo.get("jwt").asText();
        assertThat(jwt.validar(novo).nome()).isEqualTo("Ana Nova");

        http.perform(get("/api/v1/eu").header("Authorization", "Bearer " + novo))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nome").value("Ana Nova"));
    }

    @Test
    @DisplayName("PATCH /eu com nome so de espacos devolve 400")
    void patchComNomeEmBrancoDevolve400() throws Exception {
        String bearer = registra(email(), "senha-boa-123");

        assertThat(enviar(patch("/api/v1/eu"), bearer, Map.of("nome", "   "))
                .getResponse().getStatus()).isEqualTo(400);
    }

    @Test
    @DisplayName("nome sem letra nem digito (NBSP, U+3000) devolve 400 no PATCH e no cadastro")
    void nomeSoDeEspacoUnicodeDevolve400() throws Exception {
        // NBSP e U+3000 passam no @NotBlank (que so corta ate U+0020): quem barra e o service.
        String invisivel = "\u00A0\u3000";
        String bearer = registra(email(), "senha-boa-123");

        assertThat(enviar(patch("/api/v1/eu"), bearer, Map.of("nome", invisivel))
                .getResponse().getStatus()).isEqualTo(400);
        assertThat(enviar(post("/api/v1/auth/registrar"), null,
                Map.of("nome", invisivel, "email", email(), "senha", "senha-boa-123"))
                .getResponse().getStatus()).isEqualTo(400);
    }

    @Test
    @DisplayName("senha acima de 72 bytes devolve 400, nao 500, na troca e no cadastro")
    void senhaAcimaDe72BytesDevolve400() throws Exception {
        // 73 cabe no @Size(max = 100), mas o BCrypt recusa: a guarda e do AuthService.
        String longa = "x".repeat(73);
        String bearer = registra(email(), "senha-boa-123");

        http.perform(post("/api/v1/eu/senha").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(
                                Map.of("senhaAtual", "senha-boa-123", "novaSenha", longa))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Senha muito longa: use no maximo 72 caracteres"));
        assertThat(enviar(post("/api/v1/auth/registrar"), null,
                Map.of("nome", "Fulano", "email", email(), "senha", longa))
                .getResponse().getStatus()).isEqualTo(400);
    }

    @Test
    @DisplayName("trocar senha: a nova entra, a antiga nao, e so o token devolvido sobrevive")
    void trocaSenhaComAtualCerta() throws Exception {
        String email = email();
        String bearer = registra(email, "senha-velha-123");
        String outroAparelho = "Bearer " + corpoDe(enviar(post("/api/v1/auth/login"), null,
                Map.of("email", email, "senha", "senha-velha-123"))).get("jwt").asText();

        MvcResult troca = enviar(post("/api/v1/eu/senha"), bearer,
                Map.of("senhaAtual", "senha-velha-123", "novaSenha", "senha-nova-456"));
        assertThat(troca.getResponse().getStatus()).isEqualTo(200);
        String novo = "Bearer " + corpoDe(troca).get("jwt").asText();

        // Quem trocou continua dentro; toda sessao anterior cai — inclusive a
        // que fez a troca, que so segue viva pelo token novo.
        assertThat(enviar(get("/api/v1/eu"), novo, null).getResponse().getStatus()).isEqualTo(200);
        assertThat(enviar(get("/api/v1/eu"), bearer, null).getResponse().getStatus()).isEqualTo(401);
        assertThat(enviar(get("/api/v1/eu"), outroAparelho, null).getResponse().getStatus()).isEqualTo(401);

        assertThat(login(email, "senha-nova-456")).isEqualTo(200);
        assertThat(login(email, "senha-velha-123")).isEqualTo(401);
    }

    @Test
    @DisplayName("senha atual errada devolve 400, nunca 401")
    void senhaAtualErradaDevolve400() throws Exception {
        String email = email();
        String bearer = registra(email, "senha-boa-123");

        http.perform(post("/api/v1/eu/senha").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(
                                Map.of("senhaAtual", "nao-e-essa", "novaSenha", "senha-nova-456"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Senha atual incorreta"));

        assertThat(login(email, "senha-boa-123")).isEqualTo(200);
    }

    @Test
    @DisplayName("conta so do Google: temSenha falso e trocar senha devolve 400")
    void contaDoGoogleNaoTemSenha() throws Exception {
        MvcResult g = enviar(post("/api/v1/auth/google"), null,
                Map.of("idToken", "google-sub-" + UUID.randomUUID()));
        String bearer = "Bearer " + corpoDe(g).get("jwt").asText();

        http.perform(get("/api/v1/eu").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.temSenha").value(false));

        http.perform(post("/api/v1/eu/senha").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(
                                Map.of("senhaAtual", "qualquer", "novaSenha", "senha-nova-456"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Esta conta entra pelo Google e nao tem senha"));
    }

    @Test
    @DisplayName("sem token, as tres rotas devolvem 401")
    void semTokenDevolve401() throws Exception {
        assertThat(enviar(get("/api/v1/eu"), null, null).getResponse().getStatus()).isEqualTo(401);
        assertThat(enviar(patch("/api/v1/eu"), null, Map.of("nome", "X"))
                .getResponse().getStatus()).isEqualTo(401);
        assertThat(enviar(post("/api/v1/eu/senha"), null,
                Map.of("senhaAtual", "a", "novaSenha", "senha-nova-456"))
                .getResponse().getStatus()).isEqualTo(401);
    }
}
