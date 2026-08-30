package com.projetofans;

import com.projetofans.support.TesteComPostgres;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

class SmokeTest extends TesteComPostgres {

    @Autowired
    JdbcTemplate jdbc;

    /**
     * Antes este teste perguntava ao Testcontainers se o container estava de pe.
     * Isso provava que um processo existia, nao que a aplicacao falava com ele.
     *
     * Agora consulta o proprio banco pela conexao do Spring, e checa a familia
     * da versao. Depois da troca de Testcontainers por Postgres embutido, o risco
     * novo era justamente cair sem perceber num banco diferente do de producao —
     * um H2 em modo de compatibilidade passaria despercebido e reprovaria coisas
     * que o Postgres aceita, ou pior, aceitaria as que ele reprova.
     */
    @Test
    @DisplayName("o contexto sobe e o Postgres 16 embutido responde a uma consulta")
    void contextoSobeEFalaComPostgres16() {
        assertThat(jdbc.queryForObject("select version()", String.class))
                .startsWith("PostgreSQL 16");
    }
}
