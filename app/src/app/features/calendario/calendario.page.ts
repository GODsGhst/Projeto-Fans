import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

/**
 * Consulta, nao entrada. Quem so quer saber "o que tem essa semana" resolve na Home.
 * Mesma linguagem visual: cor identifica a materia, forma identifica o tipo.
 *
 * Esqueleto.
 */
@Component({
  selector: 'app-calendario',
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-title>Calendário</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true"></ion-content>
  `,
})
export class CalendarioPage {}
