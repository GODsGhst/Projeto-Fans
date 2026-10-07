package com.projetofans.web.dto;

import com.projetofans.security.PoderNaTurma;

import java.util.List;
import java.util.UUID;

/**
 * A turma do usuario, com quem esta nela e o codigo de convite.
 *
 * Responde de uma vez as tres perguntas da tela de turma. O codigo vem junto de
 * proposito: antes disto ele so existia na resposta de POST /turmas, entao quem
 * fechava o app na tela de criacao nunca mais o via — e turma sem codigo
 * divulgavel nao recebe ninguem.
 *
 * `meuAlcance` e o poder DOCENTE de quem pergunta nesta turma (spec 7): TURMA para
 * a coordenacao com poder, MATERIAS (com os ids) para o professor com poder, e
 * NENHUM para todo o resto — inclusive o LIDER, que modera pelo papel e nao pelo
 * alcance. O app usa isto para decidir que botoes mostrar; o servidor reconfere.
 */
public record MinhaTurmaResponse(
        UUID id,
        String nome,
        String semestre,
        String codigoConvite,
        List<MembroDaTurmaResponse> membros,
        PoderNaTurma.Alcance meuAlcance) {
}
