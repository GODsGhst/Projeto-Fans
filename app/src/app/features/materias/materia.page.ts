import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { MateriaRepository } from '../../data/materia.repository';
import type { MateriaDetalhe } from '../../data/models';
import { EventoCardComponent } from '../../shared/evento-card.component';
import { MaterialLinhaComponent } from '../../shared/material-linha.component';
import { eventoVm } from '../evento-vm';
import { materialVm } from '../material-vm';

/**
 * A tela de uma materia.
 *
 * Material de aula e material adicional ficam SEPARADOS (R4): os dois tipos
 * existem justamente para nao se misturarem — o que o professor deu e o que a
 * turma achou por fora sao coisas diferentes na hora de estudar.
 *
 * Renderiza na ordem que veio de `GET /materias/{id}`. Nao ordena, nao filtra e
 * nao corta: quem decide o que e visivel e o servidor, e registro oculto ja nao
 * chega aqui (R14).
 */
@Component({
  selector: 'app-materia',
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
    RouterLink,
  ],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/materias" />
        </ion-buttons>
        <ion-title>{{ nome() }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="pf-pilha">
        @if (carregando()) {
          <p class="pf-aviso">Carregando…</p>
        } @else if (erro(); as e) {
          <p class="pf-aviso">{{ e }}</p>
        }

        @if (aula().length) {
          <p class="pf-rotulo">material de aula</p>
          @for (m of aula(); track m.id) {
            <app-material-linha
              class="aula"
              [tipo]="m.tipo"
              [titulo]="m.titulo"
              [autoria]="m.autoria" />
          }
        }

        @if (adicionais().length) {
          <p class="pf-rotulo">material adicional</p>
          @for (m of adicionais(); track m.id) {
            <app-material-linha
              class="adicional"
              [tipo]="m.tipo"
              [titulo]="m.titulo"
              [autoria]="m.autoria" />
          }
        }

        @if (eventos().length) {
          <p class="pf-rotulo">eventos</p>
          @for (e of eventos(); track e.id) {
            <a class="ir" [routerLink]="['/tabs/eventos', e.id]">
              <app-evento-card
                [tipo]="e.tipo"
                [dia]="e.dia"
                [mes]="e.mes"
                [quando]="e.quando"
                [titulo]="e.titulo"
                [materia]="e.materia"
                [autoria]="e.autoria" />
            </a>
          }
        }

        @if (vazia()) {
          <div class="pf-vazio">
            <b>Nada nesta matéria ainda.</b>
            <span>
              Material e prova aparecem aqui assim que alguém da turma adicionar.
            </span>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: `
  `,
})
export class MateriaPage {
  private readonly repo = inject(MateriaRepository);

  private readonly detalhe = signal<MateriaDetalhe | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);

  protected readonly nome = computed(() => this.detalhe()?.materia.nome ?? 'Matéria');

  private readonly agora = new Date();

  protected readonly aula = computed(() =>
    (this.detalhe()?.materiaisAula ?? []).map((m) => materialVm(m, this.agora)),
  );

  protected readonly adicionais = computed(() =>
    (this.detalhe()?.materiaisAdicionais ?? []).map((m) => materialVm(m, this.agora)),
  );

  protected readonly eventos = computed(() =>
    (this.detalhe()?.eventos ?? []).map((e) => ({ id: e.id, ...eventoVm(e, this.agora) })),
  );

  /** Vazio de verdade: carregou, nao falhou, e a materia nao tem nada. */
  protected readonly vazia = computed(
    () =>
      !this.carregando() &&
      this.erro() === null &&
      this.aula().length === 0 &&
      this.adicionais().length === 0 &&
      this.eventos().length === 0,
  );

  constructor() {
    const id = inject(ActivatedRoute).snapshot.paramMap.get('id');
    void this.carregar(id ?? '');
  }

  private async carregar(id: string): Promise<void> {
    try {
      this.detalhe.set(await this.repo.detalhe(id));
    } catch (e) {
      // Nunca virar "esta materia nao tem nada": falhar ao buscar e outra tela.
      this.erro.set(e instanceof Error ? e.message : 'Não deu para carregar a matéria.');
    } finally {
      this.carregando.set(false);
    }
  }
}
