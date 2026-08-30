package com.projetofans.web.dto;

import jakarta.validation.constraints.NotBlank;

public record EsqueciSenhaRequest(@NotBlank String email) {
}
