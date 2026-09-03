package com.projetofans.service;

import com.projetofans.erro.ErroDeNegocio;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;

/**
 * Baixa o arquivo apontado por um material, para o resumo por IA.
 *
 * POR QUE O SERVIDOR BAIXA, E NAO O CELULAR
 * O celular nao consegue: o link e de outro dominio, e o WebView bloqueia a
 * leitura por CORS. E mesmo que conseguisse, mandar 10 MB de PDF pelo 4G do
 * aluno para o servidor devolver dez linhas de texto e a direcao errada.
 *
 * ISTO E UM SSRF SE FOR ESCRITO SEM CUIDADO, e por isso as guardas abaixo NAO
 * sao opcionais: qualquer um da turma cadastra um material com a URL que
 * quiser, e sem elas bastaria apontar para `http://169.254.169.254/` ou para um
 * servico interno para o backend buscar e devolver o conteudo. As regras:
 *
 * 1. So http e https. `file:` leria o disco do servidor; `gopher:`/`ftp:` sao
 *    superficie sem nenhum uso aqui.
 * 2. O endereco resolvido nao pode ser local, privado, de loopback ou de
 *    link-local. E o `169.254.169.254` das nuvens que mora nessa ultima faixa.
 * 3. Redirecionamento e seguido A MAO, ate 3 saltos, revalidando cada um. O
 *    `followRedirects` do HttpClient validaria so a primeira URL — e o desvio
 *    para 127.0.0.1 no segundo salto e justamente o truque conhecido.
 * 4. Teto de tamanho e de tempo. Sem eles, um link para um arquivo enorme
 *    derruba a memoria do servico gratuito.
 *
 * O que este componente NAO faz: julgar o conteudo. Ele devolve os bytes e o
 * tipo; quem decide o que da para resumir e o ResumoService.
 */
@Component
public class BuscadorDeArquivo {

    private static final Logger log = LoggerFactory.getLogger(BuscadorDeArquivo.class);

    /** Acima disto o arquivo nao cabe numa requisicao de IA de qualquer jeito. */
    static final int TETO_BYTES = 10 * 1024 * 1024;

    private static final int MAX_REDIRECIONAMENTOS = 3;
    private static final Duration TIMEOUT = Duration.ofSeconds(20);

    private final HttpClient http = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NEVER)
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    /** Bytes e content-type do que estava na URL. */
    public record Arquivo(byte[] bytes, String tipo) {
    }

    public Arquivo baixar(String url) {
        URI atual = validar(url);
        for (int salto = 0; salto <= MAX_REDIRECIONAMENTOS; salto++) {
            HttpResponse<InputStream> resposta = pedir(atual);
            int status = resposta.statusCode();
            if (status >= 300 && status < 400) {
                String destino = resposta.headers().firstValue("location")
                        .orElseThrow(() -> new ErroDeNegocio(HttpStatus.BAD_GATEWAY,
                                "O link redirecionou para lugar nenhum."));
                // `resolve` porque Location pode ser relativo. A URL resultante
                // passa pela mesma validacao da primeira — e o ponto todo.
                atual = validar(atual.resolve(destino).toString());
                continue;
            }
            if (status != 200) {
                throw new ErroDeNegocio(HttpStatus.BAD_GATEWAY,
                        "O link respondeu " + status + ". Confira se ele abre sem estar logado.");
            }
            String tipo = resposta.headers().firstValue("content-type")
                    .map(t -> t.split(";")[0].trim().toLowerCase(Locale.ROOT))
                    .orElse("application/octet-stream");
            return new Arquivo(lerAteOTeto(resposta.body()), tipo);
        }
        throw new ErroDeNegocio(HttpStatus.BAD_GATEWAY, "O link redireciona demais.");
    }

    private HttpResponse<InputStream> pedir(URI uri) {
        HttpRequest pedido = HttpRequest.newBuilder(uri)
                .timeout(TIMEOUT)
                .header("User-Agent", "projetofans/1.0")
                .GET()
                .build();
        try {
            return http.send(pedido, HttpResponse.BodyHandlers.ofInputStream());
        } catch (IOException e) {
            // A URL NAO entra na mensagem do usuario nem no log em nivel INFO:
            // ela e conteudo de turma, e mensagem de erro e o lugar classico
            // por onde dado interno escapa.
            log.warn("falha ao baixar arquivo de material", e);
            throw new ErroDeNegocio(HttpStatus.BAD_GATEWAY, "Nao deu para abrir o link.", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ErroDeNegocio(HttpStatus.BAD_GATEWAY, "Nao deu para abrir o link.", e);
        }
    }

    /**
     * Le no maximo TETO_BYTES + 1 e recusa se passou.
     *
     * O `+ 1` e o que diferencia "o arquivo tem exatamente o teto" de "o arquivo
     * e maior e foi cortado": sem ele, um PDF truncado no limite seria mandado
     * para a IA como se estivesse inteiro.
     */
    private byte[] lerAteOTeto(InputStream corpo) {
        try (InputStream in = corpo) {
            byte[] bytes = in.readNBytes(TETO_BYTES + 1);
            if (bytes.length > TETO_BYTES) {
                throw new ErroDeNegocio(HttpStatus.PAYLOAD_TOO_LARGE,
                        "Esse arquivo passa de 10 MB. Resuma um menor.");
            }
            return bytes;
        } catch (IOException e) {
            throw new ErroDeNegocio(HttpStatus.BAD_GATEWAY, "O download falhou no meio.", e);
        }
    }

    /** Esquema, forma e endereco. Estoura 400 — a URL veio de quem cadastrou. */
    private URI validar(String url) {
        URI uri;
        try {
            uri = new URI(url);
        } catch (URISyntaxException e) {
            throw new ErroDeNegocio(HttpStatus.BAD_REQUEST, "O link do material nao e uma URL.", e);
        }
        String esquema = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!esquema.equals("http") && !esquema.equals("https")) {
            throw new ErroDeNegocio(HttpStatus.BAD_REQUEST,
                    "So da para resumir link http ou https.");
        }
        if (uri.getHost() == null) {
            throw new ErroDeNegocio(HttpStatus.BAD_REQUEST, "O link do material nao tem endereco.");
        }
        if (ehLocal(uri.getHost())) {
            // Mensagem propositalmente sem detalhe: dizer QUAL faixa foi barrada
            // transformaria este endpoint num mapeador da rede interna.
            throw new ErroDeNegocio(HttpStatus.BAD_REQUEST, "Esse endereco nao pode ser lido.");
        }
        return uri;
    }

    /**
     * fc00::/7, a faixa privada de IPv6.
     *
     * O `isSiteLocalAddress` do Java so conhece a fec0::/10, que foi
     * descontinuada em 2004 — a faixa privada que se usa hoje passa direto por
     * ele. Sem isto, a guarda toda vale so para IPv4.
     */
    private boolean ehUlaIpv6(InetAddress endereco) {
        byte[] bytes = endereco.getAddress();
        return bytes.length == 16 && (bytes[0] & 0xFE) == 0xFC;
    }

    private boolean ehLocal(String host) {
        try {
            // Todos os enderecos, nao so o primeiro: um nome pode resolver para
            // um publico e um privado, e o sistema pode escolher o segundo.
            for (InetAddress endereco : InetAddress.getAllByName(host)) {
                if (endereco.isAnyLocalAddress() || endereco.isLoopbackAddress()
                        || endereco.isLinkLocalAddress() || endereco.isSiteLocalAddress()
                        || endereco.isMulticastAddress() || ehUlaIpv6(endereco)) {
                    return true;
                }
            }
            return false;
        } catch (UnknownHostException e) {
            throw new ErroDeNegocio(HttpStatus.BAD_REQUEST, "Esse endereco nao existe.", e);
        }
    }
}
