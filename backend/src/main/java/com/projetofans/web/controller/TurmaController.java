package com.projetofans.web.controller;

import com.projetofans.security.UsuarioAtual;
import com.projetofans.service.TurmaService;
import com.projetofans.web.dto.AtualizarTurmaRequest;
import com.projetofans.web.dto.CriarTurmaRequest;
import com.projetofans.web.dto.EntrarNaTurmaRequest;
import com.projetofans.web.dto.MembroDto;
import com.projetofans.web.dto.MinhaTurmaResponse;
import com.projetofans.web.dto.TurmaDto;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
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

    /**
     * A turma do usuario: membros, papel de cada um e o codigo de convite.
     *
     * Antes disto o codigo so existia na resposta do POST acima — quem fechava o
     * app naquela tela nunca mais o via. Quem nao e membro leva 404, nunca 403.
     */
    /** So o lider renomeia. O codigo de convite nao muda junto. */
    @PatchMapping("/minha")
    public MinhaTurmaResponse atualizar(@AuthenticationPrincipal UsuarioAtual eu,
                                        @Valid @RequestBody AtualizarTurmaRequest pedido) {
        return turmas.atualizar(eu, pedido);
    }

    @GetMapping("/minha")
    public MinhaTurmaResponse minha(@AuthenticationPrincipal UsuarioAtual eu) {
        return turmas.minha(eu);
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
