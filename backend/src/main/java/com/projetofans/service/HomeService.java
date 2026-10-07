package com.projetofans.service;

import com.projetofans.domain.TipoEvento;
import com.projetofans.repo.EventoRepository;
import com.projetofans.security.TurmaScopeResolver;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.web.dto.ItemHomeResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * A Home, e os tres nao-negociaveis que vivem nela: teto de 6 itens, janela de 14
 * dias e ordenacao por urgencia.
 *
 * As tres regras estao no SQL de {@link EventoRepository#home}, nao aqui: uma
 * implementacao, uma suite de teste, um lugar para revisar. Este service so
 * resolve a turma e traduz linha para DTO. Se aparecer aqui um sort(), um
 * filter() de data ou um subList(6), a regra passou a ter duas implementacoes —
 * e duas implementacoes divergem.
 *
 * turma_id nao e filtrado a mao: quem responde qual e a turma do usuario e o
 * TurmaScopeResolver.
 */
@Service
public class HomeService {

    private final EventoRepository eventos;
    private final TurmaScopeResolver escopo;
    private final Autorias autorias;

    public HomeService(EventoRepository eventos, TurmaScopeResolver escopo, Autorias autorias) {
        this.eventos = eventos;
        this.escopo = escopo;
        this.autorias = autorias;
    }

    /** Maximo 6 itens, entre hoje e hoje+14, ordenados por urgencia. */
    @Transactional(readOnly = true)
    public List<ItemHomeResponse> home(UsuarioAtual usuario) {
        UUID turmaId = escopo.turmaDoUsuario(usuario.usuarioId());
        return proximosDaTurma(turmaId, usuario.usuarioId());
    }

    /**
     * Os proximos de uma turma restritos a algumas materias — o /painel do professor.
     * Mesma query, mesma janela, mesma ordem e mesmo teto da Home; so o predicado de
     * materia muda, e ele e do SQL (ver EventoRepository#homeDeMaterias). Sem materia
     * nenhuma nao ha o que listar, e nem se pergunta ao banco.
     */
    List<ItemHomeResponse> proximosDasMaterias(UUID turmaId, UUID usuarioId,
                                               Collection<UUID> materiaIds) {
        if (materiaIds.isEmpty()) {
            return List.of();
        }
        return itens(eventos.homeDeMaterias(turmaId, usuarioId, false, materiaIds), turmaId);
    }

    /** Os docentes da turma sao lidos UMA vez para os (no maximo 6) itens, no selo de cada autoria. */
    List<ItemHomeResponse> proximosDaTurma(UUID turmaId, UUID usuarioId) {
        return itens(eventos.home(turmaId, usuarioId), turmaId);
    }

    private List<ItemHomeResponse> itens(List<Object[]> linhas, UUID turmaId) {
        Autorias.Listagem autoria = autorias.daListagem();
        return linhas.stream().map(linha -> item(linha, turmaId, autoria)).toList();
    }

    private static ItemHomeResponse item(Object[] linha, UUID turmaId, Autorias.Listagem autoria) {
        return new ItemHomeResponse(
                (UUID) linha[0],
                TipoEvento.valueOf((String) linha[1]),
                (String) linha[2],
                data(linha[3]),
                hora(linha[4]),
                (String) linha[5],
                (String) linha[6],
                autoria.de(turmaId, (UUID) linha[7], (UUID) linha[11], (UUID) linha[12],
                        instante(linha[8]), instante(linha[9])),
                (Boolean) linha[10]);
    }

    // Query nativa devolve o que o driver entregar. Os tres conversores abaixo
    // aceitam tanto o tipo java.time quanto o java.sql legado de proposito: um
    // cast direto quebraria numa troca de versao de driver, e a falha apareceria
    // como ClassCastException em producao, nao no compilador.

    private static LocalDate data(Object valor) {
        if (valor instanceof LocalDate d) {
            return d;
        }
        return ((java.sql.Date) valor).toLocalDate();
    }

    /** Null e valido: hora_evento e opcional. */
    private static LocalTime hora(Object valor) {
        if (valor == null || valor instanceof LocalTime) {
            return (LocalTime) valor;
        }
        return ((java.sql.Time) valor).toLocalTime();
    }

    private static Instant instante(Object valor) {
        if (valor instanceof Instant i) {
            return i;
        }
        if (valor instanceof OffsetDateTime o) {
            return o.toInstant();
        }
        return ((Timestamp) valor).toInstant();
    }
}
