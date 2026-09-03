import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';
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

        @if (ondeEQuem(); as linha) {
          <p class="onde-e-quem">{{ linha }}</p>
        }

        <!-- Fora dos @if de proposito: existe com a materia cheia e vazia. O
             estado vazio dizia "assim que alguem da turma adicionar" e nao
             oferecia como — convite sem porta. -->
        <a
          class="botao"
          [routerLink]="['/tabs/materias', id, 'material', 'novo']"
        >
          Adicionar material
        </a>

        @if (aula().length) {
          <p class="pf-rotulo">material de aula</p>
          @for (m of aula(); track m.id) {
            @if (m.url; as endereco) {
              <a
                class="abrir"
                [href]="endereco"
                target="_blank"
                rel="noopener noreferrer"
              >
                <app-material-linha
                  class="aula"
                  [tipo]="m.tipo"
                  [titulo]="m.titulo"
                  [autoria]="m.autoria"
                />
              </a>
              <span class="linha-meta">
                @if (m.daAula) {
                  <span class="da-aula">{{ m.daAula }}</span>
                }
                <!-- So o autor. O toque na linha abre o arquivo, que e a acao
                     principal; editar precisa de um alvo proprio para nao
                     disputar com ela. -->
                @if (m.autorId === meuId()) {
                  <a
                    class="editar"
                    [routerLink]="['/tabs/materiais', m.id, 'editar']"
                    >editar</a
                  >
                }
                <!-- De todo mundo, nao so do autor: o resumo e da turma. Quem
                     tem chave gera uma vez e os trinta leem. -->
                <a
                  class="editar"
                  [routerLink]="['/tabs/materiais', m.id, 'resumo']"
                  >{{ m.temResumo ? 'resumo ✓' : 'resumo' }}</a
                >
              </span>
            } @else {
              <app-material-linha
                class="aula"
                [tipo]="m.tipo"
                [titulo]="m.titulo"
                [autoria]="m.autoria"
              />
            }
          }
        }

        @if (adicionais().length) {
          <p class="pf-rotulo">material adicional</p>
          @for (m of adicionais(); track m.id) {
            @if (m.url; as endereco) {
              <a
                class="abrir"
                [href]="endereco"
                target="_blank"
                rel="noopener noreferrer"
              >
                <app-material-linha
                  class="adicional"
                  [tipo]="m.tipo"
                  [titulo]="m.titulo"
                  [autoria]="m.autoria"
                />
              </a>
              <span class="linha-meta">
                @if (m.daAula) {
                  <span class="da-aula">{{ m.daAula }}</span>
                }
                <!-- So o autor. O toque na linha abre o arquivo, que e a acao
                     principal; editar precisa de um alvo proprio para nao
                     disputar com ela. -->
                @if (m.autorId === meuId()) {
                  <a
                    class="editar"
                    [routerLink]="['/tabs/materiais', m.id, 'editar']"
                    >editar</a
                  >
                }
                <!-- De todo mundo, nao so do autor: o resumo e da turma. Quem
                     tem chave gera uma vez e os trinta leem. -->
                <a
                  class="editar"
                  [routerLink]="['/tabs/materiais', m.id, 'resumo']"
                  >{{ m.temResumo ? 'resumo ✓' : 'resumo' }}</a
                >
              </span>
            } @else {
              <app-material-linha
                class="adicional"
                [tipo]="m.tipo"
                [titulo]="m.titulo"
                [autoria]="m.autoria"
              />
            }
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
                [autoria]="e.autoria"
              />
            </a>
          }
        }

        @if (vazia()) {
          <div class="pf-vazio">
            <b>Nada nesta matéria ainda.</b>
            <span>
              Material e prova aparecem aqui assim que alguém da turma
              adicionar.
            </span>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .linha-meta {
      display: flex;
      align-items: baseline;
      gap: 10px;
      padding: 0 2px 2px;
      margin-top: -4px;
    }
    .linha-meta .editar {
      font-size: 11px;
      font-weight: 600;
      color: var(--accent);
      text-decoration: none;
      padding: 2px;
    }

    .onde-e-quem {
      margin: 0;
      font-size: 12.5px;
      color: var(--ink-3);
      padding: 0 2px;
    }

    .da-aula {
      display: block;
      font-size: 11px;
      color: var(--ink-3);
      padding: 0 2px 2px;
      margin-top: -4px;
    }

    /* Envelope de toque, como o .ir dos cartoes: o material inteiro abre.
       target=_blank sai para o navegador do sistema — o Capacitor intercepta
       link externo e abre fora do app, senao a pessoa perderia a tela do app
       dentro de um PDF sem botao de voltar. */
    .abrir {
      display: block;
      text-decoration: none;
      color: inherit;
    }
  `,
})
export class MateriaPage {
  private readonly auth = inject(AuthService);

  /**
   * Quem está olhando. Só o autor vê o link de editar o próprio material.
   *
   * `inject` fica no campo, não dentro do `computed`: fora do contexto de
   * injeção ele estoura em tempo de execução, e o erro só aparece quando a tela
   * abre — não no build.
   */
  protected readonly meuId = computed(() => this.auth.usuario()?.id ?? null);

  /**
   * "B-204 · prof. Marcos", ou vazio.
   *
   * Os dois campos sao opcionais e chegam como `undefined` quando ausentes — o
   * backend omite nulo do JSON. Uma linha com o separador e nada em volta seria
   * pior que linha nenhuma, entao o separador so entra com os dois lados.
   */
  protected readonly ondeEQuem = computed(() => {
    const m = this.detalhe()?.materia;
    return [m?.sala, m?.professor].filter(Boolean).join(' · ');
  });

  /** Usado no link de adicionar material; vem da rota, como o resto da tela. */
  protected readonly id: string;

  private readonly repo = inject(MateriaRepository);

  private readonly detalhe = signal<MateriaDetalhe | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);

  protected readonly nome = computed(
    () => this.detalhe()?.materia.nome ?? 'Matéria',
  );

  private readonly agora = new Date();

  protected readonly aula = computed(() =>
    (this.detalhe()?.materiaisAula ?? []).map((m) => materialVm(m, this.agora)),
  );

  protected readonly adicionais = computed(() =>
    (this.detalhe()?.materiaisAdicionais ?? []).map((m) =>
      materialVm(m, this.agora),
    ),
  );

  protected readonly eventos = computed(() =>
    (this.detalhe()?.eventos ?? []).map((e) => ({
      id: e.id,
      ...eventoVm(e, this.agora),
    })),
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
    this.id = id ?? '';
    void this.carregar(id ?? '');
  }

  private async carregar(id: string): Promise<void> {
    try {
      this.detalhe.set(await this.repo.detalhe(id));
    } catch (e) {
      // Nunca virar "esta materia nao tem nada": falhar ao buscar e outra tela.
      this.erro.set(
        e instanceof Error ? e.message : 'Não deu para carregar a matéria.',
      );
    } finally {
      this.carregando.set(false);
    }
  }
}
