package com.projetofans.repo;

import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MembroRepository extends JpaRepository<Membro, UUID> {

    /**
     * Ordenado do mais recente para o mais antigo: o TurmaScopeResolver pega o
     * primeiro. Multiplas turmas esta fora de escopo, e ter mais de um vinculo
     * aqui e sinal de que alguem implementou por engano — o resolver loga aviso.
     */
    List<Membro> findByUsuarioIdOrderByEntrouEmDesc(UUID usuarioId);

    Optional<Membro> findByUsuarioIdAndTurmaId(UUID usuarioId, UUID turmaId);

    Optional<Membro> findByTurmaIdAndPapel(UUID turmaId, PapelMembro papel);

    boolean existsByUsuarioIdAndTurmaId(UUID usuarioId, UUID turmaId);

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
}
