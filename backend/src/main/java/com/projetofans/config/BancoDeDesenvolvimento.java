package com.projetofans.config;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import javax.sql.DataSource;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Postgres de desenvolvimento, embutido, sem Docker.
 *
 * O {@code docker-compose.yml} continua no repo e continua sendo a forma canonica
 * de subir o banco de dev — em qualquer maquina onde o Docker funcione. Nesta aqui
 * ele nao sobe desde 2026-08-03, e sem banco o {@code spring-boot:run} nem inicia.
 * Isso bloqueava a unica coisa que o dono quer: apontar o celular para a API e ver
 * o app funcionando.
 *
 * A solucao e a mesma que destravou os testes: um binario real do Postgres 16,
 * iniciado pelo proprio processo. A diferenca importante e que aqui os dados
 * PERSISTEM — {@code setCleanDataDirectory(false)} e um diretorio fixo. Banco de
 * dev que esquece tudo a cada restart seria pior que banco nenhum: o testador
 * cadastraria uma prova, fecharia o app, e ela sumiria sem explicacao.
 *
 * So existe no perfil dev. Em prod o {@code DATABASE_URL} manda, e esta classe nao
 * e sequer instanciada.
 */
@Configuration
@Profile("dev")
public class BancoDeDesenvolvimento {

    private static final Logger log = LoggerFactory.getLogger(BancoDeDesenvolvimento.class);

    /**
     * O bean fecha junto com a aplicacao. Sem {@code destroyMethod}, o processo do
     * Postgres sobreviveria ao Ctrl+C e a proxima subida encontraria a porta ocupada
     * e o diretorio travado — falha confusa que custa meia hora para diagnosticar.
     */
    @Bean(destroyMethod = "close")
    public EmbeddedPostgres postgresDeDesenvolvimento(
            @Value("${app.dev-db-dir:.dev-db}") String diretorio) throws IOException {

        Path dados = Path.of(diretorio).toAbsolutePath().normalize();
        Files.createDirectories(dados);

        EmbeddedPostgres pg = EmbeddedPostgres.builder()
                .setDataDirectory(dados)
                .setCleanDataDirectory(false)
                .start();

        log.info("Postgres de desenvolvimento embutido na porta {} — dados em {}", pg.getPort(), dados);
        log.info("Os dados sobrevivem ao restart. Para comecar do zero, apague {}", dados);
        return pg;
    }

    /**
     * Declarar este bean faz o autoconfigure de DataSource do Boot recuar, entao o
     * {@code spring.datasource.url} do perfil dev deixa de ser lido. E de proposito:
     * duas fontes para a mesma resposta divergem na primeira vez que alguem mexe
     * numa e esquece a outra.
     */
    @Bean
    public DataSource dataSource(EmbeddedPostgres postgres) {
        return postgres.getPostgresDatabase();
    }
}
