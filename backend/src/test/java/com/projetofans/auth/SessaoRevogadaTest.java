package com.projetofans.auth;

import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.TokenResetSenha;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.repo.TokenResetSenhaRepository;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Redefinir a senha derruba as sessoes antigas. Sem isto, quem roubou um JWT de
 * 30 dias continuava dentro depois de a vitima trocar a senha — que e justamente
 * o que a vitima faz quando desconfia (observacao da auditoria de 05/10/2026).
 */
class SessaoRevogadaTest extends TesteDeApi {

    @Autowired private TokenResetSenhaRepository tokensReset;

    /** O mesmo SHA-256 em hex que o AuthService grava no lugar do token. */
    private static String hash(String token) throws Exception {
        return HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
    }

    private void home(String bearer, int esperado) throws Exception {
        http.perform(get("/api/v1/home").header("Authorization", bearer))
                .andExpect(status().is(esperado));
    }

    @Test
    @DisplayName("JWT emitido antes do reset de senha deixa de valer; o login novo vale")
    void resetDerrubaSessaoAntiga() throws Exception {
        Turma turma = novaTurma();
        Usuario ana = membroDe(turma, "Ana", PapelMembro.ALUNO);
        String sessaoAntiga = bearer(ana);
        home(sessaoAntiga, 200);

        String token = UUID.randomUUID().toString();
        tokensReset.saveAndFlush(new TokenResetSenha(UUID.randomUUID(), ana.getId(), hash(token),
                Instant.now().plus(Duration.ofHours(1))));
        http.perform(post("/api/v1/auth/senha/reset")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(Map.of("token", token, "novaSenha", "senha-nova-123"))))
                .andExpect(status().isNoContent());

        home(sessaoAntiga, 401);

        String corpoLogin = http.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(Map.of("email", ana.getEmail(), "senha", "senha-nova-123"))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        home("Bearer " + json.readTree(corpoLogin).get("jwt").asText(), 200);
    }
}
