package com.projetofans.domain;

/**
 * Papel do VINCULO com a turma. E um valor so por vinculo, e por isso o docente
 * nunca vira LIDER: a lideranca apagaria o PROFESSOR/COORDENADOR (ver
 * {@link Membro#mudarPapel}).
 *
 * PROFESSOR e COORDENADOR so tem poder quando a CONTA tambem esta aprovada
 * ({@link DocenteStatus#APROVADO}) e o vinculo nao foi contestado pelo lider; o
 * papel sozinho nao concede nada. Professor continua sendo contribuidor opcional,
 * nunca requisito: turma sem professor funciona como antes (spec 2.1 e 2.2).
 */
public enum PapelMembro {
    ALUNO,
    LIDER,
    PROFESSOR,
    COORDENADOR
}
