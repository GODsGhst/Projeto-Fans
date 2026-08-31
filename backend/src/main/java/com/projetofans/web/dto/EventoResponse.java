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
        UUID materiaId,
        String materiaSigla,
        String materiaCorHex,
        AutoriaResponse autoria,
        int version,
        boolean visivelTurma,
        Instant excluidoEm) {

    public static EventoResponse de(Evento evento, Materia materia, String autorNome) {
        return new EventoResponse(
                evento.getId(),
                evento.getTipo(),
                evento.getTitulo(),
                evento.getDataEvento(),
                evento.getHoraEvento(),
                materia.getId(),
                materia.getSigla(),
                materia.getCorHex(),
                new AutoriaResponse(evento.getAutorId(), autorNome,
                        evento.getCriadoEm(), evento.getAtualizadoEm()),
                evento.getVersion(),
                evento.isVisivelTurma(),
                evento.getExcluidoEm());
    }
}
