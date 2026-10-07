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
     * As notas da TURMA que o lider ocultou. O filtro de alcance nao e enfeite: a
     * nota pode ter sido ocultada e depois o autor a trocou para PESSOAL, e rascunho
     * pessoal nunca sai do autor — nem para o lider, nem nesta lista.
     */
    @Query("""
        select n from Nota n
        where n.turmaId = :turmaId
          and n.alcance = com.projetofans.domain.AlcanceNota.TURMA
          and n.visivelTurma = false
          and n.excluidoEm is null
        order by n.data desc, n.criadoEm desc
        """)
    List<Nota> ocultasDaTurma(@Param("turmaId") UUID turmaId);

    /**
     * As notas que EU posso ler no periodo: as da turma, e as minhas pessoais.
     *
     * A clausula do alcance NAO e opcional nem enfeite de query. E aqui que a
     * privacidade da nota pessoal acontece: um `where turmaId = :turmaId` sem
     * ela devolveria o rascunho de todo mundo para todo mundo. A regra mora na
     * consulta, e nao numa filtragem depois, porque dado que nao sai do banco
     * nao vaza por um caminho que alguem esqueceu de filtrar.
     *
     * A nota da TURMA que o lider ocultou sai da lista de todo mundo MENOS de
     * quem escreveu — mesma regra de evento e material: ocultar tira da vista da
     * turma, nunca da existencia, e o autor continua vendo o que e dele.
     */
    @Query("""
        select n from Nota n
        where n.turmaId = :turmaId
          and n.excluidoEm is null
          and n.data between :de and :ate
          and (
                (n.alcance = com.projetofans.domain.AlcanceNota.TURMA
                   and (n.visivelTurma = true or n.autorId = :euId))
             or n.autorId = :euId
              )
        order by n.data asc, n.criadoEm asc
        """)
    List<Nota> queEuLeioNoPeriodo(@Param("turmaId") UUID turmaId,
                                  @Param("euId") UUID euId,
                                  @Param("de") LocalDate de,
                                  @Param("ate") LocalDate ate);
}
