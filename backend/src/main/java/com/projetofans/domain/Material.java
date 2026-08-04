package com.projetofans.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "material")
public class Material {

    @Id
    private UUID id;

    @Column(name = "turma_id", nullable = false)
    private UUID turmaId;

    @Column(name = "materia_id", nullable = false)
    private UUID materiaId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoMaterial tipo;

    @Column(nullable = false)
    private String titulo;

    @Column
    private String url;

    /**
     * Sempre NULL no MVP: upload de arquivo nao esta implementado (ver
     * PERGUNTAS-ABERTAS.md A4). Upload exige storage de objeto, politica de tamanho
     * e limpeza de orfaos — e subsistema, nao campo. A coluna existe para que ligar
     * isso depois seja uma tarefa, e nao uma migration de dados.
     */
    @Column(name = "arquivo_ref")
    private String arquivoRef;

    @Column(name = "autor_id", nullable = false, updatable = false)
    private UUID autorId;

    @Column(name = "criado_em", nullable = false, insertable = false, updatable = false)
    private Instant criadoEm;

    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm;

    @Version
    @Column(nullable = false)
    private int version;

    @Column(name = "visivel_turma", nullable = false)
    private boolean visivelTurma = true;

    @Column(name = "excluido_em")
    private Instant excluidoEm;

    protected Material() {
    }

    public Material(UUID id, UUID turmaId, UUID materiaId, TipoMaterial tipo,
                    String titulo, String url, UUID autorId, Instant agora) {
        this.id = id;
        this.turmaId = turmaId;
        this.materiaId = materiaId;
        this.tipo = tipo;
        this.titulo = titulo;
        this.url = url;
        this.autorId = autorId;
        this.atualizadoEm = agora;
        this.visivelTurma = true;
    }

    public UUID getId() {
        return id;
    }

    public UUID getTurmaId() {
        return turmaId;
    }

    public UUID getMateriaId() {
        return materiaId;
    }

    public TipoMaterial getTipo() {
        return tipo;
    }

    public String getTitulo() {
        return titulo;
    }

    public String getUrl() {
        return url;
    }

    public String getArquivoRef() {
        return arquivoRef;
    }

    public UUID getAutorId() {
        return autorId;
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

    public boolean isVisivelTurma() {
        return visivelTurma;
    }

    public Instant getExcluidoEm() {
        return excluidoEm;
    }

    public boolean estaExcluido() {
        return excluidoEm != null;
    }

    public void editar(UUID materiaId, TipoMaterial tipo, String titulo, String url, Instant agora) {
        this.materiaId = materiaId;
        this.tipo = tipo;
        this.titulo = titulo;
        this.url = url;
        this.atualizadoEm = agora;
    }

    public void excluirLogicamente(Instant agora) {
        this.excluidoEm = agora;
        this.atualizadoEm = agora;
    }

    public void definirVisibilidadeTurma(boolean visivel) {
        this.visivelTurma = visivel;
    }
}
