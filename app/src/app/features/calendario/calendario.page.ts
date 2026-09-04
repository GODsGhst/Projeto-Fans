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

import { EventoCardComponent } from '../../shared/evento-card.component';
import { NotaComponent } from '../../shared/nota.component';
import { EventoRepository } from '../../data/evento.repository';
import { NotaRepository } from '../../data/nota.repository';
import { assinatura } from '../evento-vm';
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
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    EventoCardComponent,
    NotaComponent,
    RouterLink,
  ],
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

        <p class="pf-rotulo">anotações</p>
        <!-- Aviso PROPRIO das anotacoes. O erro() acima e o dos eventos; sem
             esta linha, falhar ao buscar anotacao virava "nao tem anotacao" —
             que e exatamente o que este app nao pode fazer. -->
        @if (erroDasNotas(); as e) {
          <p class="pf-aviso" role="alert">{{ e }}</p>
        }
        <a class="botao botao--fantasma" routerLink="/tabs/notas/nova"
          >Anotar alguma coisa</a
        >

        @for (n of notas(); track n.id) {
          <!-- So a minha e tocavel para editar. A anotacao da turma e de quem
               escreveu — o mesmo autor-only do resto do app. -->
          @if (n.minha) {
            <a class="ir" [routerLink]="['/tabs/notas', n.id, 'editar']">
              <span class="dia-nota">{{ n.dia }}</span>
              <app-nota
                [alcance]="n.alcance"
                [texto]="n.texto"
                [autoria]="n.autoria"
              />
            </a>
          } @else {
            <span class="dia-nota">{{ n.dia }}</span>
            <app-nota
              [alcance]="n.alcance"
              [texto]="n.texto"
              [autoria]="n.autoria"
            />
          }
        }

        @if (vazio()) {
          <div class="pf-vazio">
            <b>Nada marcado em {{ mes() }}.</b>
            <span>
              Prova ou entrega que a turma adicionar aparece aqui, no dia dela.
            </span>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .dia-nota {
      display: block;
      font-family: var(--mono);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--ink-3);
      margin-bottom: 2px;
    }
  `,
})
export class CalendarioPage {
  private readonly repo = inject(EventoRepository);
  private readonly notasRepo = inject(NotaRepository);

  protected readonly mes = signal(mesPorExtenso(new Date()));
  protected readonly carregando = this.repo.carregando;
  protected readonly erro = this.repo.erro;

  protected readonly eventos = computed(() => {
    const agora = new Date();
    return this.repo
      .eventos()
      .map((e) => ({ id: e.id, ...eventoVm(e, agora) }));
  });

  /**
   * As anotacoes do mes, ja com o dia e a assinatura prontos.
   *
   * `minha` sai do `autorNome`, e nao de comparar ids: o servidor so assina a
   * nota da TURMA, e a pessoal que ele devolve e sempre a de quem perguntou —
   * ele nunca manda a de outra pessoa. Entao "veio sem assinatura" ja significa
   * "e minha", sem a tela precisar saber quem ela e.
   */
  protected readonly erroDasNotas = this.notasRepo.erro;

  protected readonly notas = computed(() => {
    const agora = new Date();
    return this.notasRepo.notas().map((n) => ({
      id: n.id,
      alcance: n.alcance,
      texto: n.texto,
      dia: diaCurto(n.data),
      minha: !n.autorNome,
      autoria: n.autorNome
        ? assinatura(
            {
              autorId: n.autorId,
              autorNome: n.autorNome,
              criadoEm: n.criadoEm,
              atualizadoEm: n.atualizadoEm,
            },
            agora,
          )
        : null,
    }));
  });

  /** Vazio de verdade: carregou, nao falhou, e o mes nao tem nada. */
  protected readonly vazio = computed(
    () =>
      !this.carregando() && this.erro() === null && this.eventos().length === 0,
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
    const { de, ate } = limitesDoMes(new Date());
    // O repository relanca de proposito. Aqui o erro ja esta sinalizado na tela
    // pelo signal `erro`; este catch existe so para registrar e nao virar
    // rejeicao solta — nunca para transformar falha em "mes vazio".
    this.repo
      .carregarPeriodo(de, ate)
      .catch((e: unknown) =>
        console.error('[calendario] falha ao carregar o mês', e),
      );
    // O repositorio de nota nao relanca: ele guarda o erro no proprio signal e
    // mantem o que ja estava em tela. Uma falha aqui nao pode apagar os eventos.
    void this.notasRepo.carregar(de, ate);
  }
}

/** "12 set". Partida como string: `new Date` leria UTC e voltaria um dia. */
function diaCurto(data: string): string {
  const meses = [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ];
  const [, mes, dia] = data.split('-');
  const nome = meses[Number(mes) - 1];
  return nome === undefined ? data : `${Number(dia)} ${nome}`;
}
