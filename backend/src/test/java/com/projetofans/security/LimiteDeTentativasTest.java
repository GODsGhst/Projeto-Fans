package com.projetofans.security;

import com.projetofans.erro.ErroDeNegocio;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LimiteDeTentativasTest {

    /** Relogio que o teste empurra para frente. */
    private static final class Relogio extends Clock {
        Instant agora = Instant.parse("2026-10-05T12:00:00Z");

        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zona) { return this; }
        @Override public Instant instant() { return agora; }
    }

    private final Relogio relogio = new Relogio();
    private final LimiteDeTentativas limite = new LimiteDeTentativas(relogio);

    private void tentar(String chave) {
        limite.contar(chave, 3, Duration.ofMinutes(15));
    }

    @Test
    void acimaDoMaximoNaJanelaResponde429() {
        tentar("a");
        tentar("a");
        tentar("a");

        assertThatThrownBy(() -> tentar("a"))
                .isInstanceOfSatisfying(ErroDeNegocio.class,
                        e -> assertThat(e.getStatus().value()).isEqualTo(429));
        assertThatCode(() -> tentar("b")).as("outra chave nao herda o contador").doesNotThrowAnyException();
    }

    @Test
    void janelaVencidaRecomecaDoZero() {
        tentar("a");
        tentar("a");
        tentar("a");

        relogio.agora = relogio.agora.plus(Duration.ofMinutes(15));

        assertThatCode(() -> tentar("a")).doesNotThrowAnyException();
    }

    @Test
    void emailEmMaiusculaContaComoOMesmo() {
        for (int i = 0; i < 10; i++) {
            limite.login(i % 2 == 0 ? "Ana@Ex.dev" : " ana@ex.dev ");
        }

        assertThatThrownBy(() -> limite.login("ANA@EX.DEV")).isInstanceOf(ErroDeNegocio.class);
    }

    @Test
    void inundacaoDeChavesNaoCresceSemFim() {
        for (int i = 0; i <= LimiteDeTentativas.MAXIMO_DE_CHAVES + 1; i++) {
            tentar("lixo-" + i);
        }

        assertThat(limite.chavesGuardadas()).isLessThanOrEqualTo(LimiteDeTentativas.MAXIMO_DE_CHAVES + 1);
    }
}
