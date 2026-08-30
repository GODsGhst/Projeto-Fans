package com.projetofans.web.dto;

import jakarta.validation.constraints.NotBlank;

public record EntrarNaTurmaRequest(@NotBlank String codigoConvite) {
}
