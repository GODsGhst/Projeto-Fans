package com.projetofans.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Estado pessoal, isolado do fato compartilhado.
 *
 * Esta tabela existir separada e o que faz a regra 3 do handoff ser garantida pelo
 * banco em vez de por disciplina: nao ha coluna `feito` em evento para alguem
 * preencher por engano. Marcar feito nao muda nada para mais ninguem.
 */
@Entity
@Table(name = "estado_pessoal")
public class EstadoPessoal {

    @EmbeddedId
    private Chave chave;

    @Column(nullable = false)
    private boolean feito;

    @Column(name = "feito_em")
    private Instant feitoEm;

    protected EstadoPessoal() {
    }

    public EstadoPessoal(UUID usuarioId, UUID eventoId, boolean feito, Instant agora) {
        this.chave = new Chave(usuarioId, eventoId);
        this.feito = feito;
        this.feitoEm = feito ? agora : null;
    }

    public Chave getChave() {
        return chave;
    }

    public UUID getUsuarioId() {
        return chave.getUsuarioId();
    }

    public UUID getEventoId() {
        return chave.getEventoId();
    }

    public boolean isFeito() {
        return feito;
    }

    public Instant getFeitoEm() {
        return feitoEm;
    }

    public void marcar(boolean feito, Instant agora) {
        this.feito = feito;
        this.feitoEm = feito ? agora : null;
    }

    @Embeddable
    public static class Chave implements Serializable {

        @Column(name = "usuario_id", nullable = false)
        private UUID usuarioId;

        @Column(name = "evento_id", nullable = false)
        private UUID eventoId;

        protected Chave() {
        }

        public Chave(UUID usuarioId, UUID eventoId) {
            this.usuarioId = usuarioId;
            this.eventoId = eventoId;
        }

        public UUID getUsuarioId() {
            return usuarioId;
        }

        public UUID getEventoId() {
            return eventoId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) {
                return true;
            }
            if (!(o instanceof Chave outra)) {
                return false;
            }
            return Objects.equals(usuarioId, outra.usuarioId)
                && Objects.equals(eventoId, outra.eventoId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(usuarioId, eventoId);
        }
    }
}
