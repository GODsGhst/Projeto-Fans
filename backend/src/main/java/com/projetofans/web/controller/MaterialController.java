package com.projetofans.web.controller;

import com.projetofans.erro.IfMatchAusenteException;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.service.MaterialService;
import com.projetofans.web.dto.AtualizarMaterialRequest;
import com.projetofans.web.dto.CriarMaterialRequest;
import com.projetofans.web.dto.MaterialResponse;
import jakarta.validation.Valid;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Mesmas regras do EventoController. Nao existe GET de listagem aqui de
 * proposito: material chega pela tela da materia ou pelos vinculos de um evento.
 */
@RestController
@RequestMapping("/api/v1/materiais")
public class MaterialController {

    private final MaterialService materiais;

    public MaterialController(MaterialService materiais) {
        this.materiais = materiais;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MaterialResponse criar(@AuthenticationPrincipal UsuarioAtual eu,
                                  @Valid @RequestBody CriarMaterialRequest pedido) {
        return materiais.criar(eu, pedido);
    }

    @GetMapping("/{id}")
    public MaterialResponse buscar(@AuthenticationPrincipal UsuarioAtual eu,
                                   @PathVariable UUID id) {
        return materiais.buscar(eu, id);
    }

    @PatchMapping("/{id}")
    public MaterialResponse atualizar(@AuthenticationPrincipal UsuarioAtual eu,
                                      @PathVariable UUID id,
                                      @RequestHeader(value = "If-Match", required = false) Integer ifMatch,
                                      @Valid @RequestBody AtualizarMaterialRequest pedido) {
        return materiais.atualizar(eu, id, IfMatchAusenteException.exigir(ifMatch), pedido);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@AuthenticationPrincipal UsuarioAtual eu,
                        @PathVariable UUID id,
                        @RequestHeader(value = "If-Match", required = false) Integer ifMatch) {
        materiais.excluirLogicamente(eu, id, IfMatchAusenteException.exigir(ifMatch));
    }
}
