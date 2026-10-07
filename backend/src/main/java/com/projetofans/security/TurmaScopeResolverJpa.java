package com.projetofans.security;

import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.erro.AcessoNegadoException;
import com.projetofans.erro.SemTurmaException;
import com.projetofans.repo.MembroRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.List;
import java.util.UUID;

@Component
public class TurmaScopeResolverJpa implements TurmaScopeResolver {

    private static final Logger log = LoggerFactory.getLogger(TurmaScopeResolverJpa.class);

    /** Turma ativa do docente (spec 2.8). O app do aluno nunca manda. */
    public static final String CABECALHO_TURMA = "X-Turma-Id";

    private final MembroRepository membros;

    public TurmaScopeResolverJpa(MembroRepository membros) {
        this.membros = membros;
    }

    /**
     * O cabecalho e lido aqui, via RequestContextHolder, e nao nos ~20 chamadores:
     * a assinatura dos services nao muda. Fora de uma requisicao HTTP (teste de
     * service, tarefa agendada) nao ha cabecalho e vale o vinculo mais recente.
     *
     * O servidor NAO confia no cabecalho: so aceita a turma se a pessoa for membro
     * dela. Cabecalho malformado ou de turma alheia e 404, igual a qualquer
     * registro de outra turma — nao confirma que a turma existe.
     */
    @Override
    public UUID turmaDoUsuario(UUID usuarioId) {
        String pedido = cabecalhoDaRequisicao();
        if (pedido == null) {
            return vinculoMaisRecente(usuarioId).getTurmaId();
        }
        UUID turmaId;
        try {
            turmaId = UUID.fromString(pedido.trim());
        } catch (IllegalArgumentException malformado) {
            throw new AcessoNegadoException();
        }
        exigirMembro(usuarioId, turmaId);
        return turmaId;
    }

    @Override
    public PapelMembro papelNaTurma(UUID usuarioId, UUID turmaId) {
        return membros.findByUsuarioIdAndTurmaId(usuarioId, turmaId)
                .map(Membro::getPapel)
                .orElseThrow(() -> negar(usuarioId));
    }

    @Override
    public void exigirMesmaTurma(UUID usuarioId, UUID turmaIdDoRegistro) {
        exigirMembro(usuarioId, turmaIdDoRegistro);
    }

    private void exigirMembro(UUID usuarioId, UUID turmaId) {
        if (!membros.existsByUsuarioIdAndTurmaId(usuarioId, turmaId)) {
            throw negar(usuarioId);
        }
    }

    /**
     * Quem nao e membro leva 404. So quem nao tem vinculo NENHUM leva o codigo
     * SEM_TURMA — o mesmo sinal que o app usa para esquecer a turma local, e que
     * so diz o que a propria pessoa ja sabe sobre si. Quem tem outras turmas e
     * pediu uma alheia leva o 404 liso, sem codigo (um 404 qualquer nao pode
     * mandar o app apagar a turma local). A consulta extra so roda no caminho de erro.
     */
    private AcessoNegadoException negar(UUID usuarioId) {
        return membros.existsByUsuarioId(usuarioId)
                ? new AcessoNegadoException()
                : new SemTurmaException();
    }

    private static String cabecalhoDaRequisicao() {
        RequestAttributes atual = RequestContextHolder.getRequestAttributes();
        return atual instanceof ServletRequestAttributes http
                ? http.getRequest().getHeader(CABECALHO_TURMA)
                : null;
    }

    /**
     * Usuario sem vinculo nenhum tambem cai em 404: ele nao esta em turma alguma,
     * entao nenhum registro de turma existe para ele. Devolver null aqui so
     * empurraria um NullPointerException para o proximo metodo.
     *
     * E o UNICO 404 com codigo SEM_TURMA: e o sinal que o app usa para esquecer a
     * turma local. Os outros 404 (registro de outra turma) seguem sem codigo.
     */
    private Membro vinculoMaisRecente(UUID usuarioId) {
        List<Membro> vinculos = membros.findByUsuarioIdOrderByEntrouEmDesc(usuarioId);
        if (vinculos.isEmpty()) {
            throw new SemTurmaException();
        }
        if (vinculos.size() > 1) {
            // So aviso, sem cabecalho: o aluno tem um vinculo so (guarda do
            // TurmaService), entao mais de um sem o app dizer qual turma e ou um
            // docente cujo app esqueceu de mandar X-Turma-Id, ou um aluno que
            // furou a guarda. Os dois sao bug a rastrear, nao caso a tratar melhor.
            log.warn("usuario {} tem {} vinculos de turma e a requisicao nao disse qual "
                            + "(sem {}); resolvendo pelo mais recente ({})",
                    usuarioId, vinculos.size(), CABECALHO_TURMA, vinculos.get(0).getTurmaId());
        }
        return vinculos.get(0);
    }
}
