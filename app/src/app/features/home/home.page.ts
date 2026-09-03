import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { AulaCardComponent } from '../../shared/aula-card.component';
import { EventoCardComponent } from '../../shared/evento-card.component';
import type { Materia } from '../../shared/tipos';
import { HomeRepository } from '../../data/home.repository';
import { diaPorExtenso, eventoVm } from '../evento-vm';

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
 * Tres telas diferentes, e elas nao podem se parecer: carregando, falhou, e
 * vazio. "Nao ha provas" e "falhei ao buscar as provas" sao coisas opostas.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    AulaCardComponent,
    EventoCardComponent,
    RouterLink,
  ],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-title>{{ hoje() }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="pf-pilha">
        @if (carregando()) {
          <p class="pf-aviso">Carregando…</p>
        } @else if (aviso(); as a) {
          <p class="pf-aviso">{{ a }}</p>
        }

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
              [agora]="a.agora ?? false"
            />
          }
        }

        @if (eventos().length) {
          <p class="pf-rotulo">o que vem aí</p>
          <!-- A17: o card inteiro leva ao evento. A tela existia e so era
               alcancavel por Materias -> uma materia -> o evento; da Home, que e
               onde a prova aparece primeiro, tocar nela nao fazia nada. -->
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
              Se você sabe de alguma prova ou entrega que não está aqui,
              adicione — qualquer pessoa da turma pode.
            </span>
          </div>
        }

        <!-- Sempre visivel, inclusive na tela vazia: e exatamente quando alguem
             precisa cadastrar. O dono instalou o APK, entrou na turma e nao tinha
             como cadastrar nada — o app so lia. -->
        <!-- Botao, nao mais a linha discreta. Adicionar prova e a acao principal
             de quem abre o app com algo para registrar; um link fino do tamanho
             de um rodape faz a pessoa procurar por ele. -->
        <a class="botao" routerLink="/tabs/eventos/novo">
          Adicionar prova ou entrega
        </a>
      </div>
    </ion-content>
  `,
  styles: ``,
})
export class HomePage {
  private readonly repo = inject(HomeRepository);

  protected readonly hoje = signal(diaPorExtenso(new Date()));

  /**
   * A grade de aulas nao tem origem de dado ainda — a tabela `aula` e o
   * `GET /grade` chegam nas Tasks 13 e 16. Ate la a lista fica vazia, e o bloco
   * inteiro nao renderiza. Aula inventada aqui seria pior que aula nenhuma:
   * uma grade que mente sobre onde a pessoa precisa estar agora e o risco que a
   * A8 escreveu.
   */
  protected readonly aulas = signal<readonly AulaVm[]>([]);

  protected readonly carregando = this.repo.carregando;

  /** Renderiza na ordem que veio do servidor. Sem `sort`, sem `filter`, sem `slice`. */
  protected readonly eventos = computed(() => {
    const agora = new Date();
    // O id nao entra no EventoVm: a Home o chama de `eventoId` e o Calendario de
    // `id`, e o vm serve aos dois. Mesmo formato usado em materia.page.ts.
    return this.repo
      .itens()
      .map((i) => ({ id: i.eventoId, ...eventoVm(i, agora) }));
  });

  /**
   * Falhou. Offline com snapshot diz de quando e o dado; offline sem snapshot
   * admite que nao ha o que mostrar. Em nenhum dos dois a tela finge que a
   * semana esta vazia.
   */
  protected readonly aviso = computed(() => {
    const erro = this.repo.erro();
    if (erro === null) {
      return null;
    }
    if (!this.repo.offline()) {
      return erro;
    }
    const sync = this.repo.ultimoSync();
    return sync === null
      ? 'Sem conexão · nenhum dado salvo neste aparelho'
      : `Sem conexão · mostrando dados de ${hora(sync)}`;
  });

  /** Vazio de verdade: carregou, nao falhou, e nao ha nada. */
  protected readonly vazia = computed(
    () =>
      !this.carregando() &&
      this.repo.erro() === null &&
      this.aulas().length === 0 &&
      this.eventos().length === 0,
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
    void this.repo.carregar();
  }
}

function hora(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? 'antes'
    : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
