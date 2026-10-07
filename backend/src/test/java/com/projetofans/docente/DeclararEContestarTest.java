package com.projetofans.docente;

import com.fasterxml.jackson.databind.JsonNode;
import com.projetofans.domain.Evento;
import com.projetofans.domain.Materia;
import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.ProfessorMateria;
import com.projetofans.domain.TipoConta;
import com.projetofans.domain.TipoEvento;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.repo.ProfessorMateriaRepository;
import com.projetofans.support.TesteDeApi;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * O professor declara o que leciona (P17) e o lider contesta (P12) — as duas pontas
 * da spec 2.3 e 2.4 — mais o que GET /turmas/minha passa a dizer sobre isso.
 *
 * A fronteira que mais importa: declarar vale POR TURMA. Um professor de duas
 * turmas que troca a lista de uma nao pode perder a da outra.
 */
class DeclararEContestarTest extends TesteDeApi {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private EntityManager em;
    @Autowired private ProfessorMateriaRepository lecionadas;

    private Turma turma;
    private Materia calculo;
    private Materia fisica;
    private Usuario lider;
    private Usuario aluno;
    private Usuario prof;
    private Usuario coord;

    @BeforeEach
    void cenario() {
        turma = novaTurma();
        calculo = novaMateria(turma);
        fisica = materias.saveAndFlush(new Materia(
                UUID.randomUUID(), turma.getId(), "Fisica", "FIS", "#1F6FB2"));
        lider = membroDe(turma, "Lia", PapelMembro.LIDER);
        aluno = membroDe(turma, "Ana", PapelMembro.ALUNO);
        prof = docente(turma, TipoConta.PROFESSOR, true);
        coord = docente(turma, TipoConta.COORDENADOR, true);
    }

    private Usuario docente(Turma t, TipoConta tipo, boolean aprovado) {
        Usuario u = usuarios.saveAndFlush(Usuario.comSenha(UUID.randomUUID(), "Docente " + tipo,
                "d-" + UUID.randomUUID() + "@ex.dev", "hash", tipo));
        if (aprovado) {
            u.decidirDocente(true, novoUsuario("Admin").getId(), Instant.now());
            usuarios.saveAndFlush(u);
        }
        membros.saveAndFlush(new Membro(UUID.randomUUID(), u.getId(), t.getId(),
                PapelMembro.valueOf(tipo.name())));
        return u;
    }

    private ResultActions declarar(Usuario quem, String turmaAtiva, UUID... materiaIds)
            throws Exception {
        var req = put("/api/v1/turmas/minha/lecionadas")
                .header("Authorization", bearer(quem))
                .contentType(MediaType.APPLICATION_JSON)
                .content(corpo(Map.of("materiaIds", List.of(materiaIds))));
        if (turmaAtiva != null) {
            req = req.header("X-Turma-Id", turmaAtiva);
        }
        return http.perform(req);
    }

    private ResultActions declarar(Usuario quem, UUID... materiaIds) throws Exception {
        return declarar(quem, null, materiaIds);
    }

    private ResultActions contestar(Usuario quem, UUID alvo) throws Exception {
        return http.perform(post("/api/v1/turmas/minha/docentes/" + alvo + "/contestar")
                .header("Authorization", bearer(quem)));
    }

    private ResultActions restaurar(Usuario quem, UUID alvo) throws Exception {
        return http.perform(post("/api/v1/turmas/minha/docentes/" + alvo + "/restaurar")
                .header("Authorization", bearer(quem)));
    }

    private JsonNode corpoDe(ResultActions r) throws Exception {
        return json.readTree(r.andReturn().getResponse().getContentAsString());
    }

    private JsonNode minha(Usuario quem) throws Exception {
        return corpoDe(http.perform(get("/api/v1/turmas/minha")
                        .header("Authorization", bearer(quem)))
                .andExpect(status().isOk()));
    }

    private JsonNode membro(JsonNode turmaJson, Usuario quem) {
        for (JsonNode m : turmaJson.get("membros")) {
            if (m.get("usuarioId").asText().equals(quem.getId().toString())) {
                return m;
            }
        }
        throw new AssertionError("membro nao esta na resposta: " + quem.getNome());
    }

    private Set<UUID> declaradas(Usuario u) {
        em.flush();
        em.clear();
        return lecionadas.findByChaveUsuarioId(u.getId()).stream()
                .map(ProfessorMateria::getMateriaId).collect(Collectors.toSet());
    }

    private boolean podeOcultar(Usuario quem) throws Exception {
        Evento prova = eventos.saveAndFlush(new Evento(UUID.randomUUID(), turma.getId(),
                calculo.getId(), TipoEvento.PROVA, "P1", LocalDate.now().plusDays(3), null,
                aluno.getId(), Instant.now()));
        int s = http.perform(post("/api/v1/moderacao/evento/" + prova.getId() + "/ocultar")
                        .header("Authorization", bearer(quem)))
                .andReturn().getResponse().getStatus();
        return s == 200;
    }

    // ---- P17: declarar ------------------------------------------------------------

    @Test
    @DisplayName("professor declara, troca e zera o conjunto; a resposta ja traz as siglas")
    void professorSubstituiOConjunto() throws Exception {
        JsonNode r = corpoDe(declarar(prof, calculo.getId(), fisica.getId())
                .andExpect(status().isOk()));
        List<String> siglas = new ArrayList<>();
        membro(r, prof).get("lecionadas").forEach(n -> siglas.add(n.asText()));
        assertThat(siglas).containsExactly("CAL", "FIS");
        assertThat(declaradas(prof)).containsExactlyInAnyOrder(calculo.getId(), fisica.getId());

        declarar(prof, fisica.getId()).andExpect(status().isOk());
        assertThat(declaradas(prof)).containsExactly(fisica.getId());

        declarar(prof).andExpect(status().isOk());
        assertThat(declaradas(prof)).isEmpty();
    }

    @Test
    @DisplayName("declarar duas vezes a mesma materia na lista nao estoura a chave primaria")
    void repeticaoNaListaEIgnorada() throws Exception {
        declarar(prof, calculo.getId(), calculo.getId()).andExpect(status().isOk());

        assertThat(declaradas(prof)).containsExactly(calculo.getId());
    }

    @Test
    @DisplayName("professor PENDENTE pode declarar (fica inerte ate a aprovacao)")
    void pendenteDeclara() throws Exception {
        Usuario pendente = docente(turma, TipoConta.PROFESSOR, false);

        declarar(pendente, calculo.getId()).andExpect(status().isOk());

        assertThat(declaradas(pendente)).containsExactly(calculo.getId());
    }

    @Test
    @DisplayName("P17 — materia de OUTRA turma -> 404 e nada e gravado, nem as validas da mesma lista")
    void materiaDeOutraTurmaDa404() throws Exception {
        Materia deOutra = novaMateria(novaTurma());

        declarar(prof, calculo.getId(), deOutra.getId()).andExpect(status().isNotFound());
        declarar(prof, UUID.randomUUID()).andExpect(status().isNotFound());

        assertThat(declaradas(prof)).isEmpty();
    }

    @Test
    @DisplayName("P17 — ALUNO, LIDER e COORDENADOR levam 403: so professor declara")
    void soProfessorDeclara() throws Exception {
        declarar(aluno, calculo.getId()).andExpect(status().isForbidden());
        declarar(lider, calculo.getId()).andExpect(status().isForbidden());
        declarar(coord, calculo.getId()).andExpect(status().isForbidden());

        assertThat(declaradas(aluno)).isEmpty();
        assertThat(declaradas(coord)).isEmpty();
    }

    @Test
    @DisplayName("P17 — o 403 vem antes de olhar as materias: aluno nao sonda ids de outra turma")
    void alunoNaoSondaMaterias() throws Exception {
        Materia deOutra = novaMateria(novaTurma());

        declarar(aluno, deOutra.getId()).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("corpo sem materiaIds -> 400, e nao 'apagar tudo'")
    void corpoSemListaDa400() throws Exception {
        declarar(prof, calculo.getId()).andExpect(status().isOk());

        http.perform(put("/api/v1/turmas/minha/lecionadas")
                        .header("Authorization", bearer(prof))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());

        assertThat(declaradas(prof)).containsExactly(calculo.getId());
    }

    @Test
    @DisplayName("declarar numa turma NAO apaga o que o professor declarou na outra")
    void declararEPorTurma() throws Exception {
        Turma b = novaTurma();
        Materia deB = novaMateria(b);
        membros.saveAndFlush(new Membro(UUID.randomUUID(), prof.getId(), b.getId(),
                PapelMembro.PROFESSOR));
        lecionadas.saveAndFlush(new ProfessorMateria(prof.getId(), deB.getId()));

        declarar(prof, turma.getId().toString(), calculo.getId()).andExpect(status().isOk());
        assertThat(declaradas(prof)).containsExactlyInAnyOrder(calculo.getId(), deB.getId());

        // zerar a lista de A tambem nao toca em B
        declarar(prof, turma.getId().toString()).andExpect(status().isOk());
        assertThat(declaradas(prof)).containsExactly(deB.getId());
    }

    // ---- P12: contestar / restaurar -----------------------------------------------

    @Test
    @DisplayName("P12 — lider contesta: professor perde o poder e o selo; restaurar devolve os dois")
    void contestarCortaERestaurarDevolve() throws Exception {
        declarar(prof, calculo.getId()).andExpect(status().isOk());
        assertThat(podeOcultar(prof)).isTrue();
        assertThat(membro(minha(lider), prof).get("selo").asText()).isEqualTo("PROFESSOR");

        JsonNode depois = corpoDe(contestar(lider, prof.getId()).andExpect(status().isOk()));

        assertThat(membro(depois, prof).get("contestado").asBoolean()).isTrue();
        assertThat(membro(depois, prof).has("selo")).isFalse();
        assertThat(membro(depois, prof).get("lecionadas")).hasSize(1);
        assertThat(minha(prof).get("meuAlcance").get("tipo").asText()).isEqualTo("NENHUM");
        assertThat(podeOcultar(prof)).isFalse();

        JsonNode restaurado = corpoDe(restaurar(lider, prof.getId()).andExpect(status().isOk()));

        assertThat(membro(restaurado, prof).get("contestado").asBoolean()).isFalse();
        assertThat(membro(restaurado, prof).get("selo").asText()).isEqualTo("PROFESSOR");
        assertThat(podeOcultar(prof)).isTrue();
    }

    @Test
    @DisplayName("P12 — entrar de novo com o codigo NAO limpa a contestacao")
    void entrarDeNovoNaoLimpa() throws Exception {
        declarar(prof, calculo.getId()).andExpect(status().isOk());
        contestar(lider, prof.getId()).andExpect(status().isOk());

        http.perform(post("/api/v1/turmas/entrar").header("Authorization", bearer(prof))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(Map.of("codigoConvite", turma.getCodigoConvite()))))
                .andExpect(status().isOk());

        assertThat(podeOcultar(prof)).isFalse();
        assertThat(jdbc.queryForObject("select docente_contestado_em is not null from membro "
                + "where usuario_id = ? and turma_id = ?", Boolean.class,
                prof.getId(), turma.getId())).isTrue();
    }

    @Test
    @DisplayName("P12 — contestar o coordenador tira o poder dele na turma inteira")
    void contestarCoordenador() throws Exception {
        assertThat(podeOcultar(coord)).isTrue();

        contestar(lider, coord.getId()).andExpect(status().isOk());

        assertThat(podeOcultar(coord)).isFalse();
        assertThat(minha(coord).get("meuAlcance").get("tipo").asText()).isEqualTo("NENHUM");
    }

    @Test
    @DisplayName("P12 — quem nao e lider nao contesta nem restaura: 403, e nada muda")
    void naoLiderNaoContesta() throws Exception {
        contestar(aluno, prof.getId()).andExpect(status().isForbidden());
        contestar(coord, prof.getId()).andExpect(status().isForbidden());
        contestar(prof, coord.getId()).andExpect(status().isForbidden());

        contestar(lider, prof.getId()).andExpect(status().isOk());
        restaurar(aluno, prof.getId()).andExpect(status().isForbidden());
        restaurar(prof, prof.getId()).andExpect(status().isForbidden());

        assertThat(jdbc.queryForObject("select count(*) from membro where turma_id = ? "
                + "and docente_contestado_em is not null", Integer.class, turma.getId()))
                .isEqualTo(1);
    }

    @Test
    @DisplayName("alvo que nao e docente da turma do lider -> 404: aluno, o proprio lider, gente de fora")
    void alvoPrecisaSerDocenteDaTurma() throws Exception {
        Usuario docenteDeOutra = docente(novaTurma(), TipoConta.PROFESSOR, true);

        contestar(lider, aluno.getId()).andExpect(status().isNotFound());
        contestar(lider, lider.getId()).andExpect(status().isNotFound());
        contestar(lider, docenteDeOutra.getId()).andExpect(status().isNotFound());
        contestar(lider, UUID.randomUUID()).andExpect(status().isNotFound());
        restaurar(lider, aluno.getId()).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("lider de OUTRA turma nao contesta o docente desta: 404")
    void liderDeOutraTurmaNaoContesta() throws Exception {
        Usuario outroLider = membroDe(novaTurma(), "Outro", PapelMembro.LIDER);

        contestar(outroLider, prof.getId()).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("contestar duas vezes guarda a primeira: o rastro nao e sobrescrito")
    void contestarDeNovoMantemOPrimeiroRastro() throws Exception {
        contestar(lider, prof.getId()).andExpect(status().isOk());
        Object primeira = jdbc.queryForObject("select docente_contestado_em from membro "
                + "where usuario_id = ? and turma_id = ?", Object.class, prof.getId(), turma.getId());

        contestar(lider, prof.getId()).andExpect(status().isOk());

        assertThat(jdbc.queryForObject("select docente_contestado_em from membro "
                + "where usuario_id = ? and turma_id = ?", Object.class, prof.getId(), turma.getId()))
                .isEqualTo(primeira);
    }

    // ---- GET /turmas/minha: meuAlcance, selo, contestado, lecionadas --------------

    @Test
    @DisplayName("meuAlcance: TURMA para a coordenacao, MATERIAS (com ids) para o professor, NENHUM para o resto")
    void meuAlcancePorPapel() throws Exception {
        declarar(prof, calculo.getId()).andExpect(status().isOk());
        Usuario pendente = docente(turma, TipoConta.PROFESSOR, false);
        declarar(pendente, calculo.getId()).andExpect(status().isOk());

        JsonNode daCoord = minha(coord).get("meuAlcance");
        assertThat(daCoord.get("tipo").asText()).isEqualTo("TURMA");
        assertThat(daCoord.get("materiaIds")).isEmpty();

        JsonNode doProf = minha(prof).get("meuAlcance");
        assertThat(doProf.get("tipo").asText()).isEqualTo("MATERIAS");
        assertThat(doProf.get("materiaIds")).hasSize(1);
        assertThat(doProf.get("materiaIds").get(0).asText()).isEqualTo(calculo.getId().toString());

        // pendente declarou, mas a declaracao e inerte; lider e aluno nao tem alcance docente
        assertThat(minha(pendente).get("meuAlcance").get("tipo").asText()).isEqualTo("NENHUM");
        assertThat(minha(lider).get("meuAlcance").get("tipo").asText()).isEqualTo("NENHUM");
        assertThat(minha(aluno).get("meuAlcance").get("tipo").asText()).isEqualTo("NENHUM");
    }

    @Test
    @DisplayName("lista de membros: selo so de quem tem poder; lecionadas aparece mesmo sem poder")
    void membrosComSeloEDeclaracao() throws Exception {
        declarar(prof, fisica.getId(), calculo.getId()).andExpect(status().isOk());
        Usuario pendente = docente(turma, TipoConta.PROFESSOR, false);
        declarar(pendente, fisica.getId()).andExpect(status().isOk());

        JsonNode t = minha(aluno);

        assertThat(membro(t, prof).get("selo").asText()).isEqualTo("PROFESSOR");
        assertThat(membro(t, coord).get("selo").asText()).isEqualTo("COORDENACAO");
        assertThat(membro(t, pendente).has("selo")).isFalse();
        assertThat(membro(t, pendente).get("lecionadas").get(0).asText()).isEqualTo("FIS");
        // ordem alfabetica das siglas, estavel entre aberturas
        assertThat(membro(t, prof).get("lecionadas").get(0).asText()).isEqualTo("CAL");
        assertThat(membro(t, prof).get("lecionadas").get(1).asText()).isEqualTo("FIS");
        // aluno e lider: sem selo, nao contestados, sem materias
        assertThat(membro(t, aluno).has("selo")).isFalse();
        assertThat(membro(t, lider).has("selo")).isFalse();
        assertThat(membro(t, aluno).get("contestado").asBoolean()).isFalse();
        assertThat(membro(t, aluno).get("lecionadas")).isEmpty();
    }
}
