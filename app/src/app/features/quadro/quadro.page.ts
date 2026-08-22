import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { MiniCardComponent } from '../../shared/mini-card.component';
import type { Materia, TipoEvento } from '../../shared/tipos';

export interface CartaoVm {
  readonly materia: Materia;
  readonly titulo: string;
  readonly tipo: TipoEvento;
  /** Estado pessoal: nao muda nada para mais ninguem. */
  readonly feito?: boolean;
  /** So em "Nao listados": "oculto pelo lider · so voce ve". */
  readonly aviso?: string;
}

/**
 * Meu quadro — o unico lugar do app onde o estado e pessoal.
 *
 * Duas colunas, "a fazer" e "feito", e mais nada. Marcar feito nao muda o que a
 * turma enxerga: o dado mora em tabela separada, nunca como coluna no fato
 * compartilhado.
 *
 * "Nao listados" e secao RECOLHIDA ABAIXO do kanban, nunca uma terceira coluna.
 * Ela so aparece quando o lider ocultou algum registro seu — a maioria das
 * pessoas nunca a ve. Duas colunas e literal no handoff; nao virar tres.
 *
 * PARA O CODEX: os signals estao com dados de exemplo. Troque por QuadroService
 * mantendo o shape. As duas colunas e a posicao de "Nao listados" nao mudam.
 */
@Component({
  selector: 'app-quadro',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, MiniCardComponent],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-title>Meu quadro</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="pf-pilha">
        <div class="kanban">
          <div class="coluna">
            <p class="pf-rotulo">a fazer</p>
            @for (c of aFazer(); track c.titulo) {
              <app-mini-card [materia]="c.materia" [titulo]="c.titulo" [tipo]="c.tipo" />
            } @empty {
              <p class="nada">Nada pendente.</p>
            }
          </div>

          <div class="coluna">
            <p class="pf-rotulo">feito</p>
            @for (c of feitos(); track c.titulo) {
              <app-mini-card
                [materia]="c.materia"
                [titulo]="c.titulo"
                [tipo]="c.tipo"
                [feito]="true" />
            } @empty {
              <p class="nada">Nada ainda.</p>
            }
          </div>
        </div>

        @if (naoListados().length) {
          <section class="nao-listados">
            <p class="pf-rotulo">não listados · {{ naoListados().length }}</p>
            @for (c of naoListados(); track c.titulo) {
              <app-mini-card
                class="oculto"
                [materia]="c.materia"
                [titulo]="c.titulo"
                [tipo]="c.tipo"
                [aviso]="c.aviso ?? null" />
            }
          </section>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .kanban {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      align-items: start;
    }

    .coluna {
      display: flex;
      flex-direction: column;
      gap: 7px;
      min-width: 0;
    }

    .nada {
      margin: 0;
      font-size: 12px;
      color: var(--ink-3);
      padding: 2px;
    }

    /* recolhida ABAIXO do kanban, separada por fio tracejado — nunca terceira coluna */
    .nao-listados {
      display: flex;
      flex-direction: column;
      gap: 7px;
      margin-top: 10px;
      padding-top: 12px;
      border-top: 1px dashed var(--rule);
    }

    .oculto {
      opacity: 0.72;
      max-width: 250px;
    }
  `,
})
export class QuadroPage {
  // --- dados de exemplo. Trocar por QuadroService, mantendo o shape. ---
  private readonly cartoes = signal<readonly CartaoVm[]>([
    {
      materia: { sigla: 'CALC2', cor: 'var(--m-01-azul)' },
      titulo: 'Prova 2 — integrais',
      tipo: 'PROVA',
    },
    {
      materia: { sigla: 'ESOFT', cor: 'var(--m-03-teal)' },
      titulo: 'Diagrama de casos de uso',
      tipo: 'ENTREGA',
    },
    {
      materia: { sigla: 'REDES', cor: 'var(--m-04-verde)' },
      titulo: 'Prova 1 — enlace',
      tipo: 'PROVA',
    },
    {
      materia: { sigla: 'BD', cor: 'var(--m-02-azul-celeste)' },
      titulo: 'Lista 4 — normalização',
      tipo: 'ENTREGA',
      feito: true,
    },
    {
      materia: { sigla: 'SO', cor: 'var(--m-05-oliva)' },
      titulo: 'Trabalho de escalonamento',
      tipo: 'ENTREGA',
      feito: true,
    },
  ]);

  private readonly ocultos = signal<readonly CartaoVm[]>([
    {
      materia: { sigla: 'ALG', cor: 'var(--m-09-vermelho)' },
      titulo: 'Prova de grafos — 30 jul',
      tipo: 'PROVA',
      aviso: 'oculto pelo líder · só você vê',
    },
  ]);

  protected readonly aFazer = computed(() => this.cartoes().filter((c) => !c.feito));
  protected readonly feitos = computed(() => this.cartoes().filter((c) => c.feito));
  protected readonly naoListados = this.ocultos.asReadonly();
}
