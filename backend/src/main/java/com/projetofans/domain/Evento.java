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
import java.time.LocalTime;
import java.util.UUID;

/**
 * Fato compartilhado. Repare no que NAO existe aqui: nenhuma coluna `feito`.
 *
 * Estado pessoal vive em {@link EstadoPessoal}, tabela separada. Isso transforma a
 * regra 3 do handoff — "nunca gravar estado pessoal dentro do fato compartilhado" —
 * de regra escrita num documento para algo que o banco recusa violar.
 *
 * Se em algum momento parecer conveniente adicionar `feito` aqui para simplificar
 * uma query: e exatamente a violacao que este desenho existe para impedir.
 */
@Entity
@Table(name = "evento")
public class Evento {

    @Id
    private UUID id;

    @Column(name = "turma_id", nullable = false)
    private UUID turmaId;

    @Column(name = "materia_id", nullable = false)
    private UUID materiaId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoEvento tipo;

    @Column(nullable = false)
    private String titulo;

    @Column(name = "data_evento", nullable = false)
    private LocalDate dataEvento;

    /** Opcional. Obrigar hora faria o aluno inventar dado, e dado inventado corroi a confianca. */
    @Column(name = "hora_evento")
    private LocalTime horaEvento;

    /**
     * Sala DESTE evento, quando difere da habitual da materia.
     *
     * Nulo na imensa maioria dos casos, e nulo significa "na sala de sempre" —
     * quem le resolve olhando a materia. Copiar a sala da materia para ca em
     * toda criacao faria a disciplina mudar de sala e reescrever onde as provas
     * passadas aconteceram; elas aconteceram na sala antiga.
     */
    @Column(name = "sala")
    private String sala;

    @Column(name = "autor_id", nullable = false, updatable = false)
    private UUID autorId;

    @Column(name = "criado_em", nullable = false, insertable = false, updatable = false)
    private Instant criadoEm;

    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm;

    /** Locking otimista: edicao simultanea vira 409, nunca perda silenciosa. */
    @Version
    @Column(nullable = false)
    private int version;

    /** So a moderacao do lider mexe aqui. O conteudo nao muda junto. */
    @Column(name = "visivel_turma", nullable = false)
    private boolean visivelTurma = true;

    /** Exclusao e sempre logica: a regra 2 proibe apagar historico. */
    @Column(name = "excluido_em")
    private Instant excluidoEm;

    protected Evento() {
    }

    public Evento(UUID id, UUID turmaId, UUID materiaId, TipoEvento tipo, String titulo,
                  LocalDate dataEvento, LocalTime horaEvento, UUID autorId, Instant agora) {
        this(id, turmaId, materiaId, tipo, titulo, dataEvento, horaEvento, null, autorId, agora);
    }

    public Evento(UUID id, UUID turmaId, UUID materiaId, TipoEvento tipo, String titulo,
                  LocalDate dataEvento, LocalTime horaEvento, String sala, UUID autorId,
                  Instant agora) {
        this.sala = emBrancoViraNulo(sala);
        this.id = id;
        this.turmaId = turmaId;
        this.materiaId = materiaId;
        this.tipo = tipo;
        this.titulo = titulo;
        this.dataEvento = dataEvento;
        this.horaEvento = horaEvento;
        this.autorId = autorId;
        this.atualizadoEm = agora;
        this.visivelTurma = true;
    }

    /** Vazio e ausencia sao a mesma coisa; o banco so entende uma delas. */
    private static String emBrancoViraNulo(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }

    public String getSala() {
        return sala;
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

    public TipoEvento getTipo() {
        return tipo;
    }

    public String getTitulo() {
        return titulo;
    }

    public LocalDate getDataEvento() {
        return dataEvento;
    }

    public LocalTime getHoraEvento() {
        return horaEvento;
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

    /** So o autor chega aqui — a checagem de autoria e do service, e tem teste proprio. */
    /**
     * PATCH SUBSTITUI o objeto inteiro (A13), entao todo campo editavel entra
     * aqui — inclusive os que sao nulos na maioria das vezes.
     *
     * `sala` ficou de fora quando a coluna foi criada: so o caminho de CRIAR foi
     * ligado, e editar o titulo de uma prova ignorava a sala enviada, com
     * resposta 200. Perda silenciosa e o pior defeito possivel aqui, porque quem
     * editou nao tem como perceber.
     */
    public void editar(UUID materiaId, TipoEvento tipo, String titulo,
                       LocalDate dataEvento, LocalTime horaEvento, String sala, Instant agora) {
        this.materiaId = materiaId;
        this.tipo = tipo;
        this.titulo = titulo;
        this.dataEvento = dataEvento;
        this.horaEvento = horaEvento;
        this.sala = emBrancoViraNulo(sala);
        this.atualizadoEm = agora;
    }

    public void excluirLogicamente(Instant agora) {
        this.excluidoEm = agora;
        this.atualizadoEm = agora;
    }

    /**
     * Moderacao do lider. Muda SO visibilidade — nunca autor, titulo ou data.
     * Nao toca em atualizadoEm de proposito: ocultar nao e edicao de conteudo.
     */
    public void definirVisibilidadeTurma(boolean visivel) {
        this.visivelTurma = visivel;
    }
}
