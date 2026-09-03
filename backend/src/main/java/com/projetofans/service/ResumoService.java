package com.projetofans.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.projetofans.domain.Material;
import com.projetofans.erro.ErroDeNegocio;
import com.projetofans.repo.MaterialRepository;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.web.dto.MaterialResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;

/**
 * Resumo do material por IA, com a chave de quem pediu.
 *
 * A CHAVE NAO E NOSSA, E NAO FICA
 * Ela chega no header `X-IA-Key`, e usada e some com o fim da requisicao. Nao
 * vai para o banco, nao vai para log, nao volta em resposta nenhuma. Isso e o
 * que permite o recurso existir hoje sem ninguem bancar a conta da turma
 * inteira — e e o que faz este servidor continuar sendo um alvo pequeno: o pior
 * vazamento aqui e conteudo de turma, e nao a conta de terceiros de 30 alunos.
 *
 * Quando virar recurso pago, o caminho e apagar UM header: a chave passa a sair
 * da configuracao do servidor e nada mais muda.
 *
 * O RESUMO E DA TURMA
 * Guardado no material, nao no aparelho de quem pediu: gerar custa dinheiro, e
 * um resumo por pessoa faria os trinta pagarem pelo mesmo PDF. Quem chamar de
 * novo com o resumo ja gerado recebe o que existe, sem gastar — a menos que
 * peca explicitamente para refazer.
 */
@Service
public class ResumoService {

    private static final Logger log = LoggerFactory.getLogger(ResumoService.class);

    private static final URI ENDPOINT = URI.create("https://api.anthropic.com/v1/messages");
    private static final String VERSAO_API = "2023-06-01";
    private static final int MAX_TOKENS = 1024;

    /** Texto puro nao vai inteiro: um .txt de 5 MB estoura o contexto e o custo. */
    private static final int TETO_TEXTO = 60_000;

    private static final String INSTRUCAO = """
            Você está resumindo um material de estudo para uma turma de faculdade.

            Escreva em português do Brasil, em no máximo 12 linhas:
            - do que o material trata, em uma frase;
            - os pontos principais, em tópicos curtos;
            - o que provavelmente cai em prova, se der para saber pelo conteúdo.

            Não invente nada que não esteja no material. Se o arquivo estiver
            ilegível ou não for material de estudo, diga isso em uma linha e pare.
            """;

    private final MaterialRepository materiais;
    private final MaterialService materialService;
    private final BuscadorDeArquivo buscador;
    private final ObjectMapper json;
    private final String modelo;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public ResumoService(MaterialRepository materiais, MaterialService materialService,
                         BuscadorDeArquivo buscador, ObjectMapper json,
                         @Value("${app.ia.modelo}") String modelo) {
        this.materiais = materiais;
        this.materialService = materialService;
        this.buscador = buscador;
        this.json = json;
        this.modelo = modelo;
    }

    @Transactional
    public MaterialResponse resumir(UsuarioAtual eu, UUID materialId, String chave, boolean refazer) {
        if (chave == null || chave.isBlank()) {
            throw new ErroDeNegocio(HttpStatus.BAD_REQUEST,
                    "Falta a chave da IA. Cole a sua em Ajustes.");
        }
        Material material = materialService.daTurmaDoUsuario(eu, materialId);

        // Ja resumido e sem pedido de refazer: devolve o que existe. Sem esta
        // guarda, abrir a tela duas vezes cobraria duas vezes.
        if (material.getResumo() != null && !refazer) {
            return MaterialResponse.de(material, materialService.nomeDoAutor(material.getAutorId()));
        }
        if (material.getUrl() == null || material.getUrl().isBlank()) {
            throw new ErroDeNegocio(HttpStatus.BAD_REQUEST,
                    "Esse material nao tem link para ler.");
        }

        BuscadorDeArquivo.Arquivo arquivo = buscador.baixar(material.getUrl());
        String resumo = pedirAIa(chave, conteudoDe(arquivo));
        material.guardarResumo(resumo, eu.usuarioId(), Instant.now());
        materiais.save(material);
        return MaterialResponse.de(material, materialService.nomeDoAutor(material.getAutorId()));
    }

    /**
     * O bloco de conteudo que a API entende, conforme o tipo que voltou do link.
     *
     * O caso que mais aparece na pratica e o ultimo: link de pasta do Drive
     * devolve `text/html`, que e a pagina do Drive e nao o PDF. Resumir essa
     * pagina daria um texto confiante sobre a interface do Google — pior que
     * recusar, porque parece que funcionou.
     */
    private Map<String, Object> conteudoDe(BuscadorDeArquivo.Arquivo arquivo) {
        String tipo = arquivo.tipo();
        if (tipo.equals("application/pdf")) {
            return Map.of("type", "document", "source", Map.of(
                    "type", "base64", "media_type", "application/pdf",
                    "data", Base64.getEncoder().encodeToString(arquivo.bytes())));
        }
        if (tipo.equals("image/png") || tipo.equals("image/jpeg")
                || tipo.equals("image/gif") || tipo.equals("image/webp")) {
            return Map.of("type", "image", "source", Map.of(
                    "type", "base64", "media_type", tipo,
                    "data", Base64.getEncoder().encodeToString(arquivo.bytes())));
        }
        if (tipo.startsWith("text/") && !tipo.equals("text/html")) {
            String texto = new String(arquivo.bytes(), StandardCharsets.UTF_8);
            return Map.of("type", "text",
                    "text", texto.length() > TETO_TEXTO ? texto.substring(0, TETO_TEXTO) : texto);
        }
        throw new ErroDeNegocio(HttpStatus.UNPROCESSABLE_ENTITY,
                "Esse link nao devolve o arquivo, devolve uma pagina. "
                        + "Cole o link direto do PDF ou da imagem.");
    }

    private String pedirAIa(String chave, Map<String, Object> conteudo) {
        String corpo;
        try {
            corpo = json.writeValueAsString(Map.of(
                    "model", modelo,
                    "max_tokens", MAX_TOKENS,
                    "messages", java.util.List.of(Map.of(
                            "role", "user",
                            "content", java.util.List.of(conteudo,
                                    Map.of("type", "text", "text", INSTRUCAO))))));
        } catch (IOException e) {
            throw new ErroDeNegocio(HttpStatus.INTERNAL_SERVER_ERROR, "Nao deu para montar o pedido.", e);
        }

        HttpResponse<String> resposta;
        try {
            resposta = http.send(HttpRequest.newBuilder(ENDPOINT)
                    // Tempo generoso: PDF grande demora, e o erro de timeout aqui
                    // custa dinheiro de verdade — a chamada foi cobrada mesmo se
                    // desistirmos de esperar a resposta.
                    .timeout(Duration.ofSeconds(120))
                    .header("content-type", "application/json")
                    .header("anthropic-version", VERSAO_API)
                    .header("x-api-key", chave)
                    .POST(HttpRequest.BodyPublishers.ofString(corpo, StandardCharsets.UTF_8))
                    .build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new ErroDeNegocio(HttpStatus.BAD_GATEWAY, "Nao deu para falar com a IA.", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ErroDeNegocio(HttpStatus.BAD_GATEWAY, "Nao deu para falar com a IA.", e);
        }

        if (resposta.statusCode() != 200) {
            // O corpo da resposta NAO e repassado: ele pode ecoar parte do
            // pedido, e o pedido carrega a chave no header. Traduzimos so o que
            // a pessoa pode resolver.
            log.warn("IA recusou o pedido de resumo: status {}", resposta.statusCode());
            throw new ErroDeNegocio(traduzir(resposta.statusCode()), recado(resposta.statusCode()));
        }
        return texto(resposta.body());
    }

    private HttpStatus traduzir(int status) {
        return switch (status) {
            case 401, 403 -> HttpStatus.BAD_REQUEST;
            case 429 -> HttpStatus.TOO_MANY_REQUESTS;
            default -> HttpStatus.BAD_GATEWAY;
        };
    }

    private String recado(int status) {
        return switch (status) {
            case 401, 403 -> "A IA recusou a sua chave. Confira em Ajustes.";
            case 429 -> "Sua chave atingiu o limite de uso. Tente daqui a pouco.";
            default -> "A IA nao respondeu direito. Tente de novo.";
        };
    }

    /** `content[0].text` da resposta da Messages API. */
    private String texto(String corpo) {
        try {
            JsonNode conteudo = json.readTree(corpo).path("content");
            for (JsonNode bloco : conteudo) {
                if ("text".equals(bloco.path("type").asText())) {
                    return bloco.path("text").asText();
                }
            }
        } catch (IOException e) {
            throw new ErroDeNegocio(HttpStatus.BAD_GATEWAY, "A IA respondeu algo ilegivel.", e);
        }
        throw new ErroDeNegocio(HttpStatus.BAD_GATEWAY, "A IA respondeu sem texto nenhum.");
    }
}
