package com.projetofans.web.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Corpo de PUT /eventos/{id}/estado-pessoal.
 *
 * Boolean em caixa alta com @NotNull, nao boolean primitivo: um corpo sem o campo
 * viraria false silenciosamente no primitivo, e "desmarquei sem querer" e
 * exatamente o tipo de bug mudo que este app nao pode ter. Ausente vira 400.
 */
public record EstadoPessoalRequest(@NotNull Boolean feito) {
}
