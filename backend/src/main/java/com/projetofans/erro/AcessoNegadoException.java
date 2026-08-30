package com.projetofans.erro;

import org.springframework.http.HttpStatus;

/**
 * 404, NUNCA 403.
 *
 * Lancada quando o escopo de turma falha — o registro existe, mas e de outra
 * turma. Responder 403 confirmaria que ele existe, e existencia e justamente o
 * que nao se pode vazar entre turmas. A mensagem tambem nao distingue os casos.
 *
 * A distincao com 403 e deliberada: 404 quando o ESCOPO falha (outra turma), 403
 * quando o escopo passa e a AUTORIZACAO falha (sua turma, mas voce nao e o autor).
 */
public class AcessoNegadoException extends ErroDeNegocio {

    public AcessoNegadoException() {
        super(HttpStatus.NOT_FOUND, "Registro nao encontrado");
    }
}
