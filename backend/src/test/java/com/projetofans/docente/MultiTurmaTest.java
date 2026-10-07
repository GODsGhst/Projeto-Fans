package com.projetofans.docente;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.JsonNode;
import com.projetofans.domain.Evento;
import com.projetofans.domain.Materia;
import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.TipoConta;
import com.projetofans.domain.TipoEvento;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.erro.AcessoNegadoException;
import com.projetofans.erro.SemTurmaException;
import com.projetofans.security.TurmaScopeResolver;
import com.projetofans.security.TurmaScopeResolverJpa;
import com.projetofans.support.TesteDeApi;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsStringIgnoringCase;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * PC4 — varias turmas por pessoa, com o app dizendo qual (cabecalho X-Turma-Id) e
 * o servidor conferindo (spec 2.8 e Secao 4).
 *
 * O que estes testes protegem, em ordem de importancia:
 *
 *  - o cabecalho NUNCA da acesso a turma alheia: sem vinculo ou malformado e 404,
 *    para qualquer tipo de conta, em toda rota (P8, P9);
 *  - com o cabecalho, cada rota devolve so a turma pedida (P10);
 *  - sem o cabecalho nada muda: vinculo mais recente, como o app do aluno sempre fez;
 *  - o CORS deixa o cabecalho passar, senao o site do docente morre no preflight (P19).
 */
class MultiTurmaTest extends TesteDeApi {

    private static final String CABECALHO = "X-Turma-Id";

    @Autowired private TurmaScopeResolver escopo;
    @Autowired private JdbcTemplate jdbc;

    private Turma turmaA;
    private Turma turmaB;
    private Turma turmaC;     // alheia: o docente nao e membro
    private Usuario docente;  // A (mais antiga, PROFESSOR) e B (mais recente, COORDENADOR)
    private Materia materiaB;
    private Materia materiaC;
    private Evento provaA;
    private Evento provaB;
    private Evento provaC;

    @BeforeEach
    void cenario() {
        turmaA = novaTurma();
        turmaB = novaTurma();
        turmaC = novaTurma();
        docente = usuarios.saveAndFlush(Usuario.comSenha(UUID.randomUUID(), "Prof",
                "d-" + UUID.randomUUID() + "@ex.dev", "hash", TipoConta.PROFESSOR));
        Instant agora = Instant.now();
        vincula(docente, turmaA, PapelMembro.PROFESSOR, agora.minus(30, ChronoUnit.DAYS));
        vincula(docente, turmaB, PapelMembro.COORDENADOR, agora);

        Materia materiaA = materia(turmaA, "Algebra A", "ALA");
        materiaB = materia(turmaB, "Fisica B", "FIB");
        materiaC = materia(turmaC, "Quimica C", "QUC");
        provaA = prova(turmaA, materiaA, "Prova A");
        provaB = prova(turmaB, materiaB, "Prova B");
        provaC = prova(turmaC, materiaC, "Prova C");
    }

    @AfterEach
    void limparRequisicaoSimulada() {
        RequestContextHolder.resetRequestAttributes();
    }

    // ------------------------------------------------------------ cenario

    /** entrou_em tem DEFAULT now() = inicio da transacao; sem escrever a data na mao os dois empatam. */
    private void vincula(Usuario usuario, Turma turma, PapelMembro papel, Instant entrouEm) {
        Membro m = membros.saveAndFlush(
                new Membro(UUID.randomUUID(), usuario.getId(), turma.getId(), papel));
        jdbc.update("update membro set entrou_em = ? where id = ?", Timestamp.from(entrouEm), m.getId());
    }

    private Materia materia(Turma turma, String nome, String sigla) {
        return materias.saveAndFlush(new Materia(UUID.randomUUID(), turma.getId(), nome, sigla, "#1F6FB2"));
    }

    /** Autor e um aluno da propria turma: o evento precisa de autor, e o docente nao e o alvo do teste. */
    private Evento prova(Turma turma, Materia materia, String titulo) {
        Usuario autor = membroDe(turma, "Autor " + titulo, PapelMembro.ALUNO);
        return eventos.saveAndFlush(new Evento(UUID.randomUUID(), turma.getId(), materia.getId(),
                TipoEvento.PROVA, titulo, LocalDate.now().plusDays(3), null,
                autor.getId(), Instant.now()));
    }

    private MockHttpServletRequestBuilder comTurma(MockHttpServletRequestBuilder req, Usuario quem,
                                                    String turmaId) {
        req.header("Authorization", bearer(quem));
        return turmaId == null ? req : req.header(CABECALHO, turmaId);
    }

    private JsonNode corpoDe(MockHttpServletRequestBuilder req) throws Exception {
        MvcResult r = http.perform(req).andExpect(status().isOk()).andReturn();
        return json.readTree(r.getResponse().getContentAsString());
    }

    /** O que cada rota "de turma" devolve, reduzido aos nomes que identificam de que turma veio. */
    private Map<String, List<String>> nomesPorRota(Usuario quem, String turmaId) throws Exception {
        String hoje = LocalDate.now().toString();
        String longe = LocalDate.now().plusDays(30).toString();
        JsonNode sync = corpoDe(comTurma(get("/api/v1/sync"), quem, turmaId));
        return Map.of(
                "/home", nomes(corpoDe(comTurma(get("/api/v1/home"), quem, turmaId)), "titulo"),
                "/eventos", nomes(corpoDe(comTurma(
                        get("/api/v1/eventos?de=" + hoje + "&ate=" + longe), quem, turmaId)), "titulo"),
                "/materias", nomes(corpoDe(comTurma(get("/api/v1/materias"), quem, turmaId)), "nome"),
                "/sync eventos", nomes(sync.get("eventosAlterados"), "titulo"),
                "/sync materias", nomes(sync.get("materias"), "nome"));
    }

    private static List<String> nomes(JsonNode lista, String campo) {
        List<String> saida = new ArrayList<>();
        lista.forEach(item -> saida.add(item.get(campo).asText()));
        return saida;
    }

    // ------------------------------------------------------------ P10

    @Test
    @DisplayName("P10 — com X-Turma-Id de cada turma, home, eventos, materias e sync devolvem so a turma pedida")
    void cadaRotaDevolveSoATurmaPedida() throws Exception {
        assertThat(nomesPorRota(docente, turmaA.getId().toString()))
                .containsEntry("/home", List.of("Prova A"))
                .containsEntry("/eventos", List.of("Prova A"))
                .containsEntry("/materias", List.of("Algebra A"))
                .containsEntry("/sync eventos", List.of("Prova A"))
                .containsEntry("/sync materias", List.of("Algebra A"));
        assertThat(nomesPorRota(docente, turmaB.getId().toString()))
                .containsEntry("/home", List.of("Prova B"))
                .containsEntry("/eventos", List.of("Prova B"))
                .containsEntry("/materias", List.of("Fisica B"))
                .containsEntry("/sync eventos", List.of("Prova B"))
                .containsEntry("/sync materias", List.of("Fisica B"));
    }

    @Test
    @DisplayName("P9 — sem o cabecalho vale o vinculo mais recente, como sempre foi")
    void semCabecalhoVaiParaOMaisRecente() throws Exception {
        assertThat(nomesPorRota(docente, null))
                .containsEntry("/home", List.of("Prova B"))
                .containsEntry("/materias", List.of("Fisica B"));
    }

    @Test
    @DisplayName("o id vem com espacos em volta e em caixa alta e ainda assim vale")
    void cabecalhoToleraEspacoECaixa() throws Exception {
        String pedido = "  " + turmaA.getId().toString().toUpperCase() + " ";

        assertThat(nomes(corpoDe(comTurma(get("/api/v1/home"), docente, pedido)), "titulo"))
                .containsExactly("Prova A");
    }

    // ------------------------------------------------------------ P8 e P9: 404

    @Test
    @DisplayName("P9 — X-Turma-Id malformado ou vazio -> 404, em vez de cair no vinculo mais recente")
    void cabecalhoMalformadoDa404() throws Exception {
        // Cair no vinculo mais recente "por tolerancia" mostraria a turma errada ao
        // docente achando que esta na outra — e o erro silencioso e o pior deles.
        for (String lixo : new String[] {"nao-e-uuid", "", "   ", "123", turmaA.getId() + "x"}) {
            http.perform(comTurma(get("/api/v1/home"), docente, lixo))
                    .andExpect(status().isNotFound());
        }
    }

    @Test
    @DisplayName("P8/P9 — X-Turma-Id de turma onde a pessoa nao e membro -> 404 em toda leitura, sem codigo SEM_TURMA")
    void turmaAlheiaDa404EmTodaLeitura() throws Exception {
        String alheia = turmaC.getId().toString();
        String hoje = LocalDate.now().toString();
        for (String rota : new String[] {"/api/v1/home", "/api/v1/materias", "/api/v1/sync",
                "/api/v1/turmas/minha", "/api/v1/eventos?de=" + hoje + "&ate=" + hoje}) {
            MvcResult r = http.perform(comTurma(get(rota), docente, alheia))
                    .andExpect(status().isNotFound()).andReturn();
            // O app so esquece a turma local diante de SEM_TURMA; o docente ainda tem A e B.
            assertThat(json.readTree(r.getResponse().getContentAsString()).has("codigo"))
                    .as(rota).isFalse();
        }
    }

    @Test
    @DisplayName("P8 — o cabecalho nao abre turma alheia nem para o aluno: so a dele, ou 404")
    void alunoTambemNaoEscolheTurmaAlheia() throws Exception {
        Usuario aluno = membroDe(turmaA, "Aluno", PapelMembro.ALUNO);

        http.perform(comTurma(get("/api/v1/home"), aluno, turmaA.getId().toString()))
                .andExpect(status().isOk());
        http.perform(comTurma(get("/api/v1/home"), aluno, turmaB.getId().toString()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("quem nao tem vinculo nenhum continua levando SEM_TURMA, com ou sem cabecalho")
    void semVinculoNenhumLevaSemTurma() throws Exception {
        Usuario recemChegado = novoUsuario("Sem turma");

        for (String pedido : new String[] {null, turmaA.getId().toString()}) {
            MvcResult r = http.perform(comTurma(get("/api/v1/home"), recemChegado, pedido))
                    .andExpect(status().isNotFound()).andReturn();
            assertThat(json.readTree(r.getResponse().getContentAsString()).path("codigo").asText())
                    .as("cabecalho=" + pedido).isEqualTo("SEM_TURMA");
        }
    }

    @Test
    @DisplayName("P8 — escrita com materia de turma onde nao e membro -> 404, com e sem cabecalho")
    void escritaEmTurmaAlheiaDa404() throws Exception {
        Map<String, Object> pedido = Map.of("materiaId", materiaC.getId().toString(), "tipo", "PROVA",
                "titulo", "Invasao", "data", LocalDate.now().plusDays(2).toString());

        for (String turmaId : new String[] {null, turmaC.getId().toString(), turmaA.getId().toString()}) {
            http.perform(comTurma(post("/api/v1/eventos"), docente, turmaId)
                            .contentType(MediaType.APPLICATION_JSON).content(corpo(pedido)))
                    .andExpect(status().isNotFound());
        }
        assertThat(eventos.findAll()).extracting(Evento::getTitulo).doesNotContain("Invasao");
    }

    // ------------------------------------------------------------ exigirMesmaTurma por vinculo

    @Test
    @DisplayName("abrir pelo id um evento de outra turma DELE funciona sem trocar a turma ativa")
    void abrirRegistroDeOutraTurmaDele() throws Exception {
        // Turma ativa = A, evento de B: o toque no painel nao pode exigir trocar antes.
        http.perform(comTurma(get("/api/v1/eventos/" + provaB.getId()), docente, turmaA.getId().toString()))
                .andExpect(status().isOk());
        http.perform(comTurma(get("/api/v1/eventos/" + provaA.getId()), docente, null))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("evento de turma onde nao e membro continua 404 pelo id, mesmo com cabecalho valido de outra")
    void registroAlheioPeloIdDa404() throws Exception {
        http.perform(comTurma(get("/api/v1/eventos/" + provaC.getId()), docente, turmaA.getId().toString()))
                .andExpect(status().isNotFound());
        // O aluno de A, que so tem A, continua sem ver o evento de B.
        Usuario aluno = membroDe(turmaA, "Aluno", PapelMembro.ALUNO);
        http.perform(comTurma(get("/api/v1/eventos/" + provaB.getId()), aluno, null))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("escrita fica na turma da MATERIA, nunca na do cabecalho")
    void escritaSegueATurmaDaMateria() throws Exception {
        Map<String, Object> pedido = Map.of("materiaId", materiaB.getId().toString(), "tipo", "PROVA",
                "titulo", "Prova nova de B", "data", LocalDate.now().plusDays(4).toString());

        // Cabecalho aponta A, materia e de B: o evento nasce em B.
        MvcResult r = http.perform(comTurma(post("/api/v1/eventos"), docente, turmaA.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON).content(corpo(pedido)))
                .andExpect(status().isCreated()).andReturn();

        UUID criado = UUID.fromString(json.readTree(r.getResponse().getContentAsString()).get("id").asText());
        assertThat(eventos.findById(criado).orElseThrow().getTurmaId()).isEqualTo(turmaB.getId());
    }

    // ------------------------------------------------------------ resolver direto

    @Test
    @DisplayName("papelNaTurma devolve o papel DAQUELA turma, nao o da turma ativa")
    void papelNaTurmaEPorTurma() {
        assertThat(escopo.papelNaTurma(docente.getId(), turmaA.getId())).isEqualTo(PapelMembro.PROFESSOR);
        assertThat(escopo.papelNaTurma(docente.getId(), turmaB.getId())).isEqualTo(PapelMembro.COORDENADOR);
    }

    @Test
    @DisplayName("papelNaTurma de turma onde nao e membro -> 404; sem vinculo nenhum -> SEM_TURMA")
    void papelNaTurmaSemVinculo() {
        UUID semVinculoNenhum = novoUsuario("Sem turma").getId();

        assertThatThrownBy(() -> escopo.papelNaTurma(docente.getId(), turmaC.getId()))
                .isExactlyInstanceOf(AcessoNegadoException.class);
        assertThatThrownBy(() -> escopo.papelNaTurma(semVinculoNenhum, turmaC.getId()))
                .isExactlyInstanceOf(SemTurmaException.class);
    }

    @Test
    @DisplayName("papelDoUsuario continua funcionando: e o papel na turma ativa (a mais recente, sem cabecalho)")
    void papelDoUsuarioDelegaParaATurmaAtiva() {
        assertThat(escopo.papelDoUsuario(docente.getId())).isEqualTo(PapelMembro.COORDENADOR);

        requisicaoComCabecalho(turmaA.getId().toString());

        assertThat(escopo.papelDoUsuario(docente.getId())).isEqualTo(PapelMembro.PROFESSOR);
    }

    @Test
    @DisplayName("exigirMesmaTurma e 'e membro da turma do registro': passa nas duas dele, 404 na terceira")
    void exigirMesmaTurmaEPorVinculo() {
        escopo.exigirMesmaTurma(docente.getId(), turmaA.getId());
        escopo.exigirMesmaTurma(docente.getId(), turmaB.getId());

        assertThatThrownBy(() -> escopo.exigirMesmaTurma(docente.getId(), turmaC.getId()))
                .isInstanceOf(AcessoNegadoException.class);
    }

    @Test
    @DisplayName("o aviso de 'mais de um vinculo' dispara so sem o cabecalho")
    void avisoSoSemCabecalho() {
        ListAppender<ILoggingEvent> avisos = capturaLogDoResolver();

        requisicaoComCabecalho(turmaA.getId().toString());
        assertThat(escopo.turmaDoUsuario(docente.getId())).isEqualTo(turmaA.getId());
        assertThat(avisos.list).as("com cabecalho nao ha ambiguidade, logo nao ha aviso").isEmpty();

        RequestContextHolder.resetRequestAttributes();
        assertThat(escopo.turmaDoUsuario(docente.getId())).isEqualTo(turmaB.getId());
        assertThat(avisos.list).anyMatch(e -> e.getLevel() == Level.WARN
                && e.getFormattedMessage().contains(docente.getId().toString()));
    }

    /** Simula so o que o resolver le: a requisicao corrente. Basta para testar o resolver sem MockMvc. */
    private static void requisicaoComCabecalho(String turmaId) {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader(CABECALHO, turmaId);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(req));
    }

    private ListAppender<ILoggingEvent> capturaLogDoResolver() {
        LoggerContext contexto = (LoggerContext) LoggerFactory.getILoggerFactory();
        ch.qos.logback.classic.Logger logger = contexto.getLogger(TurmaScopeResolverJpa.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.setContext(contexto);
        appender.start();
        logger.addAppender(appender);
        return appender;
    }

    // ------------------------------------------------------------ P19

    @Test
    @DisplayName("P19 — preflight libera X-Turma-Id: sem isso todo request do docente no site morre")
    void preflightLiberaOCabecalhoDeTurma() throws Exception {
        // Mesmo bug que o comentario do If-Match descreve: header customizado fora
        // de allowedHeaders passa em curl e em teste de servico, e morre no navegador.
        http.perform(MockMvcRequestBuilders.options("/api/v1/home")
                        .header("Origin", "https://localhost")
                        .header("Access-Control-Request-Method", "GET")
                        .header("Access-Control-Request-Headers", "authorization, x-turma-id"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://localhost"))
                .andExpect(header().string("Access-Control-Allow-Headers",
                        containsStringIgnoringCase("x-turma-id")));
    }
}
