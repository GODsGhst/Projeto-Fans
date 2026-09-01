package com.projetofans.erro;

import org.springframework.http.HttpStatus;

/**
 * Ja existe materia com esta sigla na turma.
 *
 * 409 e nao 400: o pedido esta bem formado, o que conflita e o estado atual da
 * turma. A distincao importa para o app, que trata 409 como "recarregue e
 * reveja" e 400 como "voce digitou errado".
 */
public class SiglaDuplicadaException extends ErroDeNegocio {

    public SiglaDuplicadaException(String sigla) {
        super(HttpStatus.CONFLICT,
                "Ja existe uma materia com a sigla " + sigla + " nesta turma.");
    }
}
