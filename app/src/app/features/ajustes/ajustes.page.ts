import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { ChaveIaService } from '../../core/chave-ia.service';

/**
 * Ajustes: hoje, só a chave da IA.
 *
 * **A chave fica no aparelho, e essa é a decisão inteira.** Ela não está dentro
 * do APK porque APK é arquivo: quem recebe extrai o conteúdo em um minuto —
 * inclusive o colega para quem o app foi mandado testar. E não fica no
 * servidor porque guardar chave de terceiro transforma este backend num alvo
 * que hoje ele não é.
 *
 * **Cada um usa a sua e paga a sua.** O resumo gerado, esse sim, fica com a
 * turma: quem tem chave gera uma vez e os trinta leem.
 *
 * **É temporário por desenho.** Quando o resumo virar recurso pago do projeto,
 * a chave passa a sair da configuração do servidor e esta tela sai junto.
 */
@Component({
  selector: 'app-ajustes',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
  ],
  styleUrls: ['../auth/auth.scss'],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/turma" />
        </ion-buttons>
        <ion-title>Ajustes</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="pf-auth">
        <div class="marca">
          <b>Chave da IA</b>
          <span>
            Serve para gerar o resumo de um material. Ela fica só neste aparelho
            — não vai para o servidor nem para dentro do app, e cada pessoa usa
            a sua.
          </span>
        </div>

        @if (salvo()) {
          <p class="alerta" role="status">Guardado neste aparelho.</p>
        }

        @if (mascarada(); as m) {
          <p class="rot-campo">chave guardada</p>
          <p class="valor-chave">{{ m }}</p>
        }

        <p class="rot-campo">
          {{ mascarada() ? 'trocar por outra' : 'cole a chave' }}
        </p>
        <input
          #chave
          class="campo--linha"
          type="password"
          name="chave"
          autocapitalize="off"
          autocomplete="off"
          spellcheck="false"
          placeholder="sk-ant-…"
          aria-label="Chave da IA"
        />

        <button
          class="botao"
          type="button"
          (click)="guardar(chave.value); chave.value = ''"
        >
          Guardar
        </button>

        @if (mascarada()) {
          <button
            class="botao botao--fantasma"
            type="button"
            (click)="guardar('')"
          >
            Apagar a chave deste aparelho
          </button>
        }

        <p class="alerta">
          O resumo que sair dela fica com a turma inteira. Quem tem chave gera
          uma vez e todo mundo lê — ninguém paga duas vezes pelo mesmo PDF.
        </p>
      </div>
    </ion-content>
  `,
  styles: `
    .valor-chave {
      font-family: var(--mono);
      font-size: 14px;
      color: var(--ink-2);
      margin: 0;
    }
  `,
})
export class AjustesPage {
  private readonly chaves = inject(ChaveIaService);

  protected readonly mascarada = signal('');
  protected readonly salvo = signal(false);

  constructor() {
    void this.atualizar();
  }

  protected async guardar(valor: string): Promise<void> {
    await this.chaves.gravar(valor);
    await this.atualizar();
    this.salvo.set(valor.trim() !== '');
  }

  private async atualizar(): Promise<void> {
    this.mascarada.set(await this.chaves.mascarada());
  }
}
