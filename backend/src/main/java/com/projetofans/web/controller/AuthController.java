package com.projetofans.web.controller;

import com.projetofans.service.AuthService;
import com.projetofans.web.dto.AuthResponse;
import com.projetofans.web.dto.EsqueciSenhaRequest;
import com.projetofans.web.dto.GoogleLoginRequest;
import com.projetofans.web.dto.LoginRequest;
import com.projetofans.web.dto.RegistrarRequest;
import com.projetofans.web.dto.ResetSenhaRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * As unicas rotas abertas do app. Todo o resto exige Bearer.
 *
 * Nenhum metodo aqui monta corpo de erro: as excecoes de dominio ja carregam o
 * status e o ProblemDetailHandler as traduz.
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/registrar")
    public AuthResponse registrar(@Valid @RequestBody RegistrarRequest pedido) {
        return auth.registrar(pedido.nome(), pedido.email(), pedido.senha());
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest pedido) {
        return auth.login(pedido.email(), pedido.senha());
    }

    @PostMapping("/google")
    public AuthResponse google(@Valid @RequestBody GoogleLoginRequest pedido) {
        return auth.entrarComGoogle(pedido.idToken());
    }

    /** 204 sempre, exista o e-mail ou nao. Ver AuthService.esqueciSenha. */
    @PostMapping("/senha/esqueci")
    public ResponseEntity<Void> esqueciSenha(@Valid @RequestBody EsqueciSenhaRequest pedido) {
        auth.esqueciSenha(pedido.email());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/senha/reset")
    public ResponseEntity<Void> resetarSenha(@Valid @RequestBody ResetSenhaRequest pedido) {
        auth.resetarSenha(pedido.token(), pedido.novaSenha());
        return ResponseEntity.noContent().build();
    }
}
