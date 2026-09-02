package com.projetofans.web.dto;

import com.projetofans.domain.TipoEvento;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/** `hora` e o unico campo opcional: obrigar horario faz o aluno inventar dado. */
public record CriarEventoRequest(
        @NotNull UUID materiaId,
        @NotNull TipoEvento tipo,
        @NotBlank String titulo,
        @NotNull LocalDate data,
        LocalTime hora,
        // Vazia significa "na sala de sempre", que e o caso normal. Preenchida e
        // a excecao daquele dia — a prova que caiu na sala de outro periodo.
        @Size(max = 40) String sala) {
}
