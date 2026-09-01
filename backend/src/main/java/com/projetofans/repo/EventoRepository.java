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
     *
     * O EXISTS sobre acao_moderacao e a resposta a A16, e sem ele o paragrafo acima
     * seria mentira: `ocultar` NAO toca em `atualizado_em` (a entidade diz, desde a
     * Task 2, que "ocultar nao e edicao de conteudo"), entao o registro que o lider
     * escondeu nunca entrava neste delta. A alternativa era fazer ocultar carimbar
     * `atualizado_em`, o que apagaria essa distincao e mexeria numa das colunas que
     * o teste de R13 compara. A linha de auditoria ja existe e a moderacao SEMPRE a
     * grava: da para ler a mudanca de visibilidade dali sem inventar coluna nova.
     *
     * `>=` e nao `>`: o app usa `servidorEm` da resposta anterior como `desde`, e
     * num delta de notificacao reenviar um item ja conhecido nao custa nada (o
     * aparelho regrava a mesma linha), enquanto pular um item por empate de
     * timestamp deixa a notificacao errada agendada.
     */
    @Query("""
        select e from Evento e
        where e.turmaId = :turmaId
          and (e.atualizadoEm >= :desde
               or exists (select 1 from AcaoModeracao a
                          where a.registroTipo = com.projetofans.domain.RegistroTipo.EVENTO
                            and a.registroId = e.id
                            and a.em >= :desde))
        """)
    List<Evento> alteradosDesde(@Param("turmaId") UUID turmaId,
                                @Param("desde") java.time.Instant desde);

    /**
     * A Home inteira: janela, ordenacao e teto, em um SQL so.
     *
     * O LIMIT 6 esta AQUI e nao num subList em Java. Trazer a turma inteira para
     * cortar na memoria funciona hoje e fica lento sem ninguem perceber.
     *
     * A ordenacao e a Secao 2.6 do spec, na ordem exata: data, hora com nulos por
     * ultimo, PROVA antes de ENTREGA, criado_em. O criterio de tipo e o TERCEIRO
     * de proposito — promove-lo a primeiro transformaria ordenacao em agrupamento
     * por tipo, que o handoff proibe.
     *
     * feito sai do left join com estado_pessoal filtrado pelo usuario. Nao existe
     * coluna feito em evento, e criar uma apagaria o nao-negociavel 3.
     */
    @Query(value = """
        select e.id, e.tipo, e.titulo, e.data_evento, e.hora_evento,
               m.sigla, m.cor_hex,
               e.autor_id, u.nome as autor_nome, e.criado_em, e.atualizado_em,
               coalesce(ep.feito, false) as feito
        from evento e
        join materia m on m.id = e.materia_id
        join usuario u on u.id = e.autor_id
        left join estado_pessoal ep on ep.evento_id = e.id and ep.usuario_id = :usuarioId
        where e.turma_id = :turmaId
          and e.visivel_turma
          and e.excluido_em is null
          and e.data_evento >= current_date
          and e.data_evento <= current_date + 14
        order by e.data_evento asc,
                 e.hora_evento asc nulls last,
                 case e.tipo when 'PROVA' then 0 else 1 end,
                 e.criado_em asc
        limit 6
        """, nativeQuery = true)
    List<Object[]> home(@Param("turmaId") UUID turmaId, @Param("usuarioId") UUID usuarioId);

    Optional<Evento> findByIdAndTurmaId(UUID id, UUID turmaId);
}
