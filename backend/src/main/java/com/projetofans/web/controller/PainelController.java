package com.projetofans.web.controller;

import com.projetofans.security.UsuarioAtual;
import com.projetofans.service.PainelService;
import com.projetofans.web.dto.PainelResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Painel do docente (professor ou coordenador).
 *
 * Acesso: conta com tipoConta = PROFESSOR ou COORDENADOR. ALUNO recebe 403.
 * Ignora: cabeçalho X-Turma-Id (painel é da conta, não da turma ativa).
 */
@RestController
@RequestMapping("/api/v1/painel")
public class PainelController {

    private final PainelService painel;

    public PainelController(PainelService painel) {
        this.painel = painel;
    }

    @GetMapping
    public PainelResponse painel(@AuthenticationPrincipal UsuarioAtual eu) {
        return painel.painel(eu);
    }
}
