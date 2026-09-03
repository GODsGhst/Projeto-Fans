package com.projetofans.web.dto;

import com.projetofans.domain.RegistroTipo;

import java.time.Instant;
import java.util.UUID;

/**
 * Um pedido do lider para que voce apague algo seu.
 *
 * O lider NAO apaga registro de ninguem — ele pode ocultar da turma e pode pedir.
 * Quem apaga e sempre quem criou, e por isso o pedido precisa CHEGAR: ate agora
 * `pedirExclusao` so escrevia no diario de moderacao e o autor nao tinha por
 * onde saber. Botao que registra e nao avisa e um botao que mente para os dois
 * lados — o lider acha que pediu, o autor nunca soube.
 *
 * `titulo` vem junto porque um pedido que diz so "evento a3f2-..." obriga a
 * pessoa a procurar o que ela mesma escreveu.
 */
public record PedidoDeExclusaoResponse(
        RegistroTipo registroTipo,
        UUID registroId,
        String titulo,
        String motivo,
        String pedidoPor,
        Instant em) {
}
