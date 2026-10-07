package com.projetofans.service;

import com.projetofans.domain.AcaoRevisao;
import com.projetofans.domain.Evento;
import com.projetofans.domain.EventoMaterial;
import com.projetofans.domain.Materia;
import com.projetofans.domain.Material;
import com.projetofans.domain.RegistroTipo;
import com.projetofans.erro.AcessoNegadoException;
import com.projetofans.erro.ConflitoVersaoException;
import com.projetofans.erro.NaoAutorException;
import com.projetofans.notify.Notifier;
import com.projetofans.notify.PayloadSync;
import com.projetofans.repo.EventoMaterialRepository;
import com.projetofans.repo.EventoRepository;
import com.projetofans.repo.MateriaRepository;
import com.projetofans.repo.MaterialRepository;
import com.projetofans.security.PoderNaTurma;
import com.projetofans.security.TurmaScopeResolver;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.web.dto.AtualizarEventoRequest;
import com.projetofans.web.dto.CriarEventoRequest;
import com.projetofans.web.dto.EventoDetalheResponse;
import com.projetofans.web.dto.EventoResponse;
import com.projetofans.web.dto.MaterialResponse;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * CRUD de evento, vinculo com material, locking otimista e historico.
 *
 * A ordem das checagens em cada escrita e sempre a mesma e nao e arbitraria:
 *
 *   1. escopo de turma  -> 404 (voce nao tem direito de saber que existe)
 *   2. autoria ou poder -> 403 (voce ve, mas nao edita — nem o LIDER; so o autor ou
 *                         o docente com alcance na materia, spec 5)
 *   3. version          -> 409 (alguem mexeu antes de voce salvar)
 *
 * Inverter 1 e 2 vazaria pelo status a existencia de registro de outra turma.
 *
 * turma_id nao e filtrado a mao em lugar nenhum daqui: quem resolve turma e o
 * TurmaScopeResolver, e quem sabe o que e visivel sao os metodos nomeados do
 * repository.
 */
@Service
public class EventoService {

    private final EventoRepository eventos;
    private final MateriaRepository materias;
    private final MaterialRepository materiais;
    private final EventoMaterialRepository vinculos;
    private final RevisaoService revisoes;
    private final TurmaScopeResolver escopo;
    private final Notifier avisos;
    private final EntityManager em;
    private final PoderNaTurma poderNaTurma;
    private final Autorias autorias;

    public EventoService(EventoRepository eventos, MateriaRepository materias,
                         MaterialRepository materiais, EventoMaterialRepository vinculos,
                         RevisaoService revisoes,
                         TurmaScopeResolver escopo, Notifier avisos, EntityManager em,
                         PoderNaTurma poderNaTurma, Autorias autorias) {
        this.eventos = eventos;
        this.materias = materias;
        this.materiais = materiais;
        this.vinculos = vinculos;
        this.revisoes = revisoes;
        this.escopo = escopo;
        this.avisos = avisos;
        this.em = em;
        this.poderNaTurma = poderNaTurma;
        this.autorias = autorias;
    }

    /** Qualquer membro cria. Sem fila, sem aprovacao, sem status pendente. */
    @Transactional
    public EventoResponse criar(UsuarioAtual autor, CriarEventoRequest req) {
        Materia materia = materiaDaTurmaDoUsuario(autor, req.materiaId());
        Instant agora = Instant.now();
        Evento evento = new Evento(UUID.randomUUID(), materia.getTurmaId(), materia.getId(),
                req.tipo(), req.titulo(), req.data(), req.hora(), req.sala(),
                autor.usuarioId(), agora);
        // save() aqui vira merge (id atribuido a mao), entao a instancia gerenciada
        // e a devolvida, nao a local. E criado_em tem DEFAULT no banco e e
        // insertable=false: sem o refresh a resposta sairia com criadoEm nulo e
        // violaria R1 em silencio.
        Evento salvo = eventos.saveAndFlush(evento);
        em.refresh(salvo);
        avisar(salvo.getTurmaId(), autor, agora);
        return EventoResponse.de(salvo, materia, autorias.daListagem().de(salvo));
    }

    @Transactional
    public EventoResponse atualizar(UsuarioAtual usuario, UUID eventoId,
                                    int versionEsperada, AtualizarEventoRequest req) {
        Evento evento = daTurmaDoUsuario(usuario, eventoId);
        // Autor OU docente com alcance na materia de origem E destino.
        exigirAutorOuAlcance(usuario, evento, req.materiaId());
        exigirVersao(evento, versionEsperada);
        Materia materia = materiaDaTurmaDoUsuario(usuario, req.materiaId());

        // Antes de aplicar: o snapshot precisa ser o estado ANTERIOR.
        revisoes.registrar(RegistroTipo.EVENTO, evento.getId(), usuario.usuarioId(),
                AcaoRevisao.EDITAR, evento);

        Instant agora = Instant.now();
        evento.editar(materia.getId(), req.tipo(), req.titulo(), req.data(), req.hora(),
                req.sala(), usuario.usuarioId(), agora);
        Evento salvo = eventos.saveAndFlush(evento);
        avisar(salvo.getTurmaId(), usuario, agora);
        return EventoResponse.de(salvo, materia, autorias.daListagem().de(salvo));
    }

    /** Exclusao e sempre logica: a linha continua existindo em "Nao listados". */
    @Transactional
    public void excluirLogicamente(UsuarioAtual usuario, UUID eventoId, int versionEsperada) {
        Evento evento = daTurmaDoUsuario(usuario, eventoId);
        exigirAutor(usuario, evento);
        exigirVersao(evento, versionEsperada);

        revisoes.registrar(RegistroTipo.EVENTO, evento.getId(), usuario.usuarioId(),
                AcaoRevisao.EXCLUIR, evento);

        Instant agora = Instant.now();
        evento.excluirLogicamente(agora);
        eventos.saveAndFlush(evento);
        avisar(evento.getTurmaId(), usuario, agora);
    }

    /**
     * O aviso que faz o aparelho de quem NAO abriu o app reagendar a notificacao
     * local — e o furo que a decisao 2.3 do spec fecha.
     *
     * Sai pela interface Notifier, nunca pelo SDK do Firebase, e vale para os tres
     * caminhos de escrita: cadastro, edicao e exclusao. Exclusao e o caso menos
     * obvio e o mais importante — sem ele o celular avisa as 19h de uma prova que
     * o proprio autor ja apagou.
     *
     * Roda DENTRO da transacao, e nao depois do commit. Um rollback depois daqui
     * mandaria um push a mais, e o pior que isso causa e um sync que nao traz nada;
     * ja um afterCommit nunca dispararia num teste transacional, e a guarda de R20
     * viraria decoracao. A implementacao de prod nao deixa falha de FCM derrubar a
     * escrita.
     */
    private void avisar(UUID turmaId, UsuarioAtual autor, Instant agora) {
        avisos.avisarMudancaNaTurma(turmaId, autor.usuarioId(), PayloadSync.agora(agora));
    }

    /** Inclui SOMENTE os materiais vinculados. Nunca a materia inteira. */
    @Transactional(readOnly = true)
    public EventoDetalheResponse buscar(UsuarioAtual usuario, UUID eventoId) {
        Evento evento = daTurmaDoUsuario(usuario, eventoId);
        // Evento e materiais vinculados sao da mesma turma: uma leitura de docentes so.
        Autorias.Listagem autoria = autorias.daListagem();
        List<MaterialResponse> vinculados = materiais.vinculadosAoEvento(eventoId).stream()
                .map(m -> MaterialResponse.de(m, autoria.de(m)))
                .toList();
        return new EventoDetalheResponse(resposta(evento, autoria), vinculados);
    }

    /** Alimenta o Calendario. Quem decide o que e visivel e o predicado do repository. */
    @Transactional(readOnly = true)
    public List<EventoResponse> listarNoPeriodo(UsuarioAtual usuario, LocalDate de, LocalDate ate) {
        UUID turmaId = escopo.turmaDoUsuario(usuario.usuarioId());
        Autorias.Listagem autoria = autorias.daListagem();
        return eventos.visiveisDaTurmaNoPeriodo(turmaId, de, ate).stream()
                .map(e -> resposta(e, autoria))
                .toList();
    }

    /**
     * Idempotente: tocar duas vezes no botao nao pode estourar a PK do vinculo.
     * O material tambem passa pelo escopo de turma — vincular material alheio
     * seria um caminho lateral para ler registro de outra turma.
     */
    @Transactional
    public void vincularMaterial(UsuarioAtual usuario, UUID eventoId, UUID materialId) {
        Evento evento = daTurmaDoUsuario(usuario, eventoId);
        Material material = materialDaTurmaDoUsuario(usuario, materialId);
        if (vinculos.existsByChaveEventoIdAndChaveMaterialId(evento.getId(), material.getId())) {
            return;
        }
        vinculos.save(new EventoMaterial(evento.getId(), material.getId(), usuario.usuarioId()));
    }

    /**
     * Vincular e de qualquer membro; DESVINCULAR e so do autor do evento ou docente
     * com alcance na materia do evento (PC6).
     *
     * A assimetria e deliberada. Juntar material na prova de alguem e o espirito
     * do app — qualquer membro posta, e a coluna vinculado_por existe para isso.
     * Arrancar material e o oposto: e alteracao destrutiva do conteudo de registro
     * alheio, que o nao-negociavel 10 proibe, e some sem rastro porque a linha do
     * vinculo e apagada de verdade (o CHECK de revisao so aceita EVENTO e MATERIAL,
     * entao registrar vinculo exigiria migration).
     *
     * Sem esta guarda, qualquer um da turma esvaziava a prova de outra pessoa.
     */
    @Transactional
    public void desvincularMaterial(UsuarioAtual usuario, UUID eventoId, UUID materialId) {
        Evento evento = daTurmaDoUsuario(usuario, eventoId);
        // Autor OU docente com alcance na materia do evento.
        exigirAutorOuAlcance(usuario, evento, evento.getMateriaId());
        Material material = materialDaTurmaDoUsuario(usuario, materialId);
        vinculos.deleteByChaveEventoIdAndChaveMaterialId(evento.getId(), material.getId());
    }

    /**
     * Turma e depois visibilidade, para todo caminho por id. Oculto pelo lider ou
     * excluido existe SO para o autor (Secao 6.5 do handoff, que ganha do spec em
     * regra de negocio). Sem a segunda checagem a moderacao vazava para quem
     * guardou o id antes — os ids estao em todo aparelho que sincronizou (Secao
     * 8): o detalhe ja dava 404, mas vincular respondia 204 e editar 403, os dois
     * confirmando que o registro oculto continuava la (achado B2, 05/10/2026).
     *
     * 404 e nao 403: 403 confirmaria que o registro esta la.
     */
    private Evento daTurmaDoUsuario(UsuarioAtual usuario, UUID eventoId) {
        Evento evento = eventos.findById(eventoId).orElseThrow(AcessoNegadoException::new);
        escopo.exigirMesmaTurma(usuario.usuarioId(), evento.getTurmaId());
        if (!evento.visivelPara(usuario.usuarioId())) {
            throw new AcessoNegadoException();
        }
        return evento;
    }

    private Material materialDaTurmaDoUsuario(UsuarioAtual usuario, UUID materialId) {
        Material material = materiais.findById(materialId).orElseThrow(AcessoNegadoException::new);
        escopo.exigirMesmaTurma(usuario.usuarioId(), material.getTurmaId());
        if (!material.visivelPara(usuario.usuarioId())) {
            throw new AcessoNegadoException();
        }
        return material;
    }

    private Materia materiaDaTurmaDoUsuario(UsuarioAtual usuario, UUID materiaId) {
        Materia materia = materias.findById(materiaId).orElseThrow(AcessoNegadoException::new);
        escopo.exigirMesmaTurma(usuario.usuarioId(), materia.getTurmaId());
        return materia;
    }

    private static void exigirAutor(UsuarioAtual usuario, Evento evento) {
        if (!evento.getAutorId().equals(usuario.usuarioId())) {
            throw new NaoAutorException();
        }
    }

    /**
     * Autor OU docente com alcance na materia. Docente pendente, recusado ou
     * contestado nao alcanca ninguem (PoderNaTurma cobre isso).
     */
    private void exigirAutorOuAlcance(UsuarioAtual usuario, Evento evento, UUID materiaIdDestino) {
        if (evento.getAutorId().equals(usuario.usuarioId())) {
            return;
        }
        PoderNaTurma.Docentes docentes = poderNaTurma.daTurma(evento.getTurmaId());
        // Precisa de alcance na materia de ORIGEM e destino (se diferentes).
        if (!docentes.alcanca(usuario.usuarioId(), evento.getMateriaId()) ||
            !docentes.alcanca(usuario.usuarioId(), materiaIdDestino)) {
            throw new NaoAutorException();
        }
    }

    private static void exigirVersao(Evento evento, int versionEsperada) {
        if (evento.getVersion() != versionEsperada) {
            throw new ConflitoVersaoException(versionEsperada, evento.getVersion());
        }
    }

    /**
     * ponytail: um findById de materia por item. O cache de primeiro nivel do
     * Hibernate absorve as repeticoes dentro da mesma transacao, e uma turma tem
     * dezenas de eventos por janela, nao milhares. Se a listagem crescer, o
     * conserto e um findAllById aqui — nao uma associacao nova na entidade.
     */
    private EventoResponse resposta(Evento evento, Autorias.Listagem autoria) {
        return EventoResponse.de(evento,
                materias.findById(evento.getMateriaId()).orElseThrow(AcessoNegadoException::new),
                autoria.de(evento));
    }
}
