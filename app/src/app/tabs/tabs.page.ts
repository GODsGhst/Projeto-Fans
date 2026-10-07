import { Component, computed, inject, signal } from '@angular/core';
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
  gridOutline,
  libraryOutline,
  listOutline,
  peopleOutline,
} from 'ionicons/icons';

import { AuthService } from '../core/auth.service';
import { ehContaDocente } from '../data/docente.models';

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

        <!-- A interface sai do TIPO da conta, nao do status (spec 2.9): o docente
             pendente tambem ve estas abas. So a primeira e a penultima mudam;
             Calendario e Materias sao as mesmas telas para os dois. -->
        @if (ehDocente()) {
          <ion-tab-button tab="painel" href="/tabs/painel" title="Painel">
            <ion-icon aria-hidden="true" name="grid-outline"></ion-icon>
            <ion-label>Painel</ion-label>
          </ion-tab-button>
        } @else {
          <ion-tab-button tab="home" href="/tabs/home" title="Home">
            <ion-icon aria-hidden="true" name="list-outline"></ion-icon>
            <ion-label>Home</ion-label>
          </ion-tab-button>
        }

        <ion-tab-button tab="calendario" href="/tabs/calendario" title="Calendário">
          <ion-icon aria-hidden="true" name="calendar-outline"></ion-icon>
          <ion-label>Calendário</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="materias" href="/tabs/materias" title="Matérias">
          <ion-icon aria-hidden="true" name="library-outline"></ion-icon>
          <ion-label>Matérias</ion-label>
        </ion-tab-button>

        <!-- Sem Meu quadro para o docente: kanban de "feito" e coisa de quem tem
             prova para fazer. No lugar, a turma (membros, matérias declaradas). -->
        @if (ehDocente()) {
          <ion-tab-button tab="turma" href="/tabs/turma" title="Turma">
            <ion-icon aria-hidden="true" name="people-outline"></ion-icon>
            <ion-label>Turma</ion-label>
          </ion-tab-button>
        } @else {
          <ion-tab-button tab="quadro" href="/tabs/quadro" title="Meu quadro">
            <ion-icon aria-hidden="true" name="checkbox-outline"></ion-icon>
            <ion-label>Meu quadro</ion-label>
          </ion-tab-button>
        }

        <!-- Por ultimo de proposito: no PC o global.scss o empurra para o rodape
             do menu, como a conta no Google e no Claude. No celular e a quinta
             aba, so com "Perfil" — nome e e-mail nao cabem em 1/5 da tela. -->
        <ion-tab-button
          class="pf-aba-perfil"
          tab="perfil"
          href="/tabs/perfil"
          title="Perfil"
        >
          <span class="pf-avatar" aria-hidden="true">{{ inicial() }}</span>
          <ion-label>
            <span class="pf-perfil-curto">Perfil</span>
            <span class="pf-perfil-nome">{{ usuario()?.nome }}</span>
            <span class="pf-perfil-email">{{ usuario()?.email }}</span>
          </ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class TabsPage {
  protected readonly recolhido = signal(lerRecolhido());

  /** Da sessao, e nao de `GET /eu`: renomear troca a sessao e o menu acompanha. */
  protected readonly usuario = inject(AuthService).usuario;
  // ponytail: trocar por `auth.ehDocente()` quando o AuthService o expuser.
  protected readonly ehDocente = computed(() => ehContaDocente(this.usuario()));
  // Espalhar quebra por code point, nao por unidade UTF-16: `trim()[0]` de um
  // nome que comeca com emoji pegava meia surrogate e o avatar mostrava lixo.
  protected readonly inicial = computed(() =>
    ([...(this.usuario()?.nome ?? '').trim()][0] ?? '?').toUpperCase(),
  );

  constructor() {
    addIcons({
      listOutline,
      calendarOutline,
      libraryOutline,
      checkboxOutline,
      chevronBackOutline,
      chevronForwardOutline,
      gridOutline,
      peopleOutline,
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
