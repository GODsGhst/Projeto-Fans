import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { MateriaRepository } from '../../data/materia.repository';
import { MateriaChipComponent } from '../../shared/materia-chip.component';
import { Espera } from '../auth/espera';
import { mensagemDeErro } from '../auth/erro';

/**
 * As 12 hues de materia, e so elas.
 *
 * A lista e a mesma de `docs/design/telas-v3.html` (bloco `.cores-pick`) e a
 * mesma de `Paleta.HUES` no backend, que RECUSA com 400 qualquer hex fora dela.
 * Nao e capricho: cada uma foi medida para dar no minimo 4.5:1 com o texto
 * branco do chip. Um amarelo qualquer passaria no CHECK do banco e produziria
 * uma sigla ilegivel — e cor de materia se escolhe uma vez e fica.
 *
 * Por isso a tela oferece escolha entre 12, e nao um campo de cor livre.
 */
export const PALETA: readonly { readonly hex: string; readonly nome: string }[] = [
  { hex: '#1D4ED8', nome: 'azul' },
  { hex: '#0369A1', nome: 'azul-petróleo' },
  { hex: '#0F766E', nome: 'verde-azulado' },
  { hex: '#15803D', nome: 'verde' },
  { hex: '#4D7C0F', nome: 'oliva' },
  { hex: '#A16207', nome: 'âmbar' },
  { hex: '#B45309', nome: 'laranja-queimado' },
  { hex: '#C2410C', nome: 'laranja' },
  { hex: '#B91C1C', nome: 'vermelho' },
  { hex: '#BE185D', nome: 'rosa' },
  { hex: '#A21CAF', nome: 'magenta' },
  { hex: '#6D28D9', nome: 'violeta' },
];

/**
 * Cadastrar materia — a primeira coisa que o app nao sabia fazer.
 *
 * Qualquer membro cria, sem fila e sem aprovacao (nao-negociavel 9). O estado
 * vazio da aba Materias convidava a cadastrar e nao oferecia como; esta tela e
 * a porta que faltava.
 *
 * A cor escolhida ganha ANEL, nao brilho: em escala de cinza o anel sobrevive e
 * o brilho nao — a mesma regra que separa prova de entrega no resto do sistema.
 *
 * A previa usa `MateriaChipComponent` de proposito. Nao existe outro caminho
 * para exibir materia neste app, e uma previa desenhada a mao aqui seria
 * exatamente o segundo caminho que o nao-negociavel 7 proibe.
 */
@Component({
  selector: 'app-nova-materia',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    MateriaChipComponent,
  ],
  styleUrls: ['../auth/auth.scss'],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/materias" />
        </ion-buttons>
        <ion-title>Nova matéria</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="pf-auth">
        @if (erro(); as e) {
          <p class="pf-erro" role="alert">{{ e }}</p>
        }

        <p class="rot-campo">nome</p>
        <input
          #nome
          class="campo--linha"
          type="text"
          maxlength="80"
          placeholder="Banco de Dados"
          aria-label="Nome da matéria" />

        <p class="rot-campo">sigla</p>
        <input
          #sigla
          class="campo--linha campo--sigla"
          type="text"
          maxlength="12"
          autocapitalize="characters"
          placeholder="BD"
          aria-label="Sigla"
          (input)="previa.set(sigla.value.trim().toUpperCase() || 'SIGLA')" />

        <p class="rot-campo">sala <span class="opcional">— opcional</span></p>
        <input
          #sala
          class="campo--linha"
          type="text"
          name="sala"
          maxlength="40"
          placeholder="B-204"
          aria-label="Sala habitual" />

        <p class="rot-campo">professor <span class="opcional">— opcional</span></p>
        <input
          #professor
          class="campo--linha"
          type="text"
          name="professor"
          maxlength="80"
          placeholder="prof. Marcos"
          aria-label="Professor" />

        <p class="cache-aviso">
          A sala aqui é a de sempre. Quando uma prova cair em outra sala, dá para dizer isso na
          própria prova — sem mexer na matéria.
        </p>

        <p class="rot-campo">cor</p>
        <div class="cores-pick" role="group" aria-label="Cor da matéria">
          @for (c of paleta; track c.hex) {
            <button
              type="button"
              [style.background]="c.hex"
              [attr.data-cor]="c.hex"
              [attr.aria-pressed]="cor() === c.hex"
              [attr.aria-label]="c.nome"
              (click)="cor.set(c.hex)"></button>
          }
        </div>

        <div class="previa-chip">
          <app-materia-chip [cor]="cor()" [sigla]="previa()" />
          <span>é assim que ela vai aparecer</span>
        </div>

        <p class="alerta">
          As 12 cores foram medidas para dar contraste suficiente com o texto branco do chip. Por
          isso a escolha é entre elas, e não livre.
        </p>

        <button
          class="botao"
          type="button"
          [disabled]="enviando()"
          (click)="criar(nome.value, sigla.value, sala.value, professor.value)">
          {{ rotuloDoBotao() }}
        </button>
      </div>
    </ion-content>
  `,
  styles: `
    .campo--sigla {
      text-transform: uppercase;
    }

    .cores-pick {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
    }

    .cores-pick button {
      aspect-ratio: 1;
      padding: 0;
      border: 0;
      border-radius: var(--r-sm);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }

    .cores-pick button:active {
      transform: scale(0.9);
    }

    /* Anel, nao brilho: em escala de cinza o anel sobrevive e o brilho nao. */
    .cores-pick button[aria-pressed='true'] {
      box-shadow:
        0 0 0 2px var(--paper),
        0 0 0 4px var(--ink);
    }

    .cores-pick button:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 3px;
    }

    .previa-chip {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 4px 2px;
    }

    .previa-chip span {
      font-size: 12.5px;
      color: var(--ink-3);
    }
  `,
})
export class NovaMateriaPage {
  private readonly repo = inject(MateriaRepository);
  private readonly router = inject(Router);

  protected readonly paleta = PALETA;
  protected readonly cor = signal(PALETA[0].hex);
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);
  /** Sigla digitada, so para a previa; o chip nunca fica sem texto. */
  protected readonly previa = signal('SIGLA');

  private readonly espera = new Espera();

  /** O servidor gratuito hiberna e leva ate ~45 s para acordar (ver `Espera`). */
  protected readonly rotuloDoBotao = computed(() => {
    if (!this.enviando()) {
      return 'Criar matéria';
    }
    return this.espera.demorando() ? 'Acordando o servidor…' : 'Criando…';
  });

  protected async criar(
    nome: string,
    sigla: string,
    sala: string,
    professor: string,
  ): Promise<void> {
    if (this.enviando()) {
      return;
    }
    const limpo = { nome: nome.trim(), sigla: sigla.trim().toUpperCase() };
    // Validado aqui porque o servidor devolve a mesma frase generica em ingles
    // para todo campo em branco, e "Invalid request content." nao diz a pessoa
    // qual dos dois campos ela esqueceu.
    if (limpo.nome === '' || limpo.sigla === '') {
      this.erro.set('Preencha o nome e a sigla da matéria.');
      return;
    }

    this.enviando.set(true);
    this.erro.set(null);
    this.espera.comecar();
    try {
      await this.repo.criar({
        ...limpo,
        corHex: this.cor(),
        // Vazio vira null, nao string vazia: o backend normaliza igual, e mandar
        // "" faria a tela da materia mostrar uma sala em branco como se fosse uma.
        sala: sala.trim() === '' ? null : sala.trim(),
        professor: professor.trim() === '' ? null : professor.trim(),
      });
    } catch (e) {
      // Sigla repetida na turma volta 409 com frase legivel; a paleta violada
      // volta 400 com outra. As duas chegam prontas do interceptor central.
      this.erro.set(mensagemDeErro(e));
      return;
    } finally {
      this.enviando.set(false);
      this.espera.terminar();
    }

    // Recarregar ANTES de voltar. Sem isto a aba Materias ainda diz "nenhuma
    // materia cadastrada", e quem acabou de cadastrar cadastra de novo.
    //
    // Falhar aqui NAO devolve a pessoa para este formulario: a materia ja
    // existe, e repetir o cadastro daria 409. O erro nao some — o repositorio o
    // guarda no proprio signal e a aba Materias o mostra.
    await this.repo
      .carregar()
      .catch((e: unknown) => console.error('[nova-materia] falha ao recarregar as materias', e));
    await this.router.navigateByUrl('/tabs/materias');
  }
}
