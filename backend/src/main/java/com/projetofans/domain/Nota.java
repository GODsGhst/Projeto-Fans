package com.projetofans.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Anotacao presa a um dia.
 *
 * Duas coisas opostas na mesma entidade, separadas por {@link AlcanceNota}:
 * TURMA e recado que todo mundo le, PESSOAL e rascunho que so o autor le. Sao a
 * mesma coisa para o banco — texto num dia — e coisas diferentes para quem le.
 *
 * `alcance` e EDITAVEL de proposito. O erro que mais vai acontecer aqui e
 * escrever um rascunho e perceber que ele devia ser recado (ou, pior, o
 * contrario). Sem poder trocar, a saida seria apagar e reescrever — e ninguem
 * reescreve, entao o recado simplesmente nao chega.
 */
@Entity
@Table(name = "nota")
public class Nota {

    @Id
    private UUID id;

    @Column(name = "turma_id", nullable = false, updatable = false)
    private UUID turmaId;

    @Column(name = "autor_id", nullable = false, updatable = false)
    private UUID autorId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AlcanceNota alcance;

    @Column(name = "data_nota", nullable = false)
    private LocalDate data;

    @Column(nullable = false)
    private String texto;

    @Column(name = "criado_em", nullable = false, insertable = false, updatable = false)
    private Instant criadoEm;

    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm;

    @Version
    @Column(nullable = false)
    private int version;

    /**
     * false = o lider tirou da lista da turma. So faz sentido em nota TURMA: a
     * PESSOAL nunca sai para outra pessoa, entao nao ha o que ocultar.
     */
    @Column(name = "visivel_turma", nullable = false)
    private boolean visivelTurma = true;

    @Column(name = "excluido_em")
    private Instant excluidoEm;

    protected Nota() {
    }

    public Nota(UUID id, UUID turmaId, UUID autorId, AlcanceNota alcance,
                LocalDate data, String texto, Instant agora) {
        this.id = id;
        this.turmaId = turmaId;
        this.autorId = autorId;
        this.alcance = alcance;
        this.data = data;
        this.texto = texto;
        this.atualizadoEm = agora;
    }

    /** PATCH substitui: todos os campos editaveis entram, inclusive o alcance. */
    public void editar(AlcanceNota alcance, LocalDate data, String texto, Instant agora) {
        this.alcance = alcance;
        this.data = data;
        this.texto = texto;
        this.atualizadoEm = agora;
    }

    public boolean isVisivelTurma() {
        return visivelTurma;
    }

    /**
     * NAO mexe em `atualizadoEm` nem na version: ocultar e ato do lider sobre a
     * lista, nao edicao do registro. Se contasse como edicao, quem estivesse com
     * a anotacao aberta levaria 409 por causa de uma acao que nao mudou o texto.
     */
    public void definirVisibilidadeTurma(boolean visivel) {
        this.visivelTurma = visivel;
    }

    public void excluirLogicamente(Instant agora) {
        this.excluidoEm = agora;
        this.atualizadoEm = agora;
    }

    public UUID getId() {
        return id;
    }

    public UUID getTurmaId() {
        return turmaId;
    }

    public UUID getAutorId() {
        return autorId;
    }

    public AlcanceNota getAlcance() {
        return alcance;
    }

    public LocalDate getData() {
        return data;
    }

    public String getTexto() {
        return texto;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public Instant getAtualizadoEm() {
        return atualizadoEm;
    }

    public int getVersion() {
        return version;
    }

    public Instant getExcluidoEm() {
        return excluidoEm;
    }
}
