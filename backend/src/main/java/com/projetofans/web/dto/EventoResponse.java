package com.projetofans.web.dto;

import com.projetofans.domain.Evento;
import com.projetofans.domain.Materia;
import com.projetofans.domain.TipoEvento;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/**
 * Nao existe campo de aprovacao aqui, e isso e proposital: postar e livre, entao
 * nao ha estado "pendente" a expor. Sigla e cor viajam juntas porque a regra
 * visual proibe renderizar cor sozinha.
 */
public record EventoResponse(
        UUID id,
        TipoEvento tipo,
        String titulo,
        LocalDate data,
        LocalTime hora,
        /** Sala deste evento quando difere da habitual; nulo = na sala da materia. */
        String sala,
        UUID materiaId,
        String materiaSigla,
        String materiaCorHex,
        AutoriaResponse autoria,
        int version,
        boolean visivelTurma,
        Instant excluidoEm) {

    /**
     * Lapide: diz que o registro existiu e sumiu, sem dizer o que ele era.
     *
     * O /sync PRECISA devolver evento oculto e excluido — sem eles o aparelho
     * mantem agendada a notificacao de um evento que a turma nao ve mais. Mas
     * precisar do ITEM nao e precisar do CONTEUDO: para desagendar, o aparelho so
     * usa id, visivelTurma e excluidoEm.
     *
     * Sem isto, GET /sync?desde=1970-01-01 devolvia titulo, data, materia e autoria
     * de todo registro moderado para qualquer membro da turma — reabrindo por outra
     * rota o que EventoService.buscar fecha com 404, e sem nem precisar saber o id.
     *
     * O reagendador do app filtra pelas flags antes de olhar o conteudo, entao os
     * nulos aqui nao chegam a ser lidos.
     */
    public static EventoResponse lapide(Evento evento) {
        return new EventoResponse(
                evento.getId(), null, null, null, null, null, null, null, null, null,
                evento.getVersion(), evento.isVisivelTurma(), evento.getExcluidoEm());
    }

    /** A autoria (com selo e "editado por") vem pronta de {@code Autorias}: aqui nao se calcula nada. */
    public static EventoResponse de(Evento evento, Materia materia, AutoriaResponse autoria) {
        return new EventoResponse(
                evento.getId(),
                evento.getTipo(),
                evento.getTitulo(),
                evento.getDataEvento(),
                evento.getHoraEvento(),
                evento.getSala(),
                materia.getId(),
                materia.getSigla(),
                materia.getCorHex(),
                autoria,
                evento.getVersion(),
                evento.isVisivelTurma(),
                evento.getExcluidoEm());
    }
}
