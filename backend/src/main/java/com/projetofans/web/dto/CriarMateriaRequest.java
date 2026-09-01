package com.projetofans.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * `corHex` e validada duas vezes, de proposito e em niveis diferentes: o
 * `@Pattern` aqui recusa o que nem parece cor, e o `MateriaService` recusa o que
 * parece cor mas nao esta entre as 12 validadas. A primeira e sintaxe, a segunda
 * e acessibilidade — e so a segunda sabe por que #FFFF00 e inaceitavel.
 */
public record CriarMateriaRequest(
        @NotBlank @Size(max = 80) String nome,
        @NotBlank @Size(max = 12) String sigla,
        @NotBlank @Pattern(regexp = "^#[0-9A-Fa-f]{6}$") String corHex) {
}
