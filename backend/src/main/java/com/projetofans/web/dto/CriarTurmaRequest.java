package com.projetofans.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CriarTurmaRequest(
        @NotBlank @Size(max = 120) String nome,
        // Opcional: quem cria nem sempre sabe o periodo, e obrigar faz
        // inventar. Turma sem semestre e uma turma; turma com semestre errado e
        // uma mentira que ninguem consegue corrigir depois.
        @Size(max = 20) String semestre) {
}
