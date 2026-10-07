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
 * A contestacao do lider (spec 2.4) como memoria duravel, por (turma, usuario).
 *
 * Existe porque o vinculo ({@link Membro}) e apagado quando o lider remove o
 * docente: contestar, remover e deixar o docente voltar pelo codigo limpava a
 * contestacao sem ninguem restaurar. A chave aqui NAO e o vinculo, entao a linha
 * sobrevive a remocao, e {@code TurmaService.entrar} faz o vinculo novo nascer
 * contestado a partir dela. Restaurar apaga a linha.
 *
 * E configuracao de moderacao, nao fato compartilhado: aceita DELETE fisico.
 */
@Entity
@Table(name = "contestacao_docente")
public class ContestacaoDocente {

    @EmbeddedId
    private Chave chave;

    @Column(name = "contestado_em", nullable = false)
    private Instant contestadoEm;

    @Column(name = "contestado_por", nullable = false)
    private UUID contestadoPor;

    protected ContestacaoDocente() {
    }

    public ContestacaoDocente(UUID turmaId, UUID usuarioId, Instant contestadoEm, UUID contestadoPor) {
        this.chave = new Chave(turmaId, usuarioId);
        this.contestadoEm = contestadoEm;
        this.contestadoPor = contestadoPor;
    }

    public Chave getChave() {
        return chave;
    }

    public Instant getContestadoEm() {
        return contestadoEm;
    }

    public UUID getContestadoPor() {
        return contestadoPor;
    }

    @Embeddable
    public static class Chave implements Serializable {

        @Column(name = "turma_id", nullable = false)
        private UUID turmaId;

        @Column(name = "usuario_id", nullable = false)
        private UUID usuarioId;

        protected Chave() {
        }

        public Chave(UUID turmaId, UUID usuarioId) {
            this.turmaId = turmaId;
            this.usuarioId = usuarioId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) {
                return true;
            }
            if (!(o instanceof Chave outra)) {
                return false;
            }
            return Objects.equals(turmaId, outra.turmaId)
                && Objects.equals(usuarioId, outra.usuarioId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(turmaId, usuarioId);
        }
    }
}
