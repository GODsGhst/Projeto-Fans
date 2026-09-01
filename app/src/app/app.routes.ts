import { Routes } from '@angular/router';

import { guardaSessao } from './core/auth.guard';

/**
 * As telas de entrada ficam FORA das abas.
 *
 * Nao e estetica: quem ainda nao entrou nao tem vinculo de turma, e sem vinculo
 * o TurmaScopeResolver responde 404 em toda rota protegida. Uma barra de abas
 * ali embaixo ofereceria quatro telas que so sabem dizer que nada existe.
 *
 * `/login` e a rota que o interceptor de 401 ja tentava alcancar (ROTA_LOGIN);
 * ela nao existia, e a navegacao morria num console.error.
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'cadastro',
    loadComponent: () => import('./features/auth/cadastro.page').then((m) => m.CadastroPage),
  },
  {
    // Depois do cadastro, e nao as abas: conta nova nao tem turma.
    path: 'entrar-turma',
    loadComponent: () =>
      import('./features/auth/entrar-turma.page').then((m) => m.EntrarTurmaPage),
  },
  {
    path: 'recuperar',
    loadComponent: () => import('./features/auth/recuperar.page').then((m) => m.RecuperarPage),
  },
  {
    path: '',
    canActivate: [guardaSessao],
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.tabsRoutes),
  },
];
