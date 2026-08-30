package com.projetofans.security;

import java.util.UUID;

/**
 * O principal autenticado, injetado nos controllers via @AuthenticationPrincipal.
 *
 * Carrega o minimo: id e nome. Nao carrega turma nem papel de proposito — quem
 * responde isso e o TurmaScopeResolver, consultando o banco. Colocar turma dentro
 * do JWT faria um aluno que troca de turma continuar vendo a antiga ate o token
 * expirar, e o token vale 30 dias.
 */
public record UsuarioAtual(UUID usuarioId, String nome) {
}
