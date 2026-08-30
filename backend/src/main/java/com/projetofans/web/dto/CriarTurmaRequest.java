package com.projetofans.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CriarTurmaRequest(
        @NotBlank @Size(max = 120) String nome,
        @NotBlank @Size(max = 20) String semestre) {
}
