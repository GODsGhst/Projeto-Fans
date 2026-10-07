package com.projetofans.web.dto;

import com.projetofans.domain.Selo;

import java.time.Instant;
import java.util.UUID;

/**
 * Toda resposta de fato compartilhado carrega isto. Sem excecao.
 *
 * Autoria e o unico mecanismo de confianca do app: nao existe registro anonimo,
 * e e por saber quem postou que a turma decide se acredita na data da prova.
 * Selo ("esta pessoa tem poder aqui") e editadoPor* seguem a spec PC7. Os tres saem do JSON
 * quando nulos (jackson.default-property-inclusion = non_null): sem poder nao ha selo, e
 * sem edicao alheia nao ha "editado por". Quem monta isto e so a Autorias.
 */
public record AutoriaResponse(UUID autorId, String autorNome, Selo autorSelo,
                              Instant criadoEm, Instant atualizadoEm,
                              String editadoPorNome, Selo editadoPorSelo) {
}
