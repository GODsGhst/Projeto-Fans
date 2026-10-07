package com.projetofans.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * "Este professor leciona esta materia" (spec 2.3). A declaracao vale na hora, sem
 * fila: nada e aprovado antes de existir, a correcao vem depois do fato.
 *
 * A turma NAO e coluna daqui: sai de `materia.turma_id`. Materia e por turma
 * ("Calculo na turma A" e "Calculo na turma B" sao duas linhas em `materia`),
 * entao repetir turma_id so criaria uma segunda verdade que pode discordar da
 * primeira.
 *
 * E configuracao do docente, nao fato compartilhado: aceita DELETE fisico (o
 * nao-negociavel 2 fala de evento e material). Declarar uma materia nao da poder
 * sozinho — o poder exige tambem conta aprovada, vinculo na turma e vinculo nao
 * contestado (spec 2.2); isso e regra do PoderNaTurma, nao desta tabela.
 */
@Entity
@Table(name = "professor_materia")
public class ProfessorMateria {

    @EmbeddedId
    private Chave chave;

    /**
     * O banco preenche now(); `@Generated` manda o Hibernate reler apos o INSERT,
     * senao a instancia salva ficaria com `declaradoEm` nulo (mesmo motivo do
     * `Membro.entrouEm`).
     */
    @Generated(event = EventType.INSERT)
    @Column(name = "declarado_em", nullable = false, insertable = false, updatable = false)
    private Instant declaradoEm;

    protected ProfessorMateria() {
    }

    public ProfessorMateria(UUID usuarioId, UUID materiaId) {
        this.chave = new Chave(usuarioId, materiaId);
    }

    public Chave getChave() {
        return chave;
    }

    public UUID getUsuarioId() {
        return chave.getUsuarioId();
    }

    public UUID getMateriaId() {
        return chave.getMateriaId();
    }

    public Instant getDeclaradoEm() {
        return declaradoEm;
    }

    @Embeddable
    public static class Chave implements Serializable {

        @Column(name = "usuario_id", nullable = false)
        private UUID usuarioId;

        @Column(name = "materia_id", nullable = false)
        private UUID materiaId;

        protected Chave() {
        }

        public Chave(UUID usuarioId, UUID materiaId) {
            this.usuarioId = usuarioId;
            this.materiaId = materiaId;
        }

        public UUID getUsuarioId() {
            return usuarioId;
        }

        public UUID getMateriaId() {
            return materiaId;
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
                && Objects.equals(materiaId, outra.materiaId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(usuarioId, materiaId);
        }
    }
}
