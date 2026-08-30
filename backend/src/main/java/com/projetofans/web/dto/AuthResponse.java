package com.projetofans.web.dto;

public record AuthResponse(String jwt, UsuarioDto usuario) {
}
