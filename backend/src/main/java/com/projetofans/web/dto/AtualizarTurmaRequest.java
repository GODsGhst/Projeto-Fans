package com.projetofans.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Renomear a turma e acertar o periodo.
 *
 * O codigo de convite NAO entra aqui, de proposito: ele identifica a turma e
 * esta anotado no celular de todo mundo. Trocar o codigo na virada de semestre
 * expulsaria a turma inteira do proprio grupo.
 */
public record AtualizarTurmaRequest(
        @NotBlank @Size(max = 120) String nome,
        @Size(max = 20) String semestre) {
}
