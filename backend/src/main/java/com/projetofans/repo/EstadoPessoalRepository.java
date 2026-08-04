package com.projetofans.repo;

import com.projetofans.domain.EstadoPessoal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EstadoPessoalRepository
        extends JpaRepository<EstadoPessoal, EstadoPessoal.Chave> {

    Optional<EstadoPessoal> findByChaveUsuarioIdAndChaveEventoId(UUID usuarioId, UUID eventoId);

    /** Sempre filtrado por usuario: o estado de A nunca pode aparecer no quadro de B. */
    List<EstadoPessoal> findByChaveUsuarioId(UUID usuarioId);
}
