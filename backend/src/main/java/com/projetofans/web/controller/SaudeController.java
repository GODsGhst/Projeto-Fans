package com.projetofans.web.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
 * Nao expoe versao, host, uptime nem nada que ajude quem estiver bisbilhotando.
 * So diz que esta de pe.
 */
@RestController
@RequestMapping("/api/v1")
public class SaudeController {

    @GetMapping("/saude")
    public Map<String, String> saude() {
        return Map.of("status", "ok");
    }
}
