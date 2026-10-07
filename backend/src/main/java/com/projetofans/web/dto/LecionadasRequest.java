package com.projetofans.web.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

/**
 * As materias que o professor leciona NESTA turma. Substitui o conjunto inteiro:
 * lista vazia = "nao leciono nenhuma". Ausente e 400 — apagar tudo sem querer por
 * causa de um corpo mal montado seria pior que recusar.
 */
public record LecionadasRequest(
        @NotNull @Size(max = 100) List<@NotNull UUID> materiaIds) {
}
