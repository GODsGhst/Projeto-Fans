package com.projetofans.web.controller;

import com.projetofans.security.UsuarioAtual;
import com.projetofans.service.HomeService;
import com.projetofans.web.dto.ItemHomeResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Sem parametro de paginacao, de ordem ou de janela — e deliberado. Quem decide
 * quantos itens, quais e em que ordem e o servidor; deixar o cliente pedir
 * "ordena por tipo" ou "me da 20" devolveria a regra para a vitrine.
 */
@RestController
@RequestMapping("/api/v1/home")
public class HomeController {

    private final HomeService home;

    public HomeController(HomeService home) {
        this.home = home;
    }

    /** Lista pronta: o app renderiza na ordem que veio. */
    @GetMapping
    public List<ItemHomeResponse> home(@AuthenticationPrincipal UsuarioAtual eu) {
        return home.home(eu);
    }
}
