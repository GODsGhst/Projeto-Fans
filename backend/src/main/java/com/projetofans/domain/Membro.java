package com.projetofans.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

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

    /**
     * Usado na transferencia de lideranca, que precisa rebaixar o atual e promover
     * o novo na MESMA transacao — o indice unico parcial do banco garante no maximo
     * um LIDER por turma e estouraria no meio de duas transacoes separadas.
     */
    public void mudarPapel(PapelMembro novo) {
        this.papel = novo;
    }
}
