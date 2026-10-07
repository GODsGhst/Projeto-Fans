import { NgTemplateOutlet } from '@angular/common';
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

import {
  DocenteAdmin,
  DocenteAdminRepository,
} from '../../data/docente-admin.repository';
import { mensagemDeErro } from '../auth/erro';

/**
 * Aprovar quem se cadastrou como professor ou coordenação.
 *
 * Existe porque conta docente nasce PENDENTE (spec 2.1): sem o dono liberar, a
 * pessoa posta como qualquer membro, mas não corrige nem oculta nada. Aprovar é
 * da CONTA e vale para todas as turmas; por isso a tela não mostra turma nem
 * conteúdo — o admin decide quem a pessoa é, não onde ela manda.
 *
 * **Revogar pede confirmação, aprovar e recusar não.** Recusar uma pendente e
 * aprovar de novo uma recusada se desfazem com um toque nesta mesma tela. Revogar
 * tira o poder e o selo de todas as turmas na hora, e quem estava no meio de
 * corrigir uma prova perde o acesso — toque errado aí custa mais.
 *
 * Quem não é admin leva 404 da API e vê o erro; esconder a rota não protege nada,
 * o servidor é quem decide.
 *
 * Sem paginação (ponytail: o dono aprova dezenas, não milhares).
 */
@Component({
  selector: 'app-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
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
          <ion-back-button defaultHref="/tabs/perfil" />
        </ion-buttons>
        <ion-title>Aprovar professores</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="pf-pilha">
        <!-- "Carregando" so na primeira vez: ao voltar para a tela as listas ja
             estao ali, e o aviso as empurraria a cada entrada. -->
        @if (carregando() && !carregou()) {
          <p class="pf-aviso">Carregando…</p>
        } @else if (erroCarga(); as e) {
          <p class="pf-erro" role="alert">{{ e }}</p>
          <button
            class="botao botao--fantasma"
            type="button"
            (click)="carregar()"
          >
            Tentar de novo
          </button>
        }
        @if (erroAcao(); as e) {
          <p class="pf-erro" role="alert">{{ e }}</p>
        }

        @if (carregou()) {
          <div class="alerta">
            Você decide <b>quem a pessoa é</b>, não onde ela manda: aqui não
            aparece turma nem conteúdo. Aprovar vale para todas as turmas;
            recusar ou revogar tira o poder de todas, na hora.
          </div>

          <p class="pf-rotulo">pendentes · {{ pendentes().length }}</p>
          @for (d of pendentes(); track d.usuarioId) {
            <ng-container
              [ngTemplateOutlet]="cartao"
              [ngTemplateOutletContext]="{ $implicit: d }"
            />
          } @empty {
            <div class="pf-vazio">
              <b>Ninguém na fila.</b>
              <span>
                Quando alguém se cadastrar como professor ou coordenação,
                aparece aqui.
              </span>
            </div>
          }

          <p class="pf-rotulo">aprovados · {{ aprovados().length }}</p>
          @for (d of aprovados(); track d.usuarioId) {
            <ng-container
              [ngTemplateOutlet]="cartao"
              [ngTemplateOutletContext]="{ $implicit: d }"
            />
          }

          <!-- Recolhido: recusado e a minoria, mas precisa estar a um toque para
               desfazer uma recusa errada. -->
          <details class="recolhido">
            <summary>recusados · {{ recusados().length }}</summary>
            <div class="lista">
              @for (d of recusados(); track d.usuarioId) {
                <ng-container
                  [ngTemplateOutlet]="cartao"
                  [ngTemplateOutletContext]="{ $implicit: d }"
                />
              }
            </div>
          </details>
        }
      </div>
    </ion-content>

    <ng-template #cartao let-d>
      <div class="pessoa" [attr.data-situacao]="d.docenteStatus">
        <div class="pessoa-topo">
          <span class="inicial" aria-hidden="true">{{ inicial(d.nome) }}</span>
          <span class="quem">
            <span class="nome">{{ d.nome }}</span>
            <span class="email">{{ d.email }}</span>
            <!-- Texto e nao so cor: o tipo e o que o admin confere. -->
            <span class="meta">
              {{ rotuloDoTipo(d) }} · cadastro em {{ data(d.criadoEm) }}
            </span>
          </span>
        </div>

        <!-- O cadastro docente nao verifica o e-mail: quem se cadastra pode usar o
             endereco de outra pessoa, e o admin decide olhando para ele. Texto,
             nao so cor, e so na fila: e antes de APROVAR que importa. -->
        @if (d.docenteStatus === 'PENDENTE' && !d.emailVerificado) {
          <p class="alerta aviso-email" role="note">
            <b>E-mail não verificado:</b> confirme com a pessoa antes de aprovar
          </p>
        }

        @if (revogando() === d.usuarioId) {
          <div
            class="confirma"
            role="group"
            [attr.aria-label]="'Revogar ' + d.nome"
          >
            <p>
              <b>Revogar {{ d.nome }}?</b> Esta conta perde o poder e o selo em
              <b>todas as turmas, na hora</b>. Nada do que postou é apagado.
            </p>
            <div class="acoes">
              <button
                class="botao botao--fantasma"
                type="button"
                [disabled]="agindo() !== null"
                (click)="agir(d, 'recusar')"
              >
                Sim, revogar
              </button>
              <button
                class="botao"
                type="button"
                [disabled]="agindo() !== null"
                (click)="revogando.set(null)"
              >
                Cancelar
              </button>
            </div>
          </div>
        } @else {
          <div class="acoes">
            @switch (d.docenteStatus) {
              @case ('PENDENTE') {
                <button
                  class="botao"
                  type="button"
                  [disabled]="agindo() !== null"
                  [attr.aria-label]="'Aprovar ' + d.nome"
                  (click)="agir(d, 'aprovar')"
                >
                  Aprovar
                </button>
                <button
                  class="botao botao--fantasma"
                  type="button"
                  [disabled]="agindo() !== null"
                  [attr.aria-label]="'Recusar ' + d.nome"
                  (click)="agir(d, 'recusar')"
                >
                  Recusar
                </button>
              }
              @case ('APROVADO') {
                <button
                  class="botao botao--fantasma"
                  type="button"
                  [disabled]="agindo() !== null"
                  [attr.aria-label]="'Revogar ' + d.nome"
                  (click)="revogando.set(d.usuarioId)"
                >
                  Revogar
                </button>
              }
              @case ('RECUSADO') {
                <button
                  class="botao"
                  type="button"
                  [disabled]="agindo() !== null"
                  [attr.aria-label]="'Aprovar ' + d.nome + ' de novo'"
                  (click)="agir(d, 'aprovar')"
                >
                  Aprovar
                </button>
              }
            }
          </div>
        }
      </div>
    </ng-template>
  `,
  styles: `
    .lista {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .pessoa {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px 13px;
      border-radius: var(--r-md);
      background: var(--surface);
      border: 1px solid var(--rule);
      box-shadow: var(--e1);
    }
    .pessoa-topo {
      display: flex;
      gap: 11px;
      align-items: center;
    }
    .inicial {
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
    .quem {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      flex: 1;
    }
    .nome {
      font-size: 14.5px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .email {
      font-size: 12px;
      color: var(--ink-3);
      overflow-wrap: anywhere;
    }
    .meta {
      margin-top: 2px;
      font-size: 11.5px;
      color: var(--ink-3);
    }
    .aviso-email {
      margin: 0;
    }
    .aviso-email b {
      color: var(--ink);
    }
    .acoes {
      display: flex;
      gap: 8px;
    }
    .acoes .botao {
      flex: 1;
      min-height: 44px;
      padding: 10px 14px;
      font-size: 13.5px;
    }
    .confirma {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .confirma p {
      margin: 0;
      font-size: 12.5px;
      line-height: 1.45;
      color: var(--ink-2);
    }
    .confirma p b {
      color: var(--ink);
    }
    details.recolhido > summary {
      display: flex;
      align-items: center;
      gap: 7px;
      min-height: 44px;
      padding: 6px 2px 0;
      list-style: none;
      cursor: pointer;
      font-size: 12.5px;
      font-weight: 600;
      color: var(--ink-3);
    }
    details.recolhido > summary::-webkit-details-marker {
      display: none;
    }
    details.recolhido > summary::before {
      content: '\\25B8';
      font-size: 11px;
    }
    details.recolhido[open] > summary::before {
      content: '\\25BE';
    }
    details.recolhido > summary:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
      border-radius: var(--r-sm);
    }
    details.recolhido[open] > .lista {
      margin-top: 4px;
    }
  `,
})
export class AdminPage {
  private readonly docentes = inject(DocenteAdminRepository);

  protected readonly pendentes = signal<DocenteAdmin[]>([]);
  protected readonly aprovados = signal<DocenteAdmin[]>([]);
  protected readonly recusados = signal<DocenteAdmin[]>([]);

  protected readonly carregando = signal(true);
  /** Alguma carga ja deu certo: so entao as listas (e o "ninguem na fila") valem. */
  protected readonly carregou = signal(false);
  protected readonly erroCarga = signal<string | null>(null);
  protected readonly erroAcao = signal<string | null>(null);

  /** Quem esta com uma decisao no ar: trava os botoes, para nao decidir duas vezes. */
  protected readonly agindo = signal<string | null>(null);
  /** Quem esta com a confirmacao de "revogar" aberta. */
  protected readonly revogando = signal<string | null>(null);

  private readonly formato = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  /** Toda vez que a tela aparece: o Ionic a mantem viva, e a fila anda sem o app. */
  ionViewWillEnter(): void {
    void this.carregar();
  }

  protected async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erroCarga.set(null);
    // Tudo ou nada: tres listas, uma falha, e a tela mostraria uma fila que nao
    // e a fila. Falha de recarga nao apaga o que ja esta na tela.
    try {
      const [p, a, r] = await Promise.all([
        this.docentes.listar('PENDENTE'),
        this.docentes.listar('APROVADO'),
        this.docentes.listar('RECUSADO'),
      ]);
      this.pendentes.set(p);
      this.aprovados.set(a);
      this.recusados.set(r);
      this.carregou.set(true);
    } catch (e) {
      this.erroCarga.set(mensagemDeErro(e));
    } finally {
      this.carregando.set(false);
    }
  }

  /**
   * "Revogar" e `recusar` no servidor — a rota e uma so, e quem decide qual
   * palavra aparece na tela e o status de quem esta na lista.
   *
   * Recarrega em vez de mover o cartao de lista na mao: o servidor e quem sabe
   * em que lista a pessoa caiu, e outro admin pode ter mexido na fila.
   */
  protected async agir(
    d: DocenteAdmin,
    acao: 'aprovar' | 'recusar',
  ): Promise<void> {
    if (this.agindo() !== null) {
      return;
    }
    this.agindo.set(d.usuarioId);
    this.erroAcao.set(null);
    try {
      await (acao === 'aprovar'
        ? this.docentes.aprovar(d.usuarioId)
        : this.docentes.recusar(d.usuarioId));
      this.revogando.set(null);
      await this.carregar();
    } catch (e) {
      this.erroAcao.set(mensagemDeErro(e));
    } finally {
      this.agindo.set(null);
    }
  }

  protected rotuloDoTipo(d: DocenteAdmin): string {
    return d.tipoConta === 'COORDENADOR' ? 'Coordenação' : 'Professor';
  }

  protected data(iso: string): string {
    return this.formato.format(new Date(iso));
  }

  // Espalhar quebra por code point: `[0]` pegava meia surrogate de um emoji.
  protected inicial(nome: string): string {
    return ([...nome.trim()][0] ?? '?').toUpperCase();
  }
}
