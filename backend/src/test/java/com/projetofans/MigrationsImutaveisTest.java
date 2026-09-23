package com.projetofans;

import org.flywaydb.core.internal.resolver.ChecksumCalculator;
import org.flywaydb.core.internal.resource.filesystem.FileSystemResource;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Migration que ja rodou em producao NAO se edita — nem comentario.
 *
 * O Flyway guarda o checksum de cada migration aplicada e o confere a cada
 * subida. Em 05/09 um comentario acrescentado a V5 ("ATUALIZACAO: entrou na
 * V7") mudou o checksum dela, e todo deploy dali em diante morreu com
 * "Exited with status 1" — 18 dias de producao presa no commit d9c8b8c sem
 * nenhum teste vermelho, porque a suite cria o banco do zero e nunca ve o
 * checksum antigo.
 *
 * Os valores abaixo sao os do ChecksumCalculator do proprio Flyway, o mesmo
 * que a producao compara. Mudou uma migration? Nao conserte o numero: crie a
 * proxima versao. Criou a proxima? Registre o checksum que o teste imprime.
 */
class MigrationsImutaveisTest {

    private static final Path PASTA = Path.of("src/main/resources/db/migration");

    private static final Map<String, Integer> APLICADAS = Map.of(
            "V1__schema_inicial.sql", -1227045531,
            "V2__sala_professor_e_data_da_aula.sql", 314822761,
            "V3__turma_nao_depende_do_periodo.sql", 1686895473,
            "V4__resumo_do_material.sql", -1722328793,
            "V5__anotacoes.sql", -582117543,
            "V6__admin_de_plataforma.sql", 1160653929,
            "V7__lider_modera_anotacao.sql", 1717707491);

    @Test
    @DisplayName("nenhuma migration registrada mudou, e toda migration esta registrada")
    void checksumsBatemComOsRegistrados() throws IOException {
        List<Path> arquivos;
        try (var s = Files.list(PASTA)) {
            arquivos = s.filter(p -> p.toString().endsWith(".sql")).sorted().toList();
        }
        assertThat(arquivos).isNotEmpty();

        for (Path p : arquivos) {
            String nome = p.getFileName().toString();
            int atual = ChecksumCalculator.calculate(
                    new FileSystemResource(null, p.toString(), StandardCharsets.UTF_8, false));

            assertThat(APLICADAS)
                    .as("%s nao esta registrada. Adicione ao mapa: \"%s\", %d", nome, nome, atual)
                    .containsKey(nome);
            assertThat(atual)
                    .as("%s foi EDITADA depois de aplicada: o Flyway vai recusar subir em producao. "
                            + "Desfaca a edicao e crie uma migration nova.", nome)
                    .isEqualTo(APLICADAS.get(nome));
        }
    }
}
