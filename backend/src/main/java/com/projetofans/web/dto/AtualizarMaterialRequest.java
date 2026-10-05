package com.projetofans.web.dto;

import com.projetofans.domain.TipoMaterial;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.time.LocalDate;
import java.util.UUID;

/** Substituicao por inteiro, pelo mesmo motivo de AtualizarEventoRequest. */
public record AtualizarMaterialRequest(
        @NotNull UUID materiaId,
        @NotNull TipoMaterial tipo,
        @NotBlank String titulo,
        // So http(s): a url vira href para a turma inteira, e o sanitizador do
        // Angular barra so javascript: — data:, intent: e file: passariam (achado C1).
        @NotBlank
        @Pattern(regexp = "(?i)https?://\\S+", message = "o link precisa começar com http:// ou https://")
        String url,
        /** Mesmo motivo da sala em AtualizarEventoRequest: campo editavel entra aqui. */
        LocalDate dataAula) {
}
