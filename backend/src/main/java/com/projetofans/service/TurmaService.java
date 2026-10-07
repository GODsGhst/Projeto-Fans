package com.projetofans.service;

import com.projetofans.domain.ContestacaoDocente;
import com.projetofans.domain.DocenteStatus;
import com.projetofans.domain.Materia;
import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.TipoConta;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.erro.NaoLiderException;
import com.projetofans.erro.AcessoNegadoException;
import com.projetofans.erro.ErroDeNegocio;
import com.projetofans.repo.ContestacaoDocenteRepository;
import com.projetofans.repo.MateriaRepository;
import com.projetofans.repo.MembroRepository;
import com.projetofans.repo.ProfessorMateriaRepository;
import com.projetofans.repo.TurmaRepository;
import com.projetofans.repo.UsuarioRepository;
import com.projetofans.security.PoderNaTurma;
import com.projetofans.security.TurmaScopeResolver;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.web.dto.MembroDaTurmaResponse;
import com.projetofans.web.dto.AtualizarTurmaRequest;
import com.projetofans.web.dto.MinhaTurmaResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Criar turma e entrar em turma.
 *
 * Quem cria vira LIDER; quem entra por convite vira ALUNO. Nao existe fila de
 * aprovacao: o codigo de convite JA e o controle de entrada, e postar depois disso
 * e livre, sem gate e sem status pendente.
 */
@Service
public class TurmaService {

    private final TurmaRepository turmas;
    private final MembroRepository membros;
    private final UsuarioRepository usuarios;
    private final TurmaScopeResolver escopo;
    private final MateriaRepository materias;
    private final PoderNaTurma poder;
    private final ContestacaoDocenteRepository contestacoes;
    private final ProfessorMateriaRepository lecionadas;

    /**
     * Conta docente que ainda nao foi aprovada cria no maximo isto: aprovacao e o que
     * libera mais. O codigo de convite e a unica barreira de uma turma, e um cadastro
     * docente aberto a qualquer um (e-mail nao verificado) poderia encher o banco de
     * turmas vazias.
     */
    static final int TETO_DE_TURMAS_ATE_APROVAR = 3;

    public TurmaService(TurmaRepository turmas, MembroRepository membros,
                        UsuarioRepository usuarios, TurmaScopeResolver escopo,
                        MateriaRepository materias, PoderNaTurma poder,
                        ContestacaoDocenteRepository contestacoes,
                        ProfessorMateriaRepository lecionadas) {
        this.turmas = turmas;
        this.membros = membros;
        this.usuarios = usuarios;
        this.escopo = escopo;
        this.materias = materias;
        this.poder = poder;
        this.contestacoes = contestacoes;
        this.lecionadas = lecionadas;
    }

    /**
     * A turma do usuario: quem esta nela, quem e o lider, e o codigo de convite.
     *
     * O codigo e visivel para TODO membro, nao so para o lider. E o nao-negociavel
     * 9 levado a serio: se qualquer membro posta sem aprovacao, qualquer membro
     * convida — esconder o codigo do aluno faria a entrada de um calouro depender
     * do lider estar por perto com o celular na mao.
     *
     * turma_id nao e filtrado a mao: quem responde qual e a turma e o
     * TurmaScopeResolver, e ele ja lanca 404 para quem nao tem vinculo nenhum.
     * 404 e nao 403 de proposito — 403 confirmaria que a turma existe, e o codigo
     * de convite e justamente o que nao pode vazar para quem esta de fora.
     */
    /**
     * Renomear a turma e acertar o periodo. So o lider.
     *
     * Existe porque o periodo envelhece sozinho: no setimo periodo a turma ainda
     * se chamava "Fans 2026.2" e nao havia como corrigir. O codigo de convite
     * fica de fora — ele identifica a turma e esta anotado no celular de todo
     * mundo.
     */
    @Transactional
    public MinhaTurmaResponse atualizar(UsuarioAtual usuario, AtualizarTurmaRequest req) {
        UUID turmaId = escopo.turmaDoUsuario(usuario.usuarioId());
        exigirLider(usuario, turmaId);
        Turma turma = turmas.findById(turmaId).orElseThrow(AcessoNegadoException::new);
        turma.renomear(req.nome(), req.semestre(), Instant.now());
        turmas.saveAndFlush(turma);
        return minha(usuario);
    }

    /**
     * Gera um codigo de convite novo. So o lider.
     *
     * Existe para o dia em que o codigo vazou ou alguem que ja saiu da turma ainda
     * o tem anotado: o antigo deixa de valer na hora (`entrar` busca pelo codigo
     * atual), e quem ja esta na turma nao sente nada — o vinculo e a linha em
     * `membro`, nao o codigo. Devolve a turma inteira porque o app precisa do
     * codigo novo na tela no mesmo instante, e uma segunda ida ao servidor so
     * para le-lo deixaria uma janela com o codigo velho exibido.
     */
    @Transactional
    public MinhaTurmaResponse trocarCodigo(UsuarioAtual usuario) {
        UUID turmaId = escopo.turmaDoUsuario(usuario.usuarioId());
        exigirLider(usuario, turmaId);
        Turma turma = turmas.findById(turmaId).orElseThrow(AcessoNegadoException::new);
        turma.trocarCodigo(novoCodigoConvite(), Instant.now());
        turmas.saveAndFlush(turma);
        return minha(usuario);
    }

    /**
     * Tira alguem da turma. So o lider.
     *
     * Apaga a linha de `membro` e mais nada: o que a pessoa postou fica, com a
     * autoria dela — `evento.autor_id` e `material.autor_id` apontam para
     * `usuario`, nao para `membro`, e autoria visivel e nao-negociavel. Por isso
     * tambem nao ha como "remover e limpar": o conteudo e da turma, o rastro e de
     * quem escreveu.
     *
     * Ordem das checagens e a do projeto: escopo (404) -> poder (403) -> estado
     * (409). Quem nao e da turma do lider leva 404 como se o usuario nao existisse;
     * so depois o 403 do aluno, que ja esta vendo a lista de membros e nao ganha
     * nada com o disfarce; e por ultimo o 409 de remover a si mesmo.
     *
     * O lider nao se remove: a turma ficaria sem lider (o indice parcial garante no
     * maximo um, nao pelo menos um). O caminho e transferir antes.
     *
     * O removido perde o acesso na hora: toda rota resolve a turma pelo vinculo, e
     * sem vinculo o TurmaScopeResolver responde 404. Nao ha token a revogar — o JWT
     * nao carrega turma. Os avisos tambem param, porque saem de uma consulta aos
     * membros da turma.
     *
     * ponytail: nao grava em acao_moderacao. A tabela tem CHECK que exige tipo de
     * acao conhecido e alvo registro; registrar remocao pede migration nova.
     */
    @Transactional
    public void removerMembro(UsuarioAtual lider, UUID usuarioId) {
        // Primeiro de tudo: ver MembroRepository#travarDoUsuario.
        membros.travarDoUsuario(lider.usuarioId());
        UUID turmaId = escopo.turmaDoUsuario(lider.usuarioId());
        Membro alvo = membros.findByUsuarioIdAndTurmaId(usuarioId, turmaId)
                .orElseThrow(AcessoNegadoException::new);
        exigirLider(lider, turmaId);
        if (alvo.getUsuarioId().equals(lider.usuarioId())) {
            throw new ErroDeNegocio(HttpStatus.CONFLICT, "Transfira a lideranca antes de sair");
        }
        membros.delete(alvo);
        // As declaracoes de materia dele NESTA turma vao junto. Sem isto, quem volta
        // pelo codigo reencontraria as declaracoes antigas ainda valendo e ganharia
        // alcance de volta sem declarar nada de novo (e sem passar pelo lider). A
        // CONTESTACAO e o contrario: fica, em contestacao_docente (V10), para o
        // vinculo novo nascer contestado.
        lecionadas.apagarDaTurma(usuarioId, turmaId);
    }

    /** Papel de quem pede, lido do vinculo dele nesta turma. */
    private void exigirLider(UsuarioAtual usuario, UUID turmaId) {
        Membro eu = membros.findByUsuarioIdAndTurmaId(usuario.usuarioId(), turmaId)
                .orElseThrow(AcessoNegadoException::new);
        if (eu.getPapel() != PapelMembro.LIDER) {
            throw new NaoLiderException();
        }
    }

    @Transactional(readOnly = true)
    public MinhaTurmaResponse minha(UsuarioAtual usuario) {
        UUID turmaId = escopo.turmaDoUsuario(usuario.usuarioId());
        Turma turma = turmas.findById(turmaId).orElseThrow(AcessoNegadoException::new);

        List<Membro> daTurma = membros.findByTurmaId(turmaId);
        Map<UUID, String> nomes = usuarios
                .findAllById(daTurma.stream().map(Membro::getUsuarioId).toList()).stream()
                .collect(Collectors.toMap(Usuario::getId, Usuario::getNome));

        // Duas leituras para a turma toda, e nao uma por membro: os docentes (com o
        // que declararam) numa query so, e as materias para trocar id por sigla.
        PoderNaTurma.Docentes docentes = poder.daTurma(turmaId);
        Map<UUID, String> siglas = materias.findByTurmaIdOrderBySiglaAsc(turmaId).stream()
                .collect(Collectors.toMap(Materia::getId, Materia::getSigla));

        return new MinhaTurmaResponse(turma.getId(), turma.getNome(), turma.getSemestre(),
                turma.getCodigoConvite(),
                daTurma.stream().map(m -> resumo(m, nomes, docentes, siglas))
                        .sorted(POR_CHEGADA).toList(),
                docentes.alcance(usuario.usuarioId()));
    }

    /**
     * Por ordem de chegada, com o nome desempatando.
     *
     * O desempate nao e enfeite: `entrou_em` tem DEFAULT now(), e no Postgres now()
     * e o instante da TRANSACAO — dois membros criados na mesma transacao empatam
     * no milissegundo. Sem o segundo criterio a ordem sairia do banco e mudaria a
     * cada abertura, e lista que se reordena parece lista que mudou de conteudo.
     */
    private static final Comparator<MembroDaTurmaResponse> POR_CHEGADA =
            Comparator.comparing(MembroDaTurmaResponse::entrouEm,
                            Comparator.nullsLast(Comparator.<Instant>naturalOrder()))
                    .thenComparing(MembroDaTurmaResponse::nome)
                    .thenComparing(MembroDaTurmaResponse::usuarioId);

    private MembroDaTurmaResponse resumo(Membro membro, Map<UUID, String> nomes,
                                         PoderNaTurma.Docentes docentes, Map<UUID, String> siglas) {
        String nome = nomes.get(membro.getUsuarioId());
        if (nome == null) {
            // A FK membro.usuario_id -> usuario(id) torna isto impossivel. Se
            // acontecer, o banco esta corrompido: estourar e melhor que exibir uma
            // pessoa sem nome como se a turma tivesse um membro fantasma.
            throw new IllegalStateException("membro sem usuario: " + membro.getUsuarioId());
        }
        // `lecionadas` mostra a declaracao mesmo sem poder (pendente, contestado): e o
        // que o lider confere antes de contestar. O selo, ao contrario, segue o poder.
        List<String> lecionadas = docentes.lecionadas(membro.getUsuarioId()).stream()
                .map(siglas::get)
                .filter(Objects::nonNull)
                .sorted()
                .toList();
        return new MembroDaTurmaResponse(
                membro.getUsuarioId(), nome, membro.getPapel(), membro.getEntrouEm(),
                docentes.seloGeral(membro.getUsuarioId()), membro.isContestado(), lecionadas);
    }

    /**
     * Aluno que cria vira LIDER, como sempre. Docente cria a turma e entra nela
     * com o proprio papel (PROFESSOR/COORDENADOR), SEM lider: o primeiro aluno que
     * entrar herda a lideranca (ver {@link #entrar}). Docente nunca vira lider
     * porque `membro.papel` e um valor so por vinculo — a lideranca apagaria o
     * PROFESSOR (spec 2.7).
     *
     * Criar turma nao e poder sobre ninguem, entao nao olha o status docente: conta
     * PENDENTE tambem cria. O poder e que espera a aprovacao, e so existe depois
     * que ha aluno para exerce-lo.
     */
    @Transactional
    public Turma criar(UUID criadorId, String nome, String semestre) {
        TipoConta tipo = tipoDaConta(criadorId);
        if (tipo.ehDocente()) {
            exigirDentroDoTetoDeCriacao(criadorId);
        } else {
            exigirSemTurma(criadorId);
        }
        Turma turma = turmas.save(
                new Turma(UUID.randomUUID(), nome, semestre, novoCodigoConvite(), criadorId));
        PapelMembro papel = tipo.ehDocente() ? papelDoDocente(tipo) : PapelMembro.LIDER;
        membros.save(new Membro(UUID.randomUUID(), criadorId, turma.getId(), papel));
        return turma;
    }

    /**
     * Codigo invalido responde 404, nunca 403 nem 400 com mensagem propria: quem
     * chuta codigo nao pode aprender nada sobre quais existem.
     *
     * Idempotente de proposito — tocar duas vezes no botao nao pode estourar o
     * UNIQUE (usuario_id, turma_id) na cara do aluno. Por isso a mesma turma
     * devolve o vinculo que ja existe, e so OUTRA turma leva o 409 (para conta
     * ALUNO; docente entra em quantas turmas quiser).
     *
     * O papel do vinculo sai do TIPO da conta, qualquer que seja o status docente:
     * quem espera aprovacao ja entra na turma (o codigo de convite e o controle de
     * entrada), so nao tem poder ainda.
     *
     * Aluno que entra numa turma SEM lider vira LIDER (spec 2.7): a turma criada
     * por docente nasce sem lider e alguem precisa ser o dono do codigo e da
     * moderacao. Depois do primeiro, os demais entram como ALUNO.
     */
    @Transactional
    public Membro entrar(UUID usuarioId, String codigoConvite) {
        Turma turma = turmas.findByCodigoConvite(codigoConvite)
                .orElseThrow(AcessoNegadoException::new);
        return membros.findByUsuarioIdAndTurmaId(usuarioId, turma.getId())
                .orElseGet(() -> {
                    TipoConta tipo = tipoDaConta(usuarioId);
                    if (tipo.ehDocente()) {
                        Membro novo = new Membro(
                                UUID.randomUUID(), usuarioId, turma.getId(), papelDoDocente(tipo));
                        // O lider contestou e removeu; voltar pelo codigo nao desfaz isso.
                        // A contestacao vive em contestacao_docente (chave turma+usuario),
                        // que sobrevive ao vinculo apagado: o vinculo novo ja nasce contestado.
                        contestacoes.findById(new ContestacaoDocente.Chave(turma.getId(), usuarioId))
                                .ifPresent(c -> novo.contestar(c.getContestadoPor(), c.getContestadoEm()));
                        return membros.save(novo);
                    }
                    exigirSemTurma(usuarioId);
                    return entrarComoAluno(usuarioId, turma.getId());
                });
    }

    /**
     * Tenta a lideranca primeiro: o INSERT ... ON CONFLICT do repositorio so grava
     * se a turma ainda nao tem LIDER, e e o indice parcial do banco quem decide
     * sob concorrencia — dois alunos entrando juntos nunca dao dois lideres, e o
     * perdedor da corrida cai no ALUNO logo abaixo, na mesma transacao.
     */
    private Membro entrarComoAluno(UUID usuarioId, UUID turmaId) {
        if (membros.entrarComoLiderSeVago(UUID.randomUUID(), usuarioId, turmaId) == 1) {
            return membros.findByUsuarioIdAndTurmaId(usuarioId, turmaId).orElseThrow();
        }
        return membros.save(new Membro(UUID.randomUUID(), usuarioId, turmaId, PapelMembro.ALUNO));
    }

    /**
     * Teto de criacao da conta docente PENDENTE: 409 com mensagem que o app mostra.
     *
     * Trava a linha da conta antes de contar: sem a trava, varias criacoes em
     * paralelo leem a mesma contagem e todas passam. A conta aprovada nao e
     * limitada; entrar em turma por codigo tambem nao (nao e criar).
     */
    private void exigirDentroDoTetoDeCriacao(UUID criadorId) {
        Usuario conta = usuarios.travarPorId(criadorId).orElseThrow(AcessoNegadoException::new);
        if (conta.getDocenteStatus() == DocenteStatus.PENDENTE
                && turmas.countByCriadaPor(criadorId) >= TETO_DE_TURMAS_ATE_APROVAR) {
            throw new ErroDeNegocio(HttpStatus.CONFLICT,
                    "Aguarde a aprovacao para criar mais turmas");
        }
    }

    /** O tipo e gravado so na criacao da conta; o papel do vinculo docente e o mesmo nome. */
    private static PapelMembro papelDoDocente(TipoConta tipo) {
        return PapelMembro.valueOf(tipo.name());
    }

    /**
     * Usuario inexistente e 404 (a FK estouraria em 500 mais adiante). Na pratica
     * nao acontece: o id vem do JWT, assinado por nos.
     */
    private TipoConta tipoDaConta(UUID usuarioId) {
        return usuarios.findById(usuarioId)
                .orElseThrow(AcessoNegadoException::new)
                .getTipoConta();
    }

    /**
     * Um vinculo por pessoa. Sem isto, criar ou entrar numa segunda turma dava
     * certo, e o TurmaScopeResolver passava a resolver pelo vinculo mais recente:
     * a turma original sumia do app sem aviso, com tudo que a pessoa postou nela.
     *
     * Regra de conta ALUNO (e por consequencia LIDER). Conta docente nao passa
     * por aqui: professor e coordenador entram em quantas turmas tiverem codigo,
     * e o app diz qual esta ativa com o cabecalho X-Turma-Id (spec 2.8).
     *
     * ponytail: dois pedidos simultaneos de ALUNO para turmas diferentes passam os
     * dois. O indice unico em membro.usuario_id que fecharia isso continua
     * descartado, agora com motivo concreto: travaria o docente de varias turmas.
     * O resolver loga aviso se acontecer.
     */
    private void exigirSemTurma(UUID usuarioId) {
        if (!membros.findByUsuarioIdOrderByEntrouEmDesc(usuarioId).isEmpty()) {
            throw new ErroDeNegocio(HttpStatus.CONFLICT, "Voce ja esta numa turma");
        }
    }

    /**
     * 8 caracteres de UUID em caixa alta, para caber num quadro branco.
     *
     * Sorteia de novo enquanto o codigo ja existir. Antes era so o UNIQUE do banco
     * a recusar, o que bastava para criar turma (nasce uma por vez, sem codigo
     * anterior); trocar o codigo de uma turma que ja tem gente nao pode terminar em
     * 500 por azar de sorteio — e a checagem tambem impede de re-sortear o proprio
     * codigo atual. O UNIQUE continua sendo a garantia contra duas trocas
     * simultaneas.
     */
    private String novoCodigoConvite() {
        String codigo;
        do {
            codigo = UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        } while (turmas.existsByCodigoConvite(codigo));
        return codigo;
    }
}
