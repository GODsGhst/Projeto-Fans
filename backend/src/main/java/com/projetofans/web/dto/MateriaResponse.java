package com.projetofans.web.dto;

import com.projetofans.domain.Materia;

import java.util.UUID;

/**
 * Materia como o app a ve.
 *
 * `turmaId` e `criadoEm` ficam de fora: o app resolve uma turma so, entao repetir
 * o id dela em cada item e ruido, e a data de criacao da materia nao aparece em
 * tela nenhuma. DTO magro tambem e o que impede campo novo da entidade de vazar
 * sozinho para a API.
 */
public record MateriaResponse(UUID id, String nome, String sigla, String corHex) {

    public static MateriaResponse de(Materia materia) {
        return new MateriaResponse(
                materia.getId(), materia.getNome(), materia.getSigla(), materia.getCorHex());
    }
}
