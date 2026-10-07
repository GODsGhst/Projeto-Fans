package com.projetofans.domain;

import com.projetofans.erro.ErroDeNegocio;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.UUID;

/**
 * Vinculo N:N entre usuario e turma.
 *
 * A forma N:N nao e especulacao sobre multiplas turmas: a entrada por convite ja
 * exige um registro de vinculo com data, entao a tabela teria de existir de todo
 * jeito. Dar a ela a forma N:N saiu de graca e mantem a porta aberta.
 *
 * No MVP a API resolve exatamente UMA turma por usuario, e nao existe seletor de
 * turma na UI. A tabela esta pronta; a feature nao esta, e nao deve ser construida.
 */
@Entity
@Table(name = "membro")
public class Membro {

    @Id
    private UUID id;

    @Column(name = "usuario_id", nullable = false)
    private UUID usuarioId;

    @Column(name = "turma_id", nullable = false)
    private UUID turmaId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PapelMembro papel;

    /**
     * `insertable = false` sozinho deixa o campo NULO no objeto depois do INSERT:
     * o banco preenche o DEFAULT now(), mas o Hibernate nunca le o valor de volta,
     * e qualquer leitura na mesma transacao devolve a instancia em cache — sem
     * data. Foi assim que GET /turmas/minha saiu sem `entrouEm`, com a coluna
     * preenchida no banco. `@Generated` manda o Hibernate reler apos gravar; e o
     * mesmo conserto que o EventoService faz a mao com `em.refresh`.
     */
    @Generated(event = EventType.INSERT)
    @Column(name = "entrou_em", nullable = false, insertable = false, updatable = false)
    private Instant entrouEm;

    /**
     * Quando o LIDER contestou este docente NESTA turma (spec 2.4). Nulo = nao
     * contestado; "contestado" nao e um boolean separado para nao haver dois campos
     * que divirjam. Mora no vinculo, e nao no usuario, porque vale por turma — e
     * entrar de novo com o codigo nao limpa: o vinculo (usuario+turma) e o mesmo.
     */
    @Column(name = "docente_contestado_em")
    private Instant docenteContestadoEm;

    @Column(name = "docente_contestado_por")
    private UUID docenteContestadoPor;

    protected Membro() {
    }

    public Membro(UUID id, UUID usuarioId, UUID turmaId, PapelMembro papel) {
        this.id = id;
        this.usuarioId = usuarioId;
        this.turmaId = turmaId;
        this.papel = papel;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUsuarioId() {
        return usuarioId;
    }

    public UUID getTurmaId() {
        return turmaId;
    }

    public PapelMembro getPapel() {
        return papel;
    }

    public Instant getEntrouEm() {
        return entrouEm;
    }

    public Instant getDocenteContestadoEm() {
        return docenteContestadoEm;
    }

    public UUID getDocenteContestadoPor() {
        return docenteContestadoPor;
    }

    public boolean isContestado() {
        return docenteContestadoEm != null;
    }

    /** O lider tira o poder e o selo deste docente nesta turma, ate restaurar (spec 2.4). */
    public void contestar(UUID liderId, Instant agora) {
        this.docenteContestadoEm = agora;
        this.docenteContestadoPor = liderId;
    }

    /** Desfaz a contestacao: zera o rastro, e o poder volta na proxima requisicao. */
    public void restaurar() {
        this.docenteContestadoEm = null;
        this.docenteContestadoPor = null;
    }

    /**
     * Usado na transferencia de lideranca, que precisa rebaixar o atual e promover
     * o novo na MESMA transacao — o indice unico parcial do banco garante no maximo
     * um LIDER por turma e estouraria no meio de duas transacoes separadas.
     *
     * A guarda: so ALUNO vira LIDER (spec 2.7 e 3.3). `papel` e um valor so por
     * vinculo, entao promover um PROFESSOR/COORDENADOR apagaria o papel dele — e a
     * turma e o grupo de alunos, o docente e visita com poderes, nao dono. Fica
     * aqui, e nao no service, porque este metodo e o gargalo de TODOS os caminhos
     * que criam lider (transferencia pelo lider e `definirLider` do admin): uma
     * checagem so, que um caminho novo nao tem como esquecer.
     *
     * LIDER -> LIDER passa (nao muda nada). O `definirLider` do admin e idempotente
     * hoje — "defina de novo quem ja lidera" e 204, nao erro — e a guarda nao pode
     * transformar isso em 409.
     */
    public void mudarPapel(PapelMembro novo) {
        if (novo == PapelMembro.LIDER
                && papel != PapelMembro.ALUNO && papel != PapelMembro.LIDER) {
            throw new ErroDeNegocio(HttpStatus.CONFLICT,
                    "Professor e coordenador nao podem ser lider da turma.");
        }
        this.papel = novo;
    }
}
