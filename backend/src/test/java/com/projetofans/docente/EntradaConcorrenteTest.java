package com.projetofans.docente;

import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.TipoConta;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.repo.MembroRepository;
import com.projetofans.repo.TurmaRepository;
import com.projetofans.repo.UsuarioRepository;
import com.projetofans.service.TurmaService;
import com.projetofans.support.TesteComPostgres;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * P14 — dois alunos entrando ao mesmo tempo numa turma sem lider: EXATAMENTE um LIDER.
 *
 * NAO e @Transactional de proposito (mesmo motivo do LiderSemCorridaTest): a
 * corrida precisa de duas transacoes reais, em threads diferentes, e dados
 * gravados de verdade. Por isso o cenario se apaga sozinho no fim — o Postgres da
 * suite e um so.
 *
 * A ordem e fixa, o pior caso: a entrada da Ana ainda esta ABERTA (o vinculo LIDER
 * dela inserido, sem commit) quando o Bruno entra. Uma implementacao ingenua —
 * "a turma nao tem lider? entao salvo como LIDER" — faria o Bruno tambem tentar
 * LIDER, bater no indice parcial e estourar; pior, no Postgres a violacao ja
 * aborta a transacao, entao nem da para "tentar de novo como ALUNO". O INSERT ...
 * ON CONFLICT DO NOTHING espera a Ana commitar, nao insere nada e deixa o Bruno
 * cair no ALUNO na mesma transacao.
 */
class EntradaConcorrenteTest extends TesteComPostgres {

    @Autowired private TurmaService turmaService;
    @Autowired private TurmaRepository turmas;
    @Autowired private UsuarioRepository usuarios;
    @Autowired private MembroRepository membros;
    @Autowired private PlatformTransactionManager transacoes;
    @Autowired private JdbcTemplate jdbc;

    private Turma turma;
    private Usuario professor;
    private Usuario ana;
    private Usuario bruno;

    @BeforeEach
    void cenario() {
        turma = turmas.saveAndFlush(new Turma(
                UUID.randomUUID(), "Corrida de entrada", "2026.2", "ENTR-" + UUID.randomUUID()));
        professor = usuario("Professor", TipoConta.PROFESSOR);
        ana = usuario("Ana", TipoConta.ALUNO);
        bruno = usuario("Bruno", TipoConta.ALUNO);
        // A turma de docente nasce sem lider: so o vinculo do professor existe.
        membros.saveAndFlush(new Membro(
                UUID.randomUUID(), professor.getId(), turma.getId(), PapelMembro.PROFESSOR));
    }

    @AfterEach
    void limpar() {
        jdbc.update("delete from membro where turma_id = ?", turma.getId());
        jdbc.update("delete from usuario where id in (?, ?, ?)",
                professor.getId(), ana.getId(), bruno.getId());
        jdbc.update("delete from turma where id = ?", turma.getId());
    }

    private Usuario usuario(String nome, TipoConta tipo) {
        return usuarios.saveAndFlush(Usuario.comSenha(UUID.randomUUID(), nome,
                "u-" + UUID.randomUUID() + "@ex.dev", "hash", tipo));
    }

    /** Espera ate alguma transacao estar parada numa trava — a outra ja chegou na corrida. */
    private void esperarAlguemTravado() throws InterruptedException {
        for (int i = 0; i < 100; i++) {
            Integer esperando = jdbc.queryForObject(
                    "select count(*) from pg_stat_activity where wait_event_type = 'Lock'", Integer.class);
            if (esperando != null && esperando > 0) {
                return;
            }
            Thread.sleep(50);
        }
        throw new AssertionError("a segunda transacao nunca chegou a esperar por trava");
    }

    private PapelMembro papelDe(Usuario quem) {
        return membros.findByUsuarioIdAndTurmaId(quem.getId(), turma.getId()).orElseThrow().getPapel();
    }

    @Test
    @DisplayName("P14 — dois alunos entrando juntos: exatamente um LIDER, o perdedor da corrida entra como ALUNO")
    void doisAlunosJuntosDaoUmSoLider() throws Exception {
        ExecutorService outraThread = Executors.newSingleThreadExecutor();
        try {
            Future<Membro> entradaDoBruno = new TransactionTemplate(transacoes).execute(status -> {
                // A Ana ganha a lideranca, mas a transacao dela continua aberta.
                Membro daAna = turmaService.entrar(ana.getId(), turma.getCodigoConvite());
                assertThat(daAna.getPapel()).isEqualTo(PapelMembro.LIDER);

                Future<Membro> pedido = outraThread.submit(
                        () -> turmaService.entrar(bruno.getId(), turma.getCodigoConvite()));
                try {
                    esperarAlguemTravado();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException(e);
                }
                return pedido;
            });
            // A entrada da Ana commitou ao sair do template; so agora o Bruno anda.

            assertThat(entradaDoBruno.get(10, SECONDS).getPapel())
                    .as("o perdedor da corrida nao estoura: entra como ALUNO")
                    .isEqualTo(PapelMembro.ALUNO);
            assertThat(papelDe(ana)).isEqualTo(PapelMembro.LIDER);
            assertThat(papelDe(bruno)).isEqualTo(PapelMembro.ALUNO);
            assertThat(jdbc.queryForObject(
                    "select count(*) from membro where turma_id = ? and papel = 'LIDER'",
                    Integer.class, turma.getId())).isEqualTo(1);
        } finally {
            outraThread.shutdownNow();
        }
    }
}
