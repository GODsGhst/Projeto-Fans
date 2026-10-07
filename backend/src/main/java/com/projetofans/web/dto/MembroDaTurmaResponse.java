package com.projetofans.web.dto;

import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.Selo;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Uma pessoa da turma, como a tela "quem esta aqui" a mostra.
 *
 * Sai o NOME, nunca a entidade `Usuario` — ela carrega `senhaHash` e `email`, e
 * serializar a entidade e exatamente como esses campos vazam por acidente. O id
 * do vinculo (`membro.id`) tambem fica de fora: a tela referencia pessoas, e o
 * unico id util aqui e o do usuario.
 *
 * Os tres ultimos campos existem para o LIDER decidir se contesta um docente
 * (spec 2.4), e sao os mesmos para todo membro:
 * `selo` = o que a pessoa assina na turma (nulo/ausente sem poder: pendente,
 * recusado, contestado, aluno); `contestado` = o lider tirou o poder dela aqui;
 * `lecionadas` = as SIGLAS das materias que declarou, com ou sem poder — a
 * declaracao de um pendente tambem aparece, porque e ela que o lider confere.
 * Aluno e lider saem com `contestado=false` e `lecionadas=[]`.
 */
public record MembroDaTurmaResponse(UUID usuarioId, String nome, PapelMembro papel, Instant entrouEm,
                                    Selo selo, boolean contestado, List<String> lecionadas) {
}
