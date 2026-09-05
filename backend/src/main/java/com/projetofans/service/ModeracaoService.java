package com.projetofans.service;

import com.projetofans.domain.AcaoModeracao;
import com.projetofans.domain.AcaoModeracaoTipo;
import com.projetofans.domain.Evento;
import com.projetofans.domain.Material;
import com.projetofans.domain.Nota;
import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.AlcanceNota;
import com.projetofans.domain.RegistroTipo;
import com.projetofans.erro.AcessoNegadoException;
import com.projetofans.erro.NaoLiderException;
import com.projetofans.repo.AcaoModeracaoRepository;
import com.projetofans.repo.EventoRepository;
import com.projetofans.repo.MaterialRepository;
import com.projetofans.repo.NotaRepository;
import com.projetofans.repo.MembroRepository;
import com.projetofans.repo.UsuarioRepository;
import com.projetofans.security.TurmaScopeResolver;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.web.dto.PedidoDeExclusaoResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

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
    private final NotaRepository notas;
    private final MembroRepository membros;
    private final AcaoModeracaoRepository acoes;
    private final UsuarioRepository usuarios;
    private final TurmaScopeResolver escopo;

    public ModeracaoService(EventoRepository eventos, MaterialRepository materiais,
                            NotaRepository notas,
                            MembroRepository membros, AcaoModeracaoRepository acoes,
                            UsuarioRepository usuarios,
                            TurmaScopeResolver escopo) {
        this.eventos = eventos;
        this.materiais = materiais;
        this.notas = notas;
        this.membros = membros;
        this.acoes = acoes;
        this.usuarios = usuarios;
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
    /**
     * Os pedidos de exclusao abertos sobre os MEUS registros.
     *
     * "Abertos" e por construcao: a consulta so olha registro que ainda existe,
     * entao apagar o registro faz o pedido sumir junto — nao ha estado de
     * "resolvido" para manter em dia, e um estado a menos e um estado que nao
     * pode ficar errado.
     */
    @Transactional(readOnly = true)
    public List<PedidoDeExclusaoResponse> meusPedidosDeExclusao(UsuarioAtual eu) {
        List<PedidoDeExclusaoResponse> pedidos = new ArrayList<>();

        Map<UUID, String> meusEventos = eventos.vivosDoAutor(eu.usuarioId()).stream()
                .collect(Collectors.toMap(Evento::getId, Evento::getTitulo));
        Map<UUID, String> meusMateriais = materiais.vivosDoAutor(eu.usuarioId()).stream()
                .collect(Collectors.toMap(Material::getId, Material::getTitulo));

        juntar(pedidos, RegistroTipo.EVENTO, meusEventos);
        juntar(pedidos, RegistroTipo.MATERIAL, meusMateriais);
        pedidos.sort(Comparator.comparing(PedidoDeExclusaoResponse::em).reversed());
        return pedidos;
    }

    private void juntar(List<PedidoDeExclusaoResponse> destino, RegistroTipo tipo,
                        Map<UUID, String> titulosPorId) {
        if (titulosPorId.isEmpty()) {
            // `IN ()` com lista vazia e erro de sintaxe em Postgres, e o caso e
            // comum: quem ainda nao cadastrou nada cai aqui em toda abertura.
            return;
        }
        for (AcaoModeracao a : acoes.doTipoSobre(
                AcaoModeracaoTipo.PEDIR_EXCLUSAO, tipo, titulosPorId.keySet())) {
            destino.add(new PedidoDeExclusaoResponse(
                    tipo,
                    a.getRegistroId(),
                    titulosPorId.get(a.getRegistroId()),
                    a.getMotivo(),
                    nomeDeQuemPediu(a.getLiderId()),
                    a.getEm()));
        }
    }

    /** O nome de quem pediu. Ausente vira texto neutro: pedido sem dono ainda e um pedido. */
    private String nomeDeQuemPediu(UUID liderId) {
        return usuarios.findById(liderId).map(u -> u.getNome()).orElse("o líder");
    }

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
        } else if (registroTipo == RegistroTipo.NOTA) {
            Nota nota = notas.findById(registroId).orElseThrow(AcessoNegadoException::new);
            exigirTurmaELider(lider, nota.getTurmaId());
            // O lider so oculta o que ele consegue LER. Nota PESSOAL nunca sai
            // para outra pessoa, entao ocultar uma seria poder sobre o
            // invisivel — e a porta para descobrir que ela existe.
            if (nota.getAlcance() != AlcanceNota.TURMA) {
                throw new AcessoNegadoException();
            }
            nota.definirVisibilidadeTurma(visivel);
            notas.saveAndFlush(nota);
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
        UUID turmaDoRegistro = switch (registroTipo) {
            case EVENTO -> eventos.findById(registroId)
                    .orElseThrow(AcessoNegadoException::new).getTurmaId();
            case NOTA -> notas.findById(registroId)
                    .orElseThrow(AcessoNegadoException::new).getTurmaId();
            case MATERIAL -> materiais.findById(registroId)
                    .orElseThrow(AcessoNegadoException::new).getTurmaId();
        };
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
