package com.projetofans.web.controller;

import org.springframework.boot.info.BuildProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;

/**
 * "A API esta no ar?" — a primeira pergunta de todo deploy, e a unica que nao
 * pode depender de ter conta.
 *
 * Sem isto, conferir se o servidor subiu significa bater num endpoint protegido e
 * interpretar um 401 como boa noticia. Isso confunde: 401 tambem e o que um proxy
 * mal configurado devolve, e a diferenca entre "no ar" e "no ar e funcionando" e
 * justamente o que se quer saber as 23h de um dia de entrega.
 *
 * O CAMPO `build`, E POR QUE ELE E UM DIGESTO E NAO UMA VERSAO
 * "No ar" e "no ar com o codigo que eu acabei de empurrar" sao perguntas
 * diferentes, e so a primeira tinha resposta. Descobrir a segunda custava criar
 * conta descartavel, turma e registro, so para ver se um campo novo aparecia na
 * resposta — ritual que ja consumiu meia hora e sujou o banco de producao.
 *
 * Mas a decisao original deste arquivo continua valendo: nao expor versao, host
 * nem uptime, porque isso ajuda quem estiver bisbilhotando a saber o que voce
 * roda e ha quanto tempo nao atualiza. Por isso `build` e um DIGESTO OPACO do
 * instante da compilacao: muda a cada deploy, o que responde a pergunta, e nao
 * revela versao, data nem dependencia nenhuma.
 *
 * Uso: guarde o valor antes do push e compare depois. Mudou, subiu.
 */
@RestController
@RequestMapping("/api/v1")
public class SaudeController {

    private final String build;

    public SaudeController(BuildProperties build) {
        this.build = digesto(build.getTime().toString());
    }

    @GetMapping("/saude")
    public Map<String, String> saude() {
        return Map.of("status", "ok", "build", build);
    }

    /** 8 hex do SHA-256. Identifica a compilacao sem descrever nada dela. */
    private static String digesto(String semente) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256")
                    .digest(semente.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(h, 0, 4);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 e obrigatorio em toda JVM; se faltar, o problema nao e aqui.
            throw new IllegalStateException(e);
        }
    }
}
