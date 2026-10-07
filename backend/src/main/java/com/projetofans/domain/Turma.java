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
    /**
     * Periodo atual, editavel e opcional.
     *
     * NAO faz parte da identidade: a turma e o grupo de pessoas, e ela sobrevive
     * a virada de periodo. Era NOT NULL e escrito uma unica vez na criacao, e o
     * resultado era "Fans 2026.2" ainda no ano seguinte, sem ninguem poder
     * corrigir. Dado que envelhece sozinho e nao pode ser atualizado e pior que
     * dado ausente, porque parece atual.
     */
    private String semestre;

    @Column(name = "codigo_convite", nullable = false, unique = true)
    private String codigoConvite;

    @Column(name = "criado_em", nullable = false, insertable = false, updatable = false)
    private Instant criadoEm;

    protected Turma() {
    }

    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm;

    public Turma(UUID id, String nome, String semestre, String codigoConvite) {
        this.id = id;
        this.nome = nome;
        this.semestre = emBrancoViraNulo(semestre);
        this.atualizadoEm = Instant.now();
        this.codigoConvite = codigoConvite;
    }

    public UUID getId() {
        return id;
    }

    /**
     * Renomear e atualizar o periodo. O codigo de convite NAO muda junto.
     *
     * Ele identifica a turma e esta anotado no celular de todo mundo; troca-lo
     * na virada de semestre expulsaria a turma inteira do proprio grupo.
     */
    public void renomear(String nome, String semestre, Instant agora) {
        this.nome = nome;
        this.semestre = emBrancoViraNulo(semestre);
        this.atualizadoEm = agora;
    }

    /**
     * Troca o codigo de convite. Ato deliberado do lider, nunca efeito colateral.
     *
     * O codigo antigo para de valer na hora, porque a busca em `entrar` e pelo
     * codigo atual. Quem ja esta na turma nao e tocado: o vinculo e a linha em
     * `membro`, nao o codigo. E por isso que `renomear` nao chama isto — trocar
     * o codigo na virada de semestre expulsaria o grupo do proprio grupo.
     */
    public void trocarCodigo(String novoCodigo, Instant agora) {
        this.codigoConvite = novoCodigo;
        this.atualizadoEm = agora;
    }

    /** Vazio e ausencia sao a mesma coisa; o banco so entende uma. */
    private static String emBrancoViraNulo(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }

    public Instant getAtualizadoEm() {
        return atualizadoEm;
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
