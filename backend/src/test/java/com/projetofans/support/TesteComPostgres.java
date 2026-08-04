package com.projetofans.support;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Base de todo teste que precisa de banco.
 *
 * O container e um singleton de JVM, iniciado no bloco estatico e nunca parado
 * explicitamente — o Ryuk do Testcontainers derruba no fim. Isso e deliberado:
 * a alternativa idiomatica (@Testcontainers + @Container) sobe e derruba um
 * Postgres por classe de teste, o que para as ~10 classes deste projeto
 * significaria dez ciclos de container em vez de um.
 *
 * Migrations do Flyway rodam neste container. O seed NAO: ele vive em
 * classpath:db/seed, que so o perfil dev carrega, justamente para que as
 * linhas de exemplo nao poluam as assercoes dos testes.
 */
@SpringBootTest
@ActiveProfiles("test")
public abstract class TesteComPostgres {

    @ServiceConnection
    protected static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16");

    static {
        POSTGRES.start();
    }
}
