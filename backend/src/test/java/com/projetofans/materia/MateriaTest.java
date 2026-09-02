package com.projetofans.materia;

import com.fasterxml.jackson.databind.JsonNode;
import com.projetofans.domain.Materia;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.support.TesteDeApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * As materias da turma e a tela de uma materia.
 *
 * Nenhuma tarefa do plano criou este controller: a Task 11 fez o wiring das duas
 * telas contra o contrato da Secao 6.2 do spec e descobriu que o outro lado nao
 * existia. Estes testes fecham a lacuna com as regras que o resto do app ja segue.
 */
@Transactional
class MateriaTest extends TesteDeApi {

    private Turma turma;
    private Usuario aluno;
    private String bearerAluno;

    @BeforeEach
    void cenario() {
        turma = novaTurma();
        aluno = membroDe(turma, "Aluno", PapelMembro.ALUNO);
        bearerAluno = bearer(aluno);
    }

    private JsonNode getJson(String rota, String bearer) throws Exception {
        MvcResult r = http.perform(get(rota).header("Authorization", bearer))
                .andExpect(status().isOk())
                .andReturn();
        return json.readTree(r.getResponse().getContentAsString());
    }

    /**
     * O campo nao veio, ou veio nulo.
     *
     * Os dois significam a mesma coisa e o Jackson deste projeto AUSENTA o nulo
     * em vez de escreve-lo, entao `get("sala")` devolve `null` do proprio Jackson
     * quando a chave nao existe. Testar so `isNull()` estoura com
     * NullPointerException e esconde o que se queria afirmar.
     *
     * Isso tambem e um aviso para o app: la o campo chega como `undefined`, e
     * comparar com `!== null` daria verdadeiro para material sem sala.
     */
    private boolean semValor(JsonNode no, String campo) {
        JsonNode v = no.get(campo);
        return v == null || v.isNull();
    }

    private Map<String, Object> pedido(String nome, String sigla, String cor) {
        Map<String, Object> p = new HashMap<>();
        p.put("nome", nome);
        p.put("sigla", sigla);
        p.put("corHex", cor);
        return p;
    }

    @Test
    @DisplayName("lista as materias da turma em ordem de sigla")
    void listaMateriasDaTurmaOrdenadas() throws Exception {
        materias.save(new Materia(UUID.randomUUID(), turma.getId(), "Redes", "REDES", "#15803D"));
        materias.save(new Materia(UUID.randomUUID(), turma.getId(), "Banco de Dados", "BD", "#0369A1"));

        JsonNode lista = getJson("/api/v1/materias", bearerAluno);

        assertThat(lista).hasSize(2);
        assertThat(lista.get(0).get("sigla").asText()).isEqualTo("BD");
        assertThat(lista.get(1).get("sigla").asText()).isEqualTo("REDES");
    }

    @Test
    @DisplayName("materia de outra turma responde 404, nunca 403")
    void materiaDeOutraTurmaResponde404() throws Exception {
        // 403 confirmaria que a materia existe. A lista de materias de outra turma
        // e informacao, e o escopo nao pode vazar pelo status.
        Turma outra = novaTurma();
        Materia alheia = materias.save(
                new Materia(UUID.randomUUID(), outra.getId(), "Fisica", "FIS", "#6D28D9"));

        http.perform(get("/api/v1/materias/" + alheia.getId()).header("Authorization", bearerAluno))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("a lista de uma turma nao mostra materia de outra")
    void listaNaoVazaMateriaDeOutraTurma() throws Exception {
        materias.save(new Materia(UUID.randomUUID(), turma.getId(), "Calculo", "CALC", "#1D4ED8"));
        Turma outra = novaTurma();
        materias.save(new Materia(UUID.randomUUID(), outra.getId(), "Fisica", "FIS", "#6D28D9"));

        JsonNode lista = getJson("/api/v1/materias", bearerAluno);

        assertThat(lista).hasSize(1);
        assertThat(lista.get(0).get("sigla").asText()).isEqualTo("CALC");
    }

    @Test
    @DisplayName("o detalhe separa material de aula de material adicional")
    void detalheSeparaMaterialDeAulaDeAdicional() throws Exception {
        // A divisao e do SERVIDOR. Se ela vazasse para o cliente, a mesma regra
        // teria duas implementacoes e um dia divergiriam.
        Materia materia = novaMateria(turma);
        criarMaterial(materia, "AULA", "Slides da aula 3");
        criarMaterial(materia, "ADICIONAL", "Lista extra de exercicios");

        JsonNode detalhe = getJson("/api/v1/materias/" + materia.getId(), bearerAluno);

        assertThat(detalhe.get("materiaisAula")).hasSize(1);
        assertThat(detalhe.get("materiaisAula").get(0).get("titulo").asText())
                .isEqualTo("Slides da aula 3");
        assertThat(detalhe.get("materiaisAdicionais")).hasSize(1);
        assertThat(detalhe.get("materiaisAdicionais").get(0).get("titulo").asText())
                .isEqualTo("Lista extra de exercicios");
    }

    @Test
    @DisplayName("evento excluido pelo autor nao aparece no detalhe da materia")
    void eventoExcluidoNaoApareceNoDetalhe() throws Exception {
        Materia materia = novaMateria(turma);
        JsonNode criado = criarEvento(materia, "Prova 1");
        JsonNode outro = criarEvento(materia, "Prova 2");

        JsonNode antes = getJson("/api/v1/materias/" + materia.getId(), bearerAluno);
        assertThat(antes.get("eventos")).hasSize(2);

        http.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete("/api/v1/eventos/" + criado.get("id").asText())
                        .header("Authorization", bearerAluno)
                        .header("If-Match", criado.get("version").asInt()))
                .andExpect(status().isNoContent());

        JsonNode depois = getJson("/api/v1/materias/" + materia.getId(), bearerAluno);
        assertThat(depois.get("eventos")).hasSize(1);
        assertThat(depois.get("eventos").get(0).get("titulo").asText())
                .isEqualTo(outro.get("titulo").asText());
    }

    @Test
    @DisplayName("membro sem papel de lider cria materia — nao e privilegio")
    void alunoComumCriaMateria() throws Exception {
        // Nao-negociavel 9 e A6: quem posta e quem sabe, sem fila e sem aprovacao.
        // O `aluno` do cenario e ALUNO, nao LIDER.
        MvcResult r = http.perform(post("/api/v1/materias")
                        .header("Authorization", bearerAluno)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(pedido("Engenharia de Software", "ESOFT", "#0F766E"))))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode criada = json.readTree(r.getResponse().getContentAsString());
        assertThat(criada.get("sigla").asText()).isEqualTo("ESOFT");
        assertThat(materias.findByTurmaIdAndSigla(turma.getId(), "ESOFT")).isPresent();
    }

    @Test
    @DisplayName("sigla repetida na mesma turma responde 409")
    void siglaRepetidaNaTurmaResponde409() throws Exception {
        materias.save(new Materia(UUID.randomUUID(), turma.getId(), "Banco de Dados", "BD", "#0369A1"));

        http.perform(post("/api/v1/materias")
                        .header("Authorization", bearerAluno)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(pedido("Bioquimica", "BD", "#B91C1C"))))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("cor fora das 12 validadas responde 400, mesmo sendo hex valido")
    void corForaDaPaletaResponde400() throws Exception {
        // #FFFF00 passa no CHECK do banco (e hex de 6 digitos) e reprovaria no
        // contraste: texto branco em amarelo e ilegivel. A paleta e requisito de
        // acessibilidade, e validar so no app deixaria a regra contornavel por curl.
        http.perform(post("/api/v1/materias")
                        .header("Authorization", bearerAluno)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(pedido("Amarelo", "AMR", "#FFFF00"))))
                .andExpect(status().isBadRequest());

        assertThat(materias.findByTurmaIdAndSigla(turma.getId(), "AMR")).isEmpty();
    }

    @Test
    @DisplayName("cor da paleta em caixa baixa e aceita e normalizada")
    void corEmCaixaBaixaEAceita() throws Exception {
        MvcResult r = http.perform(post("/api/v1/materias")
                        .header("Authorization", bearerAluno)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(pedido("Algoritmos", "ALG", "#b91c1c"))))
                .andExpect(status().isCreated())
                .andReturn();

        // Normalizada na gravacao: duas materias com "a mesma" cor em caixas
        // diferentes viveriam como cores diferentes na comparacao do app.
        assertThat(json.readTree(r.getResponse().getContentAsString()).get("corHex").asText())
                .isEqualTo("#B91C1C");
    }

    private JsonNode criarEvento(Materia materia, String titulo) throws Exception {
        Map<String, Object> p = new HashMap<>();
        p.put("materiaId", materia.getId().toString());
        p.put("tipo", "PROVA");
        p.put("titulo", titulo);
        p.put("data", LocalDate.now().plusDays(5).toString());
        p.put("hora", null);
        MvcResult r = http.perform(post("/api/v1/eventos")
                        .header("Authorization", bearerAluno)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(p)))
                .andExpect(status().isCreated())
                .andReturn();
        return json.readTree(r.getResponse().getContentAsString());
    }

    private void criarMaterial(Materia materia, String tipo, String titulo) throws Exception {
        Map<String, Object> p = new HashMap<>();
        p.put("materiaId", materia.getId().toString());
        p.put("tipo", tipo);
        p.put("titulo", titulo);
        p.put("url", "https://exemplo.dev/" + UUID.randomUUID());
        http.perform(post("/api/v1/materiais")
                        .header("Authorization", bearerAluno)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(p)))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("sala e professor sao gravados e devolvidos")
    void salaEProfessorSaoGravados() throws Exception {
        Map<String, Object> p = pedido("Banco de Dados", "BD", "#0369A1");
        p.put("sala", "B-204");
        p.put("professor", "prof. Marcos");

        MvcResult r = http.perform(post("/api/v1/materias")
                        .header("Authorization", bearerAluno)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(p)))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode criada = json.readTree(r.getResponse().getContentAsString());

        assertThat(criada.get("sala").asText()).isEqualTo("B-204");
        assertThat(criada.get("professor").asText()).isEqualTo("prof. Marcos");
    }

    @Test
    @DisplayName("sala em branco vira nulo, nao string vazia")
    void salaEmBrancoViraNulo() throws Exception {
        // Se "" e null convivessem na coluna, toda leitura teria de testar os dois
        // — e alguem esqueceria de testar um deles. A tela mostraria uma sala
        // vazia como se fosse uma sala.
        Map<String, Object> p = pedido("Redes", "REDES", "#15803D");
        p.put("sala", "   ");
        p.put("professor", "");

        MvcResult r = http.perform(post("/api/v1/materias")
                        .header("Authorization", bearerAluno)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(p)))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode criada = json.readTree(r.getResponse().getContentAsString());

        assertThat(semValor(criada, "sala"))
                .as("espaco em branco nao e uma sala")
                .isTrue();
        assertThat(semValor(criada, "professor")).isTrue();
    }

    @Test
    @DisplayName("materia sem sala nem professor continua valida")
    void materiaSemSalaContinuaValida() throws Exception {
        // As materias que ja existem foram criadas sem esses campos. Exigi-los
        // agora quebraria o cadastro de quem so quer registrar a disciplina.
        MvcResult r = http.perform(post("/api/v1/materias")
                        .header("Authorization", bearerAluno)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(pedido("Calculo 2", "CALC2", "#B45309"))))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode criada = json.readTree(r.getResponse().getContentAsString());

        assertThat(semValor(criada, "sala")).isTrue();
        assertThat(semValor(criada, "professor")).isTrue();
    }
}
