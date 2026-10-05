package com.projetofans.seguranca;

import com.projetofans.domain.Usuario;
import com.projetofans.support.TesteDeApi;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Teto de tentativas nas tres rotas que aceitam chute: senha, e-mail de reset e
 * codigo de convite (observacao da auditoria de 05/10/2026, fora das cinco
 * categorias). O que importa alem do 429: ele nao vaza nada. Sai para e-mail com
 * e sem conta, e so depois do teto — antes dele, a resposta e a de sempre.
 */
class ForcaBrutaTest extends TesteDeApi {

    private int postar(String rota, String bearer, Map<String, Object> corpo) throws Exception {
        var pedido = post(rota).contentType(MediaType.APPLICATION_JSON).content(corpo(corpo));
        if (bearer != null) {
            pedido.header("Authorization", bearer);
        }
        return http.perform(pedido).andReturn().getResponse().getStatus();
    }

    private static String email() {
        return "alvo-" + UUID.randomUUID() + "@ex.dev";
    }

    @Test
    @DisplayName("login: dez senhas erradas passam como 401, a decima primeira e 429")
    void login() throws Exception {
        String alvo = email();
        for (int i = 0; i < 10; i++) {
            assertThat(postar("/api/v1/auth/login", null, Map.of("email", alvo, "senha", "chute-" + i)))
                    .isEqualTo(401);
        }

        assertThat(postar("/api/v1/auth/login", null, Map.of("email", alvo, "senha", "chute-x")))
                .isEqualTo(429);
        assertThat(postar("/api/v1/auth/login", null, Map.of("email", email(), "senha", "chute")))
                .as("o teto e por conta, nao global")
                .isEqualTo(401);
    }

    @Test
    @DisplayName("esqueci a senha: cinco por hora, e o 429 sai igual para e-mail com e sem conta")
    void esqueciSenha() throws Exception {
        String semConta = email();
        String comConta = novoUsuario("Ana").getEmail();
        for (int i = 0; i < 5; i++) {
            assertThat(postar("/api/v1/auth/senha/esqueci", null, Map.of("email", semConta))).isEqualTo(204);
            assertThat(postar("/api/v1/auth/senha/esqueci", null, Map.of("email", comConta))).isEqualTo(204);
        }

        assertThat(postar("/api/v1/auth/senha/esqueci", null, Map.of("email", semConta))).isEqualTo(429);
        assertThat(postar("/api/v1/auth/senha/esqueci", null, Map.of("email", comConta))).isEqualTo(429);
    }

    @Test
    @DisplayName("codigo de convite: dez chutes por usuario, depois 429")
    void entrarNaTurma() throws Exception {
        Usuario quem = novoUsuario("Chutador");
        String bearer = bearer(quem);
        for (int i = 0; i < 10; i++) {
            assertThat(postar("/api/v1/turmas/entrar", bearer, Map.of("codigoConvite", "CHUTE" + i)))
                    .isNotEqualTo(429);
        }

        assertThat(postar("/api/v1/turmas/entrar", bearer, Map.of("codigoConvite", "CHUTEX"))).isEqualTo(429);
        assertThat(postar("/api/v1/turmas/entrar", bearer(novoUsuario("Outro")),
                Map.of("codigoConvite", "CHUTEX"))).isNotEqualTo(429);
    }
}
