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
    MaterialLinhaComponent, RouterLink],
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

          <!-- FORA do @if de materiais de proposito. Anexar e mais necessario
               quando nao ha nada anexado; escondido ali, o botao so aparecia para
               quem ja tinha resolvido o problema. -->
          <a class="anexar" [routerLink]="['/tabs/eventos', id, 'anexar']">
            Anexar material
          </a>

          @if (materiais().length) {
            <p class="pf-rotulo">materiais</p>
            @for (m of materiais(); track m.id) {
              @if (m.url; as endereco) {
                <a class="abrir" [href]="endereco" target="_blank" rel="noopener noreferrer">
                  <app-material-linha [tipo]="m.tipo" [titulo]="m.titulo" [autoria]="m.autoria" />
                </a>
              } @else {
                <app-material-linha [tipo]="m.tipo" [titulo]="m.titulo" [autoria]="m.autoria" />
              }
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
  styles: `
    /* Envelope de toque, como o .ir dos cartoes: o material inteiro abre.
       target=_blank sai para o navegador do sistema — o Capacitor intercepta
       link externo e abre fora do app, senao a pessoa perderia a tela do app
       dentro de um PDF sem botao de voltar. */
    .abrir {
      display: block;
      text-decoration: none;
      color: inherit;
    }

    .anexar {
      display: block;
      text-align: center;
      font-size: 14px;
      font-weight: 700;
      padding: 13px;
      border-radius: var(--r-md);
      border: 1px solid var(--rule);
      background: transparent;
      color: var(--ink);
      text-decoration: none;
    }
    .anexar:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
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

  /**
   * O id da rota, guardado no componente porque o template precisa dele para o
   * link de anexar. Antes era so uma variavel local do construtor, e o template
   * lia um `id` que nao existia — o link saia como `/tabs/eventos//anexar`.
   */
  protected readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  constructor() {
    void this.carregar(this.id);
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
