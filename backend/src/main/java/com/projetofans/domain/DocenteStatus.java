package com.projetofans.domain;

/**
 * Estado da aprovacao de uma conta docente. Nasce PENDENTE: o codigo de convite
 * prova que a pessoa e da turma, nao que ela da aula, entao o poder espera o admin
 * (spec 2.1). Conta ALUNO nao tem status (NULL no banco, por CHECK).
 */
public enum DocenteStatus {
    PENDENTE,
    APROVADO,
    RECUSADO
}
