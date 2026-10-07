package com.projetofans.repo;

import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MembroRepository extends JpaRepository<Membro, UUID> {

    /**
     * Ordenado do mais recente para o mais antigo: sem o cabecalho X-Turma-Id o
     * TurmaScopeResolver pega o primeiro. Aluno tem um vinculo so; mais de um e
     * docente (que manda o cabecalho) ou bug — o resolver loga aviso.
     */
    List<Membro> findByUsuarioIdOrderByEntrouEmDesc(UUID usuarioId);

    Optional<Membro> findByUsuarioIdAndTurmaId(UUID usuarioId, UUID turmaId);

    Optional<Membro> findByTurmaIdAndPapel(UUID turmaId, PapelMembro papel);

    boolean existsByUsuarioIdAndTurmaId(UUID usuarioId, UUID turmaId);

    boolean existsByUsuarioId(UUID usuarioId);

    List<Membro> findByTurmaId(UUID turmaId);

    /**
     * Trava (SELECT ... FOR UPDATE) o vinculo do usuario ate o fim da transacao.
     *
     * Serializa as operacoes que dependem de "este usuario e o lider": remover
     * membro e transferir lideranca. Sem a trava, o lider remove X enquanto
     * transfere a lideranca para X — cada transacao le o estado de antes da outra,
     * e a turma termina sem lider (o indice parcial garante no MAXIMO um, nao pelo
     * menos um).
     *
     * Tem de ser a PRIMEIRA consulta da transacao: se o vinculo ja estiver carregado
     * (o TurmaScopeResolver o carrega), o Hibernate devolve a instancia em memoria
     * e o papel lido antes de esperar a trava vale como se fosse atual.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from Membro m where m.usuarioId = :usuarioId")
    List<Membro> travarDoUsuario(@Param("usuarioId") UUID usuarioId);

    /**
     * Tenta entrar como LIDER; devolve 0 (sem erro) se a turma ja tem um.
     *
     * E um INSERT ... ON CONFLICT DO NOTHING de proposito, e nao "ver se ha lider,
     * depois salvar": o indice parcial membro_um_lider_por_turma garante um so, mas
     * no Postgres uma violacao de indice ABORTA a transacao inteira (25P02) — nao da
     * para capturar a excecao e tentar de novo como ALUNO na mesma transacao. O
     * ON CONFLICT resolve no proprio comando: quem perde a corrida espera o
     * vencedor commitar, nao insere nada e entra como ALUNO logo em seguida.
     */
    @Modifying
    @Query(value = "insert into membro (id, usuario_id, turma_id, papel) "
            + "values (:id, :usuarioId, :turmaId, 'LIDER') "
            + "on conflict (turma_id) where papel = 'LIDER' do nothing", nativeQuery = true)
    int entrarComoLiderSeVago(@Param("id") UUID id, @Param("usuarioId") UUID usuarioId,
                              @Param("turmaId") UUID turmaId);

    /**
     * Docentes da turma numa query so: vinculo + conta (status) + materias que cada um
     * declarou NESTA turma. Uma linha por materia declarada; docente sem nenhuma
     * declaracao sai numa linha com a ultima coluna nula (LEFT JOIN).
     *
     * Colunas: usuarioId, papel, docenteStatus, contestadoEm, materiaId.
     *
     * A subquery em `materia` e o que impede uma declaracao de outra turma de contar
     * aqui: `professor_materia` nao tem turma_id (a turma sai de materia.turma_id),
     * entao sem este filtro o poder de A vazaria para B. O status vem da linha do
     * banco, e nao do JWT: recusar um aprovado corta o poder na proxima requisicao.
     */
    @Query("""
            select m.usuarioId, m.papel, u.docenteStatus, m.docenteContestadoEm, pm.chave.materiaId
            from Membro m
            join Usuario u on u.id = m.usuarioId
            left join ProfessorMateria pm on pm.chave.usuarioId = m.usuarioId
                 and pm.chave.materiaId in (select ma.id from Materia ma where ma.turmaId = :turmaId)
            where m.turmaId = :turmaId and m.papel in :papeis
            """)
    List<Object[]> docentesDaTurma(@Param("turmaId") UUID turmaId,
                                   @Param("papeis") Collection<PapelMembro> papeis);
}
