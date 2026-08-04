package com.projetofans.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Alvo do data-push. Quando alguem cadastra um evento, o backend avisa os aparelhos
 * da turma para que eles sincronizem e REAGENDEM a notificacao local da vespera.
 *
 * O alerta em si e local, nao remoto: assim hibernacao do servidor nao pode quebra-lo.
 */
@Entity
@Table(name = "device_token")
public class DeviceToken {

    @Id
    private UUID id;

    @Column(name = "usuario_id", nullable = false)
    private UUID usuarioId;

    @Column(name = "fcm_token", nullable = false, unique = true)
    private String fcmToken;

    @Column(nullable = false)
    private String plataforma;

    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm;

    protected DeviceToken() {
    }

    public DeviceToken(UUID id, UUID usuarioId, String fcmToken, String plataforma, Instant agora) {
        this.id = id;
        this.usuarioId = usuarioId;
        this.fcmToken = fcmToken;
        this.plataforma = plataforma;
        this.atualizadoEm = agora;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUsuarioId() {
        return usuarioId;
    }

    public String getFcmToken() {
        return fcmToken;
    }

    public String getPlataforma() {
        return plataforma;
    }

    public Instant getAtualizadoEm() {
        return atualizadoEm;
    }

    /** Mesmo token reaparecendo com outro dono ou so renovado: atualiza, nao duplica. */
    public void renovar(UUID usuarioId, String plataforma, Instant agora) {
        this.usuarioId = usuarioId;
        this.plataforma = plataforma;
        this.atualizadoEm = agora;
    }
}
