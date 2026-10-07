import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Selo } from './tipos';

/**
 * "Prof. " / "Coord. " antes do nome. Nasce do selo e some com ele (mockup, secao
 * de selos): sem selo e so o nome que a pessoa cadastrou. Fica aqui, ao lado do
 * desenho, para a palavra e o prefixo nao poderem divergir.
 */
export function prefixoDoSelo(selo: Selo | null | undefined): string {
  switch (selo) {
    case 'PROFESSOR':
      return 'Prof. ';
    case 'COORDENACAO':
      return 'Coord. ';
    default:
      return '';
  }
}

/**
 * O selo de autoria: "esta pessoa tem poder aqui" (spec 2.6 e 8).
 *
 * Texto + forma + contorno de 1px, nunca so cor, e NAO parece chip de materia
 * (o chip e pilula cheia com a hue da materia; o selo e retangulo vazado).
 *
 *   Professor    = contorno em tinta,  capelo vazado
 *   Coordenacao  = contorno no accent, escudo cheio
 *
 * Em escala de cinza a palavra, o comprimento e o icone ainda separam os dois; a
 * cor e o terceiro canal. A palavra e texto de verdade, entao leitor de tela a le.
 *
 * As cores vem de custom properties com o padrao do tema (`--selo-prof`,
 * `--selo-coord`, `--selo-bg`) para quem hospeda o selo sobre outro fundo — o bloco
 * escuro da prova, o cartao em accent-soft — poder reajustar o contraste sem este
 * componente conhecer o hospedeiro.
 */
@Component({
  selector: 'app-selo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (selo() === 'PROFESSOR') {
      <span class="selo selo--prof"
        ><svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.9"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M2.5 9.5 12 5l9.5 4.5L12 14z" />
          <path d="M6.5 11.8V16c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8v-4.2" /></svg
        >Professor</span
      >
    } @else if (selo() === 'COORDENACAO') {
      <span class="selo selo--coord"
        ><svg
          viewBox="0 0 24 24"
          fill="currentColor"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3 20 6v5.5c0 4.4-3.2 7.8-8 9.5-4.8-1.7-8-5.1-8-9.5V6z" /></svg
        >Coordenação</span
      >
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      vertical-align: middle;
    }

    .selo {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 1px 7px 1px 4px;
      border: 1px solid currentColor;
      border-radius: var(--r-sm);
      background: var(--selo-bg, transparent);
      font-family: var(--ui);
      font-size: 11px;
      font-weight: 600;
      line-height: 1.5;
      letter-spacing: -0.004em;
      white-space: nowrap;
    }

    .selo svg {
      width: 12px;
      height: 12px;
      flex: 0 0 auto;
      display: block;
    }

    .selo--prof {
      color: var(--selo-prof, var(--ink));
    }

    .selo--coord {
      color: var(--selo-coord, var(--accent));
    }
  `,
})
export class SeloComponent {
  readonly selo = input.required<Selo>();
}
