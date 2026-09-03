package com.projetofans.service;

import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.erro.NaoLiderException;
import com.projetofans.erro.AcessoNegadoException;
import com.projetofans.repo.MembroRepository;
import com.projetofans.repo.TurmaRepository;
import com.projetofans.repo.UsuarioRepository;
import com.projetofans.security.TurmaScopeResolver;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.web.dto.MembroDaTurmaResponse;
import com.projetofans.web.dto.AtualizarTurmaRequest;
import com.projetofans.web.dto.MinhaTurmaResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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

    public TurmaService(TurmaRepository turmas, MembroRepository membros,
                        UsuarioRepository usuarios, TurmaScopeResolver escopo) {
        this.turmas = turmas;
        this.membros = membros;
        this.usuarios = usuarios;
        this.escopo = escopo;
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
        Membro eu = membros.findByUsuarioIdAndTurmaId(usuario.usuarioId(), turmaId)
                .orElseThrow(AcessoNegadoException::new);
        if (eu.getPapel() != PapelMembro.LIDER) {
            throw new NaoLiderException();
        }
        Turma turma = turmas.findById(turmaId).orElseThrow(AcessoNegadoException::new);
        turma.renomear(req.nome(), req.semestre(), Instant.now());
        turmas.saveAndFlush(turma);
        return minha(usuario);
    }

    @Transactional(readOnly = true)
    public MinhaTurmaResponse minha(UsuarioAtual usuario) {
        UUID turmaId = escopo.turmaDoUsuario(usuario.usuarioId());
        Turma turma = turmas.findById(turmaId).orElseThrow(AcessoNegadoException::new);

        List<Membro> daTurma = membros.findByTurmaId(turmaId);
        Map<UUID, String> nomes = usuarios
                .findAllById(daTurma.stream().map(Membro::getUsuarioId).toList()).stream()
                .collect(Collectors.toMap(Usuario::getId, Usuario::getNome));

        return new MinhaTurmaResponse(turma.getId(), turma.getNome(), turma.getSemestre(),
                turma.getCodigoConvite(),
                daTurma.stream().map(m -> resumo(m, nomes)).sorted(POR_CHEGADA).toList());
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

    private MembroDaTurmaResponse resumo(Membro membro, Map<UUID, String> nomes) {
        String nome = nomes.get(membro.getUsuarioId());
        if (nome == null) {
            // A FK membro.usuario_id -> usuario(id) torna isto impossivel. Se
            // acontecer, o banco esta corrompido: estourar e melhor que exibir uma
            // pessoa sem nome como se a turma tivesse um membro fantasma.
            throw new IllegalStateException("membro sem usuario: " + membro.getUsuarioId());
        }
        return new MembroDaTurmaResponse(
                membro.getUsuarioId(), nome, membro.getPapel(), membro.getEntrouEm());
    }

    @Transactional
    public Turma criar(UUID criadorId, String nome, String semestre) {
        Turma turma = turmas.save(new Turma(UUID.randomUUID(), nome, semestre, novoCodigoConvite()));
        membros.save(new Membro(UUID.randomUUID(), criadorId, turma.getId(), PapelMembro.LIDER));
        return turma;
    }

    /**
     * Codigo invalido responde 404, nunca 403 nem 400 com mensagem propria: quem
     * chuta codigo nao pode aprender nada sobre quais existem.
     *
     * Idempotente de proposito — tocar duas vezes no botao nao pode estourar o
     * UNIQUE (usuario_id, turma_id) na cara do aluno.
     */
    @Transactional
    public Membro entrar(UUID usuarioId, String codigoConvite) {
        Turma turma = turmas.findByCodigoConvite(codigoConvite)
                .orElseThrow(AcessoNegadoException::new);
        return membros.findByUsuarioIdAndTurmaId(usuarioId, turma.getId())
                .orElseGet(() -> membros.save(
                        new Membro(UUID.randomUUID(), usuarioId, turma.getId(), PapelMembro.ALUNO)));
    }

    /**
     * 8 caracteres de UUID em caixa alta, para caber num quadro branco.
     * ponytail: colisao e improvavel e o UNIQUE do banco a recusa; se um dia isso
     * incomodar, o conserto e um retry aqui, nao um gerador mais esperto.
     */
    private String novoCodigoConvite() {
        return UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
    }
}
