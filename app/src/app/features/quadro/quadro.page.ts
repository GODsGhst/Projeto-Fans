import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

import { MaterialLinhaComponent } from '../../shared/material-linha.component';
import { MiniCardComponent } from '../../shared/mini-card.component';
import type { Materia, TipoEvento } from '../../shared/tipos';
import type { Evento, ItemHome } from '../../data/models';
import { QuadroRepository } from '../../data/quadro.repository';
import { materialVm } from '../material-vm';
import type { MaterialVm } from '../material-vm';

/** O que o MiniCard precisa, mais o id para a acao de marcar. */
export interface CartaoVm {
  readonly id: string;
  readonly materia: Materia;
  readonly titulo: string;
  readonly tipo: TipoEvento;
  /** So em "Nao listados": diz por que o registro sumiu do feed da turma. */
  readonly aviso?: string;
}

/**
 * Meu quadro — o unico lugar do app onde o estado e pessoal.
 *
 * Duas colunas, "a fazer" e "feito", e mais nada. Marcar feito nao muda o que a
 * turma enxerga: o dado mora em tabela separada, nunca como coluna no fato
 * compartilhado.
 *
 * **As colunas vem prontas do servidor.** A pagina nao separa feito de a-fazer
 * olhando `feitoPeloUsuario`: ela renderiza as duas listas que a API mandou. Se
 * refizesse a separacao aqui, a regra teria duas implementacoes e elas
 * divergiriam — e o teste "as duas colunas saem do servidor" existe justamente
 * para ficar vermelho se alguem tentar.
 *
 * "Nao listados" e secao RECOLHIDA ABAIXO do kanban, nunca uma terceira coluna.
 * So aparece quando ha algo — a maioria das pessoas nunca a ve.
 *
 * Quatro estados, e nenhum se parece com o outro: carregando, falhou, quadro
 * vazio, e quadro cheio. Falhar ao buscar o que esta pendente nao pode virar
 * "nada pendente" — sao frases opostas, e a segunda faz alguem perder prova.
 */
@Component({
  selector: 'app-quadro',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    MiniCardComponent,
    MaterialLinhaComponent,
    RouterLink,],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-title>Meu quadro</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="pf-pilha">
        <!-- A turma e o codigo de convite moram aqui: e a partir do quadro que
             alguem procura "quem esta na turma". -->
        <a class="link-turma" routerLink="/tabs/turma">a turma &rarr;</a>
        <!-- Carregando so quando NAO ha o que mostrar. Agora que a aba recarrega
             a cada entrada, um spinner incondicional apagaria o quadro inteiro a
             cada troca de aba — e num servidor que dorme isso dura dezenas de
             segundos com a tela em branco. -->
        @if (carregando() && !temDados()) {
          <p class="pf-aviso">Carregando…</p>
        } @else if (erro(); as e) {
          <p class="pf-aviso">{{ e }}</p>
        }

        <!--
          Sem o kanban quando a busca falhou. Colunas vazias aqui diriam "voce
          nao tem nada pendente", que e o oposto de "nao consegui descobrir o que
          voce tem pendente".
        -->
        @if (!erro() && (!carregando() || temDados())) {
          <div class="kanban">
            <div class="coluna">
              <p class="pf-rotulo">a fazer</p>
              @for (c of aFazer(); track c.id) {
                <app-mini-card [materia]="c.materia" [titulo]="c.titulo" [tipo]="c.tipo" />
                <button class="marcar" type="button" (click)="marcar(c.id, true)">
                  marcar como resolvido
                </button>
              } @empty {
                <p class="nada">Nada pendente.</p>
              }
            </div>

            <div class="coluna">
              <p class="pf-rotulo">feito</p>
              @for (c of feitos(); track c.id) {
                <app-mini-card
                  [materia]="c.materia"
                  [titulo]="c.titulo"
                  [tipo]="c.tipo"
                  [feito]="true" />
                <button class="marcar" type="button" (click)="marcar(c.id, false)">
                  desmarcar
                </button>
              } @empty {
                <p class="nada">Nada ainda.</p>
              }
            </div>
          </div>
        }

        <!--
          Falhar ao buscar os ocultos nao e "voce nao tem nenhum oculto". Aviso
          proprio, e a secao NAO renderiza — senao a ausencia dela mentiria.
        -->
        @if (!erro() && erroNaoListados()) {
          <p class="aviso-nao-listados">Não deu para carregar os não listados.</p>
        }

        @if (temNaoListados()) {
          <section class="nao-listados">
            <p class="pf-rotulo">não listados · {{ totalNaoListados() }}</p>

            @for (c of eventosOcultos(); track c.id) {
              <app-mini-card
                class="oculto"
                [materia]="c.materia"
                [titulo]="c.titulo"
                [tipo]="c.tipo"
                [aviso]="c.aviso ?? null" />
            }

            @for (m of materiaisOcultos(); track m.vm.id) {
              <div class="material-oculto">
                <app-material-linha
                  [tipo]="m.vm.tipo"
                  [titulo]="m.vm.titulo"
                  [autoria]="m.vm.autoria" />
                <span class="aviso">{{ m.aviso }}</span>
              </div>
            }
          </section>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .link-turma {
      align-self: flex-end;
      font-size: 13px;
      font-weight: 600;
      color: var(--accent);
      text-decoration: none;
      padding: 2px;
    }

    .kanban {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      align-items: start;
    }

    .coluna {
      display: flex;
      flex-direction: column;
      gap: 7px;
      min-width: 0;
    }

    .nada {
      margin: 0;
      font-size: 12px;
      color: var(--ink-3);
      padding: 2px;
    }

    .marcar {
      font: inherit;
      font-size: 11px;
      font-weight: 600;
      color: var(--accent);
      background: none;
      border: 0;
      padding: 2px 2px 6px;
      text-align: left;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .marcar:active {
      transform: scale(0.97);
    }
    .marcar:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    .aviso-nao-listados {
      margin: 0;
      font-size: 12.5px;
      color: var(--ink-2);
      padding: 2px;
    }

    /* recolhida ABAIXO do kanban, separada por fio tracejado — nunca terceira coluna */
    .nao-listados {
      display: flex;
      flex-direction: column;
      gap: 7px;
      margin-top: 10px;
      padding-top: 12px;
      border-top: 1px dashed var(--rule);
    }

    .oculto {
      opacity: 0.72;
      max-width: 250px;
    }

    .material-oculto {
      display: flex;
      flex-direction: column;
      gap: 2px;
      opacity: 0.72;
    }
    .material-oculto .aviso {
      font-size: 10.5px;
      color: var(--ink-3);
    }
  `,
})
export class QuadroPage {
  private readonly repo = inject(QuadroRepository);

  protected readonly carregando = this.repo.carregando;
  protected readonly erro = this.repo.erro;
  protected readonly erroNaoListados = this.repo.erroNaoListados;

  /**
   * Ha algo na tela agora? Separa primeira carga (spinner e certo, nao ha o que
   * preservar) de revalidacao (o quadro fica, senao pisca a cada troca de aba).
   */
  protected readonly temDados = computed(
    () => this.repo.aFazer().length > 0 || this.repo.feito().length > 0,
  );

  protected readonly aFazer = computed(() => this.repo.aFazer().map(cartaoDeItem));
  protected readonly feitos = computed(() => this.repo.feito().map(cartaoDeItem));

  protected readonly eventosOcultos = computed(
    () => this.repo.naoListados()?.eventos.map(cartaoDeEvento) ?? [],
  );

  protected readonly materiaisOcultos = computed(() => {
    const agora = new Date();
    return (this.repo.naoListados()?.materiais ?? []).map((m) => ({
      vm: materialVm(m, agora),
      aviso: porQueSumiu(m.visivelTurma, m.excluidoEm),
    }));
  });

  protected readonly totalNaoListados = computed(
    () => this.eventosOcultos().length + this.materiaisOcultos().length,
  );

  /** So aparece quando ha algo. Secao vazia seria ruido para quase todo mundo. */
  protected readonly temNaoListados = computed(() => this.totalNaoListados() > 0);

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
    void this.repo.carregar();
    void this.repo.carregarNaoListados();
  }

  protected marcar(eventoId: string, feito: boolean): void {
    void this.repo.marcar(eventoId, feito);
  }
}

function cartaoDeItem(i: ItemHome): CartaoVm {
  return {
    id: i.eventoId,
    materia: { sigla: i.materiaSigla, cor: i.materiaCorHex },
    titulo: i.titulo,
    tipo: i.tipo,
  };
}

function cartaoDeEvento(e: Evento): CartaoVm {
  return {
    id: e.id,
    materia: { sigla: e.materiaSigla, cor: e.materiaCorHex },
    titulo: e.titulo,
    tipo: e.tipo,
    aviso: porQueSumiu(e.visivelTurma, e.excluidoEm),
  };
}

/**
 * As duas razoes nao podem se confundir: "o lider ocultou" e uma decisao de
 * outra pessoa sobre o seu registro, e "voce excluiu" foi voce. Quem le precisa
 * saber com quem falar.
 *
 * A exclusao ganha da ocultacao quando as duas valem: o registro excluido nao
 * volta por reexibicao.
 */
function porQueSumiu(visivelTurma: boolean, excluidoEm: string | null): string {
  if (excluidoEm !== null) {
    return 'excluído por você · só você vê';
  }
  return visivelTurma ? 'só você vê' : 'oculto pelo líder · só você vê';
}
