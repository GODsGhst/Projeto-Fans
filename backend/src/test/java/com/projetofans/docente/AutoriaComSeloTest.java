package com.projetofans.docente;

import com.fasterxml.jackson.databind.JsonNode;
import com.projetofans.domain.AlcanceNota;
import com.projetofans.domain.Evento;
import com.projetofans.domain.Material;
import com.projetofans.domain.Membro;
import com.projetofans.domain.Nota;
import com.projetofans.domain.TipoConta;
import com.projetofans.domain.Usuario;
import com.projetofans.repo.NotaRepository;
import com.projetofans.security.PoderNaTurma;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Selo e "editado por" na autoria (spec 6, PC7): P11 e a fiacao em TODA resposta que
 * leva autoria.
 *
 * O selo e "esta pessoa tem poder aqui, agora" (spec 2.6): sai do mesmo PoderNaTurma que
 * decide quem pode corrigir, entao nao ha como o selo mentir sobre o poder — contestar,
 * recusar ou restaurar mexe nos dois ao mesmo tempo. Por isso quase todo teste aqui
 * pergunta a MESMA coisa a varias rotas: se uma delas montar a autoria a mao, a resposta
 * dela diverge das outras e o teste mostra qual.
 *
 * Servicos nao calculam selo; um deles que voltasse a chamar `new AutoriaResponse(...)`
 * ficaria sem selo e sem "editado por" em silencio — e e isso que a fiacao protege.
 */
class AutoriaComSeloTest extends CenarioDocente {

    // O spy conta as leituras de docentes sem mudar o comportamento do componente.
    @MockitoSpyBean private PoderNaTurma poder;
    @Autowired private NotaRepository notas;

    private static String selo(JsonNode autoria) {
        return autoria.has("autorSelo") ? autoria.get("autorSelo").asText() : null;
    }

    private static String seloDeQuemEditou(JsonNode autoria) {
        return autoria.has("editadoPorSelo") ? autoria.get("editadoPorSelo").asText() : null;
    }

    /** O item da lista com este titulo; a lista inteira aparece na mensagem se ele sumir. */
    private static JsonNode comTitulo(JsonNode lista, String titulo) {
        for (JsonNode item : lista) {
            if (titulo.equals(item.path("titulo").asText())) {
                return item;
            }
        }
        throw new AssertionError("nenhum item '" + titulo + "' em " + lista);
    }

    private String janela() {
        return "de=" + LocalDate.now() + "&ate=" + LocalDate.now().plusDays(30);
    }

    /** A autoria do MESMO evento, como cada rota que carrega evento a devolve. */
    private Map<String, JsonNode> autoriasDoEvento(Usuario quem, Evento e) throws Exception {
        String t = e.getTitulo();
        Map<String, JsonNode> porRota = new LinkedHashMap<>();
        porRota.put("GET /eventos", comTitulo(corpoDe(lerComo(quem, "/api/v1/eventos?" + janela())), t).get("autoria"));
        porRota.put("GET /eventos/{id}", corpoDe(lerComo(quem, "/api/v1/eventos/" + e.getId())).get("autoria"));
        porRota.put("GET /materias/{id}", comTitulo(
                corpoDe(lerComo(quem, "/api/v1/materias/" + e.getMateriaId())).get("eventos"), t).get("autoria"));
        porRota.put("GET /home", comTitulo(corpoDe(lerComo(quem, "/api/v1/home")), t).get("autoria"));
        porRota.put("GET /meu-quadro", comTitulo(
                corpoDe(lerComo(quem, "/api/v1/meu-quadro")).get("aFazer"), t).get("autoria"));
        porRota.put("GET /sync", comTitulo(
                corpoDe(lerComo(quem, "/api/v1/sync")).get("eventosAlterados"), t).get("autoria"));
        return porRota;
    }

    // ---- P11: o selo segue o poder ------------------------------------------------

    @Test
    @DisplayName("P11 — professor na materia dele: PROFESSOR; em outra: sem selo; coordenador: COORDENACAO em qualquer; pendente, recusado, contestado e aluno: sem selo")
    void seloSegueOPoderNaMateria() throws Exception {
        Usuario pendente = docentePendente(turma, "Pedro", TipoConta.PROFESSOR, calculo);
        Usuario recusado = docenteRecusado(turma, "Rita", TipoConta.PROFESSOR, calculo);
        Usuario contestado = docenteAprovado(turma, "Caio", TipoConta.PROFESSOR, calculo);
        contestar(contestado);
        Map<String, String> esperado = new LinkedHashMap<>();
        esperado.put(evento(calculo, prof, "prof em calculo", LocalDate.now().plusDays(3)).getTitulo(), "PROFESSOR");
        esperado.put(evento(fisica, prof, "prof em fisica", LocalDate.now().plusDays(3)).getTitulo(), null);
        esperado.put(evento(fisica, coord, "coord em fisica", LocalDate.now().plusDays(3)).getTitulo(), "COORDENACAO");
        esperado.put(evento(calculo, coord, "coord em calculo", LocalDate.now().plusDays(3)).getTitulo(), "COORDENACAO");
        esperado.put(evento(calculo, aluno, "aluno", LocalDate.now().plusDays(3)).getTitulo(), null);
        esperado.put(evento(calculo, lider, "lider", LocalDate.now().plusDays(3)).getTitulo(), null);
        esperado.put(evento(calculo, pendente, "pendente", LocalDate.now().plusDays(3)).getTitulo(), null);
        esperado.put(evento(calculo, recusado, "recusado", LocalDate.now().plusDays(3)).getTitulo(), null);
        esperado.put(evento(calculo, contestado, "contestado", LocalDate.now().plusDays(3)).getTitulo(), null);

        JsonNode lista = corpoDe(lerComo(aluno, "/api/v1/eventos?" + janela()));

        esperado.forEach((titulo, seloEsperado) ->
                assertThat(selo(comTitulo(lista, titulo).get("autoria"))).as(titulo).isEqualTo(seloEsperado));
    }

    @Test
    @DisplayName("selo omitido quando nulo: a chave nem aparece na autoria de quem nao tem poder")
    void seloNuloNaoViajaNoJson() throws Exception {
        evento(calculo, aluno, "da Ana", LocalDate.now().plusDays(2));

        JsonNode autoria = comTitulo(corpoDe(lerComo(aluno, "/api/v1/eventos?" + janela())), "da Ana").get("autoria");

        assertThat(autoria.has("autorSelo")).isFalse();
        assertThat(autoria.has("editadoPorNome")).isFalse();
        assertThat(autoria.has("editadoPorSelo")).isFalse();
        assertThat(autoria.get("autorNome").asText()).isEqualTo("Ana");
    }

    // ---- a fiacao: toda rota que carrega autoria --------------------------------------

    @Test
    @DisplayName("evento de professor aprovado na materia dele traz autorSelo PROFESSOR em TODA rota (lista, detalhe, materia, home, quadro, sync)")
    void seloDoProfessorEmTodasAsRotasDeEvento() throws Exception {
        Evento doProf = evento(calculo, prof, "do professor", LocalDate.now().plusDays(3));

        Map<String, JsonNode> autorias = autoriasDoEvento(aluno, doProf);

        assertThat(autorias).hasSize(6);
        autorias.forEach((rota, autoria) -> assertThat(selo(autoria)).as(rota).isEqualTo("PROFESSOR"));
    }

    @Test
    @DisplayName("evento de professor em materia NAO declarada vem sem selo em todas as rotas")
    void semSeloForaDaMateriaEmTodasAsRotas() throws Exception {
        Evento deFisica = evento(fisica, prof, "do professor em fisica", LocalDate.now().plusDays(3));

        autoriasDoEvento(aluno, deFisica).forEach((rota, autoria) ->
                assertThat(selo(autoria)).as(rota).isNull());
    }

    @Test
    @DisplayName("professor cria evento: a resposta do POST ja traz o selo dele")
    void criarJaTrazOSelo() throws Exception {
        JsonNode criado = corpoDe(http.perform(post("/api/v1/eventos")
                        .header("Authorization", bearer(prof)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"materiaId\":\"" + calculo.getId() + "\",\"tipo\":\"ENTREGA\",\"titulo\":\"Lista\","
                                + "\"data\":\"" + LocalDate.now().plusDays(4) + "\"}"))
                .andExpect(status().isCreated()));

        assertThat(selo(criado.get("autoria"))).isEqualTo("PROFESSOR");
        assertThat(criado.get("autoria").has("editadoPorNome")).isFalse();
    }

    @Test
    @DisplayName("material: selo na criacao, no GET, na tela da materia e nos vinculados do evento; materia nao declarada, sem selo")
    void seloEmTodasAsRotasDeMaterial() throws Exception {
        JsonNode criado = corpoDe(http.perform(post("/api/v1/materiais")
                        .header("Authorization", bearer(prof)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"materiaId\":\"" + calculo.getId() + "\",\"tipo\":\"AULA\",\"titulo\":\"Slides do prof\","
                                + "\"url\":\"https://ex.dev/s\"}"))
                .andExpect(status().isCreated()));
        UUID materialId = UUID.fromString(criado.get("id").asText());
        Material deFisica = material(fisica, prof);
        Evento prova = evento(calculo, aluno);
        vincular(prova, materiais.findById(materialId).orElseThrow(), prof);

        assertThat(selo(criado.get("autoria"))).as("POST /materiais").isEqualTo("PROFESSOR");
        assertThat(selo(corpoDe(lerComo(aluno, "/api/v1/materiais/" + materialId)).get("autoria")))
                .as("GET /materiais/{id}").isEqualTo("PROFESSOR");
        assertThat(selo(comTitulo(corpoDe(lerComo(aluno, "/api/v1/materias/" + calculo.getId())).get("materiaisAula"),
                "Slides do prof").get("autoria"))).as("GET /materias/{id}").isEqualTo("PROFESSOR");
        assertThat(selo(comTitulo(corpoDe(lerComo(aluno, "/api/v1/eventos/" + prova.getId())).get("materiais"),
                "Slides do prof").get("autoria"))).as("GET /eventos/{id} (vinculados)").isEqualTo("PROFESSOR");
        assertThat(selo(corpoDe(lerComo(aluno, "/api/v1/materiais/" + deFisica.getId())).get("autoria")))
                .as("material em materia nao declarada").isNull();
    }

    @Test
    @DisplayName("/nao-listados: o registro oculto do proprio professor tambem sai com selo")
    void naoListadosTrazOSelo() throws Exception {
        Evento oculto = evento(calculo, prof, "oculto do prof", LocalDate.now().plusDays(3));
        oculto.definirVisibilidadeTurma(false);
        eventos.saveAndFlush(oculto);
        Material materialOculto = material(calculo, prof);
        materialOculto.definirVisibilidadeTurma(false);
        materiais.saveAndFlush(materialOculto);

        JsonNode resposta = corpoDe(lerComo(prof, "/api/v1/nao-listados"));

        assertThat(selo(comTitulo(resposta.get("eventos"), "oculto do prof").get("autoria"))).isEqualTo("PROFESSOR");
        assertThat(selo(resposta.get("materiais").get(0).get("autoria"))).isEqualTo("PROFESSOR");
    }

    @Test
    @DisplayName("lapide do /sync continua SEM autoria: quem sumiu nao diz quem era, nem com selo")
    void lapideSemAutoria() throws Exception {
        Evento oculto = evento(calculo, prof, "sumiu", LocalDate.now().plusDays(3));
        oculto.definirVisibilidadeTurma(false);
        eventos.saveAndFlush(oculto);

        JsonNode itens = corpoDe(lerComo(aluno, "/api/v1/sync")).get("eventosAlterados");

        assertThat(itens).hasSize(1);
        assertThat(itens.get(0).get("visivelTurma").asBoolean()).isFalse();
        assertThat(itens.get(0).path("autoria").isMissingNode() || itens.get(0).get("autoria").isNull()).isTrue();
        assertThat(itens.get(0).path("titulo").isMissingNode() || itens.get(0).get("titulo").isNull()).isTrue();
    }

    // ---- editado por ---------------------------------------------------------------

    @Test
    @DisplayName("professor corrige evento da Ana: lista, detalhe, materia, Home, quadro e /sync trazem editadoPorNome e editadoPorSelo; a Ana segue sem selo")
    void editadoPorEmTodasAsRotas() throws Exception {
        Evento daAna = evento(calculo, aluno, "da Ana", LocalDate.now().plusDays(3));
        patchEvento(prof, daAna, calculo, "da Ana", daAna.getVersion()).andExpect(status().isOk());

        Map<String, JsonNode> autorias = autoriasDoEvento(aluno, daAna);

        assertThat(autorias).hasSize(6);
        autorias.forEach((rota, autoria) -> {
            assertThat(autoria.get("autorNome").asText()).as(rota).isEqualTo("Ana");
            assertThat(selo(autoria)).as(rota + " autorSelo").isNull();
            assertThat(autoria.get("editadoPorNome").asText()).as(rota).isEqualTo("Paulo");
            assertThat(seloDeQuemEditou(autoria)).as(rota + " editadoPorSelo").isEqualTo("PROFESSOR");
        });
    }

    @Test
    @DisplayName("material corrigido por professor: GET, tela da materia e vinculados trazem editadoPor*")
    void editadoPorEmMaterial() throws Exception {
        Material daAna = material(calculo, aluno);
        Evento prova = evento(calculo, aluno);
        vincular(prova, daAna, aluno);
        patchMaterial(prof, daAna, calculo, "Slides", daAna.getVersion()).andExpect(status().isOk());

        Map<String, JsonNode> autorias = new LinkedHashMap<>();
        autorias.put("GET /materiais/{id}", corpoDe(lerComo(aluno, "/api/v1/materiais/" + daAna.getId())).get("autoria"));
        autorias.put("GET /materias/{id}", comTitulo(
                corpoDe(lerComo(aluno, "/api/v1/materias/" + calculo.getId())).get("materiaisAula"), "Slides").get("autoria"));
        autorias.put("GET /eventos/{id}", comTitulo(
                corpoDe(lerComo(aluno, "/api/v1/eventos/" + prova.getId())).get("materiais"), "Slides").get("autoria"));

        autorias.forEach((rota, autoria) -> {
            assertThat(autoria.get("editadoPorNome").asText()).as(rota).isEqualTo("Paulo");
            assertThat(seloDeQuemEditou(autoria)).as(rota).isEqualTo("PROFESSOR");
        });
    }

    @Test
    @DisplayName("a Ana corrige de volta o que o professor corrigiu: atualizado_por volta a ser o autor e o 'editado por' some")
    void autorCorrigindoDeVoltaApagaOEditadoPor() throws Exception {
        Evento daAna = evento(calculo, aluno, "da Ana", LocalDate.now().plusDays(3));
        patchEvento(prof, daAna, calculo, "corrigido", daAna.getVersion()).andExpect(status().isOk());
        patchEvento(aluno, daAna, calculo, "da Ana de novo", daAna.getVersion()).andExpect(status().isOk());

        autoriasDoEvento(aluno, daAna).forEach((rota, autoria) -> {
            assertThat(autoria.has("editadoPorNome")).as(rota).isFalse();
            assertThat(autoria.has("editadoPorSelo")).as(rota).isFalse();
        });
    }

    @Test
    @DisplayName("P11/P12 — contestar o professor remove o selo da autoria dele E o de 'editado por'; restaurar devolve os dois")
    void seloEPoderAndamJuntos() throws Exception {
        Evento doProf = evento(calculo, prof, "do professor", LocalDate.now().plusDays(3));
        Evento daAna = evento(calculo, aluno, "da Ana", LocalDate.now().plusDays(3));
        patchEvento(prof, daAna, calculo, "da Ana", daAna.getVersion()).andExpect(status().isOk());
        assertThat(selo(autoriasDoEvento(aluno, doProf).get("GET /home"))).isEqualTo("PROFESSOR");

        contestar(prof);

        autoriasDoEvento(aluno, doProf).forEach((rota, autoria) ->
                assertThat(selo(autoria)).as(rota).isNull());
        autoriasDoEvento(aluno, daAna).forEach((rota, autoria) -> {
            // o fato de ter editado continua verdadeiro; o que cai e o "tem poder aqui"
            assertThat(autoria.get("editadoPorNome").asText()).as(rota).isEqualTo("Paulo");
            assertThat(seloDeQuemEditou(autoria)).as(rota).isNull();
        });

        Membro vinculo = membros.findByUsuarioIdAndTurmaId(prof.getId(), turma.getId()).orElseThrow();
        vinculo.restaurar();
        membros.saveAndFlush(vinculo);

        autoriasDoEvento(aluno, doProf).forEach((rota, autoria) ->
                assertThat(selo(autoria)).as(rota).isEqualTo("PROFESSOR"));
        autoriasDoEvento(aluno, daAna).forEach((rota, autoria) ->
                assertThat(seloDeQuemEditou(autoria)).as(rota).isEqualTo("PROFESSOR"));
    }

    // ---- nota -------------------------------------------------------------------------

    @Test
    @DisplayName("NotaResponse.autorSelo: so COORDENACAO e so em nota da TURMA — professor, aluno e nota PESSOAL saem sem selo")
    void seloDaNota() throws Exception {
        LocalDate dia = LocalDate.now().plusDays(2);
        nota(coord, AlcanceNota.TURMA, dia, "recado da coordenacao");
        nota(prof, AlcanceNota.TURMA, dia, "recado do professor");
        nota(aluno, AlcanceNota.TURMA, dia, "recado da Ana");
        nota(coord, AlcanceNota.PESSOAL, dia, "rascunho da coordenacao");

        JsonNode lidaPelaCoordenacao = corpoDe(lerComo(coord, "/api/v1/notas?" + janela()));
        JsonNode lidaPelaAna = corpoDe(lerComo(aluno, "/api/v1/notas?" + janela()));

        assertThat(selo(comTexto(lidaPelaAna, "recado da coordenacao"))).isEqualTo("COORDENACAO");
        assertThat(selo(comTexto(lidaPelaAna, "recado do professor"))).isNull();
        assertThat(selo(comTexto(lidaPelaAna, "recado da Ana"))).isNull();
        // a PESSOAL so a propria coordenacao le, e nem ela e assinada: nao e fato da turma
        assertThat(selo(comTexto(lidaPelaCoordenacao, "rascunho da coordenacao"))).isNull();
        assertThat(comTexto(lidaPelaCoordenacao, "rascunho da coordenacao").has("autorSelo")).isFalse();
    }

    @Test
    @DisplayName("nota da turma criada pela coordenacao: o POST ja devolve autorSelo")
    void criarNotaDaCoordenacaoTrazOSelo() throws Exception {
        JsonNode criada = corpoDe(http.perform(post("/api/v1/notas")
                        .header("Authorization", bearer(coord)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"alcance\":\"TURMA\",\"data\":\"" + LocalDate.now().plusDays(1)
                                + "\",\"texto\":\"aviso\"}"))
                .andExpect(status().isCreated()));

        assertThat(selo(criada)).isEqualTo("COORDENACAO");
    }

    @Test
    @DisplayName("nota da coordenacao contestada pelo lider sai sem selo (selo = poder agora)")
    void notaDeCoordenadorContestadoSemSelo() throws Exception {
        nota(coord, AlcanceNota.TURMA, LocalDate.now().plusDays(2), "aviso antigo");
        contestar(coord);

        JsonNode lida = corpoDe(lerComo(aluno, "/api/v1/notas?" + janela()));

        assertThat(selo(comTexto(lida, "aviso antigo"))).isNull();
    }

    private Nota nota(Usuario autor, AlcanceNota alcance, LocalDate dia, String texto) {
        return notas.saveAndFlush(new Nota(UUID.randomUUID(), turma.getId(), autor.getId(), alcance, dia,
                texto, Instant.now()));
    }

    private static JsonNode comTexto(JsonNode lista, String texto) {
        for (JsonNode item : lista) {
            if (texto.equals(item.path("texto").asText())) {
                return item;
            }
        }
        throw new AssertionError("nenhuma nota '" + texto + "' em " + lista);
    }

    // ---- uma leitura de docentes por listagem -----------------------------------------

    @Test
    @DisplayName("P11 — PoderNaTurma.daTurma e chamado UMA vez por listagem, nunca uma por item (lista, Home, quadro, materia, sync, notas, nao-listados)")
    void umaLeituraDeDocentesPorListagem() throws Exception {
        Usuario pendente = docentePendente(turma, "Pedro", TipoConta.PROFESSOR, calculo);
        // varios autores e editores distintos: uma query por item apareceria como varias chamadas
        Evento a = evento(calculo, prof, "a", LocalDate.now().plusDays(1));
        Evento b = evento(fisica, coord, "b", LocalDate.now().plusDays(2));
        Evento c = evento(calculo, aluno, "c", LocalDate.now().plusDays(3));
        evento(calculo, pendente, "d", LocalDate.now().plusDays(4));
        evento(fisica, lider, "e", LocalDate.now().plusDays(5));
        patchEvento(prof, c, calculo, "c", c.getVersion()).andExpect(status().isOk());
        patchEvento(coord, b, fisica, "b", b.getVersion()).andExpect(status().isOk());
        Evento oculto = evento(calculo, aluno, "oculto", LocalDate.now().plusDays(6));
        oculto.definirVisibilidadeTurma(false);
        eventos.saveAndFlush(oculto);
        material(calculo, prof);
        material(fisica, aluno);
        nota(coord, AlcanceNota.TURMA, LocalDate.now().plusDays(1), "recado");
        nota(aluno, AlcanceNota.TURMA, LocalDate.now().plusDays(1), "recado 2");

        Map<String, String> rotas = new LinkedHashMap<>();
        rotas.put("lista de eventos", "/api/v1/eventos?" + janela());
        rotas.put("detalhe do evento", "/api/v1/eventos/" + a.getId());
        rotas.put("Home", "/api/v1/home");
        rotas.put("Meu quadro", "/api/v1/meu-quadro");
        rotas.put("tela da materia", "/api/v1/materias/" + calculo.getId());
        rotas.put("sync", "/api/v1/sync");
        rotas.put("notas", "/api/v1/notas?" + janela());
        for (Map.Entry<String, String> rota : rotas.entrySet()) {
            clearInvocations(poder);
            lerComo(aluno, rota.getValue()).andExpect(status().isOk());
            verify(poder, times(1)).daTurma(any());
        }

        // o aluno tem registro oculto: a lista dele de nao listados le a turma uma vez, tambem
        clearInvocations(poder);
        lerComo(aluno, "/api/v1/nao-listados").andExpect(status().isOk());
        verify(poder, times(1)).daTurma(any());
    }
}
