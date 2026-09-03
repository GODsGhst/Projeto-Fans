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
          import('../features/calendario/calendario.page').then(
            (m) => m.CalendarioPage,
          ),
      },
      {
        path: 'materias',
        loadComponent: () =>
          import('../features/materias/materias.page').then(
            (m) => m.MateriasPage,
          ),
      },
      // ANTES de 'materias/:id' de proposito. O Angular casa na ordem: se esta
      // rota viesse depois, /tabs/materias/nova abriria a tela de uma materia
      // com id="nova" e o app pediria ao servidor uma materia que nao existe.
      {
        path: 'materias/nova',
        loadComponent: () =>
          import('../features/materias/nova-materia.page').then(
            (m) => m.NovaMateriaPage,
          ),
      },
      // Antes de 'materias/:id' pelo mesmo motivo das outras: o Angular casa na
      // primeira que serve, e um caminho de 3 segmentos nao colide com um de 2 —
      // mas manter a regra visivel evita alguem reordenar sem perceber.
      {
        path: 'materiais/:id/editar',
        loadComponent: () =>
          import('../features/materias/editar-material.page').then(
            (m) => m.EditarMaterialPage,
          ),
      },
      {
        path: 'materias/:id/material/novo',
        loadComponent: () =>
          import('../features/materias/novo-material.page').then(
            (m) => m.NovoMaterialPage,
          ),
      },
      {
        path: 'materias/:id',
        loadComponent: () =>
          import('../features/materias/materia.page').then(
            (m) => m.MateriaPage,
          ),
      },
      // A tela de um evento vive dentro das abas de proposito: sair do app para
      // ver uma prova, e voltar sem contexto, seria pior que o custo de manter
      // a barra visivel.
      // Mesma armadilha da rota acima: 'novo' antes de ':id'.
      {
        path: 'eventos/novo',
        loadComponent: () =>
          import('../features/evento/novo-evento.page').then(
            (m) => m.NovoEventoPage,
          ),
      },
      // Mesma pagina de adicionar: o `id` na rota liga o modo de edicao.
      {
        path: 'eventos/:id/editar',
        loadComponent: () =>
          import('../features/evento/novo-evento.page').then(
            (m) => m.NovoEventoPage,
          ),
      },
      {
        path: 'eventos/:id/anexar',
        loadComponent: () =>
          import('../features/evento/anexar-material.page').then(
            (m) => m.AnexarMaterialPage,
          ),
      },
      {
        path: 'eventos/:id',
        loadComponent: () =>
          import('../features/evento/evento.page').then((m) => m.EventoPage),
      },
      {
        path: 'quadro',
        loadComponent: () =>
          import('../features/quadro/quadro.page').then((m) => m.QuadroPage),
      },
      {
        path: 'turma/editar',
        loadComponent: () =>
          import('../features/turma/editar-turma.page').then(
            (m) => m.EditarTurmaPage,
          ),
      },
      {
        path: 'turma/transferir',
        loadComponent: () =>
          import('../features/turma/transferir.page').then(
            (m) => m.TransferirPage,
          ),
      },
      {
        path: 'turma',
        loadComponent: () =>
          import('../features/turma/turma.page').then((m) => m.TurmaPage),
      },
      { path: '', redirectTo: '/tabs/home', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: '/tabs/home', pathMatch: 'full' },
];
