import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { TimeoutError, catchError, throwError } from 'rxjs';

import { ROTA_ENTRAR_TURMA } from './auth.guard';
import { ROTA_LOGIN, AuthService } from './auth.service';

export type ClasseErro =
  | 'DEMOROU'
  | 'AUTH'
  | 'PROIBIDO'
  | 'NAO_ENCONTRADO'
  | 'PRECONDICAO'
  | 'CONFLITO'
  | 'SERVIDOR'
  | 'OFFLINE'
  | 'DESCONHECIDO';

/**
 * O 404 de quem nao tem vinculo com turma nenhuma (o lider o removeu). E o unico
 * 404 que o servidor marca com `codigo`; ver `SemTurmaException` no backend.
 */
export const CODIGO_SEM_TURMA = 'SEM_TURMA';

/**
 * Erro de dominio do app. Toda falha de HTTP vira um destes, com uma mensagem
 * ja pronta para a tela — nenhuma tela le `status` cru.
 */
export class ErroApi extends Error {
  constructor(
    readonly classe: ClasseErro,
    readonly status: number,
    mensagem: string,
    /** 5xx e queda de rede valem um botao de "tentar novamente". */
    readonly podeTentarNovamente = false,
    /** 409: alguem editou; a tela tem de reler o registro antes de insistir. */
    readonly recarregarRegistro = false,
    /**
     * Codigo estavel que o servidor manda em `ProblemDetail.codigo`, para os casos
     * em que o status sozinho e ambiguo. Quem decide algo destrutivo olha ESTE
     * campo, nunca `status === 404`: um 404 de proxy, do Render acordando ou de
     * portal cativo tem o mesmo status e nao quer dizer "voce saiu da turma".
     */
    readonly codigo: string | null = null,
  ) {
    super(mensagem);
    this.name = 'ErroApi';
  }
}

/**
 * Interceptor central de erro (Secao 10 do spec). Trata TODOS os status.
 *
 * Ele nunca engole: sempre relanca. Um `catch` que devolvesse lista vazia como
 * sucesso transformaria "falhei ao buscar as provas" em "nao ha provas".
 */
export const erroHttpInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((resposta: unknown) => {
      // O teto de espera do timeoutInterceptor chega aqui como TimeoutError, nao
      // como HttpErrorResponse. Sem este ramo ele cairia no `traduzir` como
      // status undefined e viraria "Nao deu para completar a acao" — mudo sobre a
      // unica coisa que a pessoa precisa saber, que e que vale tentar de novo.
      if (resposta instanceof TimeoutError) {
        return throwError(
          () =>
            new ErroApi(
              'DEMOROU',
              0,
              'O servidor demorou demais para responder. Tente de novo.',
              true,
            ),
        );
      }
      if (!(resposta instanceof HttpErrorResponse)) {
        return throwError(() => resposta);
      }
      if (resposta.status === 401) {
        auth.encerrarSessao();
        router
          .navigateByUrl(ROTA_LOGIN)
          .catch((e: unknown) =>
            console.error('[http] falha ao voltar para o login', e),
          );
      }
      const erro = traduzir(resposta);
      if (erro.codigo === CODIGO_SEM_TURMA) {
        ficouSemTurma(auth, router);
      }
      return throwError(() => erro);
    }),
  );
};

/**
 * Esquece a turma e leva a pessoa para onde se entra numa; vale para QUALQUER
 * rota que responda SEM_TURMA, e e por isso que mora aqui e nao em cada
 * repositorio. Antes so `GET /turmas/minha` fazia isto, e quem foi removido e
 * abria so a Home seguia com os lembretes e o snapshot da turma antiga.
 *
 * Sem `await`, como o 401: o erro sobe agora, o disco vai atras. `registrarTurma`
 * zera o vinculo em memoria ANTES do primeiro await, entao a guarda ja enxerga a
 * pessoa sem turma quando a navegacao comeca. O repositorio da turma se limpa
 * sozinho quando o vinculo some (ver o `effect` dele).
 *
 * A navegacao e explicita porque a guarda so roda quando a rota ativa: quem ja
 * esta dentro das abas nao passa por ela, e ficaria olhando uma tela de erro.
 * Falhar ao gravar em disco nao pode impedir a saida: em memoria a sessao ja esta
 * sem turma, e preso aqui a pessoa nao sai.
 */
function ficouSemTurma(auth: AuthService, router: Router): void {
  auth
    .registrarTurma(null)
    .catch((e: unknown) =>
      console.error('[http] falha ao gravar a sessao sem turma', e),
    );
  router
    .navigateByUrl(ROTA_ENTRAR_TURMA)
    .catch((e: unknown) =>
      console.error('[http] falha ao ir para a tela de entrar na turma', e),
    );
}

function traduzir(r: HttpErrorResponse): ErroApi {
  const doServidor = detalhe(r);

  // Status 0 e o que o navegador reporta quando a requisicao nem chegou a sair.
  if (r.status === 0) {
    return new ErroApi('OFFLINE', 0, 'Sem conexão.', true);
  }
  if (r.status === 401) {
    return new ErroApi(
      'AUTH',
      401,
      doServidor ?? 'Sua sessão expirou. Entre de novo.',
    );
  }
  if (r.status === 403) {
    return new ErroApi(
      'PROIBIDO',
      403,
      doServidor ?? 'Só quem criou pode editar.',
    );
  }
  if (r.status === 404) {
    return new ErroApi(
      'NAO_ENCONTRADO',
      404,
      doServidor ?? 'Isso não existe mais.',
      false,
      false,
      codigoDoServidor(r),
    );
  }
  if (r.status === 409) {
    return new ErroApi(
      'CONFLITO',
      409,
      doServidor ?? 'Alguém editou isso enquanto você editava.',
      false,
      true,
    );
  }
  if (r.status === 428) {
    return new ErroApi(
      'PRECONDICAO',
      428,
      doServidor ?? 'Recarregue o registro e tente de novo.',
    );
  }
  if (r.status >= 500) {
    return new ErroApi(
      'SERVIDOR',
      r.status,
      'Deu problema no servidor. Tente de novo.',
      true,
    );
  }
  return new ErroApi(
    'DESCONHECIDO',
    r.status,
    doServidor ?? 'Não deu para completar a ação.',
  );
}

/** `ProblemDetail.codigo`, quando o servidor o manda. Corpo que nao e JSON (HTML de proxy) nao tem. */
function codigoDoServidor(r: HttpErrorResponse): string | null {
  const corpo = r.error as { codigo?: unknown } | null;
  return typeof corpo?.codigo === 'string' ? corpo.codigo : null;
}

/** O backend responde `ProblemDetail` (RFC 7807): `detail` primeiro, `title` depois. */
function detalhe(r: HttpErrorResponse): string | null {
  const corpo = r.error as { detail?: string; title?: string } | null;
  return corpo?.detail ?? corpo?.title ?? null;
}
