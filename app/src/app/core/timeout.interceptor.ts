import { HttpInterceptorFn } from '@angular/common/http';
import { timeout } from 'rxjs';

/**
 * Teto de espera de toda chamada. Sem ele, uma requisição que nunca responde
 * deixa a tela presa para sempre — foi exatamente o que aconteceu em
 * 2026-09-01: o botão de criar conta ficou em "Criando…" indefinidamente, e do
 * lado de quem usa isso é indistinguível de app travado.
 *
 * 75 segundos, e o número tem motivo: o plano gratuito do Render dorme depois de
 * 15 minutos parado, e a primeira chamada depois disso paga o cold start. Medido
 * neste projeto, `GET /saude` levou **45,6 s** para responder num servidor
 * dormindo. Um teto de 30 s — que seria o palpite natural — abortaria requisição
 * legítima e ensinaria a pessoa que o app não funciona.
 *
 * O erro que ele produz é traduzido pelo `erroHttpInterceptor` em mensagem que
 * diz o que aconteceu. Um timeout mudo seria só outra forma de travar.
 */
export const TETO_DE_ESPERA_MS = 75_000;

export const timeoutInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(timeout(TETO_DE_ESPERA_MS));
