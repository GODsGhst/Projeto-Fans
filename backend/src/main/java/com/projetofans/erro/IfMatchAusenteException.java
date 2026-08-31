package com.projetofans.erro;

import org.springframework.http.HttpStatus;

/**
 * 428 Precondition Required.
 *
 * Sem If-Match nao ha como detectar edicao concorrente, entao a requisicao e
 * recusada em vez de aceita com risco. O default silencioso ("se nao mandou,
 * sobrescreve") e exatamente o que a regra existe para impedir.
 */
public class IfMatchAusenteException extends ErroDeNegocio {

    public IfMatchAusenteException() {
        super(HttpStatus.PRECONDITION_REQUIRED, "Header If-Match com a version e obrigatorio");
    }

    /** Um lugar so para a checagem, usada por evento e por material. */
    public static int exigir(Integer ifMatch) {
        if (ifMatch == null) {
            throw new IfMatchAusenteException();
        }
        return ifMatch;
    }
}
