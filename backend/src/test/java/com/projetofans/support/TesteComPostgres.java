package com.projetofans.support;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.io.UncheckedIOException;

/**
 * Base de todo teste que precisa de banco.
 *
 * E um Postgres 16 de verdade, iniciado a partir de um binario embutido — nao um
 * H2 em modo de compatibilidade. Isso importa neste projeto especificamente: o
 * schema depende de CHECK constraint, indice parcial com WHERE, TIMESTAMPTZ e de
 * consultas a information_schema. Um banco "quase compativel" passaria em testes
 * que o Postgres reprovaria, que e o pior resultado possivel para uma suite.
 *
 * Por que nao Testcontainers: o Docker Desktop desta maquina nao sobe desde
 * 2026-08-03 — o named pipe dockerDesktopLinuxEngine nao existe e o app fica
 * parado esperando interacao humana. A suite ficou 27 dias sem rodar uma vez.
 * Postgres embutido nao precisa de daemon nenhum. Se o Docker voltar a viver e
 * alguem preferir o container, o git tem a versao anterior desta classe.
 *
 * O Postgres e singleton de JVM, no bloco estatico, e nunca parado explicitamente
 * — morre com a JVM. Deliberado, pelo mesmo motivo de antes: subir um banco por
 * classe de teste significaria ~10 ciclos em vez de um.
 *
 * Migrations do Flyway rodam aqui. O seed NAO: ele vive em SeedDev, que so o
 * perfil dev carrega, justamente para que as linhas de exemplo nao poluam as
 * assercoes dos testes.
 */
@SpringBootTest
@ActiveProfiles("test")
public abstract class TesteComPostgres {

    private static final EmbeddedPostgres POSTGRES;

    static {
        try {
            POSTGRES = EmbeddedPostgres.builder().start();
        } catch (IOException e) {
            // Sem banco nao ha teste possivel. Relancar e o certo: engolir aqui
            // faria a suite inteira falhar com NullPointerException mais tarde,
            // escondendo a causa real.
            throw new UncheckedIOException("Postgres embutido nao subiu", e);
        }
    }

    @DynamicPropertySource
    static void apontaDatasource(DynamicPropertyRegistry registro) {
        registro.add("spring.datasource.url",
                () -> "jdbc:postgresql://localhost:" + POSTGRES.getPort() + "/postgres");
        registro.add("spring.datasource.username", () -> "postgres");
        registro.add("spring.datasource.password", () -> "postgres");
    }
}
