package com.projetofans.docente;

import com.fasterxml.jackson.databind.JsonNode;
import com.projetofans.domain.Evento;
import com.projetofans.domain.Materia;
import com.projetofans.domain.Material;
import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.ProfessorMateria;
import com.projetofans.domain.RegistroTipo;
import com.projetofans.domain.TipoConta;
import com.projetofans.domain.TipoEvento;
import com.projetofans.domain.TipoMaterial;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Um docente de DUAS turmas nao leva conteudo de uma para a outra (achado HIGH da
 * revisao de 07/10/2026).
 *
 * O PATCH aceitava materiaId de qualquer turma em que a pessoa fosse membro, porque
 * "exigirMesmaTurma" virou "sou membro da turma do registro". Resultado: evento da
 * turma A numa materia da B, o /sync de A dando 404 para a turma INTEIRA e o
 * conteudo aparecendo na tela de materia da outra turma. Aqui o cenario e sempre o
 * mesmo: turma A (a do CenarioDocente) e turma B, com docentes nas duas.
 *
 * Registros "de legado" (ja apontando para outra turma) so se montam direto pelos
 * repositorios — e justamente porque a API nao os cria mais.
 */
class IsolamentoEntreTurmasTest extends CenarioDocente {

    enum Ator { AUTOR, PROFESSOR, COORDENADOR }

    private Turma outra;
    private Materia quimica;
    /** Docente aprovado nas duas turmas e autor dos registros do caso "autor". */
    private Usuario doc;

    @BeforeEach
    void duasTurmas() {
        outra = novaTurma();
        quimica = materias.saveAndFlush(new Materia(
                UUID.randomUUID(), outra.getId(), "Quimica", "QUI", "#1F6FB2"));

        doc = docenteAprovado(turma, "Dora", TipoConta.PROFESSOR, calculo);
        for (Usuario docente : List.of(doc, prof)) {
            membros.saveAndFlush(new Membro(
                    UUID.randomUUID(), docente.getId(), outra.getId(), PapelMembro.PROFESSOR));
            lecionadas.saveAndFlush(new ProfessorMateria(docente.getId(), quimica.getId()));
        }
        membros.saveAndFlush(new Membro(
                UUID.randomUUID(), coord.getId(), outra.getId(), PapelMembro.COORDENADOR));
    }

    private Usuario ator(Ator a) {
        return switch (a) {
            case AUTOR -> doc;
            case PROFESSOR -> prof;
            case COORDENADOR -> coord;
        };
    }

    /** No caso "autor" o registro e do proprio docente; nos outros e de um aluno. */
    private Usuario autorDe(Ator a) {
        return a == Ator.AUTOR ? doc : aluno;
    }

    private Evento eventoLegado(Turma daTurma, Materia daMateria, String titulo) {
        return eventos.saveAndFlush(new Evento(UUID.randomUUID(), daTurma.getId(), daMateria.getId(),
                TipoEvento.PROVA, titulo, LocalDate.now().plusDays(3), null, doc.getId(),
                Instant.now()));
    }

    private Material materialDe(Turma daTurma, Materia daMateria, String titulo) {
        return materiais.saveAndFlush(new Material(UUID.randomUUID(), daTurma.getId(),
                daMateria.getId(), TipoMaterial.AULA, titulo, "https://ex.dev/x", doc.getId(),
                Instant.now()));
    }

    // ---- PATCH para materia de OUTRA turma: 404 para os tres poderes -------------

    @ParameterizedTest
    @EnumSource(Ator.class)
    @DisplayName("PATCH de evento para materia da OUTRA turma -> 404 (autor, professor e coordenador); materia da mesma turma segue 200")
    void eventoParaMateriaDeOutraTurma(Ator a) throws Exception {
        Evento e = evento(calculo, autorDe(a));

        patchEvento(ator(a), e, quimica, "Movida", 0).andExpect(status().isNotFound());

        Evento agora = eventos.findById(e.getId()).orElseThrow();
        assertThat(agora.getMateriaId()).isEqualTo(calculo.getId());
        assertThat(agora.getVersion()).isZero();
        assertThat(agora.getAtualizadoPor()).isNull();
        assertThat(revisoes.findByRegistroTipoAndRegistroIdOrderByEmDesc(
                RegistroTipo.EVENTO, e.getId())).isEmpty();
        // o mesmo pedido, com a materia DESTA turma, passa: o 404 e da turma, nao do ator
        patchEvento(ator(a), e, calculo, "Corrigida", 0).andExpect(status().isOk());
    }

    @ParameterizedTest
    @EnumSource(Ator.class)
    @DisplayName("PATCH de material para materia da OUTRA turma -> 404 (autor, professor e coordenador); materia da mesma turma segue 200")
    void materialParaMateriaDeOutraTurma(Ator a) throws Exception {
        Material m = material(calculo, autorDe(a));

        patchMaterial(ator(a), m, quimica, "Movido", 0).andExpect(status().isNotFound());

        Material agora = materiais.findById(m.getId()).orElseThrow();
        assertThat(agora.getMateriaId()).isEqualTo(calculo.getId());
        assertThat(agora.getVersion()).isZero();
        assertThat(agora.getAtualizadoPor()).isNull();
        patchMaterial(ator(a), m, calculo, "Corrigido", 0).andExpect(status().isOk());
    }

    @Test
    @DisplayName("PATCH com materia que nao existe segue 404, mesmo para a coordenacao")
    void materiaInexistenteDa404() throws Exception {
        Evento e = evento(calculo, aluno);
        Materia fantasma = new Materia(UUID.randomUUID(), turma.getId(), "X", "XXX", "#1F6FB2");

        patchEvento(coord, e, fantasma, "Qualquer", 0).andExpect(status().isNotFound());
    }

    // ---- vincular / desvincular material de outra turma ---------------------------

    @Test
    @DisplayName("vincular material da turma B a evento da A -> 404 e nada e gravado; da mesma turma segue 2xx")
    void vincularMaterialDeOutraTurma() throws Exception {
        Evento e = evento(calculo, doc);
        Material deB = materialDe(outra, quimica, "Slides da B");
        Material deA = material(calculo, doc);

        postar(doc, "/api/v1/eventos/" + e.getId() + "/materiais/" + deB.getId())
                .andExpect(status().isNotFound());
        assertThat(vinculos.existsByChaveEventoIdAndChaveMaterialId(e.getId(), deB.getId())).isFalse();

        postar(doc, "/api/v1/eventos/" + e.getId() + "/materiais/" + deA.getId())
                .andExpect(status().is2xxSuccessful());
        assertThat(vinculos.existsByChaveEventoIdAndChaveMaterialId(e.getId(), deA.getId())).isTrue();
    }

    @Test
    @DisplayName("desvincular com material de outra turma -> 404 (a guarda vale nos dois sentidos)")
    void desvincularMaterialDeOutraTurma() throws Exception {
        Evento e = evento(calculo, doc);
        Material deB = materialDe(outra, quimica, "Slides da B");
        vincular(e, deB, doc); // legado: so o repositorio consegue, a API recusa desde esta correcao

        http.perform(delete("/api/v1/eventos/" + e.getId() + "/materiais/" + deB.getId())
                        .header("Authorization", bearer(doc)))
                .andExpect(status().isNotFound());
    }

    // ---- leituras nao entregam o que e de outra turma ------------------------------

    @Test
    @DisplayName("GET /materias/{id} nao lista evento nem material de OUTRA turma que aponte para a materia")
    void telaDaMateriaNaoMostraOutraTurma() throws Exception {
        Evento daA = evento(calculo, aluno, "Prova da A", LocalDate.now().plusDays(3));
        eventoLegado(outra, calculo, "Intruso da B");
        Material aulaDaA = material(calculo, aluno);
        materialDe(outra, calculo, "Slides intrusos");

        JsonNode tela = corpoDe(lerComo(aluno, "/api/v1/materias/" + calculo.getId())
                .andExpect(status().isOk()));

        assertThat(titulos(tela.get("eventos"))).containsExactly(daA.getTitulo());
        assertThat(titulos(tela.get("materiaisAula"))).containsExactly(aulaDaA.getTitulo());
    }

    @Test
    @DisplayName("GET /eventos/{id} nao entrega material de outra turma vinculado de legado")
    void detalheDoEventoNaoMostraMaterialDeOutraTurma() throws Exception {
        Evento e = evento(calculo, aluno);
        Material deA = material(calculo, aluno);
        vincular(e, deA, aluno);
        vincular(e, materialDe(outra, quimica, "Slides da B"), doc);

        JsonNode detalhe = corpoDe(lerComo(aluno, "/api/v1/eventos/" + e.getId())
                .andExpect(status().isOk()));

        assertThat(titulos(detalhe.get("materiais"))).containsExactly(deA.getTitulo());
    }

    // ---- /sync: um registro torto nao derruba a turma inteira ------------------------

    @Test
    @DisplayName("/sync da turma A segue 200 mesmo com evento de legado apontando para materia da B: o item e pulado")
    void syncPulaOItemTorto() throws Exception {
        Evento bom = evento(calculo, aluno, "Prova boa", LocalDate.now().plusDays(3));
        Evento torto = eventoLegado(turma, quimica, "Prova torta");

        JsonNode sync = corpoDe(lerComo(aluno, "/api/v1/sync").andExpect(status().isOk()));

        List<String> ids = new ArrayList<>();
        sync.get("eventosAlterados").forEach(item -> ids.add(item.get("id").asText()));
        assertThat(ids).contains(bom.getId().toString())
                .doesNotContain(torto.getId().toString());
        // e nada da materia de outra turma vai junto
        sync.get("materias").forEach(m -> assertThat(m.get("id").asText())
                .isNotEqualTo(quimica.getId().toString()));
    }

    private static List<String> titulos(JsonNode lista) {
        List<String> titulos = new ArrayList<>();
        lista.forEach(item -> titulos.add(item.get("titulo").asText()));
        return titulos;
    }
}
