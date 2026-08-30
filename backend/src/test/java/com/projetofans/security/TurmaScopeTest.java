package com.projetofans.security;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.erro.AcessoNegadoException;
import com.projetofans.repo.MembroRepository;
import com.projetofans.repo.TurmaRepository;
import com.projetofans.repo.UsuarioRepository;
import com.projetofans.support.TesteComPostgres;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * A rede de seguranca de todo o resto do backend.
 *
 * O ultimo teste e o mais importante do arquivo: acesso a registro de OUTRA turma
 * responde 404, nunca 403. 403 confirmaria que o registro existe, e existencia e
 * exatamente o que nao se pode vazar entre turmas. Se algum dia ele virar 403,
 * isso e regressao de seguranca, nao ajuste de contrato.
 */
@Transactional
class TurmaScopeTest extends TesteComPostgres {

    @Autowired private TurmaScopeResolver escopo;
    @Autowired private TurmaRepository turmas;
    @Autowired private UsuarioRepository usuarios;
    @Autowired private MembroRepository membros;
    @Autowired private JdbcTemplate jdbc;

    private Turma novaTurma() {
        String codigo = "SCOPE-" + UUID.randomUUID();
        return turmas.saveAndFlush(new Turma(UUID.randomUUID(), "Turma " + codigo, "2026.2", codigo));
    }

    private Usuario novoUsuario() {
        return usuarios.saveAndFlush(Usuario.comSenha(
                UUID.randomUUID(), "Fulano", "u-" + UUID.randomUUID() + "@ex.dev", "$2a$10$hashfalso"));
    }

    /**
     * entrou_em tem DEFAULT now(), e now() no Postgres e o instante de INICIO DA
     * TRANSACAO — dois vinculos inseridos aqui nasceriam com timestamp identico e
     * a ordenacao viraria sorteio. Por isso o teste escreve as datas na mao.
     */
    private Membro vincula(Usuario usuario, Turma turma, PapelMembro papel, Instant entrouEm) {
        Membro membro = membros.saveAndFlush(
                new Membro(UUID.randomUUID(), usuario.getId(), turma.getId(), papel));
        jdbc.update("update membro set entrou_em = ? where id = ?",
                Timestamp.from(entrouEm), membro.getId());
        return membro;
    }

    @Test
    @DisplayName("com um vinculo, resolve a turma daquele vinculo")
    void resolveTurmaDoUsuarioComUmVinculo() {
        Turma turma = novaTurma();
        Usuario usuario = novoUsuario();
        vincula(usuario, turma, PapelMembro.ALUNO, Instant.now());

        assertThat(escopo.turmaDoUsuario(usuario.getId())).isEqualTo(turma.getId());
        assertThat(escopo.papelDoUsuario(usuario.getId())).isEqualTo(PapelMembro.ALUNO);
    }

    @Test
    @DisplayName("com dois vinculos, pega o mais recente e loga aviso")
    void comDoisVinculosPegaOMaisRecente() {
        Turma antiga = novaTurma();
        Turma recente = novaTurma();
        Usuario usuario = novoUsuario();
        Instant agora = Instant.now();
        vincula(usuario, antiga, PapelMembro.LIDER, agora.minus(30, ChronoUnit.DAYS));
        vincula(usuario, recente, PapelMembro.ALUNO, agora);

        ListAppender<ILoggingEvent> avisos = capturaLogDoResolver();

        assertThat(escopo.turmaDoUsuario(usuario.getId())).isEqualTo(recente.getId());
        assertThat(escopo.papelDoUsuario(usuario.getId())).isEqualTo(PapelMembro.ALUNO);

        // Multiplas turmas esta fora de escopo (spec Secao 13). O aviso existe para
        // detectar que alguem implementou por engano, entao ele e requisito, nao enfeite.
        assertThat(avisos.list)
                .anyMatch(evento -> evento.getLevel() == Level.WARN
                        && evento.getFormattedMessage().contains(usuario.getId().toString()));
    }

    @Test
    @DisplayName("exigirMesmaTurma passa quando o registro e da turma do usuario")
    void exigirMesmaTurmaPassaQuandoIgual() {
        Turma turma = novaTurma();
        Usuario usuario = novoUsuario();
        vincula(usuario, turma, PapelMembro.ALUNO, Instant.now());

        assertThatCode(() -> escopo.exigirMesmaTurma(usuario.getId(), turma.getId()))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("exigirMesmaTurma lanca 404 — nao 403 — quando o registro e de outra turma")
    void exigirMesmaTurmaLanca404QuandoDiferente() {
        Turma minha = novaTurma();
        Turma alheia = novaTurma();
        Usuario usuario = novoUsuario();
        vincula(usuario, minha, PapelMembro.ALUNO, Instant.now());

        assertThatThrownBy(() -> escopo.exigirMesmaTurma(usuario.getId(), alheia.getId()))
                .isInstanceOf(AcessoNegadoException.class)
                .extracting(erro -> ((AcessoNegadoException) erro).getStatus())
                .isEqualTo(HttpStatus.NOT_FOUND);
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
}
