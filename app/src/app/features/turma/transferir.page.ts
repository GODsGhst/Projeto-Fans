import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { AuthService } from '../../core/auth.service';
import { ModeracaoRepository } from '../../data/moderacao.repository';
import { TurmaRepository } from '../../data/turma.repository';
import { mensagemDeErro } from '../auth/erro';

/**
 * Passar a liderança para outra pessoa da turma.
 *
 * `POST /turmas/lideranca/transferir` existia no servidor desde sempre, e o
 * domínio até guarda a ação (`AcaoModeracaoTipo.TRANSFERIR_LIDERANCA`) — não
 * havia tela. Duas telas do app prometem que o líder "transfere a liderança", e
 * a promessa não tinha porta.
 *
 * **Três decisões que o desenho fixa:**
 *
 * A turma nunca fica sem líder nem com dois. A troca é uma operação só no
 * servidor, e quem recebe já é membro — não há como passar para alguém de fora
 * nem deixar o cargo vago.
 *
 * Quem passa perde o cargo na hora, e a tela diz isso ANTES de confirmar. É
 * irreversível sem a colaboração de quem recebeu; esconder isso no meio de uma
 * frase seria empurrar alguém para uma porta que só abre de um lado.
 *
 * A autoria dos registros não muda. Liderança é sobre moderar, nunca sobre
 * posse — o que você cadastrou continua seu depois de passar o cargo.
 */
@Component({
  selector: 'app-transferir',
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
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/turma" />
        </ion-buttons>
        <ion-title>Passar a liderança</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="pf-pilha">
        @if (carregando()) {
          <p class="pf-aviso">Carregando…</p>
        } @else if (erro(); as e) {
          <p class="pf-erro" role="alert">{{ e }}</p>
        }

        @if (!souLider() && !carregando() && turma() !== null) {
          <div class="pf-vazio">
            <b>Isto é só o líder que faz.</b>
            <span>
              Quem passa a liderança é quem a tem. Se precisar do cargo, peça a
              quem está com ele — a troca é de uma pessoa para outra, sempre.
            </span>
          </div>
        }

        @if (souLider()) {
          @if (escolhido(); as pessoa) {
            <div class="alerta" role="status">
              <b>Passar a liderança para {{ pessoa.nome }}?</b>
              <span>
                {{ pessoa.nome }} passa a poder ocultar registro impróprio e a
                passar a liderança adiante.
                <b>Você deixa de ser líder na hora</b> — para voltar, só se
                {{ pessoa.nome }} devolver.
              </span>
            </div>

            <button
              class="botao"
              type="button"
              [disabled]="enviando()"
              (click)="confirmar()"
            >
              {{ enviando() ? 'Passando…' : 'Passar a liderança' }}
            </button>
            <button
              class="botao botao--fantasma"
              type="button"
              (click)="escolhidoId.set(null)"
            >
              Escolher outra pessoa
            </button>
          } @else {
            <p class="pf-rotulo">para quem</p>
            @for (m of candidatos(); track m.usuarioId) {
              <button
                class="candidato"
                type="button"
                (click)="escolhidoId.set(m.usuarioId)"
              >
                <span class="inicial">{{ m.inicial }}</span>
                <span class="quem">
                  <span class="nome">{{ m.nome }}</span>
                  <span class="desde">{{ m.desde }}</span>
                </span>
                <span class="seta">passar &rarr;</span>
              </button>
            }

            @if (candidatos().length === 0) {
              <div class="pf-vazio">
                <b>Não há para quem passar.</b>
                <span>
                  Você é a única pessoa na turma. Quando alguém entrar com o
                  código, o nome aparece aqui.
                </span>
              </div>
            }

            <p class="pf-cache-aviso">
              A autoria não muda de dono junto com o cargo: tudo o que você
              cadastrou continua seu depois de passar a liderança.
            </p>
          }
        }
      </div>
    </ion-content>
  `,
  styles: `
    .candidato {
      display: flex;
      align-items: center;
      gap: 11px;
      width: 100%;
      text-align: left;
      font: inherit;
      cursor: pointer;
      padding: 11px 13px;
      border-radius: var(--r-md);
      background: var(--surface);
      border: 1px solid var(--rule);
      box-shadow: var(--e1);
      color: var(--ink);
      transition: transform var(--dur-toque) var(--mola);
      -webkit-tap-highlight-color: transparent;
    }
    .candidato:active {
      transform: scale(var(--press));
    }
    .candidato:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .candidato .inicial {
      flex: 0 0 auto;
      width: 34px;
      height: 34px;
      border-radius: var(--r-pill);
      display: grid;
      place-items: center;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 14px;
      font-weight: 700;
    }
    .candidato .quem {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      flex: 1;
    }
    .candidato .nome {
      font-size: 14.5px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .candidato .desde {
      font-size: 11.5px;
      color: var(--ink-3);
    }
    .candidato .seta {
      font-size: 12.5px;
      font-weight: 600;
      color: var(--accent);
    }
  `,
})
export class TransferirPage {
  private readonly repo = inject(TurmaRepository);
  private readonly auth = inject(AuthService);
  private readonly moderacao = inject(ModeracaoRepository);
  private readonly router = inject(Router);

  protected readonly turma = this.repo.turma;
  protected readonly carregando = this.repo.carregando;
  protected readonly erro = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly escolhidoId = signal<string | null>(null);

  protected readonly souLider = this.repo.souLider;

  /** Todo mundo menos eu: passar a liderança para si mesmo não é uma operação. */
  protected readonly candidatos = computed(() => {
    const eu = this.auth.usuario();
    return (this.turma()?.membros ?? [])
      .filter((m) => m.usuarioId !== eu?.id)
      .map((m) => ({
        usuarioId: m.usuarioId,
        nome: m.nome,
        inicial: (m.nome.trim()[0] ?? '?').toUpperCase(),
        desde: entrouEm(m.entrouEm),
      }));
  });

  protected readonly escolhido = computed(() => {
    const id = this.escolhidoId();
    return id === null
      ? null
      : (this.candidatos().find((c) => c.usuarioId === id) ?? null);
  });

  constructor() {
    void this.repo.carregar();
  }

  protected async confirmar(): Promise<void> {
    const id = this.escolhidoId();
    if (id === null || this.enviando()) {
      return;
    }
    this.enviando.set(true);
    this.erro.set(null);
    try {
      await this.moderacao.transferirLideranca(id);
    } catch (e) {
      // O cargo não mudou: a tela volta ao estado anterior e diz por quê. Sair
      // daqui como se tivesse dado certo deixaria a pessoa achando que já não é
      // líder — e ela pararia de moderar.
      this.erro.set(mensagemDeErro(e));
      return;
    } finally {
      this.enviando.set(false);
    }
    await this.router.navigateByUrl('/tabs/turma');
  }
}

/** "entrou em 1 set". Data ilegível vira texto vazio, nunca "Invalid Date". */
function entrouEm(iso: string): string {
  const quando = new Date(iso);
  if (Number.isNaN(quando.getTime())) {
    return '';
  }
  return `entrou em ${quando.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}`;
}
