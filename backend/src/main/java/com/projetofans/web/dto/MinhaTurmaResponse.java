package com.projetofans.web.dto;

import java.util.List;
import java.util.UUID;

/**
 * A turma do usuario, com quem esta nela e o codigo de convite.
 *
 * Responde de uma vez as tres perguntas da tela de turma. O codigo vem junto de
 * proposito: antes disto ele so existia na resposta de POST /turmas, entao quem
 * fechava o app na tela de criacao nunca mais o via — e turma sem codigo
 * divulgavel nao recebe ninguem.
 */
public record MinhaTurmaResponse(
        UUID id,
        String nome,
        String semestre,
        String codigoConvite,
        List<MembroDaTurmaResponse> membros) {
}
