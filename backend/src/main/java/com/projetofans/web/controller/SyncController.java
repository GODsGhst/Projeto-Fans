package com.projetofans.web.controller;

import com.projetofans.security.UsuarioAtual;
import com.projetofans.service.SyncService;
import com.projetofans.web.dto.SyncResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

/**
 * `GET /sync?desde=` — o que mudou na turma desde o ultimo sync do aparelho.
 *
 * `desde` e opcional: o app recem-instalado nao tem `ultimoSync` para mandar, e
 * exigir o parametro faria a primeira sincronizacao da vida do aparelho ser um
 * 400. Ausente significa "manda tudo", que e exatamente o que ele precisa.
 */
@RestController
public class SyncController {

    private final SyncService sync;

    public SyncController(SyncService sync) {
        this.sync = sync;
    }

    @GetMapping("/api/v1/sync")
    public SyncResponse delta(
            @AuthenticationPrincipal UsuarioAtual eu,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant desde) {
        return sync.delta(eu, desde == null ? Instant.EPOCH : desde);
    }
}
