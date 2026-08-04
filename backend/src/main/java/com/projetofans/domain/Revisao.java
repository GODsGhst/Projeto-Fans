package com.projetofans.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * Historico append-only. Regra 2 do handoff: editar nao apaga o que havia antes.
 *
 * O snapshot guarda o estado ANTERIOR a mudanca, serializado como JSON. Guardar o
 * estado posterior seria redundante — ele esta na propria linha do registro.
 */
@Entity
@Table(name = "revisao")
public class Revisao {

    @Id
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "registro_tipo", nullable = false)
    private RegistroTipo registroTipo;

    @Column(name = "registro_id", nullable = false)
    private UUID registroId;

    @Column(name = "autor_id", nullable = false)
    private UUID autorId;

    @Column(nullable = false, insertable = false, updatable = false)
    private Instant em;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AcaoRevisao acao;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private String snapshot;

    protected Revisao() {
    }

    public Revisao(UUID id, RegistroTipo registroTipo, UUID registroId,
                   UUID autorId, AcaoRevisao acao, String snapshot) {
        this.id = id;
        this.registroTipo = registroTipo;
        this.registroId = registroId;
        this.autorId = autorId;
        this.acao = acao;
        this.snapshot = snapshot;
    }

    public UUID getId() {
        return id;
    }

    public RegistroTipo getRegistroTipo() {
        return registroTipo;
    }

    public UUID getRegistroId() {
        return registroId;
    }

    public UUID getAutorId() {
        return autorId;
    }

    public Instant getEm() {
        return em;
    }

    public AcaoRevisao getAcao() {
        return acao;
    }

    public String getSnapshot() {
        return snapshot;
    }
}
