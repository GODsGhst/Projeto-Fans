package com.projetofans.repo;

import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MembroRepository extends JpaRepository<Membro, UUID> {

    /**
     * Ordenado do mais recente para o mais antigo: o TurmaScopeResolver pega o
     * primeiro. Multiplas turmas esta fora de escopo, e ter mais de um vinculo
     * aqui e sinal de que alguem implementou por engano — o resolver loga aviso.
     */
    List<Membro> findByUsuarioIdOrderByEntrouEmDesc(UUID usuarioId);

    Optional<Membro> findByUsuarioIdAndTurmaId(UUID usuarioId, UUID turmaId);

    Optional<Membro> findByTurmaIdAndPapel(UUID turmaId, PapelMembro papel);

    boolean existsByUsuarioIdAndTurmaId(UUID usuarioId, UUID turmaId);

    List<Membro> findByTurmaId(UUID turmaId);
}
