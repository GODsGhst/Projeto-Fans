package com.projetofans.web.dto;

import java.util.UUID;

/**
 * Resposta de login, cadastro e Google.
 *
 * `turmaId` e NULO para quem ainda nao entrou em turma nenhuma, e isso nao e
 * caso de erro: e o estado normal de quem acabou de se cadastrar.
 *
 * Ele existe porque o app precisa saber a diferenca ANTES de abrir as abas. Sem
 * este campo, o unico jeito de descobrir era chamar uma rota protegida e ler o
 * 404 do TurmaScopeResolver — e o app que fizesse isso mostraria quatro telas de
 * erro a quem so nao entrou na turma ainda. Pior: quem fechasse o app entre o
 * cadastro e a entrada na turma voltaria com sessao valida, cairia nas abas, e
 * veria 404 em tudo sem saber por que nem como sair.
 */
public record AuthResponse(String jwt, UsuarioDto usuario, UUID turmaId) {
}
