package com.projetofans.web.dto;

import com.projetofans.domain.TipoMaterial;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/** Substituicao por inteiro, pelo mesmo motivo de AtualizarEventoRequest. */
public record AtualizarMaterialRequest(
        @NotNull UUID materiaId,
        @NotNull TipoMaterial tipo,
        @NotBlank String titulo,
        @NotBlank String url) {
}
