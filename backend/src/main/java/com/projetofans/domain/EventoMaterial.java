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
 * Vinculo N:N entre evento e material.
 *
 * E desta tabela que sai a resposta "o que estudar pra essa prova". A tela de prova
 * mostra APENAS os materiais aqui vinculados — nunca a materia inteira.
 */
@Entity
@Table(name = "evento_material")
public class EventoMaterial {

    @EmbeddedId
    private Chave chave;

    @Column(name = "vinculado_por", nullable = false)
    private UUID vinculadoPor;

    @Column(name = "vinculado_em", nullable = false, insertable = false, updatable = false)
    private Instant vinculadoEm;

    protected EventoMaterial() {
    }

    public EventoMaterial(UUID eventoId, UUID materialId, UUID vinculadoPor) {
        this.chave = new Chave(eventoId, materialId);
        this.vinculadoPor = vinculadoPor;
    }

    public Chave getChave() {
        return chave;
    }

    public UUID getEventoId() {
        return chave.getEventoId();
    }

    public UUID getMaterialId() {
        return chave.getMaterialId();
    }

    public UUID getVinculadoPor() {
        return vinculadoPor;
    }

    public Instant getVinculadoEm() {
        return vinculadoEm;
    }

    @Embeddable
    public static class Chave implements Serializable {

        @Column(name = "evento_id", nullable = false)
        private UUID eventoId;

        @Column(name = "material_id", nullable = false)
        private UUID materialId;

        protected Chave() {
        }

        public Chave(UUID eventoId, UUID materialId) {
            this.eventoId = eventoId;
            this.materialId = materialId;
        }

        public UUID getEventoId() {
            return eventoId;
        }

        public UUID getMaterialId() {
            return materialId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) {
                return true;
            }
            if (!(o instanceof Chave outra)) {
                return false;
            }
            return Objects.equals(eventoId, outra.eventoId)
                && Objects.equals(materialId, outra.materialId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(eventoId, materialId);
        }
    }
}
