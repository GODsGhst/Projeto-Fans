package com.projetofans.erro;

import org.springframework.http.HttpStatus;

/**
 * 409. Alguem editou entre o momento em que voce carregou a tela e o momento em
 * que salvou. Sobrescrever em silencio perderia a edicao do outro — e neste app
 * o registro perdido pode ser a data de uma prova.
 */
public class ConflitoVersaoException extends ErroDeNegocio {

    public ConflitoVersaoException(int esperada, int atual) {
        super(HttpStatus.CONFLICT,
                "Este registro mudou desde que voce abriu (version " + atual
                        + ", voce enviou " + esperada + ")");
    }
}
