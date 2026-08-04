package com.projetofans.repo;

import com.projetofans.domain.Materia;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MateriaRepository extends JpaRepository<Materia, UUID> {

    List<Materia> findByTurmaIdOrderBySiglaAsc(UUID turmaId);

    Optional<Materia> findByTurmaIdAndSigla(UUID turmaId, String sigla);
}
