import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MateriaChipComponent } from './materia-chip.component';
import type { Materia } from './tipos';

/**
 * Uma aula da grade: quando, qual materia, e onde.
 *
 * O quadrado da esquerda carrega o codigo da sala sob um vetor de sala de aula.
 * Ele nao e enfeite: marca "isto e uma aula", a mesma funcao que o glifo
 * cheio/vazado cumpre para prova e entrega em `evento-card`. Monocromatico de
 * proposito — a cor ja esta ocupada identificando a materia.
 *
 * So a aula em andamento recebe o trilho de accent. Se tudo destacasse, nada
 * destacaria — e o aluno abre o app justamente para saber onde precisa estar
 * agora.
 */
@Component({
  selector: 'app-aula-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MateriaChipComponent],
  template: `
    <article class="aula" [class.aula--agora]="agora()">
      <div class="sala">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="3.2" width="18" height="10" rx="1.2" />
          <path d="M6.4 7h7M6.4 9.8h4.6" />
          <path d="M4 17.4h6v3.2H4zM14 17.4h6v3.2h-6z" />
          <path d="M7 17.4v-1.7M17 17.4v-1.7" />
        </svg>
        <b>{{ sala() }}</b>
      </div>

      <div class="corpo">
        <div class="topo">
          <app-materia-chip [cor]="materia().cor" [sigla]="materia().sigla" />
          <span class="hora">{{ hora() }}</span>
        </div>

        <p class="nome">{{ nome() }}</p>

        @if (detalhe(); as d) {
          <p class="detalhe">{{ d }}</p>
        }

        @if (atividade(); as a) {
          <p class="atividade">
            <span class="glifo" aria-hidden="true"></span>{{ a }}
          </p>
        }
      </div>
    </article>
  `,
  styles: `
    :host {
      display: block;
    }

    .aula {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 10px 12px;
      border: 1px solid var(--rule);
      border-radius: var(--r-md);
    }

    /* uma aula por vez, no maximo: a que esta acontecendo */
    .aula--agora {
      border-color: var(--accent);
      box-shadow: inset 2px 0 0 var(--accent);
    }

    .sala {
      flex: 0 0 auto;
      width: 46px;
      height: 46px;
      border-radius: var(--r-sm);
      border: 1px solid var(--rule);
      background: var(--panel);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
      color: var(--ink-3);
    }

    .sala svg {
      width: 20px;
      height: 20px;
      display: block;
    }

    .sala b {
      font-family: var(--mono);
      font-size: 8.5px;
      font-weight: 500;
      letter-spacing: 0.04em;
      color: var(--ink-2);
    }

    .corpo {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      flex: 1;
    }

    .topo {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .hora {
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.06em;
      color: var(--ink-2);
      font-variant-numeric: tabular-nums;
    }

    .nome {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: -0.008em;
      line-height: 1.25;
      overflow-wrap: anywhere;
    }

    .detalhe {
      margin: 0;
      font-size: 11px;
      color: var(--ink-3);
    }

    .atividade {
      margin: 2px 0 0;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: var(--mono);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.09em;
      color: var(--ink-2);
    }

    .aula--agora .atividade {
      color: var(--accent);
    }

    /* mesmo glifo vazado de entrega: a gramatica nao muda de tela para tela */
    .glifo {
      width: 8px;
      height: 8px;
      flex: 0 0 auto;
      border: 1.5px solid currentColor;
      border-radius: 50%;
    }
  `,
})
export class AulaCardComponent {
  readonly materia = input.required<Materia>();
  readonly nome = input.required<string>();
  /** "19:00–20:40" ou "seg · 19:00" quando a aula nao e hoje. */
  readonly hora = input.required<string>();
  readonly sala = input.required<string>();

  /** "agora · prof. Marcos", "em 1 h 50". */
  readonly detalhe = input<string | null>(null);

  /** "entregar hoje · Lista 4" — so quando ha entrega vinculada a esta aula. */
  readonly atividade = input<string | null>(null);

  readonly agora = input(false);
}
