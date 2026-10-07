import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  NgZone,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { ErroApi } from '../../core/http-error.interceptor';
import { JanelaDesfazer } from '../../core/janela-desfazer';
import { EventoRepository } from '../../data/evento.repository';
import { AuthService } from '../../core/auth.service';
import { ModeracaoRepository } from '../../data/moderacao.repository';
import { SyncRepository } from '../../data/sync.repository';
import { TurmaRepository } from '../../data/turma.repository';
import { mensagemDeErro } from '../auth/erro';
import type { EventoDetalhe } from '../../data/models';
import { EventoCardComponent } from '../../shared/evento-card.component';
import { MaterialLinhaComponent } from '../../shared/material-linha.component';
import { eventoVm } from '../evento-vm';
import { materialVm } from '../material-vm';
import { NotificacoesService } from '../../notifications/notificacoes.service';
import type { EstadoExato } from '../../notifications/notificacoes.service';
import {
  TIMEZONE_PADRAO,
  instantePersonalizado,
  rotuloInstante,
} from '../../notifications/reagendador';
import type { AlarmePersonalizado } from '../../notifications/reagendador';

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
  // `.rot-campo` e `.campo--linha` sao do formulario do design system e vivem
  // em auth.scss. Sem esta linha o motivo da moderacao era um <input> cru: com
  // encapsulamento Emulated, a classe existe no HTML e o estilo nao alcanca.
  styleUrls: ['../auth/auth.scss'],
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
              O registro foi excluído por quem criou, ou o líder tirou da lista
              da turma.
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
            [autoria]="e.autoria"
          />

          @if (e.sala) {
            <p class="sala">
              nesta vez, na sala <b>{{ e.sala }}</b>
            </p>
          }

          <!-- O líder tira da lista da turma. Não apaga: o registro continua
               existindo, com autoria, e volta em "não listados" para quem o
               criou. É o contrapeso do papel. -->
          @if (souLider()) {
            <div class="do-lider">
              @if (ocultado()) {
                <!-- A janela do desfazer: alguns segundos. Ao sair desta tela o
                     lider leva 404 neste evento, mas o caminho de volta existe —
                     "Ocultados", na tela da turma —, entao passado o tempo o
                     aviso troca o botao por essa indicacao. -->
                @if (janela.aberta()) {
                  <div class="alerta alerta--desfazer" role="status">
                    <span>Ocultado.</span>
                    <button
                      class="botao botao--fio botao--pilula"
                      type="button"
                      [disabled]="enviandoModeracao()"
                      (click)="reexibir()"
                    >
                      {{ enviandoModeracao() ? 'Desfazendo…' : 'Desfazer' }}
                    </button>
                  </div>
                } @else {
                  <p class="alerta" role="status">
                    Ocultado da turma. Para trazer de volta, abra a turma e use
                    "Reexibir" em "Ocultados".
                  </p>
                }
              } @else if (ocultando()) {
                <p class="rot-campo">
                  por quê <span class="opcional">— opcional</span>
                </p>
                <input
                  #motivo
                  class="campo--linha"
                  type="text"
                  name="motivo"
                  maxlength="140"
                  placeholder="foto indevida, duplicado…"
                  aria-label="Motivo"
                />
                <p class="pf-cache-aviso">
                  Fica registrado com o seu nome. Quem criou continua vendo o
                  registro em "não listados". Você poderá desfazer aqui mesmo,
                  logo depois — mas só até sair desta tela.
                </p>
                <button
                  class="botao"
                  type="button"
                  [disabled]="enviandoModeracao()"
                  (click)="ocultar(motivo.value)"
                >
                  {{ enviandoModeracao() ? 'Ocultando…' : 'Ocultar da turma' }}
                </button>
                <button
                  class="botao botao--fantasma"
                  type="button"
                  (click)="ocultando.set(false)"
                >
                  Cancelar
                </button>
              } @else if (pedindo()) {
                <p class="rot-campo">
                  por quê <span class="opcional">— opcional</span>
                </p>
                <input
                  #motivoPedido
                  class="campo--linha"
                  type="text"
                  name="motivo"
                  maxlength="140"
                  placeholder="duplicado, informação errada…"
                  aria-label="Motivo"
                />
                <p class="pf-cache-aviso">
                  O pedido aparece no Meu quadro de quem criou, com o seu nome e
                  este motivo. Quem apaga é sempre a pessoa que criou — você
                  está pedindo, não apagando.
                </p>
                <button
                  class="botao"
                  type="button"
                  [disabled]="enviandoModeracao()"
                  (click)="pedirExclusao(motivoPedido.value)"
                >
                  {{ enviandoModeracao() ? 'Enviando…' : 'Enviar o pedido' }}
                </button>
                <button
                  class="botao botao--fantasma"
                  type="button"
                  (click)="pedindo.set(false)"
                >
                  Cancelar
                </button>
              } @else if (pedidoEnviado()) {
                <p class="alerta" role="status">
                  <b>Pedido enviado.</b>
                  <span
                    >Ele aparece no Meu quadro de quem criou. A decisão de
                    apagar é dela.</span
                  >
                </p>
              } @else {
                <button
                  class="botao botao--fantasma"
                  type="button"
                  (click)="ocultando.set(true)"
                >
                  Ocultar da turma
                </button>
                <!-- Dois botoes porque sao duas decisoes. Ocultar tira da vista
                     agora; pedir e conversa com quem criou. Juntar as duas faria
                     o lider apagar sem querer o que so queria tirar da lista. -->
                <button
                  class="botao botao--fantasma"
                  type="button"
                  (click)="pedindo.set(true)"
                >
                  Pedir que apague
                </button>
              }
            </div>
          }

          <!-- Só para quem criou. Mostrar o botão a quem vai levar 403 é
               convidar ao erro e depois culpar a pessoa. -->
          @if (souAutor()) {
            <div class="do-autor">
              @if (confirmando()) {
                <p class="confirma">Apagar mesmo? Some da lista da turma.</p>
                <button
                  class="perigo"
                  type="button"
                  [disabled]="apagando()"
                  (click)="apagar()"
                >
                  {{ apagando() ? 'Apagando…' : 'Sim, apagar' }}
                </button>
                <button
                  class="neutro"
                  type="button"
                  (click)="confirmando.set(false)"
                >
                  Cancelar
                </button>
              } @else {
                <a class="neutro" [routerLink]="['/tabs/eventos', id, 'editar']"
                  >Editar</a
                >
                <button
                  class="neutro"
                  type="button"
                  (click)="confirmando.set(true)"
                >
                  Apagar
                </button>
              }
            </div>
            @if (erroDaAcao(); as e2) {
              <p class="pf-erro" role="alert">{{ e2 }}</p>
            }
          } @else {
            <!-- A regra dita ANTES de tentar, e nao depois de um toque negado.
                 Esconder os botoes ja evitava o 403, mas ausencia de botao e
                 silencio: quem le nao aprende a regra e acha que o app quebrou,
                 ou fica procurando a opcao que nao existe. -->
            <p class="de-outra-pessoa">
              Quem cadastrou foi <b>{{ autorDoRegistro() }}</b> — só essa pessoa
              edita ou apaga. Se a informação mudou, avise no quadro.
            </p>
          }

          <!-- O lembrete e deste aparelho, nao da turma: ninguem mais ve, e
               por isso qualquer membro marca o seu, sem ser autor nem lider. -->
          <section class="lembrete" aria-labelledby="rot-lembrete">
            <p class="pf-rotulo" id="rot-lembrete">seu lembrete</p>
            @if (!suportaLembrete) {
              <p class="pf-cache-aviso">Lembretes funcionam no app Android.</p>
            } @else if (alarmeGravado(); as g) {
              <p class="alerta" role="status">
                @if (g.passou) {
                  Já passou — era {{ g.quando }}.
                } @else {
                  Vai tocar {{ g.quando }}.
                }
              </p>
              <button
                class="botao botao--fantasma"
                type="button"
                (click)="removerAlarme()"
              >
                Remover lembrete
              </button>
            } @else if (marcando()) {
              <div class="seg" role="group" aria-label="Como marcar o lembrete">
                <button
                  type="button"
                  [attr.aria-pressed]="modoAlarme() === 'RELATIVO'"
                  (click)="modoAlarme.set('RELATIVO')"
                >
                  Antes do evento
                </button>
                <button
                  type="button"
                  [attr.aria-pressed]="modoAlarme() === 'EXATO'"
                  (click)="modoAlarme.set('EXATO')"
                >
                  Data e hora
                </button>
              </div>

              @if (modoAlarme() === 'RELATIVO') {
                <div class="antes">
                  <input
                    #quantoAntes
                    class="campo--linha"
                    type="number"
                    min="1"
                    inputmode="decimal"
                    aria-label="Quanto antes"
                    [value]="quanto()"
                    (input)="quanto.set(quantoAntes.valueAsNumber)"
                  />
                  <select
                    #unidadeAntes
                    class="campo--linha"
                    aria-label="Horas ou dias antes"
                    (change)="unidade.set(unidadeAntes.value === 'horas' ? 'horas' : 'dias')"
                  >
                    <option value="dias" [selected]="unidade() === 'dias'">
                      dias antes
                    </option>
                    <option value="horas" [selected]="unidade() === 'horas'">
                      horas antes
                    </option>
                  </select>
                </div>
                <p class="pf-cache-aviso">
                  {{
                    temHora()
                      ? 'Contando da hora do evento.'
                      : 'O evento não tem horário: conta a partir das 7h do dia.'
                  }}
                </p>
              } @else {
                <input
                  #quandoExato
                  class="campo--linha"
                  type="datetime-local"
                  aria-label="Data e hora do lembrete"
                  [value]="exatoParede()"
                  (input)="exatoParede.set(quandoExato.value)"
                />
              }

              <!-- O instante calculado ANTES de salvar: "36 horas antes" de uma
                   prova sem hora so nao surpreende se a tela disser quando. -->
              <p class="previa" role="status">
                @if (previa(); as p) {
                  @if (p.passou) {
                    Esse horário já passou — não vai tocar.
                  } @else {
                    Vai tocar {{ p.quando }}.
                  }
                } @else {
                  Escolha quando.
                }
              </p>
              <button
                class="botao"
                type="button"
                [disabled]="!podeSalvar()"
                (click)="salvarAlarme()"
              >
                Salvar lembrete
              </button>
              <button
                class="botao botao--fantasma"
                type="button"
                (click)="marcando.set(false)"
              >
                Cancelar
              </button>
            } @else {
              <button
                class="botao botao--fantasma"
                type="button"
                (click)="marcando.set(true)"
              >
                Marcar um lembrete
              </button>
            }
            @if (erroLembrete(); as e3) {
              <p class="pf-erro" role="alert">{{ e3 }}</p>
            }
            <!-- Sem o alarme exato o Android pode atrasar o lembrete em ate 1
                 hora. Dito aqui, onde a pessoa marca o dela, e com a saida ao
                 lado: o botao e o unico caminho — daqui nada abre a tela do
                 Android sozinho. -->
            @if (suportaLembrete && exato() === 'denied') {
              <p class="pf-cache-aviso" role="status">
                Sem o alarme no horário exato, o Android pode atrasar o lembrete
                em até 1 hora.
              </p>
              <button
                class="botao botao--fantasma"
                type="button"
                (click)="permitirExato()"
              >
                Permitir horário exato
              </button>
            }
          </section>

          <!-- FORA do @if de materiais de proposito. Anexar e mais necessario
               quando nao ha nada anexado; escondido ali, o botao so aparecia para
               quem ja tinha resolvido o problema. -->
          <a
            class="botao botao--fantasma anexar"
            [routerLink]="['/tabs/eventos', id, 'anexar']"
          >
            Anexar material
          </a>

          @if (materiais().length) {
            <p class="pf-rotulo">materiais</p>
            @for (m of materiais(); track m.id) {
              @if (m.url; as endereco) {
                <a
                  class="abrir"
                  [href]="endereco"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <app-material-linha
                    [tipo]="m.tipo"
                    [titulo]="m.titulo"
                    [autoria]="m.autoria"
                  />
                </a>
              } @else {
                <app-material-linha
                  [tipo]="m.tipo"
                  [titulo]="m.titulo"
                  [autoria]="m.autoria"
                />
              }
            }
          }
        }

        @if (semMaterial()) {
          <div class="pf-vazio">
            <b>Nenhum material vinculado.</b>
            <span>
              Só aparece aqui o que alguém vinculou a esta prova ou entrega — a
              matéria inteira fica na tela da matéria.
            </span>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .lembrete {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .antes {
      display: grid;
      grid-template-columns: 5.5em 1fr;
      gap: 8px;
    }

    .previa {
      margin: 0;
      font-size: 14px;
      color: var(--ink);
    }

    /* Mesmo seletor de dois lados do cadastro de evento (novo-evento.page). */
    .seg {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      padding: 4px;
      border-radius: var(--r-md);
      background: var(--rule-soft);
    }
    .seg button {
      padding: 9px 8px;
      font: inherit;
      font-size: 12.5px;
      font-weight: 600;
      text-align: center;
      color: var(--ink-2);
      background: transparent;
      border: 0;
      border-radius: var(--r-md);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .seg button[aria-pressed='true'] {
      color: var(--accent-ink);
      background: var(--accent);
    }
    .seg button:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    .de-outra-pessoa {
      font-size: 13px;
      line-height: 1.5;
      color: var(--ink-2);
      background: var(--rule-soft);
      border-left: 3px solid var(--rule);
      border-radius: var(--r-sm);
      padding: 10px 12px;
      margin: 0;
    }

    .do-lider {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .do-autor {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .do-autor .neutro,
    .do-autor .perigo {
      font: inherit;
      font-size: 13.5px;
      font-weight: 600;
      padding: 9px 14px;
      border-radius: var(--r-md);
      cursor: pointer;
      text-decoration: none;
      border: 1px solid var(--rule);
      background: var(--surface);
      color: var(--ink);
    }
    /* Apagar não é vermelho gritante: o app usa forma, não cor, para peso — e a
       confirmação já é o freio. Vermelho aqui competiria com o vermelho de erro,
       que significa outra coisa. */
    /* --ink-2, e nao vermelho, porque e exatamente o que o comentario acima
       promete. Ate 2026-09-20 estas duas linhas diziam var(--m-vermelho,
       #b91c1c): o token nunca existiu (o nome real e --m-09-vermelho), entao
       so o fallback pintava — e o fallback e o hex da HUE DA MATERIA m-09.
       Uma cor que identifica disciplina tinha virado cromo de UI, contra a
       premissa escrita no variables.scss, e media 2.68:1 no escuro. */
    .do-autor .perigo {
      border-color: var(--ink-2);
      color: var(--ink-2);
    }
    .do-autor .neutro:focus-visible,
    .do-autor .perigo:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .confirma {
      margin: 0;
      flex: 1 0 100%;
      font-size: 13px;
      color: var(--ink-2);
    }

    /* So aparece quando ha excecao. A sala de sempre nao entra aqui: repetida em
       toda prova viraria ruido que ninguem le, e ai a excecao passaria batida. */
    .sala {
      margin: 0;
      font-size: 13px;
      color: var(--ink-2);
      padding: 0 2px;
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
export class EventoPage {
  private readonly repo = inject(EventoRepository);

  private readonly detalhe = signal<EventoDetalhe | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  /** 404: excluido pelo autor ou oculto pelo lider. Nao e falha. */
  protected readonly sumiu = signal(false);

  /**
   * O "agora" da tela, e um signal: a previa do lembrete ("Vai tocar…" ou "Esse
   * horario ja passou") e o `podeSalvar` dependem dele, e um `Date.now()` solto
   * dentro de um `computed` nao recalcula — a tela aberta por minutos seguia
   * oferecendo salvar um alarme que ja tinha passado. Anda de 30 em 30 s (ver o
   * construtor).
   */
  private readonly agora = signal(new Date());

  protected readonly evento = computed(() => {
    const d = this.detalhe();
    return d === null ? null : eventoVm(d, this.agora());
  });

  protected readonly materiais = computed(() =>
    (this.detalhe()?.materiais ?? []).map((m) => materialVm(m, this.agora())),
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
  protected readonly id =
    inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly turmas = inject(TurmaRepository);
  private readonly moderacao = inject(ModeracaoRepository);

  /** O papel é lido da turma, nunca da sessão: a liderança se transfere. */
  protected readonly souLider = this.turmas.souLider;
  protected readonly ocultando = signal(false);
  /** Ficou oculto NESTA sessao de tela. O desfazer rapido vale so enquanto `janela` esta aberta. */
  protected readonly ocultado = signal(false);
  protected readonly janela = new JanelaDesfazer();
  protected readonly pedindo = signal(false);
  protected readonly pedidoEnviado = signal(false);
  protected readonly enviandoModeracao = signal(false);

  protected readonly confirmando = signal(false);
  protected readonly apagando = signal(false);
  protected readonly erroDaAcao = signal<string | null>(null);

  /**
   * Só o autor edita e apaga — é o que a tela de cadastrar promete com estas
   * palavras, e é o que o servidor aplica. Comparar aqui não é segurança (o 403
   * é), é honestidade: oferecer um botão que vai falhar ensina a pessoa a
   * desconfiar da tela.
   */
  /** Nome de quem criou. "alguém" e melhor que vazio: a frase precisa fechar. */
  protected readonly autorDoRegistro = computed(
    () => this.detalhe()?.autoria.autorNome ?? 'alguém da turma',
  );

  protected readonly souAutor = computed(() => {
    const d = this.detalhe();
    const eu = this.auth.usuario();
    return d !== null && eu !== null && d.autoria.autorId === eu.id;
  });

  /**
   * Tira da lista da turma. Não apaga.
   *
   * O motivo é opcional porque o servidor o aceita nulo. Exigir texto faria o
   * líder inventar um para conseguir agir, e motivo inventado é pior que motivo
   * ausente: ele fica no registro de moderação com cara de verdade.
   */
  protected async ocultar(motivo: string): Promise<void> {
    if (this.enviandoModeracao()) {
      return;
    }
    this.enviandoModeracao.set(true);
    this.erroDaAcao.set(null);
    try {
      await this.moderacao.ocultar(
        'evento',
        this.id,
        motivo.trim() === '' ? null : motivo.trim(),
      );
    } catch (e) {
      this.erroDaAcao.set(mensagemDeErro(e));
      return;
    } finally {
      this.enviandoModeracao.set(false);
      this.ocultando.set(false);
    }
    // NAO navega. Ocultar tira o evento da vista do proprio lider: ao sair
    // desta tela ele leva 404. Ficar aqui deixa o desfazer a um toque; passada a
    // janela, o caminho de volta e a secao "Ocultados" da turma.
    this.ocultado.set(true);
    this.janela.abrir();
  }

  /** Desfaz o ocultar. Aqui, enquanto esta tela estiver aberta; depois, pela turma. */
  protected async reexibir(): Promise<void> {
    if (this.enviandoModeracao()) {
      return;
    }
    this.enviandoModeracao.set(true);
    this.erroDaAcao.set(null);
    try {
      await this.moderacao.reexibir('evento', this.id);
      this.janela.fechar();
      this.ocultado.set(false);
    } catch (e) {
      this.erroDaAcao.set(mensagemDeErro(e));
    } finally {
      this.enviandoModeracao.set(false);
    }
  }

  /**
   * Pede que o autor apague. NÃO apaga.
   *
   * O pedido vira uma linha em "Meu quadro" de quem criou, com o nome de quem
   * pediu e o motivo. Ignorar é uma resposta válida — se fosse para o líder
   * decidir, ele apagaria, e apagar registro alheio é justamente o que o papel
   * não faz.
   */
  protected async pedirExclusao(motivo: string): Promise<void> {
    if (this.enviandoModeracao()) {
      return;
    }
    this.enviandoModeracao.set(true);
    this.erroDaAcao.set(null);
    try {
      await this.moderacao.pedirExclusao(
        'evento',
        this.id,
        motivo.trim() === '' ? null : motivo.trim(),
      );
      this.pedidoEnviado.set(true);
    } catch (e) {
      this.erroDaAcao.set(mensagemDeErro(e));
    } finally {
      this.enviandoModeracao.set(false);
      this.pedindo.set(false);
    }
  }

  protected async apagar(): Promise<void> {
    const d = this.detalhe();
    if (d === null || this.apagando()) {
      return;
    }
    this.apagando.set(true);
    this.erroDaAcao.set(null);
    try {
      // `version` no If-Match: sem ele, apagar por cima de uma edição que outra
      // pessoa fez enquanto esta tela estava aberta passaria despercebido.
      await this.repo.excluir(this.id, d.version);
    } catch (e) {
      this.erroDaAcao.set(mensagemDeErro(e));
      this.confirmando.set(false);
      return;
    } finally {
      this.apagando.set(false);
    }
    await this.router.navigateByUrl('/tabs/home');
  }

  private readonly avisos = inject(NotificacoesService);
  private readonly sync = inject(SyncRepository);
  /**
   * Se o Android deixa agendar no horario exato. Comeca `granted` de proposito:
   * o aviso de atraso so aparece depois de o sistema dizer que NAO deixa, nunca
   * como susto enquanto a resposta nao chegou.
   */
  protected readonly exato = signal<EstadoExato>('granted');
  /** Falso no navegador: lá a seção só diz que lembrete é coisa do app. */
  protected readonly suportaLembrete = this.avisos.suportado;
  /** O alarme gravado neste aparelho para este evento. Um por evento. */
  private readonly alarme = signal<AlarmePersonalizado | null>(null);
  protected readonly marcando = signal(false);
  protected readonly modoAlarme = signal<'RELATIVO' | 'EXATO'>('RELATIVO');
  protected readonly quanto = signal(1);
  protected readonly unidade = signal<'horas' | 'dias'>('dias');
  /** O valor cru do `datetime-local`: "2026-10-09T19:00", hora de parede. */
  protected readonly exatoParede = signal('');
  protected readonly erroLembrete = signal<string | null>(null);

  protected readonly temHora = computed(() => !!this.detalhe()?.hora);

  /** O alarme que o formulário descreve agora; `null` enquanto incompleto. */
  private readonly rascunho = computed<AlarmePersonalizado | null>(() => {
    if (this.modoAlarme() === 'RELATIVO') {
      const n = this.quanto();
      return n > 0
        ? {
            modo: 'RELATIVO',
            horasAntes: this.unidade() === 'dias' ? n * 24 : n,
          }
        : null;
    }
    // O `datetime-local` devolve hora de PAREDE, sem fuso. `new Date(valor)`
    // a leria no fuso da MAQUINA — certo no celular de quem esta em Sao Paulo,
    // errado no de quem viajou. Quebrada em data e hora, ela vai para
    // `instante()`, que converte como America/Sao_Paulo de forma explicita.
    const [data, hora] = this.exatoParede().split('T');
    return data && hora ? { modo: 'EXATO', data, hora } : null;
  });

  protected readonly previa = computed(() => this.descrever(this.rascunho()));
  protected readonly alarmeGravado = computed(() =>
    this.descrever(this.alarme()),
  );
  /** Passado nao agenda: salvar um alarme que nunca vai tocar seria mentir. */
  protected readonly podeSalvar = computed(() => {
    const p = this.previa();
    return p !== null && !p.passou;
  });

  protected async salvarAlarme(): Promise<void> {
    const a = this.rascunho();
    if (a === null) {
      return;
    }
    // Confere DE NOVO com o relogio de agora: o signal anda de 30 em 30 s, e o
    // botao pode ter sido tocado no meio de um intervalo em que o instante
    // acabou de passar. Atualizar o signal tambem faz a previa dizer isso.
    this.agora.set(new Date());
    if (!this.podeSalvar()) {
      return;
    }
    await this.gravarAlarme(a);
    this.marcando.set(false);
  }

  /**
   * Abre a tela "Alarmes e lembretes" do Android. So por toque da pessoa, nunca
   * dentro do agendamento: o `resume` reagenda, e abrir a tela de dentro dele
   * reabriria a tela a cada volta.
   */
  protected async permitirExato(): Promise<void> {
    try {
      this.exato.set(await this.avisos.permitirExato());
    } catch (e) {
      this.erroLembrete.set(mensagemDeErro(e));
    }
  }

  private async lerExato(): Promise<void> {
    try {
      this.exato.set(await this.avisos.estadoExato());
    } catch (e) {
      // Nao saber nao e "negado": fica como esta, sem aviso falso na tela.
      console.error('[evento] nao deu para ler o alarme exato', e);
    }
  }

  protected async removerAlarme(): Promise<void> {
    await this.gravarAlarme(null);
  }

  /**
   * Grava e reagenda. Se falhar, a tela relê o disco em vez de supor: gravar e
   * agendar sao dois passos, e a falha pode ter sido so no segundo.
   */
  private async gravarAlarme(a: AlarmePersonalizado | null): Promise<void> {
    this.erroLembrete.set(null);
    try {
      await this.avisos.salvarAlarme(this.id, a);
      this.alarme.set(a);
      // O aparelho so agenda evento que esta na ultima lista do `/sync`, e esta
      // pode ser anterior a este evento: sem baixar de novo, a tela diria "Vai
      // tocar" e nada tocaria. `forcar`: a janela de 60 s deixaria passar justo
      // a lista velha. Sem `await`, a tela nao espera o servidor acordar.
      void this.sync.reagendarAvisos(true);
      // A pessoa pode ter mexido na permissao desde que a tela abriu.
      void this.lerExato();
    } catch (e) {
      this.erroLembrete.set(mensagemDeErro(e));
      await this.lerAlarme();
    }
  }

  private async lerAlarme(): Promise<void> {
    this.alarme.set(
      (await this.avisos.config()).personalizados[this.id] ?? null,
    );
  }

  /** "sex, 9 out, 19:00", e se ja passou. Le o signal `agora`, entao recalcula quando ele anda. */
  private descrever(
    a: AlarmePersonalizado | null,
  ): { quando: string; passou: boolean } | null {
    const d = this.detalhe();
    if (a === null || d === null) {
      return null;
    }
    const t = instantePersonalizado(a, d, TIMEZONE_PADRAO);
    return t === null
      ? null
      : {
          quando: rotuloInstante(t, TIMEZONE_PADRAO),
          passou: t.getTime() <= this.agora().getTime(),
        };
  }

  constructor() {
    // O papel do usuário na turma não vem na sessão; esta tela precisa dele para
    // decidir se oferece moderar. `garantir` não refaz a chamada se já houver.
    void this.turmas.garantirCarregada();
    void this.carregar(this.id);
    if (this.suportaLembrete) {
      void this.lerAlarme();
      void this.lerExato();
    }
    // Fora da zona: um `setInterval` dentro dela nunca deixa a tela "estavel",
    // e quem espera por isso (`whenStable`, o SSR) esperaria para sempre. So o
    // tique volta para dentro, para a mudanca do signal desenhar.
    const zona = inject(NgZone);
    const relogio = zona.runOutsideAngular(() =>
      setInterval(() => zona.run(() => this.agora.set(new Date())), 30_000),
    );
    inject(DestroyRef).onDestroy(() => clearInterval(relogio));
  }

  private async carregar(id: string): Promise<void> {
    try {
      this.detalhe.set(await this.repo.detalhe(id));
    } catch (e) {
      if (e instanceof ErroApi && e.classe === 'NAO_ENCONTRADO') {
        this.sumiu.set(true);
      } else {
        // Nunca virar "nao ha material vinculado": falhar ao buscar e outra tela.
        this.erro.set(
          e instanceof Error ? e.message : 'Não deu para carregar o evento.',
        );
      }
    } finally {
      this.carregando.set(false);
    }
  }
}
