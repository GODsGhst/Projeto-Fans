package com.projetofans.web.controller;

import com.projetofans.erro.IfMatchAusenteException;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.service.EventoService;
import com.projetofans.web.dto.AtualizarEventoRequest;
import com.projetofans.web.dto.CriarEventoRequest;
import com.projetofans.web.dto.EventoDetalheResponse;
import com.projetofans.web.dto.EventoResponse;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * O controller nao decide nada: nao filtra turma, nao compara autor e nao monta
 * corpo de erro. Ele traduz HTTP para chamada de service e devolve DTO.
 *
 * A unica regra que mora aqui e a do If-Match, porque ela e do protocolo e nao
 * do dominio: o service ja recebe a version como numero.
 */
@RestController
@RequestMapping("/api/v1/eventos")
public class EventoController {

    private final EventoService eventos;

    public EventoController(EventoService eventos) {
        this.eventos = eventos;
    }

    /** Qualquer membro posta, sem aprovacao. 201 direto. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EventoResponse criar(@AuthenticationPrincipal UsuarioAtual eu,
                                @Valid @RequestBody CriarEventoRequest pedido) {
        return eventos.criar(eu, pedido);
    }

    /** Alimenta o Calendario. Ordem e visibilidade vem prontas do servidor. */
    @GetMapping
    public List<EventoResponse> listar(
            @AuthenticationPrincipal UsuarioAtual eu,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return eventos.listarNoPeriodo(eu, de, ate);
    }

    /** Traz SOMENTE os materiais vinculados a este evento. */
    @GetMapping("/{id}")
    public EventoDetalheResponse buscar(@AuthenticationPrincipal UsuarioAtual eu,
                                        @PathVariable UUID id) {
        return eventos.buscar(eu, id);
    }

    @PatchMapping("/{id}")
    public EventoResponse atualizar(@AuthenticationPrincipal UsuarioAtual eu,
                                    @PathVariable UUID id,
                                    @RequestHeader(value = "If-Match", required = false) Integer ifMatch,
                                    @Valid @RequestBody AtualizarEventoRequest pedido) {
        return eventos.atualizar(eu, id, IfMatchAusenteException.exigir(ifMatch), pedido);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@AuthenticationPrincipal UsuarioAtual eu,
                        @PathVariable UUID id,
                        @RequestHeader(value = "If-Match", required = false) Integer ifMatch) {
        eventos.excluirLogicamente(eu, id, IfMatchAusenteException.exigir(ifMatch));
    }

    @PostMapping("/{id}/materiais/{materialId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void vincularMaterial(@AuthenticationPrincipal UsuarioAtual eu,
                                 @PathVariable UUID id,
                                 @PathVariable UUID materialId) {
        eventos.vincularMaterial(eu, id, materialId);
    }

    @DeleteMapping("/{id}/materiais/{materialId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void desvincularMaterial(@AuthenticationPrincipal UsuarioAtual eu,
                                    @PathVariable UUID id,
                                    @PathVariable UUID materialId) {
        eventos.desvincularMaterial(eu, id, materialId);
    }
}
