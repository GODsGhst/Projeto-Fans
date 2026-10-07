package com.projetofans.docente;

import com.projetofans.domain.DocenteStatus;
import com.projetofans.domain.Materia;
import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.ProfessorMateria;
import com.projetofans.domain.TipoConta;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.repo.ProfessorMateriaRepository;
import com.projetofans.support.TesteDeApi;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * PC1 — a base de dados e o dominio de professor/coordenador (V8).
 *
 * Aqui nao ha regra de negocio de service: o que se prova e que o SCHEMA aceita o
 * que deve e recusa o que deve, e que o mapeamento JPA le e grava o que a V8
 * criou. A suite inteira ja sobe com Flyway + ddl-auto validate, entao o simples
 * fato de estes testes iniciarem prova que entidade e tabela concordam.
 *
 * Os INSERTs/UPDATEs por SQL cru sao de proposito: as fabricas das entidades
 * nunca produzem um estado invalido, entao so o SQL direto exercita os CHECKs.
 */
class BaseDocenteTest extends TesteDeApi {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private EntityManager em;
    @Autowired private ProfessorMateriaRepository lecionadas;

    private Usuario novoDocente(String nome, TipoConta tipo) {
        return usuarios.saveAndFlush(Usuario.comSenha(
                UUID.randomUUID(), nome, "d-" + UUID.randomUUID() + "@ex.dev", "hash", tipo));
    }

    private String statusNoBanco(Usuario u) {
        return jdbc.queryForObject(
                "select docente_status from usuario where id = ?", String.class, u.getId());
    }

    // ---- usuario: tipo da conta e status docente ------------------------------

    @Test
    @DisplayName("P1 — conta criada sem tipo e ALUNO e nao tem status")
    void contaPadraoEAluno() {
        Usuario aluno = novoUsuario("Aluno");

        assertThat(jdbc.queryForObject(
                "select tipo_conta from usuario where id = ?", String.class, aluno.getId()))
                .isEqualTo("ALUNO");
        assertThat(statusNoBanco(aluno)).isNull();
    }

    @Test
    @DisplayName("P1 — conta docente nasce PENDENTE, com o tipo gravado")
    void docenteNasceComTipoEPendente() {
        Usuario professor = novoDocente("Prof", TipoConta.PROFESSOR);
        Usuario coordenador = novoDocente("Coord", TipoConta.COORDENADOR);

        em.clear();

        Usuario lido = usuarios.findById(professor.getId()).orElseThrow();
        assertThat(lido.getTipoConta()).isEqualTo(TipoConta.PROFESSOR);
        assertThat(lido.getDocenteStatus()).isEqualTo(DocenteStatus.PENDENTE);
        assertThat(usuarios.findById(coordenador.getId()).orElseThrow().getTipoConta())
                .isEqualTo(TipoConta.COORDENADOR);
        assertThat(statusNoBanco(coordenador)).isEqualTo("PENDENTE");
    }

    /**
     * Um caso por execucao, de proposito: no Postgres um comando que falha aborta a
     * transacao inteira (25P02), e cada teste roda na propria transacao.
     */
    @ParameterizedTest(name = "tipo={0}, status={1}")
    @CsvSource({
            "ALUNO,PENDENTE",       // aluno nunca tem status
            "PROFESSOR,",           // docente sempre tem
            "COORDENADOR,",         // idem
            "DIRETOR,",             // tipo fora da lista
            "PROFESSOR,TALVEZ"})    // status fora da lista
    @DisplayName("P1 — o CHECK do usuario recusa combinacao invalida de tipo e status")
    void checksDeUsuario(String tipo, String status) {
        assertThatThrownBy(() -> jdbc.update(
                "insert into usuario (id, nome, email, senha_hash, tipo_conta, docente_status) "
                        + "values (?, 'X', ?, 'h', ?, ?)",
                UUID.randomUUID(), "chk-" + UUID.randomUUID(), tipo, status))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("decidirDocente grava status, quem decidiu e quando — e nao toca no resto da linha")
    void decidirDocenteGravaORastro() {
        Usuario admin = novoUsuario("Admin");
        Usuario professor = novoDocente("Prof", TipoConta.PROFESSOR);
        Instant agora = Instant.now().truncatedTo(ChronoUnit.MICROS);

        professor.decidirDocente(true, admin.getId(), agora);
        usuarios.saveAndFlush(professor);
        em.clear();

        Usuario lido = usuarios.findById(professor.getId()).orElseThrow();
        assertThat(lido.getDocenteStatus()).isEqualTo(DocenteStatus.APROVADO);
        assertThat(lido.getDocenteDecididoPor()).isEqualTo(admin.getId());
        assertThat(lido.getDocenteDecididoEm()).isEqualTo(agora);
        assertThat(lido.getSenhaHash()).isEqualTo("hash");

        // revogar e o mesmo caminho, com aprovado = false
        lido.decidirDocente(false, admin.getId(), agora);
        usuarios.saveAndFlush(lido);
        assertThat(statusNoBanco(lido)).isEqualTo("RECUSADO");
    }

    @Test
    @DisplayName("conta ALUNO nao passa por decisao docente")
    void alunoNaoTemDecisao() {
        Usuario aluno = novoUsuario("Aluno");

        assertThatThrownBy(() -> aluno.decidirDocente(true, UUID.randomUUID(), Instant.now()))
                .isInstanceOf(IllegalStateException.class);
    }

    // ---- membro: COORDENADOR no CHECK, contestacao -----------------------------

    @Test
    @DisplayName("P1 — o CHECK de membro.papel aceita COORDENADOR e continua recusando o resto")
    void checkDePapelAceitaCoordenador() {
        Turma turma = novaTurma();
        Usuario coord = novoDocente("Coord", TipoConta.COORDENADOR);
        Usuario outro = novoDocente("Outro", TipoConta.PROFESSOR);

        membros.saveAndFlush(
                new Membro(UUID.randomUUID(), coord.getId(), turma.getId(), PapelMembro.COORDENADOR));
        em.clear();

        assertThat(membros.findByUsuarioIdAndTurmaId(coord.getId(), turma.getId()).orElseThrow()
                .getPapel()).isEqualTo(PapelMembro.COORDENADOR);
        assertThatCode(() -> membros.saveAndFlush(new Membro(
                UUID.randomUUID(), outro.getId(), turma.getId(), PapelMembro.PROFESSOR)))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> jdbc.update(
                "update membro set papel = 'DONO' where usuario_id = ?", outro.getId()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("a contestacao mora no vinculo: grava, le de volta e restaurar zera o rastro")
    void contestacaoNoVinculo() {
        Turma turma = novaTurma();
        Usuario lider = membroDe(turma, "Lider", PapelMembro.LIDER);
        Usuario prof = novoDocente("Prof", TipoConta.PROFESSOR);
        Membro vinculo = membros.saveAndFlush(
                new Membro(UUID.randomUUID(), prof.getId(), turma.getId(), PapelMembro.PROFESSOR));
        assertThat(vinculo.isContestado()).isFalse();
        Instant agora = Instant.now().truncatedTo(ChronoUnit.MICROS);

        vinculo.contestar(lider.getId(), agora);
        membros.saveAndFlush(vinculo);
        em.clear();

        Membro contestado = membros.findById(vinculo.getId()).orElseThrow();
        assertThat(contestado.isContestado()).isTrue();
        assertThat(contestado.getDocenteContestadoEm()).isEqualTo(agora);
        assertThat(contestado.getDocenteContestadoPor()).isEqualTo(lider.getId());

        contestado.restaurar();
        membros.saveAndFlush(contestado);
        em.clear();

        assertThat(membros.findById(vinculo.getId()).orElseThrow().isContestado()).isFalse();
    }

    // ---- P13: docente nunca vira LIDER, por nenhum caminho ---------------------

    /**
     * Um papel por execucao: o service rebaixa o lider ANTES de promover o novo, e
     * quando a promocao leva 409 e o rollback da transacao que desfaz o rebaixamento.
     * Aqui o teste e uma transacao so, entao o rebaixamento ficaria visivel numa
     * segunda chamada (que levaria 403, por o "lider" ja ter virado aluno).
     */
    @ParameterizedTest
    @EnumSource(value = PapelMembro.class, names = {"PROFESSOR", "COORDENADOR"})
    @DisplayName("P13 — transferir a lideranca para PROFESSOR ou COORDENADOR da turma -> 409")
    void transferirParaDocenteDa409(PapelMembro papelDoDocente) throws Exception {
        Turma turma = novaTurma();
        Usuario lider = membroDe(turma, "Lider", PapelMembro.LIDER);
        Usuario docente = membroDe(turma, "Docente", papelDoDocente);

        http.perform(post("/api/v1/turmas/lideranca/transferir")
                        .header("Authorization", bearer(lider))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"novoLiderUsuarioId\":\"" + docente.getId() + "\"}"))
                .andExpect(status().isConflict());

        em.clear();
        assertThat(membros.findByUsuarioIdAndTurmaId(docente.getId(), turma.getId()).orElseThrow()
                .getPapel()).isEqualTo(papelDoDocente);
    }

    @Test
    @DisplayName("P13 — o admin tambem nao consegue fazer docente virar LIDER: 409")
    void adminDefinirDocenteComoLiderDa409() throws Exception {
        Turma turma = novaTurma();
        Usuario prof = membroDe(turma, "Prof", PapelMembro.PROFESSOR);
        Usuario admin = novoUsuario("Admin");
        jdbc.update("update usuario set admin_plataforma = true where id = ?", admin.getId());
        em.clear();

        http.perform(post("/api/v1/admin/turmas/" + turma.getId() + "/lider")
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"novoLiderUsuarioId\":\"" + prof.getId() + "\"}"))
                .andExpect(status().isConflict());

        em.clear();
        assertThat(membros.findByUsuarioIdAndTurmaId(prof.getId(), turma.getId()).orElseThrow()
                .getPapel()).isEqualTo(PapelMembro.PROFESSOR);
    }

    // ---- professor_materia -----------------------------------------------------

    @Test
    @DisplayName("ProfessorMateria: salva, le de volta com declarado_em e lista por usuario")
    void professorMateriaSalvaELe() {
        Turma turma = novaTurma();
        Materia calc = novaMateria(turma);
        Usuario prof = novoDocente("Prof", TipoConta.PROFESSOR);

        lecionadas.saveAndFlush(new ProfessorMateria(prof.getId(), calc.getId()));
        em.clear();

        ProfessorMateria lida = lecionadas
                .findById(new ProfessorMateria.Chave(prof.getId(), calc.getId())).orElseThrow();
        assertThat(lida.getUsuarioId()).isEqualTo(prof.getId());
        assertThat(lida.getMateriaId()).isEqualTo(calc.getId());
        assertThat(lida.getDeclaradoEm()).isNotNull();
        assertThat(lecionadas.findByChaveUsuarioId(prof.getId())).hasSize(1);
        assertThat(lecionadas.findByChaveUsuarioId(UUID.randomUUID())).isEmpty();
    }

    @Test
    @DisplayName("ProfessorMateria: a instancia recem-salva ja vem com declarado_em (nao fica nula)")
    void declaradoEmPreenchidoLogoAposSalvar() {
        Turma turma = novaTurma();
        Usuario prof = novoDocente("Prof", TipoConta.PROFESSOR);

        ProfessorMateria salva = lecionadas.saveAndFlush(
                new ProfessorMateria(prof.getId(), novaMateria(turma).getId()));

        assertThat(salva.getDeclaradoEm()).isNotNull();
    }

    @Test
    @DisplayName("ProfessorMateria: o banco recusa declarar a mesma materia duas vezes (PK composta)")
    void naoDeclaraDuasVezes() {
        Turma turma = novaTurma();
        Materia calc = novaMateria(turma);
        Usuario prof = novoDocente("Prof", TipoConta.PROFESSOR);
        lecionadas.saveAndFlush(new ProfessorMateria(prof.getId(), calc.getId()));

        assertThatThrownBy(() -> jdbc.update(
                "insert into professor_materia (usuario_id, materia_id) values (?, ?)",
                prof.getId(), calc.getId()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("apagar a materia leva a declaracao junto (CASCADE), em vez de estourar a FK")
    void apagarMateriaLevaADeclaracao() {
        Turma turma = novaTurma();
        Materia calc = novaMateria(turma);
        Usuario prof = novoDocente("Prof", TipoConta.PROFESSOR);
        lecionadas.saveAndFlush(new ProfessorMateria(prof.getId(), calc.getId()));
        em.clear();

        materias.delete(materias.findById(calc.getId()).orElseThrow());
        materias.flush();
        em.clear();

        assertThat(lecionadas.findByChaveUsuarioId(prof.getId())).isEmpty();
    }
}
