package com.projetofans.service;

import com.projetofans.domain.Evento;
import com.projetofans.domain.Materia;
import com.projetofans.repo.EventoRepository;
import com.projetofans.repo.MateriaRepository;
import com.projetofans.security.TurmaScopeResolver;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.web.dto.EventoResponse;
import com.projetofans.web.dto.MateriaResponse;
import com.projetofans.web.dto.SyncResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Stream;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * O delta que alimenta o reagendador local do app.
 *
 * Este e o unico lugar da API que devolve registro oculto e registro excluido de
 * proposito. Em qualquer outra rota eles somem — aqui eles PRECISAM aparecer,
 * porque desagendar a notificacao da vespera exige que o aparelho saiba que o
 * evento sumiu. Se alguem "consertar" isto reusando um predicado de visibilidade,
 * a Home continua correta e o celular passa a avisar as 19h de uma prova que a
 * turma nao ve mais — falha silenciosa, do tipo que so aparece em campo.
 *
 * turma_id nao e filtrado a mao: quem resolve a turma e o TurmaScopeResolver, e o
 * delta e sempre da turma de quem pergunta.
 */
@Service
public class SyncService {

    private static final Logger log = LoggerFactory.getLogger(SyncService.class);

    private final EventoRepository eventos;
    private final MateriaRepository materias;
    private final Autorias autorias;
    private final TurmaScopeResolver escopo;

    public SyncService(EventoRepository eventos, MateriaRepository materias,
                       Autorias autorias, TurmaScopeResolver escopo) {
        this.eventos = eventos;
        this.materias = materias;
        this.autorias = autorias;
        this.escopo = escopo;
    }

    @Transactional(readOnly = true)
    public SyncResponse delta(UsuarioAtual usuario, Instant desde) {
        UUID turmaId = escopo.turmaDoUsuario(usuario.usuarioId());

        // Marcado ANTES da consulta. O que mudar enquanto ela roda volta no proximo
        // delta; marcar depois abriria uma janela em que a mudanca fica para tras do
        // ultimoSync do aparelho e nunca mais e enviada.
        Instant servidorEm = Instant.now();

        List<Materia> daTurma = materias.findByTurmaIdOrderBySiglaAsc(turmaId);
        Map<UUID, Materia> porId = daTurma.stream()
                .collect(Collectors.toMap(Materia::getId, Function.identity()));

        List<Evento> alterados = eventos.alteradosDesde(turmaId, desde);
        // Os nomes vem num findAllById so, e nao um por evento: aqui a lista e
        // "tudo que mudou desde o ultimo sync", que depois de um fim de semana
        // offline nao e uma tela — pode ser a turma inteira. Os docentes, para o selo,
        // tambem sao lidos uma vez so (Autorias.Listagem).
        Autorias.Listagem autoria = autorias.daListagem();
        autoria.carregarNomes(alterados.stream()
                .flatMap(e -> Stream.of(e.getAutorId(), e.getAtualizadoPor()))
                .filter(Objects::nonNull)
                .toList());

        // Lapide continua SEM autoria: quem sumiu nao diz quem era.
        List<EventoResponse> resposta = new ArrayList<>();
        for (Evento e : alterados) {
            if (!visivelPara(e, usuario)) {
                resposta.add(EventoResponse.lapide(e));
                continue;
            }
            Materia materia = porId.get(e.getMateriaId());
            if (materia == null) {
                // Registro antigo apontando para materia de OUTRA turma (de antes da
                // guarda de turma no PATCH). Lancar 404 aqui derrubava o /sync da turma
                // INTEIRA por causa de um item so; pular o item deixa o resto chegar,
                // e nao entrega sigla/cor da materia de outra turma. A lapide acima nao
                // precisa de materia, entao continua saindo.
                log.warn("sync: evento {} da turma {} aponta para materia {} fora da turma; "
                        + "item pulado", e.getId(), turmaId, e.getMateriaId());
                continue;
            }
            resposta.add(EventoResponse.de(e, materia, autoria.de(e)));
        }

        return new SyncResponse(resposta, daTurma.stream().map(MateriaResponse::de).toList(),
                servidorEm);
    }

    /**
     * Oculto pelo lider ou excluido pelo autor so tem conteudo para o proprio autor
     * — Secao 6.5 do handoff, a mesma regra que EventoService.buscar aplica.
     *
     * O item continua no delta de qualquer jeito: NAO filtre para fora daqui, ou o
     * aparelho nunca aprende que o evento sumiu e a notificacao vira fantasma.
     */
    private static boolean visivelPara(Evento evento, UsuarioAtual usuario) {
        if (evento.isVisivelTurma() && !evento.estaExcluido()) {
            return true;
        }
        return evento.getAutorId().equals(usuario.usuarioId());
    }
}
