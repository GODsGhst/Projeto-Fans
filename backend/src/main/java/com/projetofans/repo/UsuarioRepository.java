package com.projetofans.repo;

import com.projetofans.domain.Usuario;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface UsuarioRepository extends JpaRepository<Usuario, UUID> {

    Optional<Usuario> findByEmail(String email);

    Optional<Usuario> findByGoogleSub(String googleSub);

    boolean existsByEmail(String email);

    /**
     * Trava (SELECT ... FOR UPDATE) a linha da conta ate o fim da transacao. Serializa
     * os pedidos simultaneos de UMA conta que dependem de "quantas ja fez": sem a
     * trava, N criacoes de turma em paralelo leem todas a mesma contagem e o teto
     * do docente nao aprovado nao segura nenhuma.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from Usuario u where u.id = :id")
    Optional<Usuario> travarPorId(@Param("id") UUID id);
}
