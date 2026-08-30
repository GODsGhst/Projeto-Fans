package com.projetofans.web;

import com.projetofans.erro.ErroDeNegocio;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * O unico lugar que monta corpo de erro. RFC 7807, sempre.
 *
 * E um metodo so porque o status ja viaja dentro da excecao (ErroDeNegocio) — quem
 * sabe o que aconteceu escolhe o status na hora de lancar, e nao ha uma cascata de
 * @ExceptionHandler para manter em sincronia com a tabela do plano.
 *
 * As excecoes do proprio Spring MVC (payload invalido, media type errado, rota
 * inexistente) ja saem em ProblemDetail por spring.mvc.problemdetails.enabled.
 */
@RestControllerAdvice
public class ProblemDetailHandler {

    private static final Logger log = LoggerFactory.getLogger(ProblemDetailHandler.class);

    @ExceptionHandler(ErroDeNegocio.class)
    public ProblemDetail erroDeNegocio(ErroDeNegocio erro) {
        return ProblemDetail.forStatusAndDetail(erro.getStatus(), erro.getMessage());
    }

    /**
     * Rede de baixo. Nao devolve a mensagem original: ela pode conter detalhe de
     * banco. Mas registra o stacktrace — erro que some do log e erro que ninguem
     * conserta.
     */
    @ExceptionHandler(Exception.class)
    public ProblemDetail inesperado(Exception erro) {
        log.error("erro nao tratado", erro);
        return ProblemDetail.forStatusAndDetail(
                HttpStatus.INTERNAL_SERVER_ERROR, "Erro inesperado no servidor");
    }
}
