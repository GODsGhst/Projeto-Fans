package com.projetofans.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetSenhaRequest(
        @NotBlank String token,
        @NotBlank @Size(min = 8, max = 100) String novaSenha) {
}
