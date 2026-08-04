import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

/**
 * Hub por disciplina. Dentro de cada materia, material de aula e material adicional
 * ficam SEPARADOS por tipo, e os eventos daquela materia aparecem junto.
 *
 * Esqueleto.
 */
@Component({
  selector: 'app-materias',
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-title>Matérias</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true"></ion-content>
  `,
})
export class MateriasPage {}
