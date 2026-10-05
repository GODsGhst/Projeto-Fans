package com.projetofans.web.dto;

/**
 * Resposta do PATCH /eu. Vem com JWT novo sempre: o token carrega o nome
 * (JwtService.emitir), e sem trocar o token o app continuaria mandando o nome
 * velho em toda requisicao ate ele expirar, 30 dias depois.
 */
public record PerfilAtualizadoResponse(String jwt, PerfilResponse perfil) {
}
