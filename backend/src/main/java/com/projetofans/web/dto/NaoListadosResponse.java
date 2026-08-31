package com.projetofans.web.dto;

import java.util.List;

/**
 * Registros DO PROPRIO usuario que estao ocultos pela moderacao ou logicamente
 * excluidos. Vazio para quase todo mundo — e por isso que a secao no app so
 * aparece quando ha algo aqui.
 *
 * Estas listas carregam version, visivelTurma e excluidoEm porque e daqui que o
 * autor descobre o que aconteceu com o registro dele. Exclusao logica existe
 * justamente para que esta tela possa mostrar o que sumiu do feed.
 */
public record NaoListadosResponse(List<EventoResponse> eventos, List<MaterialResponse> materiais) {
}
