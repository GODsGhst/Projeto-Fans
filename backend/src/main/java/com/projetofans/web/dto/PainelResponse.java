package com.projetofans.web.dto;

import com.projetofans.domain.Selo;

import java.util.List;
import java.util.UUID;

/**
 * GET /painel do docente (spec PC9, secao 7).
 *
 * - professor so ve eventos das materias declaradas, teto 6 por turma
 * - coordenador ve toda a turma
 * - proximos reaproveita query/comparador da HomeService (14 dias, teto 6)
 */
public record PainelResponse(List<TurmaComProximos> turmas) {

    public record TurmaComProximos(
            UUID turmaId,
            String nome,
            String semestre,
            String papel,  // "PROFESSOR" ou "COORDENADOR"
            Selo selo,     // null se pendente/recusado/contestado
            boolean contestado,
            List<MateriaTeacherInfo> lecionadas,
            List<ItemHomeResponse> proximos) {
    }

    public record MateriaTeacherInfo(UUID materiaId, String sigla, String corHex) {
    }
}
