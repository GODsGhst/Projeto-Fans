package com.projetofans.web.dto;

import com.projetofans.domain.Turma;

import java.util.UUID;

public record TurmaDto(UUID id, String nome, String semestre, String codigoConvite) {

    public static TurmaDto de(Turma turma) {
        return new TurmaDto(turma.getId(), turma.getNome(), turma.getSemestre(), turma.getCodigoConvite());
    }
}
