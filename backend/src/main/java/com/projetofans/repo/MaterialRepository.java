package com.projetofans.repo;

import com.projetofans.domain.Material;
import com.projetofans.domain.TipoMaterial;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MaterialRepository extends JpaRepository<Material, UUID> {

    @Query("""
        select m from Material m
        where m.materiaId = :materiaId
          and m.tipo = :tipo
          and m.visivelTurma = true
          and m.excluidoEm is null
        order by m.criadoEm desc
        """)
    List<Material> visiveisDaMateriaPorTipo(@Param("materiaId") UUID materiaId,
                                            @Param("tipo") TipoMaterial tipo);

    @Query("""
        select m from Material m
        where m.autorId = :autorId
          and (m.visivelTurma = false or m.excluidoEm is not null)
        order by m.criadoEm desc
        """)
    List<Material> naoListadosDoAutor(@Param("autorId") UUID autorId);

    /** Meus materiais que ainda existem. */
    @Query("""
            SELECT m FROM Material m
            WHERE m.autorId = :autorId AND m.excluidoEm IS NULL
            """)
    List<Material> vivosDoAutor(@Param("autorId") UUID autorId);

    /**
     * SOMENTE os materiais vinculados ao evento. A tela de prova nunca despeja a
     * materia inteira — e desta consulta que sai "o que estudar pra essa prova".
     */
    @Query("""
        select m from Material m
        join EventoMaterial em on em.chave.materialId = m.id
        where em.chave.eventoId = :eventoId
          and m.visivelTurma = true
          and m.excluidoEm is null
        order by m.tipo asc, m.criadoEm desc
        """)
    List<Material> vinculadosAoEvento(@Param("eventoId") UUID eventoId);

    Optional<Material> findByIdAndTurmaId(UUID id, UUID turmaId);
}
