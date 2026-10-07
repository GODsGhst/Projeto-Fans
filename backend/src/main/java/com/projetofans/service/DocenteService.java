package com.projetofans.service;

import com.projetofans.domain.ContestacaoDocente;
import com.projetofans.domain.Materia;
import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.ProfessorMateria;
import com.projetofans.erro.AcessoNegadoException;
import com.projetofans.erro.ErroDeNegocio;
import com.projetofans.erro.NaoLiderException;
import com.projetofans.repo.ContestacaoDocenteRepository;
import com.projetofans.repo.MateriaRepository;
import com.projetofans.repo.MembroRepository;
import com.projetofans.repo.ProfessorMateriaRepository;
import com.projetofans.security.TurmaScopeResolver;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.web.dto.MinhaTurmaResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Os dois lados da relacao docente <-> turma (spec 2.3 e 2.4): o professor DECLARA
 * o que leciona, o lider CONTESTA a declaracao.
 *
 * Nenhum dos dois concede poder sozinho: o poder sai do {@code PoderNaTurma}, que
 * cruza conta aprovada, vinculo nao contestado e materia declarada. Aqui so se
 * escrevem esses dados — por isso declarar vale na hora, sem fila (a correcao vem
 * depois do fato, como no resto do app), e por isso um pendente pode declarar:
 * a declaracao fica inerte ate a aprovacao.
 *
 * A contestacao mora no vinculo (`membro.docente_contestado_*`) e nao no
 * diario de moderacao: `acao_moderacao` tem CHECK de tipos de acao e registrar
 * contestacao ali pediria migration. O rastro e o proprio vinculo — quem contestou
 * e quando. Como remover o docente apaga o vinculo, a contestacao tambem e copiada
 * para `contestacao_docente` (V10), que sobrevive a remocao e faz o vinculo novo
 * nascer contestado.
 *
 * Cada metodo devolve a turma montada ({@link TurmaService#minha}) porque as tres
 * telas que os chamam precisam do estado novo na mesma hora; uma segunda ida ao
 * servidor deixaria uma janela com o estado velho na tela.
 */
@Service
public class DocenteService {

    private final MembroRepository membros;
    private final MateriaRepository materias;
    private final ProfessorMateriaRepository lecionadas;
    private final ContestacaoDocenteRepository contestacoes;
    private final TurmaScopeResolver escopo;
    private final TurmaService turmas;

    public DocenteService(MembroRepository membros, MateriaRepository materias,
                          ProfessorMateriaRepository lecionadas,
                          ContestacaoDocenteRepository contestacoes, TurmaScopeResolver escopo,
                          TurmaService turmas) {
        this.membros = membros;
        this.materias = materias;
        this.lecionadas = lecionadas;
        this.contestacoes = contestacoes;
        this.escopo = escopo;
        this.turmas = turmas;
    }

    /**
     * Substitui o conjunto de materias que o professor leciona NESTA turma.
     *
     * So PROFESSOR declara. O COORDENADOR alcanca a turma inteira sem declarar
     * nada, entao declarar seria ruido; aluno e lider nao dao aula. Todos levam 403.
     *
     * Ordem das checagens: turma (404) -> papel (403) -> materias (404). O papel vem
     * antes das materias para que um nao-professor nao consiga sondar ids de materia
     * pela diferenca entre as respostas.
     *
     * "Esta turma" e o ponto sutil: o professor pode lecionar em varias turmas, e
     * a declaracao das outras nao pode ser apagada por esta chamada. So as linhas
     * cujas materias sao DESTA turma entram na troca.
     *
     * ponytail: apagar a materia ao mesmo tempo que o professor a declara estoura a
     * FK num 500 raro; trocar por 409 pede um ramo no ProblemDetailHandler.
     */
    @Transactional
    public MinhaTurmaResponse declarar(UsuarioAtual eu, List<UUID> materiaIds) {
        // Serializa duas declaracoes simultaneas da mesma pessoa (PK composta
        // estourando em 500). Primeira consulta da transacao, ver travarDoUsuario.
        membros.travarDoUsuario(eu.usuarioId());
        UUID turmaId = escopo.turmaDoUsuario(eu.usuarioId());
        if (escopo.papelNaTurma(eu.usuarioId(), turmaId) != PapelMembro.PROFESSOR) {
            throw new ErroDeNegocio(HttpStatus.FORBIDDEN, "Somente professor declara materias");
        }

        Set<UUID> novas = new LinkedHashSet<>(materiaIds);
        Set<UUID> daTurma = materias.findByTurmaIdOrderBySiglaAsc(turmaId).stream()
                .map(Materia::getId).collect(Collectors.toSet());
        if (!daTurma.containsAll(novas)) {
            // Inexistente e de outra turma respondem igual: 404 liso, sem dizer qual.
            throw new AcessoNegadoException();
        }

        List<ProfessorMateria> atuais = lecionadas.findByChaveUsuarioId(eu.usuarioId()).stream()
                .filter(pm -> daTurma.contains(pm.getMateriaId()))
                .toList();
        Set<UUID> jaDeclaradas = atuais.stream()
                .map(ProfessorMateria::getMateriaId).collect(Collectors.toSet());

        lecionadas.deleteAll(atuais.stream()
                .filter(pm -> !novas.contains(pm.getMateriaId())).toList());
        List<ProfessorMateria> acrescentar = new ArrayList<>();
        for (UUID materiaId : novas) {
            if (!jaDeclaradas.contains(materiaId)) {
                acrescentar.add(new ProfessorMateria(eu.usuarioId(), materiaId));
            }
        }
        lecionadas.saveAll(acrescentar);
        lecionadas.flush();

        return turmas.minha(eu);
    }

    /**
     * O lider tira o poder e o selo do docente NESTA turma, ate restaurar. Nao
     * mexe na conta (isso e do admin) nem nas outras turmas do docente.
     *
     * Ordem: alvo (404) -> poder (403), a mesma de `removerMembro`. O alvo tem de
     * ser PROFESSOR ou COORDENADOR da turma do lider; aluno, lider ou gente de fora
     * levam 404, como se o usuario nao existisse. Contestar quem ja esta contestado
     * e no-op: o rastro guarda a PRIMEIRA contestacao, nao a ultima.
     */
    @Transactional
    public MinhaTurmaResponse contestar(UsuarioAtual lider, UUID docenteId) {
        Membro alvo = alvoDocenteDoLider(lider, docenteId);
        if (!alvo.isContestado()) {
            alvo.contestar(lider.usuarioId(), Instant.now());
            membros.saveAndFlush(alvo);
        }
        // Espelha na tabela duravel SEMPRE, e com o rastro que o vinculo guarda (a
        // PRIMEIRA contestacao): removerMembro apaga o vinculo, e e aqui que a
        // contestacao sobrevive para o docente nao voltar limpo pelo codigo. Gravar
        // tambem quando o vinculo ja estava contestado cobre a contestacao feita
        // antes da tabela existir sem copia dela.
        contestacoes.saveAndFlush(new ContestacaoDocente(alvo.getTurmaId(), alvo.getUsuarioId(),
                alvo.getDocenteContestadoEm(), alvo.getDocenteContestadoPor()));
        return turmas.minha(lider);
    }

    /** Desfaz a contestacao: o poder volta na proxima requisicao do docente. */
    @Transactional
    public MinhaTurmaResponse restaurar(UsuarioAtual lider, UUID docenteId) {
        Membro alvo = alvoDocenteDoLider(lider, docenteId);
        alvo.restaurar();
        membros.saveAndFlush(alvo);
        // Restaurar e a UNICA forma de apagar a memoria duravel; sem isto o proximo
        // vinculo do docente nasceria contestado de novo.
        contestacoes.deleteById(new ContestacaoDocente.Chave(alvo.getTurmaId(), alvo.getUsuarioId()));
        contestacoes.flush();
        return turmas.minha(lider);
    }

    private Membro alvoDocenteDoLider(UsuarioAtual lider, UUID docenteId) {
        UUID turmaId = escopo.turmaDoUsuario(lider.usuarioId());
        Membro alvo = membros.findByUsuarioIdAndTurmaId(docenteId, turmaId)
                .filter(m -> m.getPapel() == PapelMembro.PROFESSOR
                        || m.getPapel() == PapelMembro.COORDENADOR)
                .orElseThrow(AcessoNegadoException::new);
        if (escopo.papelNaTurma(lider.usuarioId(), turmaId) != PapelMembro.LIDER) {
            throw new NaoLiderException();
        }
        return alvo;
    }
}
