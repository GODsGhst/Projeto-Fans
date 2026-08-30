package com.projetofans.security;

import com.projetofans.domain.PapelMembro;

import java.util.UUID;

/**
 * O unico lugar do sistema que sabe resolver a turma de um usuario.
 *
 * turma_id NUNCA e filtrado a mao num controller. Toda tarefa daqui em diante
 * passa por esta interface, e e este o arquivo que se alteraria para suportar
 * instituicoes depois — hoje ele resolve exatamente UMA turma por usuario.
 */
public interface TurmaScopeResolver {

    /** Turma do usuario autenticado. Se houver mais de um vinculo, o mais recente. */
    UUID turmaDoUsuario(UUID usuarioId);

    /** Papel do usuario na turma dele. */
    PapelMembro papelDoUsuario(UUID usuarioId);

    /** Lanca AcessoNegadoException (404) se o registro nao pertence a turma do usuario. */
    void exigirMesmaTurma(UUID usuarioId, UUID turmaIdDoRegistro);
}
