import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Cor + sigla, sempre juntas.
 *
 * Nao existe variante que renderize so a cor, e nao pode passar a existir. A
 * regra visual "nunca so a bolinha colorida" deixa de depender da disciplina de
 * quem escreve tela e passa a depender da API: os dois inputs sao `required`.
 * Quem tentar mostrar so a cor nao compila.
 *
 * Texto branco em qualquer tema e qualquer ground — uma regra so, sem variante
 * por tema, o que remove uma classe inteira de bug. As 12 hues da paleta tem
 * contraste >= 4.5:1 com branco, verificado por docs/design/validar-paleta.mjs
 * (minimo real 4.92:1), nao afirmado.
 */
@Component({
  selector: 'app-materia-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="chip" [style.background]="cor()">{{
    sigla()
  }}</span>`,
  styles: `
    :host {
      display: inline-flex;
      min-width: 0;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      /* branco literal, nao token: nao muda com o tema, por definicao */
      color: #fff;
      font-family: var(--ui);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.055em;
      line-height: 1;
      padding: 3px 7px;
      border-radius: 4px;
      white-space: nowrap;
      text-transform: uppercase;
    }
  `,
})
export class MateriaChipComponent {
  /** Uma das 12 hues da paleta fixa. */
  readonly cor = input.required<string>();
  /** Sigla curta da materia: BD, CALC2, ESOFT. */
  readonly sigla = input.required<string>();
}
