import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

import { EventoCardComponent } from '../../shared/evento-card.component';
import { EventoRepository } from '../../data/evento.repository';
import { eventoVm, limitesDoMes, mesPorExtenso } from '../evento-vm';

/**
 * Consulta, nao entrada. Quem so quer saber "o que tem essa semana" resolve na Home.
 * Mesma linguagem visual: cor identifica a materia, forma identifica o tipo.
 *
 * A janela (`de`/`ate`) e da tela — o mes corrente —, mas quem decide o que e
 * visivel continua sendo o servidor: esta pagina renderiza `GET /eventos` na
 * ordem que veio, sem reordenar, filtrar ou cortar.
 *
 * A grade do mes com os dias marcados, e o dia expansivel, sao da Task 16 e nao
 * existem como componente em `shared/` — ver o registro em `docs/LOG.md`. Ate
 * la a consulta e a lista do periodo, com os mesmos cartoes da Home.
 */
@Component({
  selector: 'app-calendario',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, EventoCardComponent],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-title>Calendário</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="pf-pilha">
        @if (carregando()) {
          <p class="pf-aviso">Carregando…</p>
        } @else if (erro(); as e) {
          <p class="pf-aviso">{{ e }}</p>
        }

        @if (eventos().length) {
          <p class="pf-rotulo">{{ mes() }}</p>
          @for (e of eventos(); track e.titulo + e.dia) {
            <app-evento-card
              [tipo]="e.tipo"
              [dia]="e.dia"
              [mes]="e.mes"
              [quando]="e.quando"
              [titulo]="e.titulo"
              [materia]="e.materia"
              [autoria]="e.autoria" />
          }
        }

        @if (vazio()) {
          <div class="pf-vazio">
            <b>Nada marcado em {{ mes() }}.</b>
            <span>
              Prova ou entrega que a turma cadastrar aparece aqui, no dia dela.
            </span>
          </div>
        }
      </div>
    </ion-content>
  `,
})
export class CalendarioPage {
  private readonly repo = inject(EventoRepository);

  protected readonly mes = signal(mesPorExtenso(new Date()));
  protected readonly carregando = this.repo.carregando;
  protected readonly erro = this.repo.erro;

  protected readonly eventos = computed(() => {
    const agora = new Date();
    return this.repo.eventos().map((e) => eventoVm(e, agora));
  });

  /** Vazio de verdade: carregou, nao falhou, e o mes nao tem nada. */
  protected readonly vazio = computed(
    () => !this.carregando() && this.erro() === null && this.eventos().length === 0,
  );

  constructor() {
    const { de, ate } = limitesDoMes(new Date());
    // O repository relanca de proposito. Aqui o erro ja esta sinalizado na tela
    // pelo signal `erro`; este catch existe so para registrar e nao virar
    // rejeicao solta — nunca para transformar falha em "mes vazio".
    this.repo
      .carregarPeriodo(de, ate)
      .catch((e: unknown) => console.error('[calendario] falha ao carregar o mês', e));
  }
}
