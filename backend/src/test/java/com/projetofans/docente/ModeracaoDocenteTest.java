package com.projetofans.docente;

import com.projetofans.domain.AlcanceNota;
import com.projetofans.domain.Evento;
import com.projetofans.domain.Materia;
import com.projetofans.domain.Material;
import com.projetofans.domain.Membro;
import com.projetofans.domain.Nota;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.ProfessorMateria;
import com.projetofans.domain.TipoConta;
import com.projetofans.domain.TipoEvento;
import com.projetofans.domain.TipoMaterial;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.repo.NotaRepository;
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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Moderacao por alcance docente (spec 5, 5.2): P2 (a parte de ocultar), P6, P7, P16.
 *
 * A pergunta de cada teste e a mesma: quem consegue ocultar O QUE. Professor so na
 * materia que declarou; coordenador na turma inteira, nota da turma inclusive;
 * pendente/recusado/aluno em nada. Em toda negativa o registro tem de continuar
 * visivel — o 403 sem efeito colateral e o que se prova.
 */
class ModeracaoDocenteTest extends TesteDeApi {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private EntityManager em;
    @Autowired private ProfessorMateriaRepository lecionadas;
    @Autowired private NotaRepository notas;

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
        prof = docenteAprovado(turma, TipoConta.PROFESSOR, calculo);
        coord = docenteAprovado(turma, TipoConta.COORDENADOR);
    }

    private Usuario docentePendente(Turma t, TipoConta tipo, Materia... declara) {
        Usuario u = usuarios.saveAndFlush(Usuario.comSenha(UUID.randomUUID(), "Docente " + tipo,
                "d-" + UUID.randomUUID() + "@ex.dev", "hash", tipo));
        membros.saveAndFlush(new Membro(UUID.randomUUID(), u.getId(), t.getId(),
                PapelMembro.valueOf(tipo.name())));
        for (Materia m : declara) {
            lecionadas.saveAndFlush(new ProfessorMateria(u.getId(), m.getId()));
        }
        return u;
    }

    private Usuario docenteAprovado(Turma t, TipoConta tipo, Materia... declara) {
        Usuario u = docentePendente(t, tipo, declara);
        u.decidirDocente(true, novoUsuario("Admin").getId(), Instant.now());
        return usuarios.saveAndFlush(u);
    }

    private Evento evento(Materia m) {
        return eventos.saveAndFlush(new Evento(UUID.randomUUID(), turma.getId(), m.getId(),
                TipoEvento.PROVA, "P1", LocalDate.now().plusDays(3), null,
                aluno.getId(), Instant.now()));
    }

    private Material material(Materia m) {
        return materiais.saveAndFlush(new Material(UUID.randomUUID(), turma.getId(), m.getId(),
                TipoMaterial.AULA, "Slides", "https://ex.dev/slides", aluno.getId(), Instant.now()));
    }

    private Nota nota(AlcanceNota alcance) {
        return notas.saveAndFlush(new Nota(UUID.randomUUID(), turma.getId(), aluno.getId(),
                alcance, LocalDate.now().plusDays(2), "Trazer calculadora", Instant.now()));
    }

    private ResultActions acao(Usuario quem, String acao, String tipo, UUID id) throws Exception {
        return http.perform(post("/api/v1/moderacao/" + tipo + "/" + id + "/" + acao)
                .header("Authorization", bearer(quem))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"motivo\":\"duplicado\"}"));
    }

    private boolean visivel(String tabela, UUID id) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "select visivel_turma from " + tabela + " where id = ?", Boolean.class, id));
    }

    private int acoesDoModerador(Usuario quem) {
        em.flush(); // o JdbcTemplate nao dispara o flush do Hibernate
        return jdbc.queryForObject(
                "select count(*) from acao_moderacao where lider_id = ?", Integer.class, quem.getId());
    }

    // ---- P2: pendente nao tem poder ---------------------------------------------

    @Test
    @DisplayName("P2 — professor PENDENTE com a materia declarada: ocultar e pedir exclusao -> 403, nada muda")
    void professorPendenteNaoModera() throws Exception {
        Usuario pendente = docentePendente(turma, TipoConta.PROFESSOR, calculo);
        Evento prova = evento(calculo);

        acao(pendente, "ocultar", "evento", prova.getId()).andExpect(status().isForbidden());
        acao(pendente, "pedir-exclusao", "evento", prova.getId()).andExpect(status().isForbidden());

        assertThat(visivel("evento", prova.getId())).isTrue();
        assertThat(acoesDoModerador(pendente)).isZero();
    }

    @Test
    @DisplayName("P2 — coordenador PENDENTE tambem nao modera, nem a nota da turma")
    void coordenadorPendenteNaoModera() throws Exception {
        Usuario pendente = docentePendente(turma, TipoConta.COORDENADOR);
        Nota recado = nota(AlcanceNota.TURMA);

        acao(pendente, "ocultar", "nota", recado.getId()).andExpect(status().isForbidden());

        assertThat(visivel("nota", recado.getId())).isTrue();
    }

    // ---- P6: professor, so na materia dele --------------------------------------

    @Test
    @DisplayName("P6 — professor aprovado oculta e reexibe evento e material da materia que declarou")
    void professorModeraNaMateriaDele() throws Exception {
        Evento prova = evento(calculo);
        Material slides = material(calculo);

        acao(prof, "ocultar", "evento", prova.getId()).andExpect(status().is2xxSuccessful());
        acao(prof, "ocultar", "material", slides.getId()).andExpect(status().is2xxSuccessful());
        assertThat(visivel("evento", prova.getId())).isFalse();
        assertThat(visivel("material", slides.getId())).isFalse();
        // rastro: quem moderou e o professor (a coluna chama lider_id, guarda "quem moderou")
        assertThat(acoesDoModerador(prof)).isEqualTo(2);

        acao(prof, "reexibir", "evento", prova.getId()).andExpect(status().is2xxSuccessful());
        assertThat(visivel("evento", prova.getId())).isTrue();
    }

    @Test
    @DisplayName("P6 — professor pede exclusao na materia dele; fora dela -> 403")
    void professorPedeExclusaoSoNaMateriaDele() throws Exception {
        acao(prof, "pedir-exclusao", "evento", evento(calculo).getId())
                .andExpect(status().is2xxSuccessful());
        acao(prof, "pedir-exclusao", "material", material(fisica).getId())
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("P6 — professor NAO modera materia que nao declarou: 403 com texto proprio, registro intacto")
    void professorNaoModeraForaDaMateria() throws Exception {
        Evento deFisica = evento(fisica);
        Material deFisicaMat = material(fisica);

        acao(prof, "ocultar", "evento", deFisica.getId())
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("Sem permissao nesta materia"));
        acao(prof, "ocultar", "material", deFisicaMat.getId()).andExpect(status().isForbidden());

        assertThat(visivel("evento", deFisica.getId())).isTrue();
        assertThat(visivel("material", deFisicaMat.getId())).isTrue();
    }

    @Test
    @DisplayName("P6 — professor NAO oculta nota da turma (nota nao tem materia), nem a pessoal -> 404")
    void professorNaoModeraNota() throws Exception {
        Nota recado = nota(AlcanceNota.TURMA);
        Nota rascunho = nota(AlcanceNota.PESSOAL);

        acao(prof, "ocultar", "nota", recado.getId()).andExpect(status().isForbidden());
        // PESSOAL de outra pessoa responde como nota inexistente ANTES de olhar o poder
        acao(prof, "ocultar", "nota", rascunho.getId()).andExpect(status().isNotFound());

        assertThat(visivel("nota", recado.getId())).isTrue();
    }

    // ---- P7: coordenador, turma inteira -----------------------------------------

    @Test
    @DisplayName("P7 — coordenador aprovado oculta em qualquer materia da turma, sem declarar nenhuma")
    void coordenadorModeraAMateriaQueQuiser() throws Exception {
        Evento deCalculo = evento(calculo);
        Material deFisicaMat = material(fisica);

        acao(coord, "ocultar", "evento", deCalculo.getId()).andExpect(status().is2xxSuccessful());
        acao(coord, "ocultar", "material", deFisicaMat.getId()).andExpect(status().is2xxSuccessful());

        assertThat(visivel("evento", deCalculo.getId())).isFalse();
        assertThat(visivel("material", deFisicaMat.getId())).isFalse();
    }

    @Test
    @DisplayName("P7 — coordenador oculta a nota da TURMA, mas a nota PESSOAL alheia continua 404")
    void coordenadorOcultaNotaDaTurmaMasNaoAPessoal() throws Exception {
        Nota recado = nota(AlcanceNota.TURMA);
        Nota rascunho = nota(AlcanceNota.PESSOAL);

        acao(coord, "ocultar", "nota", recado.getId()).andExpect(status().is2xxSuccessful());
        assertThat(visivel("nota", recado.getId())).isFalse();

        acao(coord, "ocultar", "nota", rascunho.getId()).andExpect(status().isNotFound());
        acao(coord, "pedir-exclusao", "nota", rascunho.getId()).andExpect(status().isNotFound());
        assertThat(visivel("nota", rascunho.getId())).isTrue();
    }

    // ---- ordem das checagens e fronteiras ---------------------------------------

    @Test
    @DisplayName("escopo vem antes do poder: coordenador de OUTRA turma leva 404, nao 403")
    void docenteDeOutraTurmaLeva404() throws Exception {
        Turma outra = novaTurma();
        Usuario coordDeOutra = docenteAprovado(outra, TipoConta.COORDENADOR);
        Evento prova = evento(calculo);

        acao(coordDeOutra, "ocultar", "evento", prova.getId()).andExpect(status().isNotFound());

        assertThat(visivel("evento", prova.getId())).isTrue();
    }

    @Test
    @DisplayName("o poder do docente vale na turma do REGISTRO, nao na turma ativa")
    void poderSegueATurmaDoRegistro() throws Exception {
        // professor de duas turmas: declarou Calculo na turma A e Fisica na turma B.
        Turma b = novaTurma();
        Materia fisicaDeB = novaMateria(b);
        Usuario duplo = docenteAprovado(turma, TipoConta.PROFESSOR, calculo);
        membros.saveAndFlush(new Membro(UUID.randomUUID(), duplo.getId(), b.getId(),
                PapelMembro.PROFESSOR));
        lecionadas.saveAndFlush(new ProfessorMateria(duplo.getId(), fisicaDeB.getId()));
        Evento deB = eventos.saveAndFlush(new Evento(UUID.randomUUID(), b.getId(), fisicaDeB.getId(),
                TipoEvento.PROVA, "P2", LocalDate.now().plusDays(4), null,
                aluno.getId(), Instant.now()));

        // sem X-Turma-Id a turma ativa e uma das duas; o resultado nao pode depender de qual
        acao(duplo, "ocultar", "evento", evento(calculo).getId())
                .andExpect(status().is2xxSuccessful());
        acao(duplo, "ocultar", "evento", deB.getId()).andExpect(status().is2xxSuccessful());
        // e a declaracao de A nao vale em B: Calculo de A nao e Fisica de B
        acao(duplo, "ocultar", "evento", evento(fisica).getId()).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("aluno continua levando 403 'so o lider' e o lider continua moderando tudo")
    void alunoELiderNaoMudam() throws Exception {
        Evento prova = evento(fisica);

        acao(aluno, "ocultar", "evento", prova.getId())
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("Somente o lider da turma modera"));
        acao(lider, "ocultar", "evento", prova.getId()).andExpect(status().is2xxSuccessful());
    }

    @Test
    @DisplayName("listar o que foi ocultado e transferir lideranca seguem so do lider: coordenador leva 403")
    void ocultadosETransferenciaSaoDoLider() throws Exception {
        http.perform(get("/api/v1/moderacao/ocultados").header("Authorization", bearer(coord)))
                .andExpect(status().isForbidden());
        http.perform(post("/api/v1/turmas/lideranca/transferir")
                        .header("Authorization", bearer(coord))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"novoLiderUsuarioId\":\"" + aluno.getId() + "\"}"))
                .andExpect(status().isForbidden());
    }

    // ---- P16: recusar corta o poder na hora -------------------------------------

    @Test
    @DisplayName("P16 — admin recusa um professor aprovado: a requisicao seguinte, com o MESMO token, ja e 403")
    void recusarCortaOPoderNaHora() throws Exception {
        Evento prova = evento(calculo);
        String tokenDoProfessor = bearer(prof);
        http.perform(post("/api/v1/moderacao/evento/" + prova.getId() + "/ocultar")
                        .header("Authorization", tokenDoProfessor))
                .andExpect(status().is2xxSuccessful());

        Usuario admin = novoUsuario("Admin");
        jdbc.update("update usuario set admin_plataforma = true where id = ?", admin.getId());
        em.flush();
        em.clear(); // admin_plataforma e so leitura na entidade: sem isto o cache a mostra como nao-admin
        http.perform(post("/api/v1/admin/docentes/" + prof.getId() + "/recusar")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isNoContent());

        http.perform(post("/api/v1/moderacao/evento/" + prova.getId() + "/reexibir")
                        .header("Authorization", tokenDoProfessor))
                .andExpect(status().isForbidden());
        assertThat(visivel("evento", prova.getId())).isFalse();
    }
}
