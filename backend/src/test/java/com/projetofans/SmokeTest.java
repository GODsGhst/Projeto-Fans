package com.projetofans;

import com.projetofans.support.TesteComPostgres;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SmokeTest extends TesteComPostgres {

    @Test
    @DisplayName("o contexto sobe e o Postgres do Testcontainers responde")
    void contextoSobe() {
        assertThat(POSTGRES.isRunning()).isTrue();
    }
}
