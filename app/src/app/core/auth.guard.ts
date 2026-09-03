import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { AuthService, ROTA_LOGIN } from './auth.service';

/** Onde para quem tem sessao e ainda nao pertence a turma nenhuma. */
export const ROTA_ENTRAR_TURMA = '/entrar-turma';

/**
 * Duas perguntas, nao uma: tem sessao? tem turma?
 *
 * Olhar so o token abre um beco sem saida permanente. Quem se cadastra ganha
 * token ANTES de entrar em turma — o `registrar()` ja grava a sessao em disco — e
 * se fechar o app entre o cadastro e a entrada na turma, volta autenticado e sem
 * vinculo. Uma guarda que so checasse `autenticado()` liberaria as abas, e toda
 * rota protegida responderia 404 pelo TurmaScopeResolver. Sem botao de sair e sem
 * link para a tela de turma, a unica saida era reinstalar o app.
 *
 * O `restaurar()` e a defesa contra a falha oposta, que tambem e real: ele le
 * disco e roda no `provideAppInitializer`, entao existe um instante em que a
 * sessao gravada ainda nao chegou aos signals. Guarda que decidisse nesse instante
 * expulsaria para /login quem tem sessao valida, e reabrir o app viraria um login.
 * `restaurar()` e idempotente, entao chamar de novo custa uma leitura e fecha a
 * corrida.
 */
export const guardaSessao: CanActivateFn = async (): Promise<
  boolean | UrlTree
> => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.autenticado()) {
    await auth.restaurar();
  }
  if (!auth.autenticado()) {
    return router.parseUrl(ROTA_LOGIN);
  }
  return auth.temTurma() ? true : router.parseUrl(ROTA_ENTRAR_TURMA);
};
