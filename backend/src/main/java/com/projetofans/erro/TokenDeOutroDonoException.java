package com.projetofans.erro;

import org.springframework.http.HttpStatus;

/**
 * Token de device que ja pertence a outra conta.
 *
 * 409 e nao 403: o pedido esta bem formado e quem pede esta autenticado — o que
 * conflita e o estado do registro. O app resolve mandando DELETE /devices antes,
 * que e o que ele ja faz no logout.
 */
public class TokenDeOutroDonoException extends ErroDeNegocio {

    public TokenDeOutroDonoException() {
        super(HttpStatus.CONFLICT,
                "Este aparelho ja esta registrado em outra conta. Saia da outra conta primeiro.");
    }
}
