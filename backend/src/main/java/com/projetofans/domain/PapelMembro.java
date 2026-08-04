package com.projetofans.domain;

/**
 * PROFESSOR tem exatamente as mesmas permissoes de ALUNO no MVP — o papel existe
 * so para exibicao no badge de autoria. Dar poder ao professor o tornaria requisito
 * de funcionamento, e o handoff diz que ele e contribuidor opcional.
 */
public enum PapelMembro {
    ALUNO,
    LIDER,
    PROFESSOR
}
