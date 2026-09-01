package com.projetofans.notify;

import java.time.Instant;

/**
 * Corpo do data-message. Nao ha titulo nem texto aqui de proposito: a notificacao
 * que a pessoa VE e local, agendada pelo aparelho para as 19h da vespera (decisao
 * 2.3 do spec). Este payload so acorda o app para sincronizar e REAGENDAR.
 *
 * Se um dia aparecer campo de titulo aqui, a notificacao virou remota e passa a
 * depender do servidor estar acordado — que e exatamente o que a decisao 2.3
 * evita, porque host de tier gratuito hiberna.
 *
 * `desde` e o instante da mudanca. O aparelho sincroniza a partir do PROPRIO
 * ultimoSync, nao deste campo — quem esteve offline tem mais coisa para buscar do
 * que a ultima alteracao.
 */
public record PayloadSync(String tipo, Instant desde) {

    public static PayloadSync agora(Instant t) {
        return new PayloadSync("sync", t);
    }
}
