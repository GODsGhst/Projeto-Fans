package com.projetofans.web.dto;

import java.util.List;

/**
 * As duas colunas do kanban pessoal, e so duas — "Nao listados" e uma secao
 * separada abaixo do quadro, nao uma terceira coluna.
 *
 * Reusa ItemHomeResponse de proposito: o card do quadro e o mesmo card da Home,
 * e um DTO proprio faria o app ter dois shapes para renderizar a mesma coisa. O
 * que muda entre as colunas e so feitoPeloUsuario, que vem de estado_pessoal.
 */
public record MeuQuadroResponse(List<ItemHomeResponse> aFazer, List<ItemHomeResponse> feito) {
}
