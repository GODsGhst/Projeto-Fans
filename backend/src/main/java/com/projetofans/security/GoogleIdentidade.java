package com.projetofans.security;

/** O que interessa de um ID token do Google ja verificado. */
public record GoogleIdentidade(String sub, String email, String nome) {
}
