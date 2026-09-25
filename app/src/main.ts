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
import { INTERCEPTORES } from './app/core/interceptores';
import { AuthService } from './app/core/auth.service';
import { environment } from './environments/environment';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    // A ordem mora em core/interceptores.ts, com o porque e o teste.
    provideHttpClient(withInterceptors(INTERCEPTORES)),
    // Sessao gravada sobrevive a fechar o app.
    provideAppInitializer(() => inject(AuthService).restaurar()),
    // Acorda a API enquanto a pessoa ainda digita. O free tier dorme e leva
    // 2-3 min para subir (184 s em 2026-09-25); sem isto quem paga o cold start
    // e o login, que desiste em 75 s. Sem await e fora do HttpClient: nao pode
    // atrasar a abertura nem herdar o teto de espera. Falhar aqui nao importa.
    provideAppInitializer(() => {
      fetch(`${environment.apiUrl}/saude`).catch(() => undefined);
    }),
  ],
}).catch((err) => console.error(err));
