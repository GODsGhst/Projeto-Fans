import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { AulaCardComponent } from '../../shared/aula-card.component';
import { EventoCardComponent } from '../../shared/evento-card.component';
import type { Materia, TipoEvento } from '../../shared/tipos';

/** Uma aula da grade do dia. */
export interface AulaVm {
  readonly materia: Materia;
  readonly nome: string;
  readonly hora: string;
  readonly sala: string;
  readonly detalhe?: string;
  /** Entrega vinculada a esta aula, quando existe. */
  readonly atividade?: string;
  readonly agora?: boolean;
}

/** Prova ou entrega dos proximos 14 dias. */
export interface EventoVm {
  readonly tipo: TipoEvento;
  readonly dia: string;
  readonly mes: string;
  readonly quando: string;
  readonly titulo: string;
  readonly materia: Materia;
  readonly autoria: string;
}

/**
 * Entrada do app.
 *
 * Responde duas perguntas, nesta ordem: onde eu preciso estar agora, e o que vem
 * ai. A segunda lista sai dos proximos 14 dias com teto de 6 itens, ordenada por
 * urgencia — e as tres coisas sao calculadas NO SERVIDOR. Esta pagina renderiza
 * na ordem que veio: nao reordena, nao filtra e nao corta.
 *
 * Ordem e urgencia, nunca tipo: uma entrega de amanha vem antes de uma prova de
 * daqui a quatro dias. Nao agrupar por tipo e nao-negociavel.
 *
 * PARA O CODEX: os signals abaixo estao com dados de exemplo so para a tela
 * existir. Troque a origem por HomeService (`GET /api/v1/home`) mantendo o mesmo
 * shape. Nao mexa nos componentes de shared/ nem na ordem de renderizacao.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, AulaCardComponent, EventoCardComponent],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-title>{{ hoje() }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="pf-pilha">
        @if (aulas().length) {
          <p class="pf-rotulo">próximas aulas</p>
          @for (a of aulas(); track a.nome + a.hora) {
            <app-aula-card
              [materia]="a.materia"
              [nome]="a.nome"
              [hora]="a.hora"
              [sala]="a.sala"
              [detalhe]="a.detalhe ?? null"
              [atividade]="a.atividade ?? null"
              [agora]="a.agora ?? false" />
          }
        }

        @if (eventos().length) {
          <p class="pf-rotulo">o que vem aí</p>
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

        <!--
          Semana vazia mostra pouca coisa, e isso e informacao. Nao preencher e o
          requisito: nada de dica, sugestao, card promocional ou skeleton eterno.
          "Nao tem nada nos proximos 14 dias" e exatamente o que a pessoa abriu o
          app para saber. A segunda frase existe porque o app so funciona se
          alguem alimentar, e o convite a cadastrar e a unica coisa acionavel
          honesta neste momento.
        -->
        @if (vazia()) {
          <div class="pf-vazio">
            <b>Nada nos próximos 14 dias.</b>
            <span>
              Se você sabe de alguma prova ou entrega que não está aqui, cadastre — qualquer
              pessoa da turma pode.
            </span>
          </div>
        }
      </div>
    </ion-content>
  `,
})
export class HomePage {
  // --- dados de exemplo. Trocar por HomeService, mantendo o shape. ---
  protected readonly hoje = signal('Sexta, 21 ago');

  protected readonly aulas = signal<readonly AulaVm[]>([
    {
      materia: { sigla: 'BD', cor: 'var(--m-02-azul-celeste)' },
      nome: 'Banco de Dados',
      hora: '19:00–20:40',
      sala: 'B-204',
      detalhe: 'agora · prof. Marcos',
      atividade: 'entregar hoje · Lista 4',
      agora: true,
    },
    {
      materia: { sigla: 'ESOFT', cor: 'var(--m-03-teal)' },
      nome: 'Eng. de Software',
      hora: '20:50–22:30',
      sala: 'B-204',
      detalhe: 'em 1 h 50 · prof. Lúcia',
    },
    {
      materia: { sigla: 'REDES', cor: 'var(--m-04-verde)' },
      nome: 'Redes de Computadores',
      hora: 'seg · 19:00',
      sala: 'LAB-3',
      detalhe: 'próxima segunda · lab. de redes',
    },
  ]);

  protected readonly eventos = signal<readonly EventoVm[]>([
    {
      tipo: 'ENTREGA',
      dia: '21',
      mes: 'ago',
      quando: '23:59',
      titulo: 'Lista 4 — normalização',
      materia: { sigla: 'BD', cor: 'var(--m-02-azul-celeste)' },
      autoria: 'Otávio · há 5 h',
    },
    {
      tipo: 'PROVA',
      dia: '25',
      mes: 'ago',
      quando: '19:00',
      titulo: 'Prova 2 — integrais',
      materia: { sigla: 'CALC2', cor: 'var(--m-01-azul)' },
      autoria: 'Ana Beatriz · há 2 dias',
    },
  ]);

  protected readonly vazia = computed(
    () => this.aulas().length === 0 && this.eventos().length === 0,
  );
}
