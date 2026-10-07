package com.projetofans.web;

import com.projetofans.erro.ErroDeNegocio;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.sql.SQLException;
import java.util.Set;

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
        ProblemDetail problema = ProblemDetail.forStatusAndDetail(erro.getStatus(), erro.getMessage());
        if (erro.getCodigo() != null) {
            // Propriedade de nivel raiz no JSON ({"codigo":"SEM_TURMA", ...}).
            problema.setProperty("codigo", erro.getCodigo());
        }
        return problema;
    }

    /** As duas FKs que prendem evento e material a uma materia (nomes padrao do Postgres). */
    private static final Set<String> FK_DE_MATERIA =
            Set.of("evento_materia_id_fkey", "material_materia_id_fkey");

    /**
     * Corrida entre apagar uma materia e criar evento ou material nela: a checagem
     * de "materia vazia" e o INSERT nao sao atomicos, entao um dos dois acaba na FK
     * do banco. E uma situacao esperada, que a pessoa resolve recarregando — 409 com
     * frase, nao 500.
     *
     * Vale SO para as FKs de materia. Qualquer outra violacao de integridade
     * continua sendo 500 com stacktrace no log: seria um bug nosso, e um 409
     * generico o esconderia.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ProblemDetail integridade(DataIntegrityViolationException erro) {
        if (violaFkDeMateria(erro)) {
            return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                    "A materia mudou enquanto voce salvava (foi apagada, ou ganhou provas ou "
                            + "materiais). Recarregue e tente de novo.");
        }
        return inesperado(erro);
    }

    /**
     * SQLSTATE 23503 (violacao de FK) mais o NOME da constraint na mensagem.
     *
     * Nao usa `ConstraintViolationException.getConstraintName()` do Hibernate: ele
     * extrai o nome do texto do erro em INGLES, e o Postgres devolve a mensagem no
     * idioma do servidor ("viola restricao de chave estrangeira") — la o nome vem
     * nulo. O SQLSTATE e o nome do identificador nao dependem de idioma.
     */
    private static boolean violaFkDeMateria(Throwable erro) {
        for (Throwable t = erro; t != null; t = t.getCause()) {
            if (t instanceof SQLException sql
                    && "23503".equals(sql.getSQLState())
                    && sql.getMessage() != null
                    && FK_DE_MATERIA.stream().anyMatch(sql.getMessage()::contains)) {
                return true;
            }
        }
        return false;
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
