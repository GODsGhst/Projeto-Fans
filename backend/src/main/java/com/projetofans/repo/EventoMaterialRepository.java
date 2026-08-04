package com.projetofans.repo;

import com.projetofans.domain.EventoMaterial;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EventoMaterialRepository
        extends JpaRepository<EventoMaterial, EventoMaterial.Chave> {

    List<EventoMaterial> findByChaveEventoId(UUID eventoId);

    long countByChaveEventoId(UUID eventoId);

    void deleteByChaveEventoIdAndChaveMaterialId(UUID eventoId, UUID materialId);

    boolean existsByChaveEventoIdAndChaveMaterialId(UUID eventoId, UUID materialId);
}
