package com.projetofans.domain;

import java.util.Set;

/**
 * As 12 cores de materia, e so elas.
 *
 * O CHECK do banco (`materia_cor_hex_valida`) valida so o FORMATO — qualquer
 * `#RRGGBB` passa. Isso nao basta: as 12 desta lista foram escolhidas e medidas
 * uma a uma para dar no minimo 4.5:1 com texto branco, que e o que o chip usa.
 * Um amarelo qualquer passaria no CHECK e produziria uma sigla ilegivel, e o
 * dano seria permanente — cor de materia e escolhida uma vez e fica.
 *
 * Validar aqui e nao so no app tem motivo: o app e um cliente entre outros, e a
 * regra de acessibilidade nao pode morar num lugar que da para contornar com
 * curl. Ver `docs/design/design-system-v1.html` e `validar-paleta.mjs`, que
 * calculam o contraste em vez de afirma-lo.
 */
public final class Paleta {

    private Paleta() {
    }

    public static final Set<String> HUES = Set.of(
            "#1D4ED8", // azul
            "#0369A1", // azul-petroleo
            "#0F766E", // verde-azulado
            "#15803D", // verde
            "#4D7C0F", // oliva
            "#A16207", // ambar
            "#B45309", // laranja-queimado
            "#C2410C", // laranja
            "#B91C1C", // vermelho
            "#BE185D", // rosa
            "#A21CAF", // magenta
            "#6D28D9"  // violeta
    );

    /** Comparacao sem sensibilidade a caixa: `#b91c1c` e a mesma cor de `#B91C1C`. */
    public static boolean contem(String corHex) {
        return corHex != null && HUES.contains(corHex.toUpperCase());
    }
}
