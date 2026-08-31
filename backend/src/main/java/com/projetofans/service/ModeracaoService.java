package com.projetofans.service;

import com.projetofans.domain.AcaoModeracao;
import com.projetofans.domain.AcaoModeracaoTipo;
import com.projetofans.domain.Evento;
import com.projetofans.domain.Material;
import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.RegistroTipo;
import com.projetofans.erro.AcessoNegadoException;
import com.projetofans.erro.NaoLiderException;
import com.projetofans.repo.AcaoModeracaoRepository;
import com.projetofans.repo.EventoRepository;
import com.projetofans.repo.MaterialRepository;
import com.projetofans.repo.MembroRepository;
import com.projetofans.security.TurmaScopeResolver;
import com.projetofans.security.UsuarioAtual;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Moderacao do lider: ocultar, reexibir, pedir exclusao e transferir lideranca.
 *
 * O limite do papel esta escrito no unico metodo que toca no registro:
 * {@link #definirVisibilidade}. Ele chama `definirVisibilidadeTurma` e mais nada.
 * Nao ha caminho daqui que mexa em titulo, data, materia ou autor — o lider muda
 * visibilidade, nunca conteudo alheio (nao-negociavel 10). Exclusao continua sendo
 * do autor: por isso `pedirExclusao` PEDE, e nao exclui.
 *
 * A ordem das checagens e a mesma do EventoService, e pelo mesmo motivo:
 *
 *   1. registro existe e e da minha turma -> 404
 *   2. sou o LIDER                        -> 403
 *
 * Inverter as duas faria um ALUNO descobrir, pelo status, que um registro de outra
 * turma existe.
 *
 * Nenhuma acao e silenciosa: toda uma delas grava linha em `acao_moderacao`. Esse
 * e o contrapeso do papel — uma turma e gente que se conhece, e o rastro e o que
 * torna o abuso caro.
 */
@Service
public class ModeracaoService {

    private final EventoRepository eventos;
    private final MaterialRepository materiais;
    private final MembroRepository membros;
    private final AcaoModeracaoRepository acoes;
    private final TurmaScopeResolver escopo;

    public ModeracaoService(EventoRepository eventos, MaterialRepository materiais,
                            MembroRepository membros, AcaoModeracaoRepository acoes,
                            TurmaScopeResolver escopo) {
        this.eventos = eventos;
        this.materiais = materiais;
        this.membros = membros;
        this.acoes = acoes;
        this.escopo = escopo;
    }

    @Transactional
    public void ocultar(UsuarioAtual lider, RegistroTipo registroTipo, UUID registroId,
                        String motivo) {
        definirVisibilidade(lider, registroTipo, registroId, false);
        registrar(registroTipo, registroId, AcaoModeracaoTipo.OCULTAR, lider, motivo);
    }

    @Transactional
    public void reexibir(UsuarioAtual lider, RegistroTipo registroTipo, UUID registroId) {
        definirVisibilidade(lider, registroTipo, registroId, true);
        registrar(registroTipo, registroId, AcaoModeracaoTipo.REEXIBIR, lider, null);
    }

    /**
     * PEDE. Nao exclui, e nem oculta: exclusao e do autor (nao-negociavel 10), e um
     * pedido que ja escondesse o registro seria uma exclusao com outro nome. O que
     * este metodo faz e deixar o pedido registrado — e, quando a Task 8 entrar,
     * avisar o autor.
     */
    @Transactional
    public void pedirExclusao(UsuarioAtual lider, RegistroTipo registroTipo, UUID registroId,
                              String motivo) {
        exigirLiderDoRegistro(lider, registroTipo, registroId);
        registrar(registroTipo, registroId, AcaoModeracaoTipo.PEDIR_EXCLUSAO, lider, motivo);
    }

    /**
     * Rebaixa o lider atual e promove o novo NA MESMA TRANSACAO.
     *
     * A ordem — rebaixar, dar flush, promover — nao e estilo: o indice unico parcial
     * membro_um_lider_por_turma e verificado a cada statement, entao promover antes
     * de rebaixar estoura com dois LIDER na mesma turma no meio da transacao.
     */
    @Transactional
    public void transferirLideranca(UsuarioAtual lider, UUID novoLiderUsuarioId) {
        UUID turmaId = escopo.turmaDoUsuario(lider.usuarioId());
        exigirLider(lider);

        Membro novo = membros.findByUsuarioIdAndTurmaId(novoLiderUsuarioId, turmaId)
                .orElseThrow(AcessoNegadoException::new);
        Membro atual = membros.findByUsuarioIdAndTurmaId(lider.usuarioId(), turmaId)
                .orElseThrow(AcessoNegadoException::new);

        atual.mudarPapel(PapelMembro.ALUNO);
        membros.saveAndFlush(atual);
        novo.mudarPapel(PapelMembro.LIDER);
        membros.saveAndFlush(novo);

        acoes.save(AcaoModeracao.transferenciaDeLideranca(
                UUID.randomUUID(), lider.usuarioId(), null));
    }

    /**
     * O unico ponto do service que escreve no registro moderado, e ele so sabe
     * mexer em visibilidade. Se alguem precisar mudar mais alguma coisa aqui, a
     * pergunta certa e por que o lider viraria editor.
     */
    private void definirVisibilidade(UsuarioAtual lider, RegistroTipo registroTipo,
                                     UUID registroId, boolean visivel) {
        if (registroTipo == RegistroTipo.EVENTO) {
            Evento evento = eventos.findById(registroId).orElseThrow(AcessoNegadoException::new);
            exigirTurmaELider(lider, evento.getTurmaId());
            evento.definirVisibilidadeTurma(visivel);
            eventos.saveAndFlush(evento);
        } else {
            Material material = materiais.findById(registroId)
                    .orElseThrow(AcessoNegadoException::new);
            exigirTurmaELider(lider, material.getTurmaId());
            material.definirVisibilidadeTurma(visivel);
            materiais.saveAndFlush(material);
        }
    }

    private void exigirLiderDoRegistro(UsuarioAtual lider, RegistroTipo registroTipo,
                                       UUID registroId) {
        UUID turmaDoRegistro = registroTipo == RegistroTipo.EVENTO
                ? eventos.findById(registroId).orElseThrow(AcessoNegadoException::new).getTurmaId()
                : materiais.findById(registroId).orElseThrow(AcessoNegadoException::new).getTurmaId();
        exigirTurmaELider(lider, turmaDoRegistro);
    }

    /** 404 se o registro nao e da sua turma; so depois 403 se voce nao e o lider. */
    private void exigirTurmaELider(UsuarioAtual lider, UUID turmaDoRegistro) {
        escopo.exigirMesmaTurma(lider.usuarioId(), turmaDoRegistro);
        exigirLider(lider);
    }

    private void exigirLider(UsuarioAtual usuario) {
        if (escopo.papelDoUsuario(usuario.usuarioId()) != PapelMembro.LIDER) {
            throw new NaoLiderException();
        }
    }

    private void registrar(RegistroTipo registroTipo, UUID registroId, AcaoModeracaoTipo acao,
                           UsuarioAtual lider, String motivo) {
        acoes.save(AcaoModeracao.sobreRegistro(UUID.randomUUID(), registroTipo, registroId,
                acao, lider.usuarioId(), motivo));
    }
}
