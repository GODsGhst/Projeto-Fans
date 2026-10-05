import { Component, signal } from '@angular/core';
import {
  IonIcon,
  IonLabel,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  calendarOutline,
  checkboxOutline,
  chevronBackOutline,
  chevronForwardOutline,
  libraryOutline,
  listOutline,
} from 'ionicons/icons';

/** Preferencia de quem esta neste navegador, nao dado da turma. */
const CHAVE_RECOLHIDO = 'pf.menuRecolhido';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  template: `
    <ion-tabs class="pf-abas" [class.pf-abas--recolhida]="recolhido()">
      <ion-tab-bar slot="bottom">
        <!-- So aparece no PC (global.scss). No celular a barra fica embaixo e
             nao ha o que recolher. -->
        <button
          class="pf-recolher"
          type="button"
          [attr.aria-expanded]="!recolhido()"
          [attr.aria-label]="recolhido() ? 'Expandir menu' : 'Recolher menu'"
          [title]="recolhido() ? 'Expandir menu' : 'Recolher menu'"
          (click)="alternar()"
        >
          <ion-icon
            aria-hidden="true"
            [name]="recolhido() ? 'chevron-forward-outline' : 'chevron-back-outline'"
          ></ion-icon>
        </button>

        <ion-tab-button tab="home" href="/tabs/home" title="Home">
          <ion-icon aria-hidden="true" name="list-outline"></ion-icon>
          <ion-label>Home</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="calendario" href="/tabs/calendario" title="Calendário">
          <ion-icon aria-hidden="true" name="calendar-outline"></ion-icon>
          <ion-label>Calendário</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="materias" href="/tabs/materias" title="Matérias">
          <ion-icon aria-hidden="true" name="library-outline"></ion-icon>
          <ion-label>Matérias</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="quadro" href="/tabs/quadro" title="Meu quadro">
          <ion-icon aria-hidden="true" name="checkbox-outline"></ion-icon>
          <ion-label>Meu quadro</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class TabsPage {
  protected readonly recolhido = signal(lerRecolhido());

  constructor() {
    addIcons({
      listOutline,
      calendarOutline,
      libraryOutline,
      checkboxOutline,
      chevronBackOutline,
      chevronForwardOutline,
    });
  }

  protected alternar(): void {
    const novo = !this.recolhido();
    this.recolhido.set(novo);
    try {
      localStorage.setItem(CHAVE_RECOLHIDO, novo ? '1' : '0');
    } catch {
      // Janela anonima ou storage bloqueado: o menu so nao lembra da escolha.
    }
  }
}

function lerRecolhido(): boolean {
  try {
    return localStorage.getItem(CHAVE_RECOLHIDO) === '1';
  } catch {
    return false;
  }
}
