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

    /**
     * Onde a materia cai normalmente. Nulo enquanto ninguem informou.
     *
     * O evento tem a propria sala para o caso excepcional (prova em outra sala).
     * Esta aqui e o padrao, nao um espelho: mudar a sala da disciplina nao pode
     * reescrever onde as provas passadas aconteceram.
     */
    @Column(name = "sala")
    private String sala;

    /** Quem da a materia. Nulo enquanto ninguem informou. */
    @Column(name = "professor")
    private String professor;

    @Column(name = "criado_em", nullable = false, insertable = false, updatable = false)
    private Instant criadoEm;

    protected Materia() {
    }

    public Materia(UUID id, UUID turmaId, String nome, String sigla, String corHex) {
        this(id, turmaId, nome, sigla, corHex, null, null);
    }

    public Materia(UUID id, UUID turmaId, String nome, String sigla, String corHex,
                   String sala, String professor) {
        this.id = id;
        this.turmaId = turmaId;
        this.nome = nome;
        this.sigla = sigla;
        this.corHex = corHex;
        this.sala = emBrancoViraNulo(sala);
        this.professor = emBrancoViraNulo(professor);
    }

    /**
     * String vazia e ausencia sao a mesma coisa aqui, e o banco so entende uma.
     * Sem isto, "" e null conviveriam na coluna e toda leitura precisaria testar
     * os dois — e alguem esqueceria de testar um deles.
     */
    private static String emBrancoViraNulo(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }

    /** Atualiza sala e professor. Nulo e valor valido: significa "nao informado". */
    public void anotarOndeEQuem(String sala, String professor) {
        this.sala = emBrancoViraNulo(sala);
        this.professor = emBrancoViraNulo(professor);
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

    public String getSala() {
        return sala;
    }

    public String getProfessor() {
        return professor;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }
}
