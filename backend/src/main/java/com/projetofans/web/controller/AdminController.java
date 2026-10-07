package com.projetofans.web.controller;

import com.projetofans.domain.DocenteStatus;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.service.AdminService;
import com.projetofans.web.dto.DocenteAdminResponse;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Os dois poderes do admin: destravar turma sem lider e decidir quem e docente
 * (a segunda e emenda a V6, spec 2026-10-06 secao 7). Nao ha um terceiro.
 *
 * Nao existe rota para PROMOVER admin, e a ausencia e a decisao inteira: ela
 * seria o alvo mais valioso da API, e uma falha de autorizacao ali entregaria
 * todas as turmas de uma vez. Admin se concede por SQL.
 *
 * Nao existe rota para o admin LER conteudo de turma. O poder e de destravar e
 * de atestar quem e docente, nao de vigiar.
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

    /**
     * Fila de contas docentes (professor/coordenador), mais antigas primeiro.
     * `status` e opcional: sem ele, vem todas. Quem nao e admin recebe 404.
     */
    @GetMapping("/docentes")
    public List<DocenteAdminResponse> docentes(@AuthenticationPrincipal UsuarioAtual eu,
                                               @RequestParam(required = false) DocenteStatus status) {
        return admin.listarDocentes(eu, status);
    }

    @PostMapping("/docentes/{usuarioId}/aprovar")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void aprovar(@AuthenticationPrincipal UsuarioAtual eu, @PathVariable UUID usuarioId) {
        admin.aprovarDocente(eu, usuarioId);
    }

    /** Recusa um pendente OU revoga um aprovado; vale na proxima requisicao do docente. */
    @PostMapping("/docentes/{usuarioId}/recusar")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void recusar(@AuthenticationPrincipal UsuarioAtual eu, @PathVariable UUID usuarioId) {
        admin.recusarDocente(eu, usuarioId);
    }
}
