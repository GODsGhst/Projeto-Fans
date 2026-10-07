import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { SeloComponent, prefixoDoSelo } from './selo.component';
import type { Selo } from './tipos';

/**
 * Uma linha da lista de material: pdf, slide, foto, link.
 *
 * O rotulo de tipo e mono e fraco de proposito — o titulo e o que a pessoa le e
 * procura. O tipo so precisa estar disponivel ao olhar, nao disputar atencao.
 *
 * A largura do rotulo e fixa para as linhas alinharem verticalmente, e larga o
 * bastante para "SLIDE" caber sem quebrar em duas linhas.
 */
@Component({
  selector: 'app-material-linha',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SeloComponent],
  template: `
    <div class="linha">
      <span class="tipo">{{ tipo() }}</span>
      <span class="corpo">
        <span class="titulo">{{ titulo() }}</span>
        <span class="autoria">
          <span>{{ prefixoAutor() }}{{ autoria() }}</span>
          @if (autoriaSelo(); as s) {
            <app-selo [selo]="s" />
          }
        </span>
        <!-- Quem corrigiu, quando nao e quem postou: autoria visivel, sempre. -->
        @if (editadoPor(); as quem) {
          <span class="autoria">
            <span>editado por {{ prefixoEditor() }}{{ quem }}</span>
            @if (editadoPorSelo(); as s) {
              <app-selo [selo]="s" />
            }
          </span>
        }
      </span>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .linha {
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr);
      gap: 8px;
      align-items: start;
      padding: 6px 2px;
    }

    .tipo {
      font-family: var(--mono);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.11em;
      color: var(--ink-3);
      line-height: 1.5;
    }

    .corpo {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .titulo {
      font-size: 13px;
      line-height: 1.35;
      color: var(--ink);
      overflow-wrap: anywhere;
    }

    .autoria {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 2px 6px;
      font-size: 11px;
      line-height: 1.35;
      color: var(--ink-3);
    }
  `,
})
export class MaterialLinhaComponent {
  /** "pdf", "slide", "foto", "link". */
  readonly tipo = input.required<string>();
  readonly titulo = input.required<string>();
  /** "Ana Beatriz · 22 jul" — autoria visivel e o que faz a lista ter dono. */
  readonly autoria = input.required<string>();

  /** Selo de quem postou: so existe quando essa pessoa tem poder NESTA materia. */
  readonly autoriaSelo = input<Selo | null>(null);

  /** Nome de quem corrigiu o material; ausente quando foi o proprio autor. */
  readonly editadoPor = input<string | null>(null);
  readonly editadoPorSelo = input<Selo | null>(null);

  protected readonly prefixoAutor = computed(() =>
    prefixoDoSelo(this.autoriaSelo()),
  );
  protected readonly prefixoEditor = computed(() =>
    prefixoDoSelo(this.editadoPorSelo()),
  );
}
