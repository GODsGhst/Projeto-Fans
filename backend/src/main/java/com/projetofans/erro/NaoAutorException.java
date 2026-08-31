package com.projetofans.erro;

import org.springframework.http.HttpStatus;

/**
 * 403, e nao 404.
 *
 * O escopo de turma passou — voce ve este registro na Home — mas voce nao e o
 * autor. Negar a existencia aqui seria mentira confusa; negar a edicao e a
 * verdade. Nem o LIDER escapa: ele muda visibilidade, nunca conteudo alheio.
 */
public class NaoAutorException extends ErroDeNegocio {

    public NaoAutorException() {
        super(HttpStatus.FORBIDDEN, "Somente o autor edita ou exclui o proprio registro");
    }
}
