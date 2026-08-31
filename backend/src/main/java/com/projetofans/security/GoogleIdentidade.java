package com.projetofans.security;

/**
 * O que interessa de um ID token do Google ja verificado.
 *
 * `emailVerificado` e a claim email_verified do proprio token, e nao e detalhe:
 * o AuthService usa o e-mail para decidir que dois logins sao a MESMA pessoa.
 * E-mail nao confirmado pelo Google nao pode responder essa pergunta.
 */
public record GoogleIdentidade(String sub, String email, String nome, boolean emailVerificado) {
}
