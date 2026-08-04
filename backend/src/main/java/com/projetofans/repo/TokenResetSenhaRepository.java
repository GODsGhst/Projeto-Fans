package com.projetofans.repo;

import com.projetofans.domain.TokenResetSenha;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface TokenResetSenhaRepository extends JpaRepository<TokenResetSenha, UUID> {

    Optional<TokenResetSenha> findByTokenHash(String tokenHash);
}
