package com.projetofans.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Token de uso unico para reset de senha.
 *
 * Guarda o HASH do token, nunca o token em si — vazamento do banco nao pode virar
 * tomada de conta. O valor em claro so existe no e-mail enviado.
 */
@Entity
@Table(name = "token_reset_senha")
public class TokenResetSenha {

    @Id
    private UUID id;

    @Column(name = "usuario_id", nullable = false)
    private UUID usuarioId;

    @Column(name = "token_hash", nullable = false, unique = true)
    private String tokenHash;

    @Column(name = "expira_em", nullable = false)
    private Instant expiraEm;

    @Column(name = "usado_em")
    private Instant usadoEm;

    @Column(name = "criado_em", nullable = false, insertable = false, updatable = false)
    private Instant criadoEm;

    protected TokenResetSenha() {
    }

    public TokenResetSenha(UUID id, UUID usuarioId, String tokenHash, Instant expiraEm) {
        this.id = id;
        this.usuarioId = usuarioId;
        this.tokenHash = tokenHash;
        this.expiraEm = expiraEm;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUsuarioId() {
        return usuarioId;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public Instant getExpiraEm() {
        return expiraEm;
    }

    public Instant getUsadoEm() {
        return usadoEm;
    }

    public boolean utilizavelEm(Instant agora) {
        return usadoEm == null && agora.isBefore(expiraEm);
    }

    public void consumir(Instant agora) {
        this.usadoEm = agora;
    }
}
