package com.projetofans.repo;

import com.projetofans.domain.Nota;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface NotaRepository extends JpaRepository<Nota, UUID> {

    /**
     * As notas que EU posso ler no periodo: as da turma, e as minhas pessoais.
     *
     * A clausula do alcance NAO e opcional nem enfeite de query. E aqui que a
     * privacidade da nota pessoal acontece: um `where turmaId = :turmaId` sem
     * ela devolveria o rascunho de todo mundo para todo mundo. A regra mora na
     * consulta, e nao numa filtragem depois, porque dado que nao sai do banco
     * nao vaza por um caminho que alguem esqueceu de filtrar.
     */
    @Query("""
        select n from Nota n
        where n.turmaId = :turmaId
          and n.excluidoEm is null
          and n.data between :de and :ate
          and (n.alcance = com.projetofans.domain.AlcanceNota.TURMA or n.autorId = :euId)
        order by n.data asc, n.criadoEm asc
        """)
    List<Nota> queEuLeioNoPeriodo(@Param("turmaId") UUID turmaId,
                                  @Param("euId") UUID euId,
                                  @Param("de") LocalDate de,
                                  @Param("ate") LocalDate ate);
}
