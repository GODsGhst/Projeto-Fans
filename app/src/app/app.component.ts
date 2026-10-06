import { Component, inject } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';

import { AuthService } from './core/auth.service';
import { SyncRepository } from './data/sync.repository';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
  template: `
    <ion-app>
      <ion-router-outlet></ion-router-outlet>
    </ion-app>
  `,
})
export class AppComponent {
  constructor() {
    // Volta do fundo reagenda os lembretes. Quem abre o app de manha a partir do
    // recente nao passa pela carga da Home se ela ja estava na tela, e a prova
    // que o colega cadastrou ontem a noite ficaria sem aviso ate trocar de aba.
    // So no aparelho: no navegador nao ha o que agendar, e `resume` nem existe.
    if (Capacitor.isNativePlatform()) {
      const auth = inject(AuthService);
      const sync = inject(SyncRepository);
      void App.addListener('resume', () => {
        // Sem turma o `/sync` e 404 (ou 401 sem sessao, que joga para o login
        // no meio de qualquer tela). Nao ha lembrete de turma que nao existe.
        if (auth.temTurma()) {
          void sync.reagendarAvisos();
        }
      });
    }
  }
}
