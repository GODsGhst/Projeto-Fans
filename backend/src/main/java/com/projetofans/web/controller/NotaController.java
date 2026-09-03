package com.projetofans.web.controller;

import com.projetofans.erro.IfMatchAusenteException;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.service.NotaService;
import com.projetofans.web.dto.NotaResponse;
import com.projetofans.web.dto.SalvarNotaRequest;
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
 * Anotacoes.
 *
 * NAO EXISTE `GET /notas/{id}`, e a ausencia e a regra: com ele, adivinhar um
 * UUID seria o caminho de ler o rascunho pessoal de outra pessoa. A leitura e
 * sempre por periodo, e a query ja separa o que e meu do que e da turma.
 */
@RestController
@RequestMapping("/api/v1/notas")
public class NotaController {

    private final NotaService notas;

    public NotaController(NotaService notas) {
        this.notas = notas;
    }

    /** A janela e da tela — o mes que ela mostra. Mesmo contrato de `GET /eventos`. */
    @GetMapping
    public List<NotaResponse> doPeriodo(
            @AuthenticationPrincipal UsuarioAtual eu,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return notas.doPeriodo(eu, de, ate);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public NotaResponse criar(@AuthenticationPrincipal UsuarioAtual eu,
                              @Valid @RequestBody SalvarNotaRequest pedido) {
        return notas.criar(eu, pedido);
    }

    @PatchMapping("/{id}")
    public NotaResponse atualizar(@AuthenticationPrincipal UsuarioAtual eu,
                                  @PathVariable UUID id,
                                  @RequestHeader(value = "If-Match", required = false) Integer ifMatch,
                                  @Valid @RequestBody SalvarNotaRequest pedido) {
        return notas.atualizar(eu, id, IfMatchAusenteException.exigir(ifMatch), pedido);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@AuthenticationPrincipal UsuarioAtual eu,
                        @PathVariable UUID id,
                        @RequestHeader(value = "If-Match", required = false) Integer ifMatch) {
        notas.excluirLogicamente(eu, id, IfMatchAusenteException.exigir(ifMatch));
    }
}
