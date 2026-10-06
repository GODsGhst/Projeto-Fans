package com.projetofans.seguranca;

import com.projetofans.domain.TokenResetSenha;
import com.projetofans.domain.Usuario;
import com.projetofans.repo.TokenResetSenhaRepository;
import com.projetofans.repo.UsuarioRepository;
import com.projetofans.support.TesteDeApi;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
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

    @Autowired private TokenResetSenhaRepository tokensReset;
    @Autowired private UsuarioRepository usuarios;

    /** O mesmo SHA-256 em hex que o AuthService grava no lugar do token. */
    private static String hash(String token) throws Exception {
        return HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
    }

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
    @DisplayName("login: so a falha conta, o acerto zera, e travado nem a senha certa entra")
    void loginCertoZera() throws Exception {
        // Antes, o teto contava TODO login: a dona que entrasse onze vezes em 15 min
        // (celular, notebook, app reinstalado) se trancava sozinha.
        String alvo = email();
        assertThat(postar("/api/v1/auth/registrar", null,
                Map.of("nome", "Ana", "email", alvo, "senha", "senha-certa-123"))).isEqualTo(200);
        for (int i = 0; i < 9; i++) {
            assertThat(postar("/api/v1/auth/login", null, Map.of("email", alvo, "senha", "chute-" + i)))
                    .isEqualTo(401);
        }
        assertThat(postar("/api/v1/auth/login", null, Map.of("email", alvo, "senha", "senha-certa-123")))
                .isEqualTo(200);

        for (int i = 0; i < 10; i++) {
            assertThat(postar("/api/v1/auth/login", null, Map.of("email", alvo, "senha", "chute-" + i)))
                    .as("sem o zero, a segunda daqui ja seria 429")
                    .isEqualTo(401);
        }
        assertThat(postar("/api/v1/auth/login", null, Map.of("email", alvo, "senha", "chute-x")))
                .as("o mesmo 429 do e-mail sem conta, em login() acima")
                .isEqualTo(429);
        assertThat(postar("/api/v1/auth/login", null, Map.of("email", alvo, "senha", "senha-certa-123")))
                .as("se a certa passasse travada, o 200 no meio dos 429 entregaria a senha")
                .isEqualTo(429);
    }

    @Test
    @DisplayName("login: reset de senha concluido destrava a conta que o atacante trancou")
    void resetDestravaOLogin() throws Exception {
        // Janela fixa e renovavel: quem sabe o e-mail tranca de novo a cada 15 min, e
        // "esqueci a senha" nao ajudava. O token do e-mail prova posse, entao o reset
        // devolve a ficha. Sem o loginCerto no reset, o ultimo login daqui seria 429.
        String alvo = email();
        assertThat(postar("/api/v1/auth/registrar", null,
                Map.of("nome", "Ana", "email", alvo, "senha", "senha-antiga-123"))).isEqualTo(200);
        for (int i = 0; i < 10; i++) {
            postar("/api/v1/auth/login", null, Map.of("email", alvo, "senha", "chute-" + i));
        }
        assertThat(postar("/api/v1/auth/login", null, Map.of("email", alvo, "senha", "senha-antiga-123")))
                .as("trancada: nem a senha certa entra")
                .isEqualTo(429);

        UUID donaId = usuarios.findByEmail(alvo).orElseThrow().getId();
        String token = UUID.randomUUID().toString();
        tokensReset.saveAndFlush(new TokenResetSenha(UUID.randomUUID(), donaId, hash(token),
                Instant.now().plus(Duration.ofHours(1))));
        assertThat(postar("/api/v1/auth/senha/reset", null,
                Map.of("token", token, "novaSenha", "senha-nova-123"))).isEqualTo(204);

        assertThat(postar("/api/v1/auth/login", null, Map.of("email", alvo, "senha", "senha-nova-123")))
                .as("o reset destrava, e a senha nova entra")
                .isEqualTo(200);
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
