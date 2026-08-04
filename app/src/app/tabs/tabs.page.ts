import { Component } from '@angular/core';
import {
  IonIcon,
  IonLabel,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendarOutline, checkboxOutline, libraryOutline, listOutline } from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="home" href="/tabs/home">
          <ion-icon aria-hidden="true" name="list-outline"></ion-icon>
          <ion-label>Home</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="calendario" href="/tabs/calendario">
          <ion-icon aria-hidden="true" name="calendar-outline"></ion-icon>
          <ion-label>Calendário</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="materias" href="/tabs/materias">
          <ion-icon aria-hidden="true" name="library-outline"></ion-icon>
          <ion-label>Matérias</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="quadro" href="/tabs/quadro">
          <ion-icon aria-hidden="true" name="checkbox-outline"></ion-icon>
          <ion-label>Meu quadro</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class TabsPage {
  constructor() {
    addIcons({ listOutline, calendarOutline, libraryOutline, checkboxOutline });
  }
}
