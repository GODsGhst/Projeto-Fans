package com.projetofans.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "materia")
public class Materia {

    @Id
    private UUID id;

    @Column(name = "turma_id", nullable = false)
    private UUID turmaId;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false)
    private String sigla;

    /**
     * Sai da paleta fixa de 12 cores, validada em contraste — o aluno escolhe da
     * paleta e nunca digita hex. E o que impede amarelo em fundo branco.
     * Ver docs/design/design-system-v1.html.
     */
    @Column(name = "cor_hex", nullable = false)
    private String corHex;

    @Column(name = "criado_em", nullable = false, insertable = false, updatable = false)
    private Instant criadoEm;

    protected Materia() {
    }

    public Materia(UUID id, UUID turmaId, String nome, String sigla, String corHex) {
        this.id = id;
        this.turmaId = turmaId;
        this.nome = nome;
        this.sigla = sigla;
        this.corHex = corHex;
    }

    public UUID getId() {
        return id;
    }

    public UUID getTurmaId() {
        return turmaId;
    }

    public String getNome() {
        return nome;
    }

    public String getSigla() {
        return sigla;
    }

    public String getCorHex() {
        return corHex;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }
}
