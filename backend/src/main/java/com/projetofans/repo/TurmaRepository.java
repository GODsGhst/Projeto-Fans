package com.projetofans.repo;

import com.projetofans.domain.Turma;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface TurmaRepository extends JpaRepository<Turma, UUID> {

    Optional<Turma> findByCodigoConvite(String codigoConvite);
}
