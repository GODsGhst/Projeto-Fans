import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { NotaRepository } from '../../data/nota.repository';
import type { Nota } from '../../data/nota.repository';
import type { AlcanceNota } from '../../shared/tipos';
import { mensagemDeErro } from '../auth/erro';

/**
 * Escrever ou editar uma anotação.
 *
 * **A escolha do alcance vem antes do texto, e não tem padrão marcado.** É a
 * decisão que importa aqui — "a turma inteira lê" e "só eu leio" são coisas
 * opostas —, e o custo de errar é assimétrico: um recado que ninguém vê é uma
 * chateação; um rascunho que a turma vê pode ser um problema. Marcar um padrão
 * seria escolher no lugar de quem escreve.
 *
 * A mesma tela serve para editar: o `id` na rota liga o modo de edição, como na
 * de evento. PATCH substitui o objeto inteiro, então ela abre preenchida.
 */
@Component({
  selector: 'app-nova-nota',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
  ],
  styleUrls: ['../auth/auth.scss'],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/calendario" />
        </ion-buttons>
        <ion-title>{{ editandoId ? 'Editar anotação' : 'Anotação' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="pf-auth">
        @if (erro(); as e) {
          <p class="pf-erro" role="alert">{{ e }}</p>
        }

        <p class="rot-campo">quem lê</p>
        <div class="seg" role="group" aria-label="Quem lê a anotação">
          <button
            type="button"
            [attr.aria-pressed]="alcance() === 'PESSOAL'"
            (click)="alcance.set('PESSOAL')"
          >
            Só eu
          </button>
          <button
            type="button"
            [attr.aria-pressed]="alcance() === 'TURMA'"
            (click)="alcance.set('TURMA')"
          >
            A turma
          </button>
        </div>
        <p class="explica-alcance">
          {{
            alcance() === 'TURMA'
              ? 'Todo mundo da turma vai ler, com o seu nome.'
              : 'Fica só com você. Ninguém da turma vê.'
          }}
        </p>

        <p class="rot-campo">dia</p>
        <input
          #data
          class="campo--linha"
          type="date"
          name="data"
          [value]="dataInicial()"
          aria-label="Dia da anotação"
        />

        <p class="rot-campo">o que anotar</p>
        <textarea
          #texto
          class="campo--linha campo--area"
          name="texto"
          rows="4"
          maxlength="2000"
          aria-label="Texto da anotação"
          >{{ textoInicial() }}</textarea>

        <button
          class="botao"
          type="button"
          [disabled]="enviando()"
          (click)="salvar(data.value, texto.value)"
        >
          {{ enviando() ? 'Salvando…' : 'Salvar' }}
        </button>

        @if (editandoId) {
          @if (confirmando()) {
            <p class="alerta">Apagar esta anotação?</p>
            <button
              class="botao botao--fantasma"
              type="button"
              [disabled]="enviando()"
              (click)="apagar()"
            >
              Sim, apagar
            </button>
            <button
              class="botao botao--fantasma"
              type="button"
              (click)="confirmando.set(false)"
            >
              Cancelar
            </button>
          } @else {
            <button
              class="botao botao--fantasma"
              type="button"
              (click)="confirmando.set(true)"
            >
              Apagar
            </button>
          }
        }
      </div>
    </ion-content>
  `,
  styles: `
    .campo--area {
      min-height: 96px;
      resize: vertical;
      font: inherit;
    }
    .explica-alcance {
      margin: 0;
      font-size: 12px;
      color: var(--ink-3);
    }
  `,
})
export class NovaNotaPage {
  private readonly repo = inject(NotaRepository);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  /** `null` = escrevendo uma nova. Falsy, não `!== null`: `get` devolve `null`. */
  protected readonly editandoId = this.rota.snapshot.paramMap.get('id') || null;

  protected readonly alcance = signal<AlcanceNota>('PESSOAL');
  protected readonly erro = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly confirmando = signal(false);
  protected readonly dataInicial = signal(hoje());
  protected readonly textoInicial = signal('');

  private version = 0;

  constructor() {
    const dia = this.rota.snapshot.queryParamMap.get('dia');
    if (dia !== null) {
      this.dataInicial.set(dia);
    }
    if (this.editandoId !== null) {
      this.carregarParaEditar(this.editandoId);
    }
  }

  /**
   * A nota vem da lista já carregada, não de um GET.
   *
   * `GET /notas/{id}` não existe de propósito no servidor: com ele, adivinhar um
   * UUID seria o caminho de ler o rascunho pessoal de outra pessoa. Então editar
   * só funciona a partir da lista — que é exatamente de onde se chega aqui.
   */
  private carregarParaEditar(id: string): void {
    const nota = this.repo.notas().find((n) => n.id === id);
    if (nota === undefined) {
      this.erro.set('Abra a anotação pelo calendário para poder editar.');
      return;
    }
    this.aplicar(nota);
  }

  private aplicar(nota: Nota): void {
    this.alcance.set(nota.alcance);
    this.dataInicial.set(nota.data);
    this.textoInicial.set(nota.texto);
    this.version = nota.version;
  }

  protected async salvar(data: string, texto: string): Promise<void> {
    if (this.enviando()) {
      return;
    }
    if (texto.trim() === '') {
      this.erro.set('Escreva alguma coisa.');
      return;
    }
    if (data === '') {
      this.erro.set('Escolha o dia.');
      return;
    }

    this.enviando.set(true);
    this.erro.set(null);
    const req = { alcance: this.alcance(), data, texto: texto.trim() };
    try {
      if (this.editandoId === null) {
        await this.repo.criar(req);
      } else {
        await this.repo.atualizar(this.editandoId, this.version, req);
      }
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
      return;
    } finally {
      this.enviando.set(false);
    }
    await this.router.navigateByUrl('/tabs/calendario');
  }

  protected async apagar(): Promise<void> {
    if (this.editandoId === null || this.enviando()) {
      return;
    }
    this.enviando.set(true);
    this.erro.set(null);
    try {
      await this.repo.excluir(this.editandoId, this.version);
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
      this.confirmando.set(false);
      return;
    } finally {
      this.enviando.set(false);
    }
    await this.router.navigateByUrl('/tabs/calendario');
  }
}

/** `AAAA-MM-DD` local. `toISOString` daria o dia de ontem em fuso negativo. */
function hoje(): string {
  const d = new Date();
  const mes = `${d.getMonth() + 1}`.padStart(2, '0');
  const dia = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}
