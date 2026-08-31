package com.projetofans.web.dto;

import com.projetofans.domain.Material;
import com.projetofans.domain.TipoMaterial;

import java.time.Instant;
import java.util.UUID;

public record MaterialResponse(
        UUID id,
        TipoMaterial tipo,
        String titulo,
        String url,
        String arquivoRef,
        UUID materiaId,
        AutoriaResponse autoria,
        int version,
        boolean visivelTurma,
        Instant excluidoEm) {

    public static MaterialResponse de(Material material, String autorNome) {
        return new MaterialResponse(
                material.getId(),
                material.getTipo(),
                material.getTitulo(),
                material.getUrl(),
                material.getArquivoRef(),
                material.getMateriaId(),
                new AutoriaResponse(material.getAutorId(), autorNome,
                        material.getCriadoEm(), material.getAtualizadoEm()),
                material.getVersion(),
                material.isVisivelTurma(),
                material.getExcluidoEm());
    }
}
