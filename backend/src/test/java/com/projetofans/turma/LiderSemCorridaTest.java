package com.projetofans.turma;

import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.erro.NaoLiderException;
import com.projetofans.repo.MembroRepository;
import com.projetofans.repo.TurmaRepository;
import com.projetofans.repo.UsuarioRepository;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.service.ModeracaoService;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Remover membro e transferir lideranca ao mesmo tempo nao pode deixar a turma sem
 * lider.
 *
 * NAO e @Transactional de proposito: a corrida precisa de duas transacoes reais,
 * em threads diferentes, e dados gravados de verdade. Por isso o cenario se
 * apaga sozinho no fim — o Postgres da suite e um so.
 *
 * O cenario e o pior caso, montado em ordem fixa: a transferencia (Lia -> Bia)
 * ainda esta ABERTA quando Lia pede para remover Bia. Sem a trava no vinculo da
 * Lia, a remocao le "Lia e lider" (o estado de antes), espera a linha da Bia
 * ser liberada, e apaga a nova lider.
 */
class LiderSemCorridaTest extends TesteComPostgres {

    @Autowired private TurmaService turmaService;
    @Autowired private ModeracaoService moderacao;
    @Autowired private TurmaRepository turmas;
    @Autowired private UsuarioRepository usuarios;
    @Autowired private MembroRepository membros;
    @Autowired private PlatformTransactionManager transacoes;
    @Autowired private JdbcTemplate jdbc;

    private Turma turma;
    private Usuario lia;
    private Usuario bia;

    @BeforeEach
    void cenario() {
        turma = turmas.saveAndFlush(new Turma(
                UUID.randomUUID(), "Corrida", "2026.2", "CORR-" + UUID.randomUUID()));
        lia = usuario("Lia");
        bia = usuario("Bia");
        membros.saveAndFlush(new Membro(UUID.randomUUID(), lia.getId(), turma.getId(), PapelMembro.LIDER));
        membros.saveAndFlush(new Membro(UUID.randomUUID(), bia.getId(), turma.getId(), PapelMembro.ALUNO));
    }

    @AfterEach
    void limpar() {
        jdbc.update("delete from acao_moderacao where lider_id in (?, ?)", lia.getId(), bia.getId());
        jdbc.update("delete from membro where turma_id = ?", turma.getId());
        jdbc.update("delete from usuario where id in (?, ?)", lia.getId(), bia.getId());
        jdbc.update("delete from turma where id = ?", turma.getId());
    }

    private Usuario usuario(String nome) {
        return usuarios.saveAndFlush(Usuario.comSenha(
                UUID.randomUUID(), nome, "u-" + UUID.randomUUID() + "@ex.dev", "hash"));
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

    @Test
    @DisplayName("remover quem acabou de receber a lideranca falha com 403: a turma nao fica sem lider")
    void removerNaoApagaOLiderRecemTransferido() throws Exception {
        UsuarioAtual comoLia = new UsuarioAtual(lia.getId(), "Lia");
        ExecutorService outraThread = Executors.newSingleThreadExecutor();
        try {
            Future<?> remocao = new TransactionTemplate(transacoes).execute(status -> {
                moderacao.transferirLideranca(comoLia, bia.getId());
                Future<?> pedido = outraThread.submit(
                        () -> turmaService.removerMembro(comoLia, bia.getId()));
                try {
                    esperarAlguemTravado();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException(e);
                }
                return pedido;
            });
            // A transferencia commitou ao sair do template; so agora a remocao anda.

            assertThatThrownBy(() -> remocao.get(10, SECONDS))
                    .hasCauseInstanceOf(NaoLiderException.class);
            assertThat(membros.findByTurmaIdAndPapel(turma.getId(), PapelMembro.LIDER))
                    .as("a turma continua com exatamente o lider novo")
                    .get().extracting(Membro::getUsuarioId).isEqualTo(bia.getId());
        } finally {
            outraThread.shutdownNow();
        }
    }
}
