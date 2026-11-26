package com.projetofans.web.controller;

import com.projetofans.security.UsuarioAtual;
import com.projetofans.service.ArquivoService;
import com.projetofans.web.dto.MaterialResponse;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Contrato do envio (multipart/form-data): campo {@code arquivo} com o PDF, PNG
 * ou JPG e campo opcional {@code descricao}, que vira o titulo do material.
 * Responde 201 com o material criado, ja vinculado ao evento.
 */
@RestController
public class ArquivoController {

    private final ArquivoService arquivos;

    public ArquivoController(ArquivoService arquivos) {
        this.arquivos = arquivos;
    }

    @PostMapping(path = "/api/v1/eventos/{id}/arquivos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public MaterialResponse enviar(@AuthenticationPrincipal UsuarioAtual eu,
                                   @PathVariable UUID id,
                                   @RequestPart("arquivo") MultipartFile arquivo,
                                   @RequestParam(value = "descricao", required = false) String descricao) {
        return arquivos.enviarParaEvento(eu, id, arquivo, descricao);
    }

    @GetMapping("/api/v1/arquivos/{id}")
    public ResponseEntity<byte[]> baixar(@AuthenticationPrincipal UsuarioAtual eu, @PathVariable UUID id) {
        ArquivoService.Baixado arquivo = arquivos.baixar(eu, id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(arquivo.mime()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline().filename(arquivo.nome(), StandardCharsets.UTF_8)
                                .build().toString())
                .body(arquivo.conteudo());
    }
}
