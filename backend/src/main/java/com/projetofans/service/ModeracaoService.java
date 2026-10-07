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
import com.projetofans.domain.Usuario;
import com.projetofans.web.dto.OcultadoResponse;
import com.projetofans.web.dto.PedidoDeExclusaoResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
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

    /**
     * O que o lider ocultou e continua oculto na turma dele: eventos, materiais e
     * anotacoes da TURMA, com quem postou e quando foi ocultado.
     *
     * Existe porque ocultar tira o registro da vista do proprio lider — nem a Home
     * nem a tela do registro o mostram mais — e sem esta lista o `reexibir` so
     * servia para quem ainda estava na tela logo apos ocultar.
     *
     * Escopo (404) antes de poder (403), como o resto: quem nao tem turma leva 404,
     * e so depois o aluno leva 403. A turma sai do vinculo do lider — nao ha
     * parametro para trocar, entao nao ha como pedir os ocultos de outra turma.
     * Excluido pelo autor nao entra (nao ha o que reexibir) e anotacao PESSOAL
     * tambem nao: o lider so lida com o que consegue ler.
     */
    @Transactional(readOnly = true)
    public List<OcultadoResponse> ocultados(UsuarioAtual lider) {
        UUID turmaId = escopo.turmaDoUsuario(lider.usuarioId());
        exigirLider(lider);

        List<Evento> osEventos = eventos.ocultosDaTurma(turmaId);
        List<Material> osMateriais = materiais.ocultosDaTurma(turmaId);
        List<Nota> asNotas = notas.ocultasDaTurma(turmaId);

        Map<UUID, Instant> eventosEm = ocultadosEm(RegistroTipo.EVENTO,
                osEventos.stream().map(Evento::getId).toList());
        Map<UUID, Instant> materiaisEm = ocultadosEm(RegistroTipo.MATERIAL,
                osMateriais.stream().map(Material::getId).toList());
        Map<UUID, Instant> notasEm = ocultadosEm(RegistroTipo.NOTA,
                asNotas.stream().map(Nota::getId).toList());

        List<UUID> autores = new ArrayList<>();
        osEventos.forEach(e -> autores.add(e.getAutorId()));
        osMateriais.forEach(m -> autores.add(m.getAutorId()));
        asNotas.forEach(n -> autores.add(n.getAutorId()));
        Map<UUID, String> nomes = usuarios.findAllById(autores).stream()
                .collect(Collectors.toMap(Usuario::getId, Usuario::getNome));

        List<OcultadoResponse> saida = new ArrayList<>();
        for (Evento e : osEventos) {
            saida.add(new OcultadoResponse(RegistroTipo.EVENTO, e.getId(), e.getTitulo(),
                    e.getAutorId(), nomes.get(e.getAutorId()), eventosEm.get(e.getId())));
        }
        for (Material m : osMateriais) {
            saida.add(new OcultadoResponse(RegistroTipo.MATERIAL, m.getId(), m.getTitulo(),
                    m.getAutorId(), nomes.get(m.getAutorId()), materiaisEm.get(m.getId())));
        }
        for (Nota n : asNotas) {
            saida.add(new OcultadoResponse(RegistroTipo.NOTA, n.getId(), comecoDoTexto(n.getTexto()),
                    n.getAutorId(), nomes.get(n.getAutorId()), notasEm.get(n.getId())));
        }
        // Mais recente primeiro; sem data vai para o fim, e nao para o topo — "sem
        // registro" nao e "agora".
        saida.sort(Comparator.comparing(OcultadoResponse::ocultadoEm,
                Comparator.nullsLast(Comparator.<Instant>reverseOrder())));
        return saida;
    }

    /**
     * Quando cada registro foi ocultado pela ultima vez. A consulta vem do mais
     * recente para o mais antigo, entao o primeiro de cada id e o que o escondeu
     * agora — se foi reexibido e ocultado de novo, vale a segunda vez.
     */
    private Map<UUID, Instant> ocultadosEm(RegistroTipo tipo, Collection<UUID> ids) {
        Map<UUID, Instant> em = new HashMap<>();
        if (ids.isEmpty()) {
            // `IN ()` com lista vazia e erro de sintaxe em Postgres.
            return em;
        }
        for (AcaoModeracao a : acoes.doTipoSobre(AcaoModeracaoTipo.OCULTAR, tipo, ids)) {
            em.putIfAbsent(a.getRegistroId(), a.getEm());
        }
        return em;
    }

    /** Anotacao nao tem titulo: o comeco do texto, numa linha so, e o que a identifica. */
    private static String comecoDoTexto(String texto) {
        String linha = texto.strip().replaceAll("\\s+", " ");
        return linha.length() <= 80 ? linha : linha.substring(0, 79) + "\u2026";
    }

    @Transactional
    public void transferirLideranca(UsuarioAtual lider, UUID novoLiderUsuarioId) {
        // Primeiro de tudo: ver MembroRepository#travarDoUsuario. Remover membro e
        // transferir competem pelo mesmo vinculo do lider.
        membros.travarDoUsuario(lider.usuarioId());
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
            Nota nota = notaDaTurma(registroId);
            exigirTurmaELider(lider, nota.getTurmaId());
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
            case NOTA -> notaDaTurma(registroId).getTurmaId();
            case MATERIAL -> materiais.findById(registroId)
                    .orElseThrow(AcessoNegadoException::new).getTurmaId();
        };
        exigirTurmaELider(lider, turmaDoRegistro);
    }

    /**
     * O lider so modera o que ele consegue LER. Nota PESSOAL nunca sai para outra
     * pessoa, entao ocultar ou pedir exclusao de uma seria poder sobre o invisivel
     * — e a porta para descobrir que ela existe. Responde como nota inexistente,
     * e ANTES da checagem de papel: um 403 para aluno tambem confirmaria a nota.
     * Valia so para ocultar; pedir exclusao respondia 200 (achado B1).
     */
    private Nota notaDaTurma(UUID registroId) {
        return notas.findById(registroId)
                .filter(n -> n.getAlcance() == AlcanceNota.TURMA)
                .orElseThrow(AcessoNegadoException::new);
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
