package com.projetofans.service;

import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.TipoConta;
import com.projetofans.domain.Usuario;
import com.projetofans.erro.AcessoNegadoException;
import com.projetofans.erro.ErroDeNegocio;
import com.projetofans.repo.MateriaRepository;
import com.projetofans.repo.MembroRepository;
import com.projetofans.repo.TurmaRepository;
import com.projetofans.repo.UsuarioRepository;
import com.projetofans.security.PoderNaTurma;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.web.dto.ItemHomeResponse;
import com.projetofans.web.dto.PainelResponse;
import com.projetofans.web.dto.PainelResponse.MateriaTeacherInfo;
import com.projetofans.web.dto.PainelResponse.TurmaComProximos;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Painel do docente (professor ou coordenador): suas turmas e os proximos eventos de
 * cada uma (spec PC9, secao 7).
 *
 * Quem e docente e o TIPO da conta, lido do banco a cada chamada, e nao o status:
 * ler nao e poder (spec 7), entao o docente pendente ou recusado ve o painel — so
 * sem selo. Painel e da conta, nao da turma ativa: nada aqui passa pelo
 * TurmaScopeResolver, e por isso o X-Turma-Id e ignorado.
 */
@Service
public class PainelService {

    private final MembroRepository membros;
    private final TurmaRepository turmas;
    private final MateriaRepository materias;
    private final UsuarioRepository usuarios;
    private final PoderNaTurma poderNaTurma;
    private final HomeService home;

    public PainelService(MembroRepository membros, TurmaRepository turmas,
                         MateriaRepository materias, UsuarioRepository usuarios,
                         PoderNaTurma poderNaTurma, HomeService home) {
        this.membros = membros;
        this.turmas = turmas;
        this.materias = materias;
        this.usuarios = usuarios;
        this.poderNaTurma = poderNaTurma;
        this.home = home;
    }

    /**
     * Conta ALUNO leva 403 (e nao 404: a rota existe e o aluno sabe que ela existe;
     * o que ele nao tem e o tipo de conta).
     */
    @Transactional(readOnly = true)
    public PainelResponse painel(UsuarioAtual usuario) {
        Usuario conta = usuarios.findById(usuario.usuarioId()).orElseThrow(AcessoNegadoException::new);
        if (conta.getTipoConta() == TipoConta.ALUNO) {
            throw new ErroDeNegocio(HttpStatus.FORBIDDEN, "Painel e so de professor ou coordenacao");
        }
        return new PainelResponse(membros.findByUsuarioIdOrderByEntrouEmDesc(usuario.usuarioId()).stream()
                .map(m -> turmaComProximos(usuario.usuarioId(), m))
                .toList());
    }

    private TurmaComProximos turmaComProximos(UUID usuarioId, Membro membro) {
        UUID turmaId = membro.getTurmaId();
        var turma = turmas.findById(turmaId).orElseThrow(AcessoNegadoException::new);

        // Os docentes da turma, uma leitura so: o selo e as materias saem daqui.
        PoderNaTurma.Docentes docentes = poderNaTurma.daTurma(turmaId);

        // O que o professor DECLAROU, com ou sem poder: a declaracao e dele (spec 7,
        // "pendente pode declarar, fica inerte"). Coordenacao nao declara nada.
        Set<UUID> declaradas = docentes.lecionadas(usuarioId);
        List<MateriaTeacherInfo> lecionadas = materias.findByTurmaIdOrderBySiglaAsc(turmaId).stream()
                .filter(m -> declaradas.contains(m.getId()))
                .map(m -> new MateriaTeacherInfo(m.getId(), m.getSigla(), m.getCorHex()))
                .toList();

        // Coordenacao ve a turma toda; professor, so as materias que declarou. Pelo
        // papel do VINCULO (e nao pelo status): ler o que a Home ja mostra a qualquer
        // membro nao e privilegio, entao o pendente tambem recebe a lista.
        List<ItemHomeResponse> proximos = membro.getPapel() == PapelMembro.COORDENADOR
                ? home.proximosDaTurma(turmaId, usuarioId)
                : home.proximosDasMaterias(turmaId, usuarioId, declaradas);

        return new TurmaComProximos(
                turmaId,
                turma.getNome(),
                turma.getSemestre(),
                membro.getPapel().name(),
                docentes.seloGeral(usuarioId),
                membro.isContestado(),
                lecionadas,
                proximos);
    }
}
