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
import { ModeracaoRepository } from '../../data/moderacao.repository';
import { NotaRepository } from '../../data/nota.repository';
import { TurmaRepository } from '../../data/turma.repository';
import { assinatura } from '../evento-vm';
import { eventoVm } from '../evento-vm';
import { DIAS_DA_SEMANA, mesVizinho, montarMes } from './mes';
import type { Celula } from './mes';
import { mensagemDeErro } from '../auth/erro';

/**
 * Consulta, nao entrada. Quem so quer saber "o que tem essa semana" resolve na Home.
 * Mesma linguagem visual: cor identifica a materia, forma identifica o tipo.
 *
 * A janela (`de`/`ate`) e da tela — o mes corrente —, mas quem decide o que e
 * visivel continua sendo o servidor: esta pagina renderiza `GET /eventos` na
 * ordem que veio, sem reordenar, filtrar ou cortar.
 *
 * A GRADE DO MES, que era a Task 16 pendente, existe agora. Antes disto a aba
 * era uma lista corrida — a mesma coisa que a Home ja fazia —, e nao respondia
 * "o que tem no dia 12?", que e a unica pergunta que se faz olhando um
 * calendario. A lista continua embaixo, para quem quer varrer o mes inteiro.
 *
 * O mes ANDA. Sem isso, uma prova no dia 2 do mes que vem fica invisivel
 * justamente na semana em que ela importa.
 *
 * A logica de montar o mes mora em `mes.ts`, pura e testada a parte: calendario
 * e onde vive o bug silencioso — fevereiro bissexto, o mes que comeca no
 * domingo, o fuso que joga a prova para a vespera. Nenhum aparece olhando a
 * tela.
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

        <!-- A GRADE. Antes disto o Calendario era uma lista corrida, que ja
             existe na Home: a aba nao respondia "o que tem no dia 12?", que e a
             unica pergunta que se faz olhando um calendario. -->
        <div class="cal-topo">
          <button
            class="cal-nav"
            type="button"
            (click)="andarMes(-1)"
            aria-label="Mês anterior"
          >
            ‹
          </button>
          <p class="cal-mes">{{ grade().nome }} {{ grade().ano }}</p>
          <button
            class="cal-nav"
            type="button"
            (click)="andarMes(1)"
            aria-label="Próximo mês"
          >
            ›
          </button>
        </div>

        <div class="cal">
          @for (d of diasDaSemana; track $index) {
            <span class="cal-hd">{{ d }}</span>
          }
          @for (c of grade().celulas; track $index) {
            @if (c.dia === 0) {
              <span class="cal-vazio"></span>
            } @else {
              <button
                type="button"
                class="cal-dia"
                [class.tem-prova]="c.temProva"
                [class.tem-entrega]="c.temEntrega"
                [attr.aria-pressed]="c.data === diaAberto()"
                [attr.aria-label]="rotuloDoDia(c)"
                (click)="abrirDia(c.data)"
              >
                <span class="num">{{ c.dia }}</span>
                <span class="marcas">
                  @for (cor of c.cores; track cor) {
                    <u [style.--c]="cor"></u>
                  }
                  @if (c.temNota) {
                    <u class="marca-nota"></u>
                  }
                </span>
              </button>
            }
          }
        </div>

        @if (diaAberto(); as dia) {
          <div class="dia-painel">
            <p class="pf-rotulo">{{ tituloDoDiaAberto() }}</p>

            @for (e of eventosDoDia(); track e.id) {
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

            @for (n of notasDoDia(); track n.id) {
              <app-nota
                [alcance]="n.alcance"
                [texto]="n.texto"
                [autoria]="n.autoria"
              />
            }

            @if (!eventosDoDia().length && !notasDoDia().length) {
              <!-- Vazio de um dia especifico nao pode se parecer com falha, e
                   nem com "a turma nao marcou nada este mes". -->
              <p class="dia-vazio">Nada marcado neste dia.</p>
            }

            <!-- Anotar e acao sobre UM dia, entao mora no dia. E o unico lugar
                 de onde o ?dia= da tela de anotacao chega preenchido. -->
            <a
              class="botao botao--fantasma"
              [routerLink]="['/tabs/notas/nova']"
              [queryParams]="{ dia: dia }"
              >Anotar neste dia</a
            >
          </div>
        }

        @if (eventos().length) {
          <p class="pf-rotulo">tudo de {{ grade().nome }}</p>
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

        @if (erroDaModeracao(); as e) {
          <p class="pf-erro" role="alert">{{ e }}</p>
        }

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
            @if (!n.visivelTurma) {
              <!-- O autor precisa saber POR QUE ninguem comentou o recado dele.
                   Sem esta linha ele ve a anotacao normal e conclui que a turma
                   ignorou — quando na verdade a turma nunca viu. -->
              <p class="nota-oculta">
                O líder tirou esta anotação da lista da turma. Só você ainda vê.
              </p>
            }
          } @else {
            <span class="dia-nota">{{ n.dia }}</span>
            <app-nota
              [alcance]="n.alcance"
              [texto]="n.texto"
              [autoria]="n.autoria"
            />
            @if (souLider() && n.alcance === 'TURMA') {
              <!-- O lider so oculta o que ele consegue LER. Rascunho pessoal de
                   outra pessoa nunca chega aqui, entao nao ha botao para ele. -->
              <button
                class="ocultar-nota"
                type="button"
                [disabled]="moderando()"
                (click)="ocultarNota(n.id)"
              >
                Ocultar da turma
              </button>
            }
          }
        }

        @if (vazio()) {
          <div class="pf-vazio">
            <b>Nada marcado em {{ grade().nome }}.</b>
            <span>
              Prova ou entrega que a turma adicionar aparece aqui, no dia dela.
            </span>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .cal-topo {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .cal-mes {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .cal-nav {
      font: inherit;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
      width: 36px;
      height: 36px;
      border-radius: var(--r-pill);
      border: 1px solid var(--rule);
      background: transparent;
      color: var(--ink-2);
    }
    .cal-nav:active {
      transform: scale(0.92);
    }

    .cal {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 3px;
    }
    .cal-hd {
      font-size: 10.5px;
      font-weight: 600;
      color: var(--ink-3);
      text-align: center;
      padding-bottom: 4px;
    }
    .cal-vazio {
      aspect-ratio: 1;
    }
    .cal-dia {
      font: inherit;
      font-size: 13px;
      background: none;
      border: 0;
      cursor: pointer;
      aspect-ratio: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      border-radius: var(--r-sm);
      color: var(--ink);
      -webkit-tap-highlight-color: transparent;
    }
    .cal-dia:active {
      transform: scale(0.88);
    }
    /* Prova e fundo cheio; entrega e contorno. Forma, nao cor: sobrevive a
       escala de cinza e ao daltonismo, como no resto do app. */
    .cal-dia.tem-prova {
      background: var(--prova-bg);
      color: var(--prova-fg);
      font-weight: 700;
      box-shadow: var(--e1);
    }
    .cal-dia.tem-entrega:not(.tem-prova) {
      box-shadow: inset 0 0 0 1px var(--rule);
    }
    .cal-dia[aria-pressed='true'] {
      outline: 2px solid var(--accent);
      outline-offset: 1px;
    }
    .cal-dia:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 1px;
    }
    .cal-dia .marcas {
      display: flex;
      gap: 2px;
      height: 4px;
    }
    .cal-dia .marcas u {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--c);
      display: block;
    }
    /* A anotacao nao tem cor de materia: marca vazada, para nao ser lida como
       mais uma disciplina. */
    .cal-dia .marca-nota {
      background: none;
      box-shadow: inset 0 0 0 1px var(--ink-3);
    }

    .dia-painel {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px;
      border-radius: var(--r-md);
      background: var(--surface);
      border: 1px solid var(--rule);
      box-shadow: var(--e1);
    }
    .dia-vazio {
      margin: 0;
      font-size: 13px;
      color: var(--ink-3);
    }

    .ocultar-nota {
      font: inherit;
      font-size: 12px;
      cursor: pointer;
      align-self: flex-start;
      padding: 5px 10px;
      margin-bottom: 4px;
      border-radius: var(--r-pill);
      border: 1px solid var(--rule);
      background: transparent;
      color: var(--ink-2);
    }
    .nota-oculta {
      font-size: 12px;
      line-height: 1.45;
      color: var(--ink-2);
      background: var(--rule-soft);
      border-left: 3px solid var(--rule);
      padding: 7px 10px;
      margin: 0 0 4px;
    }
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
  private readonly moderacao = inject(ModeracaoRepository);
  private readonly turmaRepo = inject(TurmaRepository);

  protected readonly diasDaSemana = DIAS_DA_SEMANA;

  /**
   * O mes em foco. Comeca no de hoje, mas ANDA — sem isso, uma prova no dia 2
   * do mes que vem fica invisivel justamente na semana em que ela importa.
   */
  private readonly emFoco = signal({
    ano: new Date().getFullYear(),
    mes: new Date().getMonth(),
  });

  /** O dia que o painel esta mostrando. `null` = nenhum aberto. */
  protected readonly diaAberto = signal<string | null>(null);
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
  protected readonly souLider = this.turmaRepo.souLider;
  protected readonly moderando = signal(false);
  protected readonly erroDaModeracao = signal<string | null>(null);

  /**
   * A grade, montada a partir do que ja foi carregado — nenhuma requisicao
   * nova. O mes inteiro ja esta na mao; filtrar por dia e trabalho de cliente.
   */
  protected readonly grade = computed(() => {
    const { ano, mes } = this.emFoco();
    return montarMes(
      ano,
      mes,
      this.repo.eventos().map((e) => ({
        data: e.data,
        tipo: e.tipo,
        cor: e.materiaCorHex,
      })),
      this.notasRepo.notas().map((n) => n.data),
    );
  });

  protected readonly eventosDoDia = computed(() => {
    const dia = this.diaAberto();
    const agora = new Date();
    return this.repo
      .eventos()
      .filter((e) => e.data === dia)
      .map((e) => ({ id: e.id, ...eventoVm(e, agora) }));
  });

  protected readonly notasDoDia = computed(() =>
    this.notas().filter((n) => n.data === this.diaAberto()),
  );

  protected readonly tituloDoDiaAberto = computed(() => {
    const dia = this.diaAberto();
    if (dia === null) {
      return '';
    }
    // Partido como string: `new Date('2026-09-12')` le UTC e, num fuso
    // negativo, mostra o dia 11.
    const [, , d] = dia.split('-');
    return `${Number(d)} de ${this.grade().nome.toLowerCase()}`;
  });

  protected readonly notas = computed(() => {
    const agora = new Date();
    return this.notasRepo.notas().map((n) => ({
      id: n.id,
      alcance: n.alcance,
      texto: n.texto,
      data: n.data,
      dia: diaCurto(n.data),
      minha: !n.autorNome,
      visivelTurma: n.visivelTurma,
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
    this.carregarMes();
  }

  /** Anda um mês e recarrega. O painel do dia fecha: ele era de outro mês. */
  protected andarMes(passo: number): void {
    const { ano, mes } = this.emFoco();
    this.emFoco.set(mesVizinho(ano, mes, passo));
    this.diaAberto.set(null);
    this.carregarMes();
  }

  /** Toca no dia: abre; toca de novo no mesmo: fecha. */
  protected abrirDia(data: string): void {
    this.diaAberto.set(this.diaAberto() === data ? null : data);
  }

  /** O que o leitor de tela anuncia. O pontinho colorido sozinho não fala. */
  protected rotuloDoDia(c: Celula): string {
    const marcas = [
      c.temProva ? 'prova' : '',
      c.temEntrega ? 'entrega' : '',
      c.temNota ? 'anotação' : '',
    ].filter(Boolean);
    return marcas.length === 0
      ? `Dia ${c.dia}`
      : `Dia ${c.dia}, com ${marcas.join(' e ')}`;
  }

  private carregarMes(): void {
    const { de, ate } = this.grade();
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
    // O papel e LIDO, nunca guardado na sessao: a lideranca se transfere, e uma
    // sessao antiga ofereceria "Ocultar" a quem ja nao e lider.
    void this.turmaRepo.garantirCarregada();
  }

  /** Tira a anotação da lista da turma. Não apaga: o autor continua vendo. */
  protected async ocultarNota(id: string): Promise<void> {
    if (this.moderando()) {
      return;
    }
    this.moderando.set(true);
    this.erroDaModeracao.set(null);
    try {
      await this.moderacao.ocultar('nota', id, null);
      const { de, ate } = this.grade();
      await this.notasRepo.carregar(de, ate);
    } catch (e) {
      this.erroDaModeracao.set(mensagemDeErro(e));
    } finally {
      this.moderando.set(false);
    }
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
