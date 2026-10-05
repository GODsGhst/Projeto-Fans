package com.projetofans.web.controller;

import com.projetofans.security.UsuarioAtual;
import com.projetofans.service.AuthService;
import com.projetofans.web.dto.PerfilAtualizadoResponse;
import com.projetofans.web.dto.PerfilResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * O perfil de quem esta logado. Como no DeviceController, nao ha id na rota:
 * o dono e sempre o do token, entao nao existe "editar o perfil de outro".
 *
 * O PATCH aqui nao pede If-Match, diferente dos registros da turma: usuario nao
 * tem coluna version, e o unico editor do proprio nome e o proprio dono.
 */
@RestController
@RequestMapping("/api/v1/eu")
public class EuController {

    private final AuthService auth;

    public EuController(AuthService auth) {
        this.auth = auth;
    }

    public record AtualizarPerfilRequest(@NotBlank @Size(max = 120) String nome) {
    }

    /** Mesmas regras da nova senha no cadastro e no reset. */
    public record TrocarSenhaRequest(@NotNull String senhaAtual,
                                     @NotBlank @Size(min = 8, max = 100) String novaSenha) {
    }

    @GetMapping
    public PerfilResponse perfil(@AuthenticationPrincipal UsuarioAtual eu) {
        return auth.perfil(eu.usuarioId());
    }

    @PatchMapping
    public PerfilAtualizadoResponse atualizar(@AuthenticationPrincipal UsuarioAtual eu,
                                              @Valid @RequestBody AtualizarPerfilRequest pedido) {
        return auth.renomear(eu.usuarioId(), pedido.nome());
    }

    /** O JWT novo de quem trocou; as outras sessoes caem (ver AuthService.trocarSenha). */
    public record SenhaTrocadaResponse(String jwt) {
    }

    @PostMapping("/senha")
    public SenhaTrocadaResponse trocarSenha(@AuthenticationPrincipal UsuarioAtual eu,
                                            @Valid @RequestBody TrocarSenhaRequest pedido) {
        return new SenhaTrocadaResponse(
                auth.trocarSenha(eu.usuarioId(), pedido.senhaAtual(), pedido.novaSenha()));
    }
}
