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
import type {
  EstadoAviso,
  EstadoExato,
} from '../../notifications/notificacoes.service';
import { LEMBRETES_PADRAO } from '../../notifications/reagendador';
import type { PreferenciasLembrete } from '../../notifications/reagendador';

/**
 * Ajustes: os lembretes deste aparelho e a chave da IA.
 *
 * **Lembrete é preferência de quem usa, não fato da turma.** Os três
 * liga/desliga ficam no aparelho e não vão para o servidor: desligar o aviso
 * das 7h não muda nada para o colega.
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
 * **A chave é temporária por desenho.** Quando o resumo virar recurso pago do
 * projeto, ela passa a sair da configuração do servidor e a seção dela sai
 * desta tela.
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
          <ion-back-button defaultHref="/tabs/perfil" />
        </ion-buttons>
        <ion-title>Ajustes</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="pf-auth">
        <div class="marca">
          <b>Lembretes</b>
          <span>
            Avisos de cada prova e entrega da turma, agendados neste aparelho —
            chegam mesmo com o app fechado.
          </span>
        </div>

        @if (!suportado) {
          <p class="pf-aviso" role="status">
            Lembretes funcionam no app Android.
          </p>
        } @else {
          <fieldset class="lembretes">
            <legend class="rot-campo">quando avisar</legend>
            @for (o of opcoes; track o.campo) {
              <label class="opcao">
                <input
                  #caixa
                  type="checkbox"
                  [attr.data-lembrete]="o.campo"
                  [checked]="preferencias()[o.campo]"
                  (change)="mudar(o.campo, caixa.checked)"
                />
                <span>{{ o.rotulo }}</span>
              </label>
            }
          </fieldset>

          <!-- Aparece ao LIGAR "1 hora antes": e o aviso que mais perde com o
               atraso do alarme inexato, e e aqui que a pessoa esta olhando. -->
          @if (avisoExato()) {
            <p class="pf-aviso" role="status">
              Sem o alarme no horário exato, o Android pode atrasar este aviso
              em até 1 hora.
            </p>
            <button
              class="botao botao--fantasma"
              type="button"
              (click)="permitirExato()"
            >
              Permitir horário exato
            </button>
          }

          <p class="rot-campo">estado neste aparelho</p>
          <p class="pf-aviso" role="status">{{ frase() }}</p>

          <p class="rot-campo">horário exato</p>
          <p class="pf-aviso" role="status">{{ FRASES_EXATO[exato()] }}</p>
          @if (exato() === 'denied') {
            <button
              class="botao botao--fantasma"
              type="button"
              (click)="permitirExato()"
            >
              Permitir horário exato
            </button>
          }

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
    .lembretes {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin: 0;
      padding: 0;
      border: 0;
    }

    /* A linha inteira e o alvo de toque, nao so a caixinha de 16px. */
    .opcao {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 44px;
      padding: 0 2px;
      font-size: 15px;
      color: var(--ink);
      cursor: pointer;
    }

    .opcao input {
      width: 20px;
      height: 20px;
      margin: 0;
      accent-color: var(--accent);
    }

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

  protected readonly suportado = this.avisos.suportado;
  protected readonly estado = signal<EstadoAviso>('prompt');
  protected readonly frase = signal('Verificando…');
  protected readonly exato = signal<EstadoExato>('granted');
  /** Ligado ao ligar "1 hora antes" com o exato negado; some ao permitir. */
  protected readonly avisoExato = signal(false);
  protected readonly preferencias = signal<PreferenciasLembrete>(
    LEMBRETES_PADRAO,
  );
  protected readonly FRASES_EXATO = FRASES_EXATO;

  /** O rótulo diz a hora: "no dia" sozinho não conta que é às 7h. */
  protected readonly opcoes: readonly {
    campo: keyof PreferenciasLembrete;
    rotulo: string;
  }[] = [
    { campo: 'noDia', rotulo: 'No dia · 7h' },
    { campo: 'vespera', rotulo: 'Na véspera · 19h' },
    { campo: 'umaHora', rotulo: '1 hora antes · só com horário' },
  ];

  constructor() {
    void this.atualizar();
    if (this.suportado) {
      void this.lerEstado();
      void this.lerPreferencias();
    }
  }

  /** Grava e reagenda na hora — o serviço refaz a lista com a preferência nova. */
  protected async mudar(
    campo: keyof PreferenciasLembrete,
    ligado: boolean,
  ): Promise<void> {
    const novas = { ...this.preferencias(), [campo]: ligado };
    this.preferencias.set(novas);
    await this.avisos.salvarPreferencias(novas);
    if (campo === 'umaHora') {
      // So ao ligar, e relendo o sistema: a pessoa pode ter mexido na permissao
      // desde que a tela abriu. Desligar limpa o aviso — nao ha mais o que atrasar.
      this.avisoExato.set(
        ligado && (await this.avisos.estadoExato()) === 'denied',
      );
    }
  }

  protected async permitirExato(): Promise<void> {
    const r = await this.avisos.permitirExato();
    this.exato.set(r);
    this.avisoExato.set(r === 'denied' && this.avisoExato());
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
    this.exato.set(await this.avisos.estadoExato());
  }

  private async lerPreferencias(): Promise<void> {
    const c = await this.avisos.config();
    this.preferencias.set({
      noDia: c.noDia,
      vespera: c.vespera,
      umaHora: c.umaHora,
    });
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
  granted: 'Ligado. Os lembretes marcados acima chegam neste aparelho.',
  denied:
    'O Android está bloqueando os avisos deste app, e daqui não dá para pedir de novo. ' +
    'Para religar: Ajustes do celular › Apps › projetoFans › Notificações.',
  prompt:
    'O Android ainda não perguntou. Ele pergunta na primeira prova que houver para avisar — ' +
    'ou agora, se você tocar em Testar.',
  'sem-suporte': 'Lembretes funcionam no app Android.',
};

/**
 * Sem o exato o aviso ainda chega, mas o Android 12+ pode atrasá-lo em até 1
 * HORA (documentação oficial) — não "alguns minutos", como esta frase já disse.
 * Para o aviso das 7h isso é incômodo; para o de "1 hora antes" é falha. Por
 * isso a frase diz o número e a tela oferece o botão logo abaixo.
 */
const FRASES_EXATO: Record<EstadoExato, string> = {
  granted: 'Permitido: o aviso chega na hora marcada.',
  denied:
    'Sem o alarme no horário exato, o Android pode atrasar o aviso em até 1 hora.',
  'sem-suporte': 'Lembretes funcionam no app Android.',
};
