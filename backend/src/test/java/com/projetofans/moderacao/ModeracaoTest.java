package com.projetofans.moderacao;

import com.projetofans.domain.AcaoModeracao;
import com.projetofans.domain.AcaoModeracaoTipo;
import com.projetofans.domain.Evento;
import com.projetofans.domain.Materia;
import com.projetofans.domain.Material;
import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.TipoEvento;
import com.projetofans.domain.TipoMaterial;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.repo.AcaoModeracaoRepository;
import com.projetofans.support.TesteDeApi;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * O papel do lider e, principalmente, o limite dele.
 *
 * O teste central e {@link #ocultarNaoAlteraAutorTituloNemData()}: le a linha
 * inteira de `evento` antes e depois e exige que so a visibilidade tenha mudado.
 * Se `titulo`, `data_evento` ou `autor_id` mudar, o lider virou editor e o
 * nao-negociavel 10 caiu — o lider muda visibilidade, nunca conteudo alheio.
 *
 * O segundo eixo e a transferencia de lideranca: rebaixar e promover na MESMA
 * transacao, porque o indice unico parcial membro_um_lider_por_turma estoura no
 * meio de duas transacoes separadas.
 */
class ModeracaoTest extends TesteDeApi {

    @Autowired
    private AcaoModeracaoRepository acoes;

    @Autowired
    private JdbcTemplate jdbc;

    private Turma turma;
    private Materia materia;
    private Usuario lider;
    private Usuario autor;
    private Usuario outro;

    @BeforeEach
    void cenario() {
        turma = novaTurma();
        materia = novaMateria(turma);
        lider = membroDe(turma, "Lia", PapelMembro.LIDER);
        autor = membroDe(turma, "Ana", PapelMembro.ALUNO);
        outro = membroDe(turma, "Bruno", PapelMembro.ALUNO);
    }

    private Evento evento(Usuario dono, String titulo, int emDias) {
        return eventos.saveAndFlush(new Evento(UUID.randomUUID(), turma.getId(), materia.getId(),
                TipoEvento.PROVA, titulo, LocalDate.now().plusDays(emDias), null,
                dono.getId(), Instant.now()));
    }

    private Material material(Usuario dono, String titulo) {
        return materiais.saveAndFlush(new Material(UUID.randomUUID(), turma.getId(), materia.getId(),
                TipoMaterial.AULA, titulo, "https://ex.dev/" + titulo,
                dono.getId(), Instant.now()));
    }

    private Map<String, Object> linha(String tabela, UUID id) {
        return jdbc.queryForMap("select * from " + tabela + " where id = ?", id);
    }

    private void ocultar(Usuario quem, String tipo, UUID id, int statusEsperado) throws Exception {
        http.perform(post("/api/v1/moderacao/" + tipo + "/" + id + "/ocultar")
                        .header("Authorization", bearer(quem))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"motivo\":\"duplicado\"}"))
                .andExpect(status().is(statusEsperado));
    }

    private void reexibir(Usuario quem, UUID id, int statusEsperado) throws Exception {
        http.perform(post("/api/v1/moderacao/evento/" + id + "/reexibir")
                        .header("Authorization", bearer(quem)))
                .andExpect(status().is(statusEsperado));
    }

    private void transferirPara(Usuario quem, Usuario novoLider, int statusEsperado)
            throws Exception {
        http.perform(post("/api/v1/turmas/lideranca/transferir")
                        .header("Authorization", bearer(quem))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"novoLiderUsuarioId\":\"" + novoLider.getId() + "\"}"))
                .andExpect(status().is(statusEsperado));
    }

    private String home(Usuario quem) throws Exception {
        return http.perform(get("/api/v1/home").header("Authorization", bearer(quem)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }

    @Test
    @DisplayName("lider oculta registro — 200 e visivel_turma vira false")
    void liderOcultaRegistro() throws Exception {
        Evento prova = evento(autor, "P1", 3);

        ocultar(lider, "evento", prova.getId(), 200);

        assertThat(linha("evento", prova.getId())).containsEntry("visivel_turma", false);
    }

    @Test
    @DisplayName("R12 — moderacao por ALUNO retorna 403")
    void alunoRecebe403AoTentarOcultar() throws Exception {
        Evento prova = evento(autor, "P1", 3);

        ocultar(outro, "evento", prova.getId(), 403);

        assertThat(linha("evento", prova.getId())).containsEntry("visivel_turma", true);
    }

    /**
     * R13 — o limite constitucional do papel. A comparacao e da linha inteira, e
     * nao de campos escolhidos a dedo: assim o teste continua valendo quando a
     * tabela ganhar coluna nova. `version` fica de fora por ser o contador de
     * locking otimista, nao conteudo (ver a decisao registrada no LOG).
     */
    @Test
    @DisplayName("R13 — ocultar nao altera autor, titulo nem data")
    void ocultarNaoAlteraAutorTituloNemData() throws Exception {
        Evento prova = evento(autor, "P1 de Calculo", 5);
        Map<String, Object> antes = linha("evento", prova.getId());

        ocultar(lider, "evento", prova.getId(), 200);

        Map<String, Object> depois = linha("evento", prova.getId());
        assertThat(depois.keySet()).isEqualTo(antes.keySet());
        assertThat(depois).containsEntry("autor_id", antes.get("autor_id"));
        assertThat(depois).containsEntry("titulo", antes.get("titulo"));
        assertThat(depois).containsEntry("data_evento", antes.get("data_evento"));
        List<String> mudaram = depois.keySet().stream()
                .filter(coluna -> !Objects.equals(depois.get(coluna), antes.get(coluna)))
                .toList();
        assertThat(mudaram).containsExactlyInAnyOrder("visivel_turma", "version");
    }

    @Test
    @DisplayName("R14 — registro oculto nao aparece na Home")
    void registroOcultoNaoApareceNaHome() throws Exception {
        Evento prova = evento(autor, "P1 que some", 3);
        assertThat(home(autor)).contains("P1 que some");

        ocultar(lider, "evento", prova.getId(), 200);

        assertThat(home(autor)).doesNotContain("P1 que some");
    }

    /**
     * R14 na tela de materia. O endpoint `/materias/{id}` nao e criado por tarefa
     * nenhuma do plano (ver Travas no LOG), entao o teste morde os dois predicados
     * nomeados que a tela usaria — os mesmos do repository desde a Task 2, e os
     * unicos lugares onde a condicao de visibilidade e escrita.
     */
    @Test
    @DisplayName("R14 — registro oculto nao aparece na tela de materia")
    void registroOcultoNaoApareceNaTelaDeMateria() throws Exception {
        Evento prova = evento(autor, "P2", 6);
        Material aula = material(autor, "slides-aula-3");
        assertThat(eventos.visiveisDaMateria(materia.getId()))
                .extracting(Evento::getId).contains(prova.getId());
        assertThat(materiais.visiveisDaMateriaPorTipo(materia.getId(), TipoMaterial.AULA))
                .extracting(Material::getId).contains(aula.getId());

        ocultar(lider, "evento", prova.getId(), 200);
        ocultar(lider, "material", aula.getId(), 200);

        assertThat(eventos.visiveisDaMateria(materia.getId()))
                .extracting(Evento::getId).doesNotContain(prova.getId());
        assertThat(materiais.visiveisDaMateriaPorTipo(materia.getId(), TipoMaterial.AULA))
                .extracting(Material::getId).doesNotContain(aula.getId());
    }

    @Test
    @DisplayName("R15 — registro oculto aparece em Nao listados do autor")
    void registroOcultoApareceEmNaoListadosDoAutor() throws Exception {
        Evento prova = evento(autor, "P3 recusada", 8);

        ocultar(lider, "evento", prova.getId(), 200);

        http.perform(get("/api/v1/nao-listados").header("Authorization", bearer(autor)))
                .andExpect(status().isOk())
                .andExpect(content().string(Matchers.containsString("P3 recusada")));
    }

    @Test
    @DisplayName("R15 — registro oculto nao aparece em Nao listados de outro")
    void registroOcultoNaoApareceEmNaoListadosDeOutro() throws Exception {
        Evento prova = evento(autor, "P3 recusada", 8);

        ocultar(lider, "evento", prova.getId(), 200);

        http.perform(get("/api/v1/nao-listados").header("Authorization", bearer(outro)))
                .andExpect(status().isOk())
                .andExpect(content().string(Matchers.not(Matchers.containsString("P3 recusada"))));
    }

    @Test
    @DisplayName("lider reexibe o registro que ele mesmo ocultou")
    void liderReexibeRegistro() throws Exception {
        Evento prova = evento(autor, "P1", 3);
        ocultar(lider, "evento", prova.getId(), 200);

        reexibir(lider, prova.getId(), 200);

        assertThat(linha("evento", prova.getId())).containsEntry("visivel_turma", true);
    }

    /**
     * O contrapeso do papel: o lider pode ocultar, mas nao em silencio. As quatro
     * acoes deixam rastro, e TRANSFERIR_LIDERANCA e a unica sem registro alvo.
     */
    @Test
    @DisplayName("toda acao de moderacao grava linha em acao_moderacao")
    void todaAcaoDeModeracaoGravaLinhaEmAcaoModeracao() throws Exception {
        Evento prova = evento(autor, "P1", 3);

        ocultar(lider, "evento", prova.getId(), 200);
        reexibir(lider, prova.getId(), 200);
        http.perform(post("/api/v1/moderacao/evento/" + prova.getId() + "/pedir-exclusao")
                        .header("Authorization", bearer(lider))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"motivo\":\"data errada\"}"))
                .andExpect(status().isOk());
        transferirPara(lider, autor, 200);

        List<AcaoModeracao> registradas = acoes.findAll();
        assertThat(registradas).extracting(AcaoModeracao::getAcao)
                .containsExactlyInAnyOrder(AcaoModeracaoTipo.OCULTAR, AcaoModeracaoTipo.REEXIBIR,
                        AcaoModeracaoTipo.PEDIR_EXCLUSAO, AcaoModeracaoTipo.TRANSFERIR_LIDERANCA);
        assertThat(registradas)
                .allSatisfy(a -> assertThat(a.getLiderId()).isEqualTo(lider.getId()));
        assertThat(registradas)
                .filteredOn(a -> a.getAcao() == AcaoModeracaoTipo.TRANSFERIR_LIDERANCA)
                .singleElement()
                .satisfies(a -> {
                    assertThat(a.getRegistroTipo()).isNull();
                    assertThat(a.getRegistroId()).isNull();
                });
        assertThat(registradas)
                .filteredOn(a -> a.getAcao() == AcaoModeracaoTipo.OCULTAR)
                .singleElement()
                .satisfies(a -> assertThat(a.getMotivo()).isEqualTo("duplicado"));
    }

    /** R19 — o indice unico do banco garante; a transacao unica evita estourar nele. */
    @Test
    @DisplayName("R19 — transferir lideranca mantem exatamente um lider")
    void transferirLiderancaMantemExatamenteUmLider() throws Exception {
        transferirPara(lider, autor, 200);

        List<Membro> daTurma = membros.findByTurmaId(turma.getId());
        assertThat(daTurma).filteredOn(m -> m.getPapel() == PapelMembro.LIDER)
                .singleElement()
                .satisfies(m -> assertThat(m.getUsuarioId()).isEqualTo(autor.getId()));
        assertThat(daTurma).filteredOn(m -> m.getUsuarioId().equals(lider.getId()))
                .singleElement()
                .satisfies(m -> assertThat(m.getPapel()).isEqualTo(PapelMembro.ALUNO));
    }

    @Test
    @DisplayName("R12 — transferir lideranca por ALUNO retorna 403")
    void alunoRecebe403AoTentarTransferirLideranca() throws Exception {
        transferirPara(outro, outro, 403);

        assertThat(membros.findByTurmaId(turma.getId()))
                .filteredOn(m -> m.getPapel() == PapelMembro.LIDER)
                .singleElement()
                .satisfies(m -> assertThat(m.getUsuarioId()).isEqualTo(lider.getId()));
    }
}
