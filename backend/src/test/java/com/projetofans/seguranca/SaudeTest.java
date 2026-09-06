package com.projetofans.seguranca;

import com.projetofans.support.TesteDeApi;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A rota que responde sem conta, e o que ela NAO pode dizer.
 */
class SaudeTest extends TesteDeApi {

    @Test
    @DisplayName("responde sem token — e a unica que pode")
    void semToken() throws Exception {
        http.perform(get("/api/v1/saude"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                // 8 hex: identifica a compilacao para saber se o deploy subiu.
                .andExpect(jsonPath("$.build").value(
                        org.hamcrest.Matchers.matchesPattern("[0-9a-f]{8}")));
    }

    @Test
    @DisplayName("NAO conta versao, host nem data — isso ajuda quem bisbilha")
    void naoVazaNada() throws Exception {
        String corpo = http.perform(get("/api/v1/saude"))
                .andReturn().getResponse().getContentAsString();

        // O digesto existe para mudar a cada build, nao para descrever o build.
        // Se um dia alguem trocar por `version` ou por um timestamp legivel,
        // este teste falha e a conversa acontece antes do merge.
        org.assertj.core.api.Assertions.assertThat(corpo)
                .doesNotContain("version", "SNAPSHOT", "20")
                .hasSizeLessThan(80);
    }

    @Test
    @DisplayName("rota inexistente nao vira 200 por engano")
    void rotaInventada() throws Exception {
        http.perform(get("/api/v1/saude/detalhes"))
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("\"status\":\"ok\""))));
    }
}
