package com.projetofans.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "turma")
public class Turma {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false)
    private String semestre;

    @Column(name = "codigo_convite", nullable = false, unique = true)
    private String codigoConvite;

    @Column(name = "criado_em", nullable = false, insertable = false, updatable = false)
    private Instant criadoEm;

    protected Turma() {
    }

    public Turma(UUID id, String nome, String semestre, String codigoConvite) {
        this.id = id;
        this.nome = nome;
        this.semestre = semestre;
        this.codigoConvite = codigoConvite;
    }

    public UUID getId() {
        return id;
    }

    public String getNome() {
        return nome;
    }

    public String getSemestre() {
        return semestre;
    }

    public String getCodigoConvite() {
        return codigoConvite;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }
}
