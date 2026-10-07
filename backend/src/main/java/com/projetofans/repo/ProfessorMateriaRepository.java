package com.projetofans.repo;

import com.projetofans.domain.ProfessorMateria;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ProfessorMateriaRepository
        extends JpaRepository<ProfessorMateria, ProfessorMateria.Chave> {

    /**
     * Tudo que o usuario declarou, em TODAS as turmas (a turma vem da materia).
     * Quem precisa de uma turma so filtra pelas materias dela.
     */
    List<ProfessorMateria> findByChaveUsuarioId(UUID usuarioId);

    /**
     * Apaga as declaracoes do usuario nas materias DESTA turma e so nelas — a
     * declaracao vale por turma, e a das outras turmas dele nao pode ir junto.
     * Bulk (um DELETE so), e por isso limpa o contexto: sem isso as instancias ja
     * carregadas ficariam como "existentes" e um declarar logo depois, com a mesma
     * chave, viraria merge sem INSERT — a declaracao nova se perderia em silencio.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            delete from ProfessorMateria pm
            where pm.chave.usuarioId = :usuarioId
              and pm.chave.materiaId in (select ma.id from Materia ma where ma.turmaId = :turmaId)
            """)
    void apagarDaTurma(@Param("usuarioId") UUID usuarioId, @Param("turmaId") UUID turmaId);
}
