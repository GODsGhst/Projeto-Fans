import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { ErroApi } from '../../core/http-error.interceptor';
import { EventoRepository } from '../../data/evento.repository';
import type { EventoDetalhe } from '../../data/models';
import { EventoCardComponent } from '../../shared/evento-card.component';
import { MaterialLinhaComponent } from '../../shared/material-linha.component';
import { eventoVm } from '../evento-vm';
import { materialVm } from '../material-vm';

/**
 * A tela de uma prova ou entrega.
 *
 * Mostra APENAS os materiais vinculados a este evento. `GET /eventos/{id}` ja
 * devolve so o que esta em `evento_material` (R5) — e esta tela nao pede mais
 * nada: buscar material por materia aqui despejaria a disciplina inteira na
 * tela de uma prova, que e o nao-negociavel 11.
 *
 * Quatro estados, e nenhum se parece com o outro: carregando, falhou, sumiu
 * (404) e sem material vinculado.
 */
@Component({
  selector: 'app-evento',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    EventoCardComponent,
    MaterialLinhaComponent,
  ],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/home" />
        </ion-buttons>
        <ion-title>{{ rotulo() }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="pf-pilha">
        @if (carregando()) {
          <p class="pf-aviso">Carregando…</p>
        } @else if (erro(); as e) {
          <p class="pf-aviso">{{ e }}</p>
        }

        <!--
          404 nao e "deu erro". O backend responde 404 quando o registro foi
          excluido ou o lider ocultou da turma — e 404, nao 403, justamente para
          nao confirmar que existe. A tela diz que sumiu, e nao finge que a
          prova continua la sem material.
        -->
        @if (sumiu()) {
          <div class="pf-vazio pf-sumiu">
            <b>Isso não existe mais.</b>
            <span>
              O registro foi excluído por quem criou, ou o líder tirou da lista da turma.
            </span>
          </div>
        }

        @if (evento(); as e) {
          <app-evento-card
            [tipo]="e.tipo"
            [dia]="e.dia"
            [mes]="e.mes"
            [quando]="e.quando"
            [titulo]="e.titulo"
            [materia]="e.materia"
            [autoria]="e.autoria" />

          @if (materiais().length) {
            <p class="pf-rotulo">materiais</p>
            @for (m of materiais(); track m.id) {
              <app-material-linha [tipo]="m.tipo" [titulo]="m.titulo" [autoria]="m.autoria" />
            }
          }
        }

        @if (semMaterial()) {
          <div class="pf-vazio">
            <b>Nenhum material vinculado.</b>
            <span>
              Só aparece aqui o que alguém vinculou a esta prova ou entrega — a matéria inteira
              fica na tela da matéria.
            </span>
          </div>
        }
      </div>
    </ion-content>
  `,
})
export class EventoPage {
  private readonly repo = inject(EventoRepository);

  private readonly detalhe = signal<EventoDetalhe | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  /** 404: excluido pelo autor ou oculto pelo lider. Nao e falha. */
  protected readonly sumiu = signal(false);

  private readonly agora = new Date();

  protected readonly evento = computed(() => {
    const d = this.detalhe();
    return d === null ? null : eventoVm(d, this.agora);
  });

  protected readonly materiais = computed(() =>
    (this.detalhe()?.materiais ?? []).map((m) => materialVm(m, this.agora)),
  );

  protected readonly rotulo = computed(() => {
    const d = this.detalhe();
    return d === null ? 'Evento' : d.tipo === 'PROVA' ? 'Prova' : 'Entrega';
  });

  /** Carregou, nao falhou, o evento existe — e ninguem vinculou material ainda. */
  protected readonly semMaterial = computed(
    () =>
      !this.carregando() &&
      this.erro() === null &&
      !this.sumiu() &&
      this.detalhe() !== null &&
      this.materiais().length === 0,
  );

  constructor() {
    const id = inject(ActivatedRoute).snapshot.paramMap.get('id');
    void this.carregar(id ?? '');
  }

  private async carregar(id: string): Promise<void> {
    try {
      this.detalhe.set(await this.repo.detalhe(id));
    } catch (e) {
      if (e instanceof ErroApi && e.classe === 'NAO_ENCONTRADO') {
        this.sumiu.set(true);
      } else {
        // Nunca virar "nao ha material vinculado": falhar ao buscar e outra tela.
        this.erro.set(e instanceof Error ? e.message : 'Não deu para carregar o evento.');
      }
    } finally {
      this.carregando.set(false);
    }
  }
}
