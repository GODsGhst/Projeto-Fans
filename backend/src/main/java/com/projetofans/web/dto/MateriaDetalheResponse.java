package com.projetofans.web.dto;

import java.util.List;

/**
 * `GET /materias/{id}` — a tela da materia inteira.
 *
 * Material de AULA e material ADICIONAL vem em listas SEPARADAS, ja divididos
 * pelo servidor. A tela os mostra sob rotulos diferentes, e deixar a divisao
 * para o cliente seria a mesma regra em dois lugares — com a garantia de que um
 * dia divergem.
 *
 * `eventos` traz so os visiveis: oculto pelo lider e logicamente excluido nao
 * aparecem aqui, pelo mesmo predicado que a Home usa.
 */
public record MateriaDetalheResponse(
        MateriaResponse materia,
        List<MaterialResponse> materiaisAula,
        List<MaterialResponse> materiaisAdicionais,
        List<EventoResponse> eventos) {
}
