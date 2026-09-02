package com.projetofans.web.dto;

import com.projetofans.domain.TipoMaterial;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.UUID;

/**
 * `url` e obrigatoria no MVP e `arquivo_ref` fica sempre nulo: envio de arquivo
 * e a Task 15, e a coluna existe so para que ligar isso depois seja uma tarefa e
 * nao uma migration de dados.
 */
public record CriarMaterialRequest(
        @NotNull UUID materiaId,
        @NotNull TipoMaterial tipo,
        @NotBlank String titulo,
        @NotBlank String url,
        // De qual aula este material e. Opcional: material adicional costuma nao
        // pertencer a uma aula, e obrigar data faria inventar uma.
        LocalDate dataAula) {
}
