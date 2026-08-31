package com.projetofans.web.dto;

import com.projetofans.domain.TipoEvento;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/**
 * PATCH substitui os campos editaveis por inteiro — nao e um merge parcial.
 *
 * A razao e `hora`: num merge, "campo ausente ou nulo mantem o atual" tornaria
 * impossivel APAGAR a hora de um evento, e o aluno que corrige "na verdade nao
 * tem horario" ficaria preso a um dado errado em silencio. Exigindo o objeto
 * inteiro, `hora: null` significa exatamente uma coisa: nao tem hora.
 */
public record AtualizarEventoRequest(
        @NotNull UUID materiaId,
        @NotNull TipoEvento tipo,
        @NotBlank String titulo,
        @NotNull LocalDate data,
        LocalTime hora) {
}
