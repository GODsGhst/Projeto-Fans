package com.projetofans.erro;

import org.springframework.http.HttpStatus;

/** ID token do Google ou JWT proprio que nao passou na verificacao. */
public class TokenInvalidoException extends ErroDeNegocio {

    public TokenInvalidoException(String mensagem) {
        super(HttpStatus.UNAUTHORIZED, mensagem);
    }
}
