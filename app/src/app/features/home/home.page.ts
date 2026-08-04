import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

/**
 * Entrada do app. Responde uma pergunta so: o que vem ai?
 *
 * Proximos 14 dias, teto de 6 itens, ordenado por urgencia — e as tres coisas sao
 * calculadas NO SERVIDOR, em HomeService. Esta pagina renderiza na ordem que veio e
 * nao reordena, nao filtra e nao corta.
 *
 * Esqueleto. O conteudo entra quando os componentes de app/shared/ chegarem.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-title>Esta semana</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true"></ion-content>
  `,
})
export class HomePage {}
