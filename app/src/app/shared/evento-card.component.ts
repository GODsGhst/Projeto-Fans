import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MateriaChipComponent } from './materia-chip.component';
import type { Materia, TipoEvento } from './tipos';

/**
 * Cartao de prova ou entrega.
 *
 * "Prova pesa mais que entrega" se resolve por PESO DE TINTA, nunca por cor:
 *
 *   prova   = bloco solido no valor oposto ao da pagina, titulo 700, glifo cheio
 *   entrega = contorno de 1px, sem preenchimento,       titulo 600, glifo vazado
 *
 * A cor nao participa dessa distincao porque ja esta ocupada identificando a
 * materia. Criterio de aceite verificavel: um screenshot em escala de cinza
 * ainda distingue os dois. Isso tambem faz o cartao funcionar para daltonicos —
 * sigla, peso de tinta e forma do glifo sao tres canais redundantes, nenhum
 * cromatico.
 *
 * A distincao existia so no visual, o que deixava leitor de tela de fora. Por
 * isso o tipo tambem vai em texto, escondido visualmente mas anunciado.
 */
@Component({
  selector: 'app-evento-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MateriaChipComponent],
  template: `
    <article class="ev" [class.ev--prova]="ehProva()">
      <div class="data">
        <span class="dia">{{ dia() }}</span>
        <span class="mes">{{ mes() }}</span>
      </div>

      <div class="corpo">
        <div class="topo">
          @if (materia(); as m) {
            <app-materia-chip [cor]="m.cor" [sigla]="m.sigla" />
          }
          <span class="tipo">
            <span class="glifo" aria-hidden="true"></span>
            <span class="apenas-leitor">{{ ehProva() ? 'Prova' : 'Entrega' }} —</span>
            {{ quando() }}
          </span>
        </div>

        <p class="titulo">{{ titulo() }}</p>

        @if (autoria(); as a) {
          <p class="rodape">{{ a }}</p>
        }
      </div>
    </article>
  `,
  styles: `
    :host {
      display: block;
    }

    .ev {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr);
      gap: 14px;
      align-items: start;
      padding: 12px 14px;
      border-radius: var(--r-md);
      /* entrega: contorno, sem preenchimento */
      background: transparent;
      border: 1px solid var(--rule);
      color: var(--ink);
    }

    /* prova: bloco solido no valor oposto ao da pagina */
    .ev--prova {
      background: var(--prova-bg);
      border-color: var(--prova-bg);
      color: var(--prova-fg);
    }

    .data {
      text-align: center;
      font-variant-numeric: tabular-nums;
    }

    .dia {
      display: block;
      font-size: 20px;
      font-weight: 700;
      line-height: 1;
      letter-spacing: -0.03em;
    }

    .mes {
      display: block;
      margin-top: 2px;
      font-family: var(--mono);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      opacity: 0.62;
    }

    .corpo {
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-width: 0;
    }

    .topo {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .tipo {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-family: var(--mono);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.11em;
      color: var(--ink-3);
      font-variant-numeric: tabular-nums;
    }

    .ev--prova .tipo {
      color: var(--prova-fg-2);
    }

    /* glifo vazado = entrega; cheio = prova. Terceiro canal nao cromatico. */
    .glifo {
      width: 8px;
      height: 8px;
      flex: 0 0 auto;
      border: 1.5px solid currentColor;
      border-radius: 50%;
    }

    .ev--prova .glifo {
      background: currentColor;
      border-radius: 1px;
    }

    .titulo {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      line-height: 1.3;
      letter-spacing: -0.008em;
      /* titulo longo quebra em vez de estourar a coluna */
      overflow-wrap: anywhere;
    }

    .ev--prova .titulo {
      font-weight: 700;
    }

    .rodape {
      margin: 0;
      font-size: 13px;
      color: var(--ink-3);
    }

    .ev--prova .rodape {
      color: var(--prova-fg-2);
    }

    /* o tipo e visual para quem enxerga e textual para quem ouve */
    .apenas-leitor {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `,
})
export class EventoCardComponent {
  readonly tipo = input.required<TipoEvento>();
  readonly dia = input.required<string>();
  readonly mes = input.required<string>();
  readonly titulo = input.required<string>();

  /** Horario ("19:00") ou rotulo ("entrega", "prova · 2 materiais"). */
  readonly quando = input.required<string>();

  /**
   * Ausente na tela de Materias: la voce ja esta dentro da materia, e repetir o
   * chip seria ruido. Par indivisivel — ver `Materia` em tipos.ts.
   */
  readonly materia = input<Materia | null>(null);

  /** "Ana Beatriz · ha 2 dias". Ausente onde a autoria ja e obvia pelo contexto. */
  readonly autoria = input<string | null>(null);

  protected readonly ehProva = computed(() => this.tipo() === 'PROVA');
}
