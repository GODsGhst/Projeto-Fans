package com.projetofans.domain;

/**
 * O que a pessoa declarou ser no cadastro. Define a INTERFACE (painel de docente
 * ou app de aluno); o PODER sai de {@link DocenteStatus}, conferido no servidor a
 * cada requisicao. Misturar os dois faria o professor pendente cair no app de
 * aluno (spec 2.9).
 *
 * Gravavel so na criacao da conta: trocar o tipo depois e SQL do dono, nao produto.
 */
public enum TipoConta {
    ALUNO,
    PROFESSOR,
    COORDENADOR;

    /** Docente (professor ou coordenador) passa por aprovacao do admin; aluno nao. */
    public boolean ehDocente() {
        return this != ALUNO;
    }
}
