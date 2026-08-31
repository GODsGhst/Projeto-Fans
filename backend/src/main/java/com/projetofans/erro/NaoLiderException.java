package com.projetofans.erro;

import org.springframework.http.HttpStatus;

/**
 * 403 — R12.
 *
 * Voce e da turma (o escopo passou), mas moderacao e do LIDER. Como no
 * {@link NaoAutorException}, negar a existencia aqui seria mentira: quem tentou
 * ocultar ja estava vendo o registro na Home.
 */
public class NaoLiderException extends ErroDeNegocio {

    public NaoLiderException() {
        super(HttpStatus.FORBIDDEN, "Somente o lider da turma modera");
    }
}
