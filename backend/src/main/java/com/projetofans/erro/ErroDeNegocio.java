package com.projetofans.erro;

import org.springframework.http.HttpStatus;

/**
 * Excecao de dominio que ja carrega o status HTTP que lhe corresponde.
 *
 * Existe para que o ProblemDetailHandler seja UM metodo, e nao um metodo por
 * excecao: o mapeamento de situacao para status esta na tabela de Global
 * Constraints do plano, e ele fica escrito aqui, junto de quem sabe o que
 * aconteceu, em vez de espalhado por @ExceptionHandler.
 *
 * Nenhum controller monta corpo de erro por conta propria. Se voce sentir vontade
 * de devolver ResponseEntity com uma mensagem, lance uma destas.
 */
public class ErroDeNegocio extends RuntimeException {

    private final HttpStatus status;

    public ErroDeNegocio(HttpStatus status, String mensagem) {
        super(mensagem);
        this.status = status;
    }

    /** Com causa: usar sempre que houver excecao original a preservar. */
    public ErroDeNegocio(HttpStatus status, String mensagem, Throwable causa) {
        super(mensagem, causa);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }

    /**
     * Codigo estavel para o app decidir o que fazer, quando o status sozinho nao
     * basta. Quase nenhum erro tem um: o status e o texto ja dizem tudo. Existe
     * porque 404 e ambiguo — "nao achei esse registro" e "voce nao esta em turma
     * nenhuma" pedem reacoes opostas, e um 404 de proxy tambem chega como 404.
     */
    public String getCodigo() {
        return null;
    }
}
