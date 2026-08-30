package com.projetofans.web.controller;

import com.projetofans.security.UsuarioAtual;
import com.projetofans.service.TurmaService;
import com.projetofans.web.dto.CriarTurmaRequest;
import com.projetofans.web.dto.EntrarNaTurmaRequest;
import com.projetofans.web.dto.MembroDto;
import com.projetofans.web.dto.TurmaDto;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/turmas")
public class TurmaController {

    private final TurmaService turmas;

    public TurmaController(TurmaService turmas) {
        this.turmas = turmas;
    }

    /** Quem cria vira LIDER. O codigo de convite volta no corpo para ser compartilhado. */
    @PostMapping
    public TurmaDto criar(@AuthenticationPrincipal UsuarioAtual eu,
                          @Valid @RequestBody CriarTurmaRequest pedido) {
        return TurmaDto.de(turmas.criar(eu.usuarioId(), pedido.nome(), pedido.semestre()));
    }

    @PostMapping("/entrar")
    public MembroDto entrar(@AuthenticationPrincipal UsuarioAtual eu,
                            @Valid @RequestBody EntrarNaTurmaRequest pedido) {
        return MembroDto.de(turmas.entrar(eu.usuarioId(), pedido.codigoConvite()));
    }
}
