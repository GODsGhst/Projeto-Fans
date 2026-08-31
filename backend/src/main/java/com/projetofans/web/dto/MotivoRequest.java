package com.projetofans.web.dto;

/**
 * Corpo opcional das acoes de moderacao. O motivo e opcional de proposito: exigi-lo
 * faria o lider inventar texto, e motivo inventado nao informa ninguem. O que nao e
 * opcional e a linha em `acao_moderacao` — essa existe com motivo ou sem.
 */
public record MotivoRequest(String motivo) {
}
