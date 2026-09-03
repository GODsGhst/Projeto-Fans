package com.projetofans.web.controller;

import com.projetofans.security.UsuarioAtual;
import com.projetofans.service.AdminService;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Uma rota. E vai continuar sendo uma.
 *
 * Nao existe rota para PROMOVER admin, e a ausencia e a decisao inteira: ela
 * seria o alvo mais valioso da API, e uma falha de autorizacao ali entregaria
 * todas as turmas de uma vez. Admin se concede por SQL.
 *
 * Nao existe rota para o admin LER conteudo de turma. O poder e de destravar,
 * nao de vigiar.
 */
@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {

    private final AdminService admin;

    public AdminController(AdminService admin) {
        this.admin = admin;
    }

    public record DefinirLiderRequest(@NotNull UUID novoLiderUsuarioId) {
    }

    /** Destrava a turma cujo lider sumiu. Quem nao e admin recebe 404. */
    @PostMapping("/turmas/{turmaId}/lider")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void definirLider(@AuthenticationPrincipal UsuarioAtual eu,
                             @PathVariable UUID turmaId,
                             @RequestBody DefinirLiderRequest pedido) {
        admin.definirLider(eu, turmaId, pedido.novoLiderUsuarioId());
    }
}
