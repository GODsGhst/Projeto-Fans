import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { ehContaDocente } from '../data/docente.models';
import { AuthService } from './auth.service';

export const ROTA_HOME = '/tabs/home';
export const ROTA_PAINEL = '/tabs/painel';

/**
 * Entrada das abas: o painel para docente, a Home para aluno (spec 2.9). E um
 * `redirectTo` em funcao (roda em contexto de injecao), e nao um destino fixo.
 */
export function rotaInicial(): string {
  return ehContaDocente(inject(AuthService).usuario()) ? ROTA_PAINEL : ROTA_HOME;
}

/**
 * As telas so de aluno (Home, Meu quadro) mandam o docente para o painel.
 *
 * Nao e enfeite: login e entrar-turma terminam em `navigateByUrl('/tabs/home')`,
 * e o botao de voltar de varias telas aponta para la. Sem esta guarda o docente
 * cairia na Home do aluno logo apos entrar — a tela que o spec 2.9 diz que ele
 * nao tem — e o redirect inicial so valeria para quem reabre o app.
 */
export const soAluno: CanActivateFn = () =>
  ehContaDocente(inject(AuthService).usuario())
    ? inject(Router).parseUrl(ROTA_PAINEL)
    : true;

/** O inverso: `GET /painel` e 403 para aluno, entao a tela nem abre para ele. */
export const soDocente: CanActivateFn = () =>
  ehContaDocente(inject(AuthService).usuario())
    ? true
    : inject(Router).parseUrl(ROTA_HOME);
