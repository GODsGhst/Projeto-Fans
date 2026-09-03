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
    /**
     * De que aula este material e, pela data. Nulo = nao se aplica.
     *
     * `LocalDate` e nao `Instant` de proposito: "a aula de 2 de setembro" e um
     * dia, e guardar instante faria o fuso mover a aula de dia.
     */
    @Column(name = "data_aula")
    private LocalDate dataAula;

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

    /**
     * Resumo por IA do arquivo em `url`. Da turma, nao de quem pediu: gerar
     * custa dinheiro da chave de quem pediu, e um resumo por pessoa faria os
     * trinta pagarem pelo mesmo PDF.
     */
    @Column(name = "resumo")
    private String resumo;

    @Column(name = "resumo_em")
    private Instant resumoEm;

    @Column(name = "resumo_por")
    private UUID resumoPor;

    protected Material() {
    }

    public Material(UUID id, UUID turmaId, UUID materiaId, TipoMaterial tipo,
                    String titulo, String url, UUID autorId, Instant agora) {
        this(id, turmaId, materiaId, tipo, titulo, url, null, autorId, agora);
    }

    public Material(UUID id, UUID turmaId, UUID materiaId, TipoMaterial tipo,
                    String titulo, String url, LocalDate dataAula, UUID autorId, Instant agora) {
        this.dataAula = dataAula;
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

    public LocalDate getDataAula() {
        return dataAula;
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

    /** Mesmo cuidado do Evento: PATCH substitui, entao `dataAula` entra aqui. */
    public void editar(UUID materiaId, TipoMaterial tipo, String titulo, String url,
                       LocalDate dataAula, Instant agora) {
        this.materiaId = materiaId;
        this.tipo = tipo;
        this.titulo = titulo;
        this.url = url;
        this.dataAula = dataAula;
        this.atualizadoEm = agora;
    }

    public String getResumo() {
        return resumo;
    }

    public Instant getResumoEm() {
        return resumoEm;
    }

    public UUID getResumoPor() {
        return resumoPor;
    }

    /**
     * NAO mexe em `atualizadoEm` nem na `version`.
     *
     * Gerar resumo nao e editar o material: se contasse como edicao, quem
     * estivesse com a tela de editar aberta levaria um 409 por causa de um
     * resumo que outra pessoa pediu, e o `/sync` acordaria os celulares da
     * turma inteira para um campo que nao muda nada do que foi combinado.
     */
    public void guardarResumo(String resumo, UUID porQuem, Instant agora) {
        this.resumo = resumo;
        this.resumoPor = porQuem;
        this.resumoEm = agora;
    }

    public void excluirLogicamente(Instant agora) {
        this.excluidoEm = agora;
        this.atualizadoEm = agora;
    }

    public void definirVisibilidadeTurma(boolean visivel) {
        this.visivelTurma = visivel;
    }
}
