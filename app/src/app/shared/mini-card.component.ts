import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MateriaChipComponent } from './materia-chip.component';
import type { Materia, TipoEvento } from './tipos';

/**
 * Cartao do Meu quadro.
 *
 * Mesma gramatica de tinta da Home — prova solida, entrega contornada — porque a
 * linguagem nao pode mudar de tela para tela. Feito e opacidade mais risco, e e
 * ESTADO PESSOAL: marcar feito nao muda nada para mais ninguem, e o dado mora em
 * tabela separada, nunca como coluna no fato compartilhado.
 *
 * `aviso` aparece so em "Nao listados", quando o lider ocultou um registro da
 * turma e o autor continua enxergando o proprio.
 */
@Component({
  selector: 'app-mini-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MateriaChipComponent],
  template: `
    <article class="mini" [class.mini--solida]="ehProva()" [class.mini--feita]="feito()">
      <app-materia-chip [cor]="materia().cor" [sigla]="materia().sigla" />
      <span class="titulo">{{ titulo() }}</span>
      @if (aviso(); as a) {
        <span class="aviso">{{ a }}</span>
      }
    </article>
  `,
  styles: `
    :host {
      display: block;
    }

    .mini {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 5px;
      padding: 8px 9px;
      border: 1px solid var(--rule);
      border-radius: var(--r-sm);
    }

    .mini--solida {
      background: var(--prova-bg);
      border-color: var(--prova-bg);
      color: var(--prova-fg);
    }

    /* feito e estado pessoal: some do seu caminho, nao do caminho dos outros */
    .mini--feita {
      opacity: 0.55;
    }

    .mini--feita .titulo {
      text-decoration: line-through;
    }

    .titulo {
      font-size: 13px;
      font-weight: 500;
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .aviso {
      font-family: var(--mono);
      font-size: 9px;
      letter-spacing: 0.06em;
      line-height: 1.3;
      color: var(--ink-3);
    }
  `,
})
export class MiniCardComponent {
  readonly materia = input.required<Materia>();
  readonly titulo = input.required<string>();
  readonly tipo = input.required<TipoEvento>();

  /** Estado pessoal. Invisivel para o resto da turma. */
  readonly feito = input(false);

  /** "oculto pelo lider · so voce ve" — so na secao Nao listados. */
  readonly aviso = input<string | null>(null);

  protected readonly ehProva = computed(() => this.tipo() === 'PROVA');
}
