package com.projetofans.repo;

import com.projetofans.domain.Evento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Os predicados de visibilidade sao METODOS NOMEADOS aqui, e nenhum controller ou
 * service reescreve essas condicoes. Ha exatamente dois:
 *
 *   feed da turma   -> visivel, nao excluido, da turma
 *   nao listados    -> do proprio autor, oculto OU excluido
 */
public interface EventoRepository extends JpaRepository<Evento, UUID> {

    @Query("""
        select e from Evento e
        where e.turmaId = :turmaId
          and e.visivelTurma = true
          and e.excluidoEm is null
        order by e.dataEvento asc
        """)
    List<Evento> visiveisDaTurma(@Param("turmaId") UUID turmaId);

    @Query("""
        select e from Evento e
        where e.turmaId = :turmaId
          and e.visivelTurma = true
          and e.excluidoEm is null
          and e.dataEvento between :de and :ate
        order by e.dataEvento asc
        """)
    List<Evento> visiveisDaTurmaNoPeriodo(@Param("turmaId") UUID turmaId,
                                          @Param("de") LocalDate de,
                                          @Param("ate") LocalDate ate);

    @Query("""
        select e from Evento e
        where e.autorId = :autorId
          and (e.visivelTurma = false or e.excluidoEm is not null)
        order by e.dataEvento desc
        """)
    List<Evento> naoListadosDoAutor(@Param("autorId") UUID autorId);

    @Query("""
        select e from Evento e
        where e.materiaId = :materiaId
          and e.visivelTurma = true
          and e.excluidoEm is null
        order by e.dataEvento asc
        """)
    List<Evento> visiveisDaMateria(@Param("materiaId") UUID materiaId);

    /**
     * Delta para o reagendador local do app. Inclui ocultos e excluidos de proposito:
     * sem eles o aparelho manteria notificacao agendada para evento que a turma nao
     * ve mais — um fantasma que so some reinstalando.
     */
    @Query("""
        select e from Evento e
        where e.turmaId = :turmaId
          and e.atualizadoEm > :desde
        """)
    List<Evento> alteradosDesde(@Param("turmaId") UUID turmaId,
                                @Param("desde") java.time.Instant desde);

    Optional<Evento> findByIdAndTurmaId(UUID id, UUID turmaId);
}
