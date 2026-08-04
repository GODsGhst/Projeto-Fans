package com.projetofans.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Registro de moderacao. Toda acao do lider fica aqui, o que e o contrapeso do papel:
 * ele pode ocultar, mas nao pode fazer isso em silencio.
 *
 * Moderacao e sempre POSTERIOR ao fato. Nada e aprovado antes de existir — postar
 * continua livre, sem fila e sem gate.
 */
@Entity
@Table(name = "acao_moderacao")
public class AcaoModeracao {

    @Id
    private UUID id;

    /** NULL em TRANSFERIR_LIDERANCA, que nao tem registro alvo. */
    @Enumerated(EnumType.STRING)
    @Column(name = "registro_tipo")
    private RegistroTipo registroTipo;

    @Column(name = "registro_id")
    private UUID registroId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AcaoModeracaoTipo acao;

    @Column(name = "lider_id", nullable = false)
    private UUID liderId;

    @Column(nullable = false, insertable = false, updatable = false)
    private Instant em;

    @Column
    private String motivo;

    protected AcaoModeracao() {
    }

    public static AcaoModeracao sobreRegistro(UUID id, RegistroTipo registroTipo, UUID registroId,
                                              AcaoModeracaoTipo acao, UUID liderId, String motivo) {
        AcaoModeracao a = new AcaoModeracao();
        a.id = id;
        a.registroTipo = registroTipo;
        a.registroId = registroId;
        a.acao = acao;
        a.liderId = liderId;
        a.motivo = motivo;
        return a;
    }

    public static AcaoModeracao transferenciaDeLideranca(UUID id, UUID liderId, String motivo) {
        AcaoModeracao a = new AcaoModeracao();
        a.id = id;
        a.acao = AcaoModeracaoTipo.TRANSFERIR_LIDERANCA;
        a.liderId = liderId;
        a.motivo = motivo;
        return a;
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

    public AcaoModeracaoTipo getAcao() {
        return acao;
    }

    public UUID getLiderId() {
        return liderId;
    }

    public Instant getEm() {
        return em;
    }

    public String getMotivo() {
        return motivo;
    }
}
