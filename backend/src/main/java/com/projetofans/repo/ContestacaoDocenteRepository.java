package com.projetofans.repo;

import com.projetofans.domain.ContestacaoDocente;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ContestacaoDocenteRepository
        extends JpaRepository<ContestacaoDocente, ContestacaoDocente.Chave> {
}
