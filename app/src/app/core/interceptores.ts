import { authInterceptor } from './auth.interceptor';
import { erroHttpInterceptor } from './http-error.interceptor';
import { timeoutInterceptor } from './timeout.interceptor';
import { turmaAtivaInterceptor } from './turma-ativa.interceptor';

/**
 * A ordem e comportamento, e o Angular a le ao contrario do que parece: o
 * PRIMEIRO da lista e o mais EXTERNO — ve a requisicao primeiro e a resposta
 * por ultimo. Para o tradutor de erro enxergar o TimeoutError, ele tem de
 * EMBRULHAR o timeout, ou seja, vir antes dele.
 *
 * Ate 2026-09-25 estava [auth, timeout, erro], com um comentario jurando o
 * oposto: o TimeoutError nascia por fora do tradutor e escapava cru, e quem
 * esperou os 75 s de cold start nunca via "O servidor demorou demais".
 *
 * Mora num arquivo proprio para o teste usar ESTA lista, e nao uma copia.
 */
export const INTERCEPTORES = [
  authInterceptor,
  turmaAtivaInterceptor,
  erroHttpInterceptor,
  timeoutInterceptor,
];
