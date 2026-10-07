package com.projetofans.web.dto;

import com.projetofans.domain.Material;
import com.projetofans.domain.TipoMaterial;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record MaterialResponse(
        UUID id,
        TipoMaterial tipo,
        String titulo,
        String url,
        String arquivoRef,
        LocalDate dataAula,
        UUID materiaId,
        AutoriaResponse autoria,
        int version,
        boolean visivelTurma,
        Instant excluidoEm,
        String resumo,
        Instant resumoEm) {

    /** A autoria (com selo e "editado por") vem pronta de {@code Autorias}. */
    public static MaterialResponse de(Material material, AutoriaResponse autoria) {
        return new MaterialResponse(
                material.getId(),
                material.getTipo(),
                material.getTitulo(),
                material.getUrl(),
                material.getArquivoRef(),
                material.getDataAula(),
                material.getMateriaId(),
                autoria,
                material.getVersion(),
                material.isVisivelTurma(),
                material.getExcluidoEm(),
                material.getResumo(),
                material.getResumoEm());
    }
}
