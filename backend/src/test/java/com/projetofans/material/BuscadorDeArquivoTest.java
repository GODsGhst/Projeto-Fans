package com.projetofans.material;

import com.projetofans.erro.ErroDeNegocio;
import com.projetofans.service.BuscadorDeArquivo;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * As guardas de SSRF do buscador.
 *
 * POR QUE ESTE TESTE EXISTE
 * Qualquer um da turma cadastra um material com a URL que quiser, e o servidor
 * busca essa URL. Sem as guardas, "resumir material" vira "leia para mim
 * qualquer coisa que o servidor alcance" — o disco dele, o banco na rede
 * interna, o endpoint de credenciais da nuvem em 169.254.169.254.
 *
 * Nenhum destes casos chega a abrir conexao: todos sao recusados na validacao,
 * que e o ponto. Se um dia um deles passar da validacao e tentar conectar, o
 * teste falha por timeout em vez de passar em silencio — e falhar alto e o
 * comportamento certo para uma regressao dessa natureza.
 */
class BuscadorDeArquivoTest {

    private final BuscadorDeArquivo buscador = new BuscadorDeArquivo();

    @ParameterizedTest
    @DisplayName("endereco que o servidor alcanca por dentro e recusado")
    @ValueSource(strings = {
            "http://127.0.0.1/segredo",
            "http://localhost:8080/actuator",
            "http://[::1]/segredo",
            // O endereco de metadados das nuvens. E o alvo classico: ele
            // devolve credenciais da maquina para quem simplesmente pedir.
            "http://169.254.169.254/latest/meta-data/",
            "http://10.0.0.5/interno",
            "http://192.168.1.1/roteador",
            "http://172.16.0.9/interno",
    })
    void recusaEnderecoInterno(String url) {
        assertThatThrownBy(() -> buscador.baixar(url))
                .isInstanceOf(ErroDeNegocio.class)
                .satisfies(e -> assertThat(((ErroDeNegocio) e).getStatus())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @ParameterizedTest
    @DisplayName("so http e https — `file:` leria o disco do servidor")
    @ValueSource(strings = {
            "file:///etc/passwd",
            "file://C:/Windows/win.ini",
            "ftp://exemplo.com/arquivo.pdf",
            "gopher://exemplo.com/",
            "jar:file:///tmp/x.jar!/",
    })
    void recusaEsquemaQueNaoEhWeb(String url) {
        assertThatThrownBy(() -> buscador.baixar(url))
                .isInstanceOf(ErroDeNegocio.class)
                .hasMessageContaining("http");
    }

    @Test
    @DisplayName("a mensagem NAO diz qual faixa barrou")
    void naoEntregaMapaDaRede() {
        // Dizer "192.168.1.1 e privado" e "10.0.0.5 nao existe" transformaria
        // este endpoint num scanner: a diferenca entre as duas respostas ja
        // desenha a rede interna para quem tentar endereco por endereco.
        assertThatThrownBy(() -> buscador.baixar("http://192.168.1.1/x"))
                .hasMessageNotContaining("192.168")
                .hasMessageNotContaining("privado");
    }

    @Test
    @DisplayName("texto que nem e URL vira 400, nao 500")
    void urlQuebrada() {
        assertThatThrownBy(() -> buscador.baixar("nao é uma url"))
                .isInstanceOf(ErroDeNegocio.class)
                .satisfies(e -> assertThat(((ErroDeNegocio) e).getStatus())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }
}
