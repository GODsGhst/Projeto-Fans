import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { SeloComponent, prefixoDoSelo } from './selo.component';
import type { AlcanceNota, Selo } from './tipos';

/**
 * Anotacao presa a um dia.
 *
 * As duas variantes nunca podem se parecer:
 *
 *   turma   = regua SOLIDA no accent,    rotulo "da turma · todos veem"
 *   pessoal = regua TRACEJADA em ink-3,  rotulo "pessoal · so voce"
 *
 * A diferenca e de forma e de palavra, nunca de cor — pelo mesmo motivo de
 * prova e entrega: sobrevive a escala de cinza e funciona para daltonico. E o
 * risco aqui e maior que estetico: alguem deixar de estudar por confundir o
 * rabisco de outra pessoa com o recado do lider e falha de produto, nao de
 * layout.
 *
 * O rotulo textual e parte da regra, nao decoracao. Nao remover.
 */
@Component({
  selector: 'app-nota',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SeloComponent],
  template: `
    <article class="nota" [class.nota--turma]="ehTurma()">
      <span class="cabeca">{{
        ehTurma() ? 'da turma · todos veem' : 'pessoal · só você'
      }}</span>
      <p class="texto">{{ texto() }}</p>
      @if (autoria(); as a) {
        <span class="autoria">
          <span>{{ prefixoAutor() }}{{ a }}</span>
          @if (autoriaSelo(); as s) {
            <app-selo [selo]="s" />
          }
        </span>
      }
    </article>
  `,
  styles: `
    :host {
      display: block;
    }

    .nota {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 9px 12px;
      border-radius: var(--r-sm);
      /* pessoal: regua tracejada. Nao e fato compartilhado, e nao se disfarca de um. */
      border-left: 3px dashed var(--ink-3);
    }

    .nota--turma {
      border-left: 3px solid var(--accent);
      background: var(--rule-soft);
    }

    .cabeca {
      font-family: var(--mono);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.09em;
      color: var(--ink-3);
    }

    .nota--turma .cabeca {
      color: var(--accent);
    }

    .texto {
      margin: 0;
      font-size: 14px;
      line-height: 1.4;
      color: var(--ink-2);
      overflow-wrap: anywhere;
    }

    .nota--turma .texto {
      color: var(--ink);
    }

    .autoria {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 2px 6px;
      font-size: 11px;
      color: var(--ink-3);
    }
  `,
})
export class NotaComponent {
  readonly alcance = input.required<AlcanceNota>();
  readonly texto = input.required<string>();

  /** "Otávio · líder da turma · ontem". Vazio na nota pessoal: o dono e voce. */
  readonly autoria = input<string | null>(null);

  /**
   * Selo de quem escreveu. So a coordenacao tem (nota nao tem materia, entao
   * professor nao alcanca) e so na nota da TURMA; a pessoal nem tem autoria.
   */
  readonly autoriaSelo = input<Selo | null>(null);

  protected readonly ehTurma = computed(() => this.alcance() === 'TURMA');
  protected readonly prefixoAutor = computed(() =>
    prefixoDoSelo(this.autoriaSelo()),
  );
}
