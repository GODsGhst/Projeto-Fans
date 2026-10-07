import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';

import { environment } from '../../environments/environment';
import { ehContaDocente } from '../data/docente.models';
import { AuthService } from './auth.service';
import { TurmaAtivaService } from './turma-ativa.service';

/**
 * O servidor tem de listar `X-Turma-Id` em `allowedHeaders` (CORS), ou toda
 * requisicao do docente no site morre no preflight (spec 4).
 */
export const CABECALHO_TURMA = 'X-Turma-Id';

/**
 * `X-Turma-Id: <turma ativa>` — SO para conta docente e SO para a nossa API
 * (spec 2.8 e 8).
 *
 * O aluno nunca manda: tem uma turma so, e o servidor a acha pelo vinculo. Mandar
 * para ele nao mudaria nada e quebraria a promessa de que o app do aluno nao muda.
 * Para fora da API (qualquer outro host) o cabecalho vazaria o id de uma turma
 * para um terceiro, e ainda forcaria um preflight que o terceiro nao espera.
 *
 * A requisicao espera a leitura do disco (`pronto`) so para docente: sem isso, as
 * primeiras chamadas do app saem antes do cabecalho existir, e o servidor
 * responderia pela turma "mais recente" — dado de OUTRA turma, sem erro nenhum.
 * Fica fora do `timeoutInterceptor` na lista, entao a espera nao gasta o teto da rede.
 */
export const turmaAtivaInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const turmaAtiva = inject(TurmaAtivaService);
  if (!ehContaDocente(auth.usuario()) || !req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }
  return from(turmaAtiva.pronto).pipe(
    switchMap(() => {
      const turmaId = turmaAtiva.turmaId();
      return next(
        turmaId === null
          ? req
          : req.clone({ setHeaders: { [CABECALHO_TURMA]: turmaId } }),
      );
    }),
  );
};
