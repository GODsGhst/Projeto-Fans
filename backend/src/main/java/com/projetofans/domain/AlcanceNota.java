package com.projetofans.domain;

/**
 * Quem le a anotacao.
 *
 * TURMA e recado; PESSOAL e rascunho. A diferenca e de privacidade, e por isso
 * ela vive no dominio e nao numa flag de tela: o servidor nunca devolve uma
 * PESSOAL para quem nao a escreveu.
 */
public enum AlcanceNota {
    TURMA,
    PESSOAL
}
