package com.projetofans.erro;

import org.springframework.http.HttpStatus;

/** Cor que nao esta entre as 12 hues validadas do design system. */
public class CorForaDaPaletaException extends ErroDeNegocio {

    public CorForaDaPaletaException(String corRecebida) {
        super(HttpStatus.BAD_REQUEST,
                "A cor " + corRecebida + " nao esta na paleta da turma. "
                        + "Escolha uma das 12 cores disponiveis.");
    }
}
