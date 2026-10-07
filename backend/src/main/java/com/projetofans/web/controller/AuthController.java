package com.projetofans.web.controller;

import com.projetofans.security.LimiteDeTentativas;
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
    private final LimiteDeTentativas limite;

    public AuthController(AuthService auth, LimiteDeTentativas limite) {
        this.auth = auth;
        this.limite = limite;
    }

    @PostMapping("/registrar")
    public AuthResponse registrar(@Valid @RequestBody RegistrarRequest pedido) {
        // Antes de qualquer consulta: o teto nao pode depender de a conta existir.
        limite.registrar(pedido.email());
        return auth.registrar(pedido.nome(), pedido.email(), pedido.senha(), pedido.tipoConta());
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest pedido) {
        limite.login(pedido.email());
        AuthResponse resposta = auth.login(pedido.email(), pedido.senha());
        // So chega aqui quem acertou: o 401 sobe antes e a falha fica contada.
        limite.loginCerto(pedido.email());
        return resposta;
    }

    @PostMapping("/google")
    public AuthResponse google(@Valid @RequestBody GoogleLoginRequest pedido) {
        return auth.entrarComGoogle(pedido.idToken());
    }

    /** 204 sempre, exista o e-mail ou nao. Ver AuthService.esqueciSenha. */
    @PostMapping("/senha/esqueci")
    public ResponseEntity<Void> esqueciSenha(@Valid @RequestBody EsqueciSenhaRequest pedido) {
        limite.esqueciSenha(pedido.email());
        auth.esqueciSenha(pedido.email());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/senha/reset")
    public ResponseEntity<Void> resetarSenha(@Valid @RequestBody ResetSenhaRequest pedido) {
        String email = auth.resetarSenha(pedido.token(), pedido.novaSenha());
        // O token do e-mail prova posse da conta: destrava o teto de login, que
        // senao ficaria renovavel nas maos de quem so sabe o e-mail da vitima.
        limite.loginCerto(email);
        return ResponseEntity.noContent().build();
    }
}
