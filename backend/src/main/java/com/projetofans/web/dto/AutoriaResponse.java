package com.projetofans.web.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * Toda resposta de fato compartilhado carrega isto. Sem excecao.
 *
 * Autoria e o unico mecanismo de confianca do app: nao existe registro anonimo,
 * e e por saber quem postou que a turma decide se acredita na data da prova.
 */
public record AutoriaResponse(UUID autorId, String autorNome, Instant criadoEm, Instant atualizadoEm) {
}
