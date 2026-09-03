package com.projetofans.web.dto;

import com.projetofans.domain.AlcanceNota;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * Serve para criar e para editar, porque os campos sao os mesmos e PATCH aqui
 * SUBSTITUI o objeto (A13). Dois records identicos so dariam a chance de um
 * ganhar um campo que o outro nao ganhou.
 *
 * `alcance` e obrigatorio e nao tem padrao. Um padrao aqui seria escolher, no
 * lugar de quem escreve, entre "a turma inteira le" e "so eu leio" — e o custo
 * de errar essa escolha e assimetrico.
 */
public record SalvarNotaRequest(
        @NotNull AlcanceNota alcance,
        @NotNull LocalDate data,
        @NotBlank @Size(max = 2000) String texto) {
}
