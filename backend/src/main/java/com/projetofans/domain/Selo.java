package com.projetofans.domain;

/**
 * "Esta pessoa tem poder aqui", exibido na autoria. O selo segue o poder, nao o
 * tipo da conta (spec 2.6): conta pendente, recusada ou contestada nao tem selo.
 * Fica nulo na API quando nao ha poder, em vez de um valor NENHUM.
 */
public enum Selo {
    PROFESSOR,
    COORDENACAO
}
