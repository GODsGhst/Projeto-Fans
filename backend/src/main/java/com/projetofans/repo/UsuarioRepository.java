package com.projetofans.repo;

import com.projetofans.domain.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UsuarioRepository extends JpaRepository<Usuario, UUID> {

    Optional<Usuario> findByEmail(String email);

    Optional<Usuario> findByGoogleSub(String googleSub);

    boolean existsByEmail(String email);
}
