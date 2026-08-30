import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthService } from './auth.service';

/**
 * `Authorization: Bearer <jwt>` em tudo, exceto `auth/*` (Secao 6 do spec) —
 * as rotas de identidade sao justamente as que rodam sem token.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();
  if (token === null || req.url.includes('/auth/')) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
