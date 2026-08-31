package com.projetofans.web.controller;

import com.projetofans.security.UsuarioAtual;
import com.projetofans.service.EstadoPessoalService;
import com.projetofans.web.dto.EstadoPessoalRequest;
import com.projetofans.web.dto.MeuQuadroResponse;
import com.projetofans.web.dto.NaoListadosResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * As tres rotas de estado pessoal.
 *
 * Marcar feito e PUT em `/eventos/{id}/estado-pessoal`, e nao PATCH no evento —
 * a URL diz que o recurso alterado e o estado pessoal, nao o fato compartilhado.
 * Por isso tambem nao ha If-Match aqui: nao ha version a conflitar, porque nada
 * do evento e tocado.
 *
 * Sem parametro de usuario em `/meu-quadro` nem em `/nao-listados`: quem le e
 * sempre o autenticado. Aceitar `?usuarioId=` seria abrir a porta que R16 fecha.
 */
@RestController
@RequestMapping("/api/v1")
public class QuadroController {

    private final EstadoPessoalService estadoPessoal;

    public QuadroController(EstadoPessoalService estadoPessoal) {
        this.estadoPessoal = estadoPessoal;
    }

    @PutMapping("/eventos/{id}/estado-pessoal")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void marcar(@AuthenticationPrincipal UsuarioAtual eu,
                       @PathVariable UUID id,
                       @Valid @RequestBody EstadoPessoalRequest pedido) {
        estadoPessoal.marcar(eu, id, pedido.feito());
    }

    @GetMapping("/meu-quadro")
    public MeuQuadroResponse meuQuadro(@AuthenticationPrincipal UsuarioAtual eu) {
        return estadoPessoal.meuQuadro(eu);
    }

    /** So aparece algo aqui para quem teve registro proprio oculto ou excluido. */
    @GetMapping("/nao-listados")
    public NaoListadosResponse naoListados(@AuthenticationPrincipal UsuarioAtual eu) {
        return estadoPessoal.naoListados(eu);
    }
}
