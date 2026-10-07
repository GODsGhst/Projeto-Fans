package com.projetofans.docente;

import com.projetofans.domain.DocenteStatus;
import com.projetofans.domain.Materia;
import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.ProfessorMateria;
import com.projetofans.domain.Selo;
import com.projetofans.domain.TipoConta;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.repo.ProfessorMateriaRepository;
import com.projetofans.security.PoderNaTurma;
import com.projetofans.security.PoderNaTurma.Docentes;
import com.projetofans.support.TesteDeApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A regra do poder docente (spec 5.2), no unico lugar que a sabe.
 *
 * Cada teste tenta tirar o poder por UM eixo (status da conta, contestacao,
 * materia nao declarada, papel, outra turma) com os outros eixos a favor: se o
 * poder aparecesse sem que o eixo testado estivesse certo, algum teste aqui falha.
 */
class PoderNaTurmaTest extends TesteDeApi {

    @Autowired private PoderNaTurma poder;
    @Autowired private ProfessorMateriaRepository lecionadas;

    private Turma turma;
    private Materia calculo;
    private Materia fisica;

    @BeforeEach
    void cenario() {
        turma = novaTurma();
        calculo = novaMateria(turma);
        fisica = materias.saveAndFlush(new Materia(
                UUID.randomUUID(), turma.getId(), "Fisica", "FIS", "#1F6FB2"));
    }

    /** Docente ja vinculado a `t`, com o status dado; `declara` sao as materias que ele leciona. */
    private Usuario docente(Turma t, TipoConta tipo, DocenteStatus status, boolean contestado,
                            Materia... declara) {
        Usuario u = usuarios.saveAndFlush(Usuario.comSenha(UUID.randomUUID(), "Docente",
                "d-" + UUID.randomUUID() + "@ex.dev", "hash", tipo));
        if (status != DocenteStatus.PENDENTE) {
            // o decididor e uma FK: aponta para um usuario de verdade
            u.decidirDocente(status == DocenteStatus.APROVADO, novoUsuario("Admin").getId(),
                    Instant.now());
            usuarios.saveAndFlush(u);
        }
        Membro vinculo = new Membro(UUID.randomUUID(), u.getId(), t.getId(),
                PapelMembro.valueOf(tipo.name()));
        if (contestado) {
            // quem contestou e so uma FK para usuario; nao precisa ser lider de verdade
            vinculo.contestar(novoUsuario("Lider").getId(), Instant.now());
        }
        membros.saveAndFlush(vinculo);
        for (Materia m : declara) {
            lecionadas.saveAndFlush(new ProfessorMateria(u.getId(), m.getId()));
        }
        return u;
    }

    @Test
    @DisplayName("coordenador aprovado alcanca qualquer materia e tambem o que nao tem materia (nota)")
    void coordenadorAprovadoAlcancaATurmaInteira() {
        Usuario coord = docente(turma, TipoConta.COORDENADOR, DocenteStatus.APROVADO, false);

        Docentes d = poder.daTurma(turma.getId());

        assertThat(d.alcanca(coord.getId(), calculo.getId())).isTrue();
        assertThat(d.alcanca(coord.getId(), fisica.getId())).isTrue();
        assertThat(d.alcanca(coord.getId(), null)).isTrue();
        assertThat(d.selo(coord.getId(), fisica.getId())).isEqualTo(Selo.COORDENACAO);
        assertThat(d.selo(coord.getId(), null)).isEqualTo(Selo.COORDENACAO);
        assertThat(d.alcance(coord.getId()).tipo()).isEqualTo(PoderNaTurma.Tipo.TURMA);
    }

    @Test
    @DisplayName("professor aprovado alcanca so a materia que declarou, e nunca o que nao tem materia")
    void professorAprovadoAlcancaSoADeclarada() {
        Usuario prof = docente(turma, TipoConta.PROFESSOR, DocenteStatus.APROVADO, false, calculo);

        Docentes d = poder.daTurma(turma.getId());

        assertThat(d.alcanca(prof.getId(), calculo.getId())).isTrue();
        assertThat(d.alcanca(prof.getId(), fisica.getId())).isFalse();
        assertThat(d.alcanca(prof.getId(), null)).isFalse();
        assertThat(d.selo(prof.getId(), calculo.getId())).isEqualTo(Selo.PROFESSOR);
        assertThat(d.selo(prof.getId(), fisica.getId())).isNull();
        assertThat(d.alcance(prof.getId()).tipo()).isEqualTo(PoderNaTurma.Tipo.MATERIAS);
        assertThat(d.alcance(prof.getId()).materiaIds()).containsExactly(calculo.getId());
    }

    @Test
    @DisplayName("professor aprovado que nao declarou nada nao tem poder nem selo")
    void professorSemDeclaracaoNaoTemPoder() {
        Usuario prof = docente(turma, TipoConta.PROFESSOR, DocenteStatus.APROVADO, false);

        Docentes d = poder.daTurma(turma.getId());

        assertThat(d.alcanca(prof.getId(), calculo.getId())).isFalse();
        assertThat(d.alcance(prof.getId()).tipo()).isEqualTo(PoderNaTurma.Tipo.NENHUM);
        assertThat(d.seloGeral(prof.getId())).isNull();
    }

    @ParameterizedTest
    @EnumSource(value = DocenteStatus.class, names = {"PENDENTE", "RECUSADO"})
    @DisplayName("conta pendente ou recusada nao tem poder nem selo, mesmo com vinculo e declaracao")
    void contaNaoAprovadaNaoTemPoder(DocenteStatus status) {
        Usuario prof = docente(turma, TipoConta.PROFESSOR, status, false, calculo);
        Usuario coord = docente(turma, TipoConta.COORDENADOR, status, false);

        Docentes d = poder.daTurma(turma.getId());

        assertThat(d.alcanca(prof.getId(), calculo.getId())).isFalse();
        assertThat(d.selo(prof.getId(), calculo.getId())).isNull();
        assertThat(d.alcanca(coord.getId(), calculo.getId())).isFalse();
        assertThat(d.alcanca(coord.getId(), null)).isFalse();
        assertThat(d.alcance(coord.getId()).tipo()).isEqualTo(PoderNaTurma.Tipo.NENHUM);
        // a declaracao continua visivel: e ela que o lider confere antes de contestar
        assertThat(d.lecionadas(prof.getId())).containsExactly(calculo.getId());
    }

    @Test
    @DisplayName("vinculo contestado pelo lider perde o poder e o selo, professor e coordenador")
    void contestadoNaoTemPoder() {
        Usuario prof = docente(turma, TipoConta.PROFESSOR, DocenteStatus.APROVADO, true, calculo);
        Usuario coord = docente(turma, TipoConta.COORDENADOR, DocenteStatus.APROVADO, true);

        Docentes d = poder.daTurma(turma.getId());

        assertThat(d.alcanca(prof.getId(), calculo.getId())).isFalse();
        assertThat(d.selo(prof.getId(), calculo.getId())).isNull();
        assertThat(d.alcanca(coord.getId(), null)).isFalse();
        assertThat(d.selo(coord.getId(), calculo.getId())).isNull();
    }

    @Test
    @DisplayName("lider, aluno e quem nao e da turma nao alcancam: o lider modera pelo papel, nao por aqui")
    void quemNaoEDocenteNaoAlcanca() {
        Usuario lider = membroDe(turma, "Lia", PapelMembro.LIDER);
        Usuario aluno = membroDe(turma, "Ana", PapelMembro.ALUNO);

        Docentes d = poder.daTurma(turma.getId());

        assertThat(d.alcanca(lider.getId(), calculo.getId())).isFalse();
        assertThat(d.alcanca(aluno.getId(), null)).isFalse();
        assertThat(d.alcanca(UUID.randomUUID(), calculo.getId())).isFalse();
        assertThat(d.alcance(lider.getId()).tipo()).isEqualTo(PoderNaTurma.Tipo.NENHUM);
    }

    @Test
    @DisplayName("declarar materia de OUTRA turma nao da poder nesta: a declaracao e filtrada pela turma")
    void declaracaoDeOutraTurmaNaoVaza() {
        Turma outra = novaTurma();
        Materia deOutra = novaMateria(outra);
        // vinculado nas duas turmas, declarou so a materia da outra
        Usuario prof = docente(turma, TipoConta.PROFESSOR, DocenteStatus.APROVADO, false, deOutra);
        membros.saveAndFlush(new Membro(UUID.randomUUID(), prof.getId(), outra.getId(),
                PapelMembro.PROFESSOR));

        assertThat(poder.daTurma(turma.getId()).alcanca(prof.getId(), deOutra.getId())).isFalse();
        assertThat(poder.daTurma(turma.getId()).lecionadas(prof.getId())).isEmpty();
        assertThat(poder.daTurma(outra.getId()).alcanca(prof.getId(), deOutra.getId())).isTrue();
    }

    @Test
    @DisplayName("P16 — o status e lido do banco a cada chamada: nada fica em cache entre requisicoes")
    void statusEhLidoAcadaChamada() {
        Usuario prof = docente(turma, TipoConta.PROFESSOR, DocenteStatus.APROVADO, false, calculo);
        assertThat(poder.daTurma(turma.getId()).alcanca(prof.getId(), calculo.getId())).isTrue();

        Usuario admin = novoUsuario("Admin");
        prof.decidirDocente(false, admin.getId(), Instant.now());
        usuarios.saveAndFlush(prof);

        assertThat(poder.daTurma(turma.getId()).alcanca(prof.getId(), calculo.getId())).isFalse();
    }
}
