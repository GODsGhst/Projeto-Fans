package com.projetofans.service;

import com.projetofans.domain.EstadoPessoal;
import com.projetofans.domain.Evento;
import com.projetofans.domain.Materia;
import com.projetofans.erro.AcessoNegadoException;
import com.projetofans.repo.EstadoPessoalRepository;
import com.projetofans.repo.EventoRepository;
import com.projetofans.repo.MateriaRepository;
import com.projetofans.repo.MaterialRepository;
import com.projetofans.repo.UsuarioRepository;
import com.projetofans.security.TurmaScopeResolver;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.web.dto.AutoriaResponse;
import com.projetofans.web.dto.EventoResponse;
import com.projetofans.web.dto.ItemHomeResponse;
import com.projetofans.web.dto.MaterialResponse;
import com.projetofans.web.dto.MeuQuadroResponse;
import com.projetofans.web.dto.NaoListadosResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Estado pessoal, Meu quadro e Nao listados.
 *
 * Este service escreve em UMA tabela: estado_pessoal. Nenhum caminho daqui toca
 * em `evento`, e isso e o nao-negociavel 3 em codigo — marcar feito nao pode
 * mudar nada para mais ninguem. O teste marcarFeitoNaoAlteraNenhumaColunaDeEvento
 * le a linha inteira do evento antes e depois e exige igualdade; se alguem um dia
 * "otimizar" isto gravando um flag no evento, ele fica vermelho.
 *
 * Nada aqui filtra turma_id a mao (TurmaScopeResolver) nem reescreve predicado de
 * visibilidade (metodos nomeados do repository). "Nao listados" e literalmente
 * naoListadosDoAutor, que ja existia desde a Task 2.
 */
@Service
public class EstadoPessoalService {

    private final EstadoPessoalRepository estados;
    private final EventoRepository eventos;
    private final MaterialRepository materiais;
    private final MateriaRepository materias;
    private final UsuarioRepository usuarios;
    private final TurmaScopeResolver escopo;

    public EstadoPessoalService(EstadoPessoalRepository estados, EventoRepository eventos,
                                MaterialRepository materiais, MateriaRepository materias,
                                UsuarioRepository usuarios, TurmaScopeResolver escopo) {
        this.estados = estados;
        this.eventos = eventos;
        this.materiais = materiais;
        this.materias = materias;
        this.usuarios = usuarios;
        this.escopo = escopo;
    }

    /**
     * Idempotente: a linha e a mesma (PK usuario+evento), entao marcar duas vezes
     * atualiza em vez de duplicar. Nao ha checagem de autoria — o quadro e de quem
     * le, e qualquer membro marca qualquer evento da propria turma como feito.
     * Ha checagem de turma: marcar evento de outra turma daria 404 pelo escopo.
     * E de visibilidade: evento oculto ou excluido tambem da 404 para quem nao e o
     * autor, senao o 204 confirmaria que ele ainda existe (achado B2).
     */
    @Transactional
    public void marcar(UsuarioAtual usuario, UUID eventoId, boolean feito) {
        Evento evento = eventos.findById(eventoId).orElseThrow(AcessoNegadoException::new);
        escopo.exigirMesmaTurma(usuario.usuarioId(), evento.getTurmaId());
        if (!evento.visivelPara(usuario.usuarioId())) {
            throw new AcessoNegadoException();
        }

        Instant agora = Instant.now();
        EstadoPessoal estado = estados
                .findByChaveUsuarioIdAndChaveEventoId(usuario.usuarioId(), eventoId)
                .orElseGet(() -> new EstadoPessoal(usuario.usuarioId(), eventoId, feito, agora));
        estado.marcar(feito, agora);
        estados.saveAndFlush(estado);
    }

    /**
     * Duas colunas, do mesmo conjunto: os eventos visiveis da turma, separados pelo
     * que ESTE usuario marcou. O quadro nao tem teto de 6 nem janela de 14 dias —
     * essas duas regras sao da Home e vivem no SQL dela. Um quadro cortado em 6
     * esconderia entrega atrasada, que e justamente o que o aluno vem procurar.
     */
    @Transactional(readOnly = true)
    public MeuQuadroResponse meuQuadro(UsuarioAtual usuario) {
        UUID turmaId = escopo.turmaDoUsuario(usuario.usuarioId());
        Set<UUID> feitos = new HashSet<>();
        for (EstadoPessoal estado : estados.findByChaveUsuarioId(usuario.usuarioId())) {
            if (estado.isFeito()) {
                feitos.add(estado.getEventoId());
            }
        }

        List<ItemHomeResponse> aFazer = new ArrayList<>();
        List<ItemHomeResponse> feito = new ArrayList<>();
        for (Evento evento : eventos.visiveisDaTurma(turmaId)) {
            boolean marcado = feitos.contains(evento.getId());
            (marcado ? feito : aFazer).add(item(evento, marcado));
        }
        return new MeuQuadroResponse(aFazer, feito);
    }

    /** Registros DO PROPRIO usuario que estao ocultos ou logicamente excluidos. */
    @Transactional(readOnly = true)
    public NaoListadosResponse naoListados(UsuarioAtual usuario) {
        List<EventoResponse> eventosOcultos =
                eventos.naoListadosDoAutor(usuario.usuarioId()).stream()
                        .map(e -> EventoResponse.de(e, materia(e.getMateriaId()), usuario.nome()))
                        .toList();
        List<MaterialResponse> materiaisOcultos =
                materiais.naoListadosDoAutor(usuario.usuarioId()).stream()
                        .map(m -> MaterialResponse.de(m, usuario.nome()))
                        .toList();
        return new NaoListadosResponse(eventosOcultos, materiaisOcultos);
    }

    private ItemHomeResponse item(Evento evento, boolean feito) {
        Materia materia = materia(evento.getMateriaId());
        return new ItemHomeResponse(
                evento.getId(),
                evento.getTipo(),
                evento.getTitulo(),
                evento.getDataEvento(),
                evento.getHoraEvento(),
                materia.getSigla(),
                materia.getCorHex(),
                new AutoriaResponse(evento.getAutorId(), nomeDoAutor(evento.getAutorId()),
                        evento.getCriadoEm(), evento.getAtualizadoEm()),
                feito);
    }

    /**
     * ponytail: um findById por item, mesmo padrao (e mesmo teto) do EventoService.
     * O cache de primeiro nivel do Hibernate absorve as repeticoes dentro da
     * transacao — uma turma tem dezenas de eventos, nao milhares. Se crescer, o
     * conserto e um findAllById aqui, nao associacao nova na entidade.
     */
    private Materia materia(UUID materiaId) {
        return materias.findById(materiaId).orElseThrow(AcessoNegadoException::new);
    }

    private String nomeDoAutor(UUID autorId) {
        return usuarios.findById(autorId).orElseThrow(AcessoNegadoException::new).getNome();
    }
}
