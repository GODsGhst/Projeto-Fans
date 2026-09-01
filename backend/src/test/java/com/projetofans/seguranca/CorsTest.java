package com.projetofans.seguranca;

import com.projetofans.support.TesteDeApi;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * O app empacotado nao roda num dominio: ele roda num WebView do Capacitor, que
 * serve os arquivos locais sob `https://localhost` no Android. Toda chamada para
 * a API e, portanto, cross-origin.
 *
 * Sem CORS o app falhava do jeito mais confuso possivel — o WebView mandava o
 * preflight OPTIONS por causa do header Authorization, o Spring Security
 * respondia 401, o navegador bloqueava, e a tela dizia "Sem conexao". O usuario
 * via "servidor fora do ar"; o servidor estava no ar e respondendo.
 *
 * Estes testes existem porque o sintoma nao aponta para a causa: nenhum log do
 * servidor mostra problema, e o app so diz que nao ha rede.
 *
 * O QUE ELES NAO PROVAM, e vale saber antes de confiar demais neles.
 *
 * Verificado por mutacao: comentar `.cors(Customizer.withDefaults())` no
 * SegurancaConfig e a suite CONTINUA VERDE. No MockMvc o preflight e atendido
 * pela camada MVC, que le o mesmo CorsConfigurationSource — entao o que estes
 * testes exercitam e o CONTEUDO da configuracao, nao a ORDEM dos filtros. E a
 * ordem era o bug: em producao o preflight batia no Spring Security antes de
 * chegar ao MVC e levava 401.
 *
 * Eles seguram bem o que sabem segurar: origem coringa reprova em
 * `origemDesconhecidaNaoEPermitida`, e remover If-Match da lista reprova em
 * `preflightLiberaIfMatch`. Para a ligacao em si, a prova e o curl contra a API
 * no ar, registrado no LOG.md de 2026-09-01.
 */
@Transactional
class CorsTest extends TesteDeApi {

    private static final String CAPACITOR_ANDROID = "https://localhost";

    @Test
    @DisplayName("preflight do app passa sem token e devolve a origem permitida")
    void preflightDoAppPassaSemToken() throws Exception {
        // Sem token de proposito: o preflight acontece ANTES de qualquer login, e
        // o CorsFilter roda antes da autenticacao. Se este teste exigir Bearer,
        // ele nao esta testando o que quebrou.
        http.perform(MockMvcRequestBuilders.options("/api/v1/home")
                        .header("Origin", CAPACITOR_ANDROID)
                        .header("Access-Control-Request-Method", "GET")
                        .header("Access-Control-Request-Headers", "authorization"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", CAPACITOR_ANDROID));
    }

    @Test
    @DisplayName("preflight libera If-Match — sem ele todo PATCH e DELETE do app morre")
    void preflightLiberaIfMatch() throws Exception {
        // If-Match nao e header simples. Esquece-lo na lista quebraria so a edicao
        // e so a exclusao, semanas depois, quando alguem tentasse editar algo.
        http.perform(MockMvcRequestBuilders.options("/api/v1/eventos/qualquer")
                        .header("Origin", CAPACITOR_ANDROID)
                        .header("Access-Control-Request-Method", "PATCH")
                        .header("Access-Control-Request-Headers", "authorization, if-match"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", CAPACITOR_ANDROID));
    }

    @Test
    @DisplayName("origem desconhecida NAO recebe permissao")
    void origemDesconhecidaNaoEPermitida() throws Exception {
        // O contrapeso. Uma configuracao com origem coringa passaria no primeiro
        // teste e deixaria qualquer pagina da internet disparar chamadas
        // autenticadas contra esta API pelo navegador de quem estiver logado.
        http.perform(MockMvcRequestBuilders.options("/api/v1/home")
                        .header("Origin", "https://site-qualquer.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    @DisplayName("CORS nao afrouxa a autenticacao: sem token continua 401")
    void corsNaoAfrouxaAutenticacao() throws Exception {
        // Liberar o preflight nao pode virar liberar a rota. Este teste fica
        // vermelho se alguem "resolver" o CORS colocando OPTIONS ou /** no
        // permitAll.
        http.perform(get("/api/v1/home").header("Origin", CAPACITOR_ANDROID))
                .andExpect(status().isUnauthorized());
    }
}
