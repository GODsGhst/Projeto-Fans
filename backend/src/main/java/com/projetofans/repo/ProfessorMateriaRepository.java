package com.projetofans.repo;

import com.projetofans.domain.ProfessorMateria;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ProfessorMateriaRepository
        extends JpaRepository<ProfessorMateria, ProfessorMateria.Chave> {

    /**
     * Tudo que o usuario declarou, em TODAS as turmas (a turma vem da materia).
     * Quem precisa de uma turma so filtra pelas materias dela.
     */
    List<ProfessorMateria> findByChaveUsuarioId(UUID usuarioId);
}
