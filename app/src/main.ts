import { bootstrapApplication } from '@angular/platform-browser';
import {
  PreloadAllModules,
  RouteReuseStrategy,
  provideRouter,
  withPreloading,
} from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { inject, provideAppInitializer } from '@angular/core';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/core/auth.interceptor';
import { erroHttpInterceptor } from './app/core/http-error.interceptor';
import { timeoutInterceptor } from './app/core/timeout.interceptor';
import { AuthService } from './app/core/auth.service';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    // Ordem importa: auth poe o Bearer na ida; timeout limita a espera; erro
    // traduz o que voltar. O timeout vem ANTES do de erro na lista para que o
    // TimeoutError que ele produz passe pelo tradutor, e nao escape cru.
    provideHttpClient(
      withInterceptors([authInterceptor, timeoutInterceptor, erroHttpInterceptor]),
    ),
    // Sessao gravada sobrevive a fechar o app.
    provideAppInitializer(() => inject(AuthService).restaurar()),
  ],
}).catch((err) => console.error(err));
