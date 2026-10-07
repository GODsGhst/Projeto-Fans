package com.projetofans.docente;

import com.fasterxml.jackson.databind.JsonNode;
import com.projetofans.domain.DocenteStatus;
import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.TipoConta;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.support.TesteDeApi;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * PC2-resto — criar e entrar em turma com conta docente (spec 2.7 e 5.2; P14).
 *
 * As regras sob teste, em ordem de importancia:
 *
 *  - docente NUNCA vira LIDER, nem criando nem entrando: `membro.papel` e um valor
 *    so por vinculo, e a lideranca apagaria o PROFESSOR;
 *  - a turma que o docente cria nasce sem lider, e o PRIMEIRO ALUNO a entrar herda
 *    a lideranca — so aluno, so o primeiro;
 *  - docente entra em quantas turmas tiver codigo; a guarda "um vinculo por pessoa"
 *    continua valendo para conta ALUNO (UmaTurmaPorPessoaTest segue verde, sem edicao);
 *  - o papel sai do TIPO da conta, nao do status: quem espera aprovacao ja entra.
 *
 * A corrida de dois alunos entrando juntos e outro arquivo (EntradaConcorrenteTest):
 * precisa de transacoes reais, e esta classe e uma transacao so.
 */
class CriarEntrarDocenteTest extends TesteDeApi {

    private Usuario docente(TipoConta tipo) {
        return usuarios.saveAndFlush(Usuario.comSenha(UUID.randomUUID(), "Docente " + tipo,
                "d-" + UUID.randomUUID() + "@ex.dev", "hash", tipo));
    }

    private JsonNode postar(Usuario quem, String rota, Map<String, Object> pedido, int esperado)
            throws Exception {
        MvcResult r = http.perform(post(rota).header("Authorization", bearer(quem))
                        .contentType(MediaType.APPLICATION_JSON).content(corpo(pedido)))
                .andExpect(status().is(esperado)).andReturn();
        return json.readTree(r.getResponse().getContentAsString());
    }

    private UUID criarTurma(Usuario quem) throws Exception {
        JsonNode turma = postar(quem, "/api/v1/turmas", Map.of("nome", "Turma nova", "semestre", "2026.2"), 200);
        return UUID.fromString(turma.get("id").asText());
    }

    private PapelMembro entrar(Usuario quem, Turma turma) throws Exception {
        return PapelMembro.valueOf(postar(quem, "/api/v1/turmas/entrar",
                Map.of("codigoConvite", turma.getCodigoConvite()), 200).get("papel").asText());
    }

    private PapelMembro papelDe(Usuario quem, UUID turmaId) {
        return membros.findByUsuarioIdAndTurmaId(quem.getId(), turmaId).orElseThrow().getPapel();
    }

    private void semLider(UUID turmaId) {
        assertThat(membros.findByTurmaIdAndPapel(turmaId, PapelMembro.LIDER))
                .as("a turma nao deve ter LIDER").isEmpty();
    }

    // ------------------------------------------------------------ criar

    @ParameterizedTest
    @EnumSource(value = TipoConta.class, names = {"PROFESSOR", "COORDENADOR"})
    @DisplayName("P14 — docente cria turma: 200, vinculo com papel = tipoConta e turma SEM lider (conta ainda PENDENTE)")
    void docenteCriaTurmaSemLider(TipoConta tipo) throws Exception {
        Usuario docente = docente(tipo);

        UUID turmaId = criarTurma(docente);

        assertThat(papelDe(docente, turmaId)).isEqualTo(PapelMembro.valueOf(tipo.name()));
        semLider(turmaId);
    }

    @Test
    @DisplayName("P14 — docente cria mais de uma turma: a guarda de vinculo unico e so de ALUNO (o teto de 3 sem aprovacao esta em LimitesDoCadastroDocenteTest)")
    void docenteCriaMaisDeUmaTurma() throws Exception {
        Usuario docente = docente(TipoConta.PROFESSOR);

        UUID primeira = criarTurma(docente);
        UUID segunda = criarTurma(docente);

        assertThat(primeira).isNotEqualTo(segunda);
        assertThat(membros.findByUsuarioIdOrderByEntrouEmDesc(docente.getId())).hasSize(2);
    }

    @Test
    @DisplayName("aluno que cria turma continua virando LIDER, como sempre")
    void alunoQueCriaViraLider() throws Exception {
        Usuario aluno = novoUsuario("Aluna");

        UUID turmaId = criarTurma(aluno);

        assertThat(papelDe(aluno, turmaId)).isEqualTo(PapelMembro.LIDER);
    }

    // ------------------------------------------------------------ entrar: lideranca herdada

    @Test
    @DisplayName("P14 — turma de docente: o primeiro ALUNO a entrar vira LIDER, o segundo e ALUNO")
    void primeiroAlunoViraLider() throws Exception {
        UUID turmaId = criarTurma(docente(TipoConta.PROFESSOR));
        Turma turma = turmas.findById(turmaId).orElseThrow();
        Usuario primeiro = novoUsuario("Primeiro");
        Usuario segundo = novoUsuario("Segundo");

        assertThat(entrar(primeiro, turma)).isEqualTo(PapelMembro.LIDER);
        assertThat(entrar(segundo, turma)).isEqualTo(PapelMembro.ALUNO);

        assertThat(papelDe(primeiro, turmaId)).isEqualTo(PapelMembro.LIDER);
        assertThat(papelDe(segundo, turmaId)).isEqualTo(PapelMembro.ALUNO);
    }

    @Test
    @DisplayName("aluno que entra numa turma que JA tem lider continua entrando como ALUNO")
    void turmaComLiderNaoGanhaOutro() throws Exception {
        Turma turma = novaTurma();
        membroDe(turma, "Lider", PapelMembro.LIDER);

        assertThat(entrar(novoUsuario("Calouro"), turma)).isEqualTo(PapelMembro.ALUNO);
    }

    @Test
    @DisplayName("repetir o codigo e idempotente: o primeiro aluno segue LIDER, sem segundo vinculo")
    void entrarDeNovoNaoMudaNada() throws Exception {
        Turma turma = turmas.findById(criarTurma(docente(TipoConta.COORDENADOR))).orElseThrow();
        Usuario aluno = novoUsuario("Aluna");
        entrar(aluno, turma);

        assertThat(entrar(aluno, turma)).isEqualTo(PapelMembro.LIDER);

        assertThat(membros.findByUsuarioIdOrderByEntrouEmDesc(aluno.getId())).hasSize(1);
    }

    @Test
    @DisplayName("o aluno que herda a lideranca nasce com a data de entrada preenchida")
    void lideranciaHerdadaTemEntrouEm() throws Exception {
        UUID turmaId = criarTurma(docente(TipoConta.PROFESSOR));
        Usuario aluno = novoUsuario("Aluna");
        entrar(aluno, turmas.findById(turmaId).orElseThrow());

        // O vinculo LIDER nasce por INSERT nativo; o DEFAULT now() do banco tem de
        // voltar na leitura, senao GET /turmas/minha sairia sem `entrouEm`.
        Membro lido = membros.findByUsuarioIdAndTurmaId(aluno.getId(), turmaId).orElseThrow();
        assertThat(lido.getEntrouEm()).isNotNull();
        assertThat(lido.getPapel()).isEqualTo(PapelMembro.LIDER);
    }

    // ------------------------------------------------------------ entrar: docente

    @ParameterizedTest
    @EnumSource(value = TipoConta.class, names = {"PROFESSOR", "COORDENADOR"})
    @DisplayName("P14 — docente entra com papel = tipoConta e aceita uma segunda turma (200)")
    void docenteEntraEmVariasTurmas(TipoConta tipo) throws Exception {
        Usuario docente = docente(tipo);
        Turma a = novaTurma();
        Turma b = novaTurma();
        membroDe(a, "Lider A", PapelMembro.LIDER);
        membroDe(b, "Lider B", PapelMembro.LIDER);

        assertThat(entrar(docente, a)).isEqualTo(PapelMembro.valueOf(tipo.name()));
        assertThat(entrar(docente, b)).isEqualTo(PapelMembro.valueOf(tipo.name()));

        assertThat(membros.findByUsuarioIdOrderByEntrouEmDesc(docente.getId())).hasSize(2);
    }

    @Test
    @DisplayName("docente que entra numa turma SEM lider nao vira lider, e nao gasta a vaga do primeiro aluno")
    void docenteNaoHerdaLideranca() throws Exception {
        UUID turmaId = criarTurma(docente(TipoConta.COORDENADOR));
        Turma turma = turmas.findById(turmaId).orElseThrow();
        Usuario outroDocente = docente(TipoConta.PROFESSOR);

        assertThat(entrar(outroDocente, turma)).isEqualTo(PapelMembro.PROFESSOR);
        semLider(turmaId);

        // A vaga continua do primeiro ALUNO.
        assertThat(entrar(novoUsuario("Primeiro aluno"), turma)).isEqualTo(PapelMembro.LIDER);
    }

    @Test
    @DisplayName("docente repetindo o codigo da mesma turma: 200, o mesmo vinculo, sem duplicar")
    void docenteEntrarDeNovoEIdempotente() throws Exception {
        Usuario docente = docente(TipoConta.PROFESSOR);
        Turma turma = novaTurma();
        entrar(docente, turma);
        UUID vinculo = membros.findByUsuarioIdAndTurmaId(docente.getId(), turma.getId()).orElseThrow().getId();

        entrar(docente, turma);

        assertThat(membros.findByUsuarioIdOrderByEntrouEmDesc(docente.getId()))
                .singleElement().extracting(Membro::getId).isEqualTo(vinculo);
    }

    @ParameterizedTest
    @EnumSource(value = DocenteStatus.class, names = {"PENDENTE", "RECUSADO"})
    @DisplayName("o papel do vinculo sai do TIPO da conta, qualquer que seja o status: quem espera aprovacao ja entra")
    void statusNaoImpedeEntrada(DocenteStatus status) throws Exception {
        Usuario docente = docente(TipoConta.PROFESSOR);
        if (status == DocenteStatus.RECUSADO) {
            docente.decidirDocente(false, novoUsuario("Admin").getId(), Instant.now());
            usuarios.saveAndFlush(docente);
        }
        Turma turma = novaTurma();

        assertThat(entrar(docente, turma)).isEqualTo(PapelMembro.PROFESSOR);
    }

    // ------------------------------------------------------------ a guarda do aluno continua

    @Test
    @DisplayName("P14 — conta ALUNO na segunda turma continua 409, e a primeira fica intacta")
    void alunoNaSegundaTurmaContinuaDando409() throws Exception {
        Turma minha = novaTurma();
        Usuario aluno = membroDe(minha, "Ana", PapelMembro.ALUNO);
        Turma outra = turmas.findById(criarTurma(docente(TipoConta.PROFESSOR))).orElseThrow();

        postar(aluno, "/api/v1/turmas/entrar", Map.of("codigoConvite", outra.getCodigoConvite()), 409);

        assertThat(membros.findByUsuarioIdOrderByEntrouEmDesc(aluno.getId()))
                .singleElement().extracting(Membro::getTurmaId).isEqualTo(minha.getId());
        // E nao ganhou a lideranca da turma sem lider pelo caminho que falhou.
        semLider(outra.getId());
    }

    @Test
    @DisplayName("aluno que ja tem turma tambem nao cria outra: 409, mesmo com a vaga de lider sobrando")
    void alunoNaoCriaSegundaTurma() throws Exception {
        Usuario aluno = membroDe(novaTurma(), "Ana", PapelMembro.ALUNO);

        http.perform(post("/api/v1/turmas").header("Authorization", bearer(aluno))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(Map.of("nome", "Segunda"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Voce ja esta numa turma"));
    }
}
