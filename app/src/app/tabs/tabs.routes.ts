import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

/**
 * Home e a entrada do app, entao ela e o redirect padrao — nao o calendario.
 * Quem so quer saber "o que tem essa semana" resolve sem tocar em mais nada.
 */
export const tabsRoutes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('../features/home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'calendario',
        loadComponent: () =>
          import('../features/calendario/calendario.page').then((m) => m.CalendarioPage),
      },
      {
        path: 'materias',
        loadComponent: () =>
          import('../features/materias/materias.page').then((m) => m.MateriasPage),
      },
      {
        path: 'quadro',
        loadComponent: () =>
          import('../features/quadro/quadro.page').then((m) => m.QuadroPage),
      },
      { path: '', redirectTo: '/tabs/home', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: '/tabs/home', pathMatch: 'full' },
];
