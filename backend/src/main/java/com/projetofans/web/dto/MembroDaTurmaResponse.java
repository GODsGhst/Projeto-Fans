package com.projetofans.web.dto;

import com.projetofans.domain.PapelMembro;

import java.time.Instant;
import java.util.UUID;

/**
 * Uma pessoa da turma, como a tela "quem esta aqui" a mostra.
 *
 * Sai o NOME, nunca a entidade `Usuario` — ela carrega `senhaHash` e `email`, e
 * serializar a entidade e exatamente como esses campos vazam por acidente. O id
 * do vinculo (`membro.id`) tambem fica de fora: a tela referencia pessoas, e o
 * unico id util aqui e o do usuario.
 */
public record MembroDaTurmaResponse(UUID usuarioId, String nome, PapelMembro papel, Instant entrouEm) {
}
