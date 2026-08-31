package com.projetofans.web.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;

import java.util.List;

/**
 * O evento mais SOMENTE os materiais vinculados a ele — nunca a materia inteira.
 *
 * `@JsonUnwrapped` achata o evento no mesmo nivel de `materiais`, que e o formato
 * que `EventoDetalhe extends Evento` do app espera. Sem ele o cliente teria de
 * conhecer dois formatos de evento.
 */
public record EventoDetalheResponse(
        @JsonUnwrapped EventoResponse evento,
        List<MaterialResponse> materiais) {
}
