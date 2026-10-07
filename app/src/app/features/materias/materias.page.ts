import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { TurmaAtivaService } from '../../core/turma-ativa.service';
import { MateriaRepository } from '../../data/materia.repository';
import { MateriaChipComponent } from '../../shared/materia-chip.component';

/**
 * Hub por disciplina: a porta de entrada para a tela de cada materia.
 *
 * Cor e sigla saem juntas porque so existe um jeito de mostrar materia neste
 * app — `MateriaChipComponent`. Nao ha caminho alternativo, e nao pode passar a
 * haver.
 *
 * Tres telas diferentes, e elas nao podem se parecer: carregando, falhou e
 * vazio. "A turma nao cadastrou materia" e "nao consegui perguntar" sao coisas
 * opostas.
 */
@Component({
  selector: 'app-materias',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    MateriaChipComponent,
    RouterLink,
  ],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <!-- Docente com varias turmas precisa ver de QUAL delas sao estas
             materias; aluno tem uma so e nome() e nulo para ele. -->
        <ion-title>{{ turmaAtiva.nome() ?? 'Matérias' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="pf-pilha">
        <!-- Antes disto o estado vazio dizia "qualquer pessoa da turma pode
             cadastrar" e nao oferecia como. Convite sem porta e crueldade.
             Fica fora do @if de proposito: existe cheia e vazia. -->
        <a class="botao" routerLink="/tabs/materias/nova">
          Adicionar matéria
        </a>
        @if (carregando()) {
          <p class="pf-aviso">Carregando…</p>
        } @else if (erro(); as e) {
          <p class="pf-aviso">{{ e }}</p>
        }

        @for (m of materias(); track m.id) {
          <a class="linha" [routerLink]="['/tabs/materias', m.id]">
            <app-materia-chip [cor]="m.corHex" [sigla]="m.sigla" />
            <span class="nome">{{ m.nome }}</span>
          </a>
        }

        <!-- Nao preencher e o requisito: nada de sugestao, dica ou card promocional. -->
        @if (vazia()) {
          <div class="pf-vazio">
            <b>Nenhuma matéria cadastrada.</b>
            <span>
              Matéria é o que organiza material e prova. Qualquer pessoa da
              turma pode adicionar.
            </span>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .linha {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 9px 2px;
      border-bottom: 1px solid var(--rule);
      text-decoration: none;
      color: inherit;
    }

    .nome {
      font-size: 14px;
      line-height: 1.35;
      color: var(--ink);
      overflow-wrap: anywhere;
    }
  `,
})
export class MateriasPage {
  private readonly repo = inject(MateriaRepository);
  protected readonly turmaAtiva = inject(TurmaAtivaService);

  protected readonly materias = this.repo.materias;
  protected readonly carregando = this.repo.carregando;
  protected readonly erro = this.repo.erro;

  /** Vazio de verdade: carregou, nao falhou, e a turma nao tem materia. */
  protected readonly vazia = computed(
    () =>
      !this.carregando() &&
      this.erro() === null &&
      this.materias().length === 0,
  );

  /**
   * Recarrega toda vez que a aba aparece — não só quando o componente nasce.
   *
   * Em abas do Ionic o componente é criado uma vez e fica vivo. Com a carga no
   * `constructor`, voltar para a aba mostrava o que existia na primeira
   * abertura, para sempre. No teste de duas pessoas esse é O defeito: o colega
   * cadastra uma prova e o outro continua olhando a tela de antes até matar o
   * app — e o estado vazio, que diz "nada nos próximos 14 dias", passa a mentir.
   *
   * A carga saiu do `constructor` em vez de ficar nos dois: `ionViewWillEnter`
   * roda também na primeira entrada, e duas cargas na abertura seriam duas
   * chamadas — num servidor que dorme, cada uma custa dezenas de segundos.
   */
  ionViewWillEnter(): void {
    // O repository relanca de proposito e a tela ja mostra o erro pelo signal.
    // Este catch registra e evita rejeicao solta — nunca transforma falha em
    // "nao ha materias".
    this.repo
      .carregar()
      .catch((e: unknown) =>
        console.error('[materias] falha ao carregar as matérias', e),
      );
  }
}
