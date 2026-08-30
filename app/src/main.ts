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
import { AuthService } from './app/core/auth.service';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    // Ordem: o de auth poe o Bearer na ida; o de erro traduz o que voltar.
    provideHttpClient(withInterceptors([authInterceptor, erroHttpInterceptor])),
    // Sessao gravada sobrevive a fechar o app.
    provideAppInitializer(() => inject(AuthService).restaurar()),
  ],
}).catch((err) => console.error(err));
