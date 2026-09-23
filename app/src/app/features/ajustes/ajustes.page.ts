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
import { NotificacoesService } from '../../notifications/notificacoes.service';
import type { EstadoAviso } from '../../notifications/notificacoes.service';

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
          <b>Avisos da véspera</b>
          <span>
            Um aviso às 19h do dia anterior a cada prova e entrega. Ele é
            agendado neste aparelho, então chega mesmo com o app fechado.
          </span>
        </div>

        <p class="rot-campo">estado neste aparelho</p>
        <p class="pf-aviso" role="status">{{ frase() }}</p>

        @if (estado() !== 'sem-suporte') {
          <button class="botao botao--fantasma" type="button" (click)="testar()">
            Testar agora
          </button>
        }

        <hr class="separa" />

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
    .separa {
      margin: 22px 0 4px;
      border: 0;
      border-top: 1px solid var(--rule-soft);
    }

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
  private readonly avisos = inject(NotificacoesService);

  protected readonly mascarada = signal('');
  protected readonly salvo = signal(false);
  protected readonly estado = signal<EstadoAviso>('prompt');
  protected readonly frase = signal('Verificando…');

  constructor() {
    void this.atualizar();
    void this.lerEstado();
  }

  /**
   * Dispara o teste e escreve o que aconteceu.
   *
   * `negado` nao e erro: e o unico estado que a pessoa consegue consertar
   * sozinha, e a frase tem de dizer ONDE. No Android o app ja gastou a unica
   * pergunta que tinha — insistir daqui nao abre caixa nenhuma.
   */
  protected async testar(): Promise<void> {
    this.frase.set('Agendando…');
    const r = await this.avisos.testar();
    if (r === 'agendado') {
      this.frase.set('Agendado. O aviso deve aparecer em uns 10 segundos — pode sair desta tela.');
      return;
    }
    await this.lerEstado();
  }

  private async lerEstado(): Promise<void> {
    const e = await this.avisos.estado();
    this.estado.set(e);
    this.frase.set(FRASES[e]);
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

/**
 * Uma frase por estado, e cada uma diz o que fazer a seguir.
 *
 * `denied` e a que justifica a tela existir: no Android a recusa e definitiva,
 * o servico volta em silencio, e sem isto o app inteiro nao tinha um so lugar
 * que contasse que os avisos estavam desligados.
 */
const FRASES: Record<EstadoAviso, string> = {
  granted: 'Ligado. Você recebe o aviso às 19h da véspera.',
  denied:
    'O Android está bloqueando os avisos deste app, e daqui não dá para pedir de novo. ' +
    'Para religar: Ajustes do celular › Apps › projetoFans › Notificações.',
  prompt:
    'O Android ainda não perguntou. Ele pergunta na primeira prova que houver para avisar — ' +
    'ou agora, se você tocar em Testar.',
  'sem-suporte':
    'Avisos só existem no app instalado no celular. No navegador não há o que agendar.',
};
