import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Share } from '@capacitor/share';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { AuthService } from '../../core/auth.service';
import { CODIGO_SEM_TURMA, ErroApi } from '../../core/http-error.interceptor';
import { TurmaAtivaService } from '../../core/turma-ativa.service';
import { statusDocente } from '../../data/docente.models';
import { MateriaRepository } from '../../data/materia.repository';
import { ModeracaoRepository } from '../../data/moderacao.repository';
import type {
  Ocultado,
  TipoModeravel,
} from '../../data/moderacao.repository';
import { TurmaRepository } from '../../data/turma.repository';
import type { MinhaTurma } from '../../data/turma.repository';
import { MateriaChipComponent } from '../../shared/materia-chip.component';
import { SeloComponent } from '../../shared/selo.component';
import { mensagemDeErro } from '../auth/erro';

/**
 * A turma: quem está nela e o código para entrar.
 *
 * O código é o motivo principal desta tela existir. Antes dela ele só aparecia na
 * resposta de `POST /turmas`, no instante da criação — quem fechasse o app ali
 * nunca mais o via, e turma sem código divulgável não recebe ninguém.
 *
 * O código é visível para TODO membro, não só para o líder. É o não-negociável 9
 * levado até o fim: se qualquer membro posta sem aprovação, qualquer membro
 * convida. Esconder o código do aluno faria a entrada de um calouro depender do
 * líder estar por perto — um gate de fato, com outro nome.
 *
 * Três telas diferentes, e nenhuma se parece com a outra: carregando, falhou, e a
 * turma. Falhar ao buscar não pode virar "turma vazia" — e o código, em
 * particular, ou vem do servidor ou não aparece. Código inventado é pior que
 * código nenhum: manda o calouro digitar algo que nunca vai funcionar.
 *
 * O líder ganha aqui as ferramentas do cargo: remover alguém, trocar o código e
 * reexibir o que ocultou. Nenhuma é edição de registro alheio — o líder tira
 * gente e esconde coisa, nunca reescreve o que a turma postou. Remover e trocar
 * o código perguntam antes (reexibir não precisa: desfazer não machuca
 * ninguém), e a pergunta fica na própria linha, sem diálogo por cima da tela.
 */
@Component({
  selector: 'app-turma',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    RouterLink,
    SeloComponent,
    MateriaChipComponent,
  ],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <!-- A turma lida primeiro (e a mais fresca: o lider pode ter renomeado);
             a ativa guardada cobre o docente enquanto ela ainda nao chegou. -->
        <ion-title>{{ turma()?.nome ?? turmaAtiva.nome() ?? 'A turma' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="pf-pilha">
        @if (carregando()) {
          <p class="pf-aviso">Carregando…</p>
        } @else if (erro(); as e) {
          <p class="pf-aviso">{{ e }}</p>
        }

        @if (turma(); as t) {
          <!-- O periodo so aparece se alguem informou. Turma sem periodo e uma
               turma; turma com o periodo do ano passado e uma mentira. -->
          @if (t.semestre) {
            <p class="pf-rotulo">período · {{ t.semestre }}</p>
          }

          @if (souProfessor()) {
            <!-- Vale na hora, sem fila (spec 2.3): a correcao vem depois do
                 fato, pelo lider. O status da conta so muda o que a nota diz. -->
            <p class="pf-rotulo">matérias que eu leciono</p>
            <div class="vinc" role="group" aria-label="Matérias que eu leciono">
              @for (mt of materiasDaTurma(); track mt.id) {
                <label>
                  <input
                    type="checkbox"
                    [checked]="marcadas().has(mt.id)"
                    (change)="alternarMateria(mt.id)"
                  />
                  <span class="vt">
                    <app-materia-chip [cor]="mt.corHex" [sigla]="mt.sigla" />
                    <span>{{ mt.nome }}</span>
                  </span>
                </label>
              } @empty {
                <p class="pf-cache-aviso">
                  Esta turma ainda não tem matéria. Qualquer membro cria na aba
                  Matérias.
                </p>
              }
            </div>
            @if (erroLecionadas(); as e) {
              <p class="pf-erro" role="alert">{{ e }}</p>
            }
            <button
              class="botao"
              type="button"
              data-testid="salvar-lecionadas"
              [disabled]="salvandoLecionadas()"
              (click)="salvarLecionadas()"
            >
              {{
                salvandoLecionadas()
                  ? 'Salvando…'
                  : lecionadasSalvas()
                    ? 'Salvo ✓'
                    : 'Salvar matérias'
              }}
            </button>
            <p class="pf-cache-aviso">{{ notaLecionadas() }}</p>
          }

          <p class="pf-rotulo">código de convite</p>
          <div class="bloco-codigo">
            <span class="valor" data-testid="codigo-convite">{{
              t.codigoConvite
            }}</span>
            <!-- Compartilhar vem primeiro porque e o que a pessoa quer fazer:
                 mandar o convite no grupo da turma. Copiar so serve para quem ja
                 esta com o app aberto e vai colar em algum lugar. -->
            <button class="botao" type="button" (click)="compartilhar(t)">
              Compartilhar convite
            </button>
            <button
              class="botao-copiar"
              type="button"
              (click)="copiar(t.codigoConvite)"
            >
              {{ copiado() ? 'Copiado ✓' : 'Copiar código' }}
            </button>
            <span class="explica">
              Quem tiver este código entra na turma. Ele não expira.
            </span>

            @if (souLider()) {
              <!-- Trocar o código é para quando ele vazou: o antigo morre, e
                   quem já está dentro nem percebe. Por isso pergunta antes. -->
              @if (confirmandoCodigo()) {
                <p class="alerta" role="status">
                  O código antigo para de funcionar. Quem já entrou continua.
                </p>
                @if (erroDoCodigo(); as e) {
                  <p class="pf-erro" role="alert">{{ e }}</p>
                }
                <span class="confirmar">
                  <button
                    class="botao botao--fio botao--pilula"
                    type="button"
                    [disabled]="agindo()"
                    (click)="gerarCodigo()"
                  >
                    {{ agindo() ? 'Gerando…' : 'Gerar novo código' }}
                  </button>
                  <button
                    class="botao botao--fio botao--pilula"
                    type="button"
                    [disabled]="agindo()"
                    (click)="confirmandoCodigo.set(false)"
                  >
                    Cancelar
                  </button>
                </span>
              } @else {
                <button
                  class="botao-copiar"
                  type="button"
                  (click)="pedirNovoCodigo()"
                >
                  Gerar novo código
                </button>
              }
            }
          </div>

          <p class="pf-rotulo">quem está aqui · {{ t.membros.length }}</p>

          @if (erroDaTroca(); as e) {
            <!-- Fora da pergunta de remoção: a pergunta mora na linha da pessoa,
                 e a linha some quando ela sai. -->
            <p class="pf-erro" role="alert">{{ e }}</p>
          }
          @if (erroDoDocente(); as e) {
            <p class="pf-erro" role="alert">{{ e }}</p>
          }

          @for (m of membros(); track m.usuarioId) {
            <div class="membro" [class.membro--contestado]="m.contestado">
              <span class="inicial">{{ m.inicial }}</span>
              <span class="quem">
                <span class="nome">
                  {{ m.nome }}
                  <!-- Selo = poder AQUI. Contestado nao tem, e a marca tracejada
                       diz por que (estado, nao poder). -->
                  @if (m.selo; as s) {
                    <app-selo [selo]="s" />
                  }
                  @if (m.contestado) {
                    <span class="tag">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M5 21V4" />
                        <path d="M5 5h11l-2 4 2 4H5" /></svg
                      >contestado
                    </span>
                  }
                </span>
                <span class="desde">{{ m.desde }}</span>
                @if (m.leciona) {
                  <span class="leciona">{{ m.leciona }}</span>
                }
              </span>
              @if (m.ehLider) {
                <span class="papel">líder</span>
              } @else if (
                souLider() &&
                confirmandoRemover() !== m.usuarioId &&
                confirmandoContestar() !== m.usuarioId
              ) {
                <span class="acoes">
                  @if (m.docente) {
                    <!-- Contestar nao tira ninguem da turma nem apaga o que a
                         pessoa postou: so tira o poder e o selo DAQUI. -->
                    @if (m.contestado) {
                      <button
                        class="botao botao--fio botao--pilula remover"
                        type="button"
                        [disabled]="agindo()"
                        [attr.aria-label]="'Restaurar ' + m.nome"
                        (click)="restaurar(m.usuarioId)"
                      >
                        Restaurar
                      </button>
                    } @else {
                      <button
                        class="botao botao--fio botao--pilula remover"
                        type="button"
                        [attr.aria-label]="'Contestar ' + m.nome"
                        (click)="pedirContestar(m.usuarioId)"
                      >
                        Contestar
                      </button>
                    }
                  }
                  <!-- Só em quem não é o líder: o servidor recusa remover o
                       próprio líder (409), então o botão nem é oferecido. -->
                  <button
                    class="botao botao--fio botao--pilula remover"
                    type="button"
                    [attr.aria-label]="'Remover ' + m.nome"
                    (click)="pedirRemocao(m.usuarioId)"
                  >
                    Remover
                  </button>
                </span>
              }
            </div>
            @if (confirmandoContestar() === m.usuarioId) {
              <p class="alerta" role="status">
                <b>{{ m.nome }}</b> perde o poder e o selo <b>nesta turma</b>,
                na hora — inclusive nos registros antigos. Nas outras turmas
                dele nada muda. Entrar de novo com o código não desfaz; só você,
                tocando em Restaurar.
              </p>
              <span class="confirmar">
                <button
                  class="botao botao--fio botao--pilula"
                  type="button"
                  data-testid="contestar-confirmar"
                  [disabled]="agindo()"
                  (click)="contestar(m.usuarioId)"
                >
                  {{ agindo() ? 'Contestando…' : 'Sim, contestar' }}
                </button>
                <button
                  class="botao botao--fio botao--pilula"
                  type="button"
                  [disabled]="agindo()"
                  (click)="confirmandoContestar.set(null)"
                >
                  Cancelar
                </button>
              </span>
            }
            @if (confirmandoRemover() === m.usuarioId) {
              <p class="alerta" role="status">
                <b>{{ m.nome }}</b> perde o acesso à turma. O que ele postou
                continua. Remover não bane: sem um código novo, a pessoa pode
                voltar com o código atual.
              </p>
              @if (erroDoMembro(); as e) {
                <p class="pf-erro" role="alert">{{ e }}</p>
              }
              <span class="confirmar">
                <button
                  class="botao botao--fio botao--pilula"
                  type="button"
                  data-testid="remover-confirmar"
                  [disabled]="agindo()"
                  (click)="remover(m.usuarioId)"
                >
                  {{ agindo() ? 'Removendo…' : 'Remover' }}
                </button>
                <button
                  class="botao botao--fio botao--pilula"
                  type="button"
                  data-testid="remover-e-trocar-codigo"
                  [disabled]="agindo()"
                  (click)="remover(m.usuarioId, true)"
                >
                  Remover e gerar novo código
                </button>
                <button
                  class="botao botao--fio botao--pilula"
                  type="button"
                  [disabled]="agindo()"
                  (click)="confirmandoRemover.set(null)"
                >
                  Cancelar
                </button>
              </span>
            }
          }

          @if (souLider()) {
            <!-- O desfazer que não expira: o aviso logo depois de ocultar dura
                 segundos; aqui está tudo que continua oculto, de qualquer tela. -->
            <p class="pf-rotulo">ocultados</p>
            @if (erroDosOcultados(); as e) {
              <p class="pf-aviso" role="alert">{{ e }}</p>
            }
            @if (erroDoOcultado(); as e) {
              <p class="pf-erro" role="alert">{{ e }}</p>
            }
            @if (ocultados() !== null) {
              @for (o of ocultadosVm(); track o.chave) {
                <div class="membro">
                  <span class="quem">
                    <span class="nome">{{ o.titulo }}</span>
                    <span class="desde">{{ o.detalhe }}</span>
                  </span>
                  <button
                    class="botao botao--fio botao--pilula remover"
                    type="button"
                    [disabled]="agindo()"
                    [attr.aria-label]="'Reexibir ' + o.titulo"
                    (click)="reexibir(o.original)"
                  >
                    Reexibir
                  </button>
                </div>
              } @empty {
                <div class="pf-vazio">
                  <b>Nada oculto.</b>
                  <span>O que você ocultar da turma aparece aqui.</span>
                </div>
              }
            }
          }

          <a class="botao botao--fantasma" routerLink="/tabs/ajustes"
            >Ajustes</a
          >

          @if (souLider()) {
            <a class="botao botao--fantasma" routerLink="/tabs/turma/editar"
              >Editar turma</a
            >
            <a class="botao botao--fantasma" routerLink="/tabs/turma/transferir"
              >Passar a liderança</a
            >
          }

          <p class="pf-cache-aviso">
            O líder não edita nem apaga registro de ninguém. Ele só oculta o que
            não devia estar ali, e pode transferir a liderança.
          </p>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .bloco-codigo {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 15px;
      border-radius: var(--r-md);
      background: var(--surface-2);
      border: 1px solid var(--accent-line);
      box-shadow: var(--e1);
    }
    .bloco-codigo .valor {
      font-family: var(--mono);
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-align: center;
      color: var(--ink);
      /* Selecionável de propósito: se a área de transferência falhar, dá para
         copiar à mão em vez de digitar errado. */
      user-select: all;
    }
    .bloco-codigo .explica {
      font-size: 12px;
      color: var(--ink-3);
      text-align: center;
    }

    .botao-copiar {
      font: inherit;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      padding: 11px;
      border-radius: var(--r-md);
      border: 1px solid var(--rule);
      background: transparent;
      color: var(--ink);
      transition: transform var(--dur-toque) var(--mola);
      -webkit-tap-highlight-color: transparent;
    }
    .botao-copiar:active {
      transform: scale(var(--press));
    }
    .botao-copiar:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    .membro {
      display: flex;
      align-items: center;
      /* as acoes do lider (Contestar + Remover) descem para a linha de baixo no
         celular estreito, em vez de espremer o nome */
      flex-wrap: wrap;
      gap: 8px 11px;
      padding: 11px 13px;
      border-radius: var(--r-md);
      background: var(--surface);
      border: 1px solid var(--rule);
      box-shadow: var(--e1);
    }
    .membro .inicial {
      flex: 0 0 auto;
      width: 34px;
      height: 34px;
      border-radius: var(--r-pill);
      display: grid;
      place-items: center;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 14px;
      font-weight: 700;
    }
    .membro .quem {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      flex: 1 1 11rem;
    }
    .membro .nome {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 3px 6px;
      font-size: 14.5px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .membro .leciona {
      font-size: 11.5px;
      color: var(--ink-3);
    }
    .membro .acoes {
      display: flex;
      gap: 8px;
      margin-left: auto;
    }
    /* Contestado: tracejado e sem sombra — estado, nao poder (mesma regra do
       .pf-aviso: tracejado = ausencia, solido = poder). */
    .membro--contestado {
      background: transparent;
      border-style: dashed;
      box-shadow: none;
    }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 1px 7px 1px 4px;
      border: 1px dashed var(--ink-3);
      border-radius: var(--r-sm);
      font-size: 11px;
      font-weight: 600;
      line-height: 1.5;
      color: var(--ink-2);
      white-space: nowrap;
    }
    .tag svg {
      width: 12px;
      height: 12px;
      flex: 0 0 auto;
    }

    .vinc {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .vinc label {
      display: flex;
      gap: 12px;
      align-items: center;
      min-height: 52px;
      padding: 8px 12px;
      border: 1px solid var(--rule);
      border-radius: var(--r-sm);
      background: var(--surface);
      box-shadow: var(--e1);
      font-size: 13.5px;
      cursor: pointer;
    }
    .vinc input {
      flex: 0 0 auto;
      width: 22px;
      height: 22px;
      margin: 0;
      accent-color: var(--accent);
    }
    .vinc .vt {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 9px;
      min-width: 0;
    }
    .membro .desde {
      font-size: 11.5px;
      color: var(--ink-3);
    }
    /* Ação rara do líder: pequena e no fim da linha, para não disputar o toque
       com o resto da tela. */
    .membro .remover {
      flex: 0 0 auto;
      font-size: 12px;
      padding: 5px 10px;
    }
    .confirmar {
      display: flex;
      flex-wrap: wrap; /* "Remover e gerar novo código" não cabe ao lado dos outros no celular */
      gap: 8px;
    }

    /* Líder é papel, não posto: marca discreta, sem coroa e sem destaque de cor
       que sugira hierarquia. */
    .membro .papel {
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--accent);
      background: var(--accent-soft);
      padding: 3px 8px;
      border-radius: var(--r-pill);
    }
  `,
})
export class TurmaPage {
  private readonly repo = inject(TurmaRepository);
  private readonly auth = inject(AuthService);
  private readonly materiasRepo = inject(MateriaRepository);
  protected readonly turmaAtiva = inject(TurmaAtivaService);

  protected readonly turma = this.repo.turma;
  protected readonly carregando = this.repo.carregando;
  protected readonly erro = this.repo.erro;
  protected readonly copiado = signal(false);

  protected readonly membros = computed(() =>
    (this.turma()?.membros ?? []).map((m) => ({
      usuarioId: m.usuarioId,
      nome: m.nome,
      ehLider: m.papel === 'LIDER',
      desde: entrouEm(m.entrouEm),
      inicial: (m.nome.trim()[0] ?? '?').toUpperCase(),
      docente: m.papel === 'PROFESSOR' || m.papel === 'COORDENADOR',
      selo: m.selo ?? null,
      contestado: m.contestado ?? false,
      // SIGLAS, como o servidor manda: o lider julga a declaracao por elas.
      leciona:
        m.papel === 'COORDENADOR'
          ? 'turma inteira'
          : m.papel === 'PROFESSOR'
            ? m.lecionadas?.length
              ? `leciona ${m.lecionadas.join(', ')}`
              : 'nenhuma matéria declarada'
            : '',
    })),
  );

  // ---- "Minhas materias" (professor) --------------------------------------

  protected readonly souProfessor = computed(
    () => this.repo.meuMembro()?.papel === 'PROFESSOR',
  );
  protected readonly materiasDaTurma = this.materiasRepo.materias;

  /**
   * O que o professor ja declarou. Vem das SIGLAS do proprio membro (a declaracao
   * guardada, valha ela ou nao) e do alcance (o que vale de fato): conta pendente
   * declara, fica inerte e `meuAlcance` vem vazio — so o alcance a faria sumir da
   * tela logo depois de salvar.
   */
  private readonly declaradas = computed(() => {
    const siglas = this.repo.meuMembro()?.lecionadas ?? [];
    const efetivas = this.turma()?.meuAlcance?.materiaIds ?? [];
    return new Set(
      this.materiasDaTurma()
        .filter((m) => siglas.includes(m.sigla) || efetivas.includes(m.id))
        .map((m) => m.id),
    );
  });

  /** O que a pessoa marcou e ainda nao releu; `null` = vale o que o servidor tem. */
  private readonly marcadasLocais = signal<ReadonlySet<string> | null>(null);
  protected readonly marcadas = computed(
    () => this.marcadasLocais() ?? this.declaradas(),
  );
  protected readonly salvandoLecionadas = signal(false);
  protected readonly lecionadasSalvas = signal(false);
  protected readonly erroLecionadas = signal<string | null>(null);

  /** A nota muda com a situacao da conta: e ela que diz se a declaracao ja vale. */
  protected readonly notaLecionadas = computed(() => {
    if (this.repo.meuMembro()?.contestado) {
      return 'O líder contestou sua declaração. Você pode ajustar as matérias, mas elas não valem até ele restaurar.';
    }
    switch (statusDocente(this.auth.usuario())) {
      case 'PENDENTE':
        return 'A declaração fica guardada e passa a valer quando sua conta for aprovada.';
      case 'RECUSADO':
        return 'Seu cadastro não foi aprovado: as matérias ficam guardadas, sem efeito.';
      default:
        return 'Vale na hora, sem fila. Se você marcar uma matéria que não leciona, o líder pode contestar — e você perde o selo desta turma até ele restaurar.';
    }
  });

  protected readonly souLider = this.repo.souLider;

  private readonly moderacao = inject(ModeracaoRepository);

  /** Um por vez: ação rara, e duas perguntas abertas juntas confundem. */
  protected readonly confirmandoCodigo = signal(false);
  protected readonly confirmandoRemover = signal<string | null>(null);
  protected readonly confirmandoContestar = signal<string | null>(null);
  protected readonly erroDoDocente = signal<string | null>(null);
  protected readonly agindo = signal(false);
  protected readonly erroDoCodigo = signal<string | null>(null);
  protected readonly erroDoMembro = signal<string | null>(null);
  /** A pessoa já saiu, mas o código novo não saiu: o aviso não pode morar na linha dela. */
  protected readonly erroDaTroca = signal<string | null>(null);
  protected readonly erroDoOcultado = signal<string | null>(null);

  /** `null` = ainda não se sabe. Lista vazia é resposta ("Nada oculto"), `null` não. */
  protected readonly ocultados = signal<Ocultado[] | null>(null);
  protected readonly erroDosOcultados = signal<string | null>(null);

  protected readonly ocultadosVm = computed(() =>
    (this.ocultados() ?? []).map((o) => ({
      chave: `${o.registroTipo}:${o.registroId}`,
      titulo: o.titulo,
      detalhe: `${rotuloDoTipo(o.registroTipo)} de ${o.autorNome} · ${ocultadoEm(o.ocultadoEm)}`,
      original: o,
    })),
  );

  /**
   * Recarrega toda vez que a aba aparece, não só quando o componente nasce.
   *
   * Em abas do Ionic o componente é criado uma vez e fica vivo. Com a carga no
   * `constructor`, "Ocultados" nunca mostraria o que o líder acabou de ocultar em
   * outra aba, e quem foi removido nunca descobriria — a turma em memória
   * continuaria valendo. A carga saiu do `constructor` (não ficou nos dois)
   * porque `ionViewWillEnter` roda também na primeira entrada.
   */
  ionViewWillEnter(): void {
    void this.preparar();
  }

  private async preparar(): Promise<void> {
    await this.recarregar();
    // Materias sao carregadas uma so vez, na primeira entrada. Reloads posteriores
    // (apos salvar lecionadas, contestar, etc.) nao precisam refazer esse GET: a
    // lista de materias nunca muda.
    if (this.souProfessor()) {
      await this.carregarMaterias();
    }
  }

  private async recarregar(): Promise<void> {
    // `carregar` não lança: a falha fica em `erro`. E se a turma sumiu (404), ele
    // já levou a pessoa embora — `souLider` volta falso e nada abaixo roda.
    await this.repo.carregar();
    await this.depoisDeAgir(true);
  }

  /**
   * O que toda ação bem-sucedida faz depois que a turma foi relida. Separado de
   * `recarregar` porque contestar, restaurar e declarar matérias já releem a
   * turma DENTRO do repositório: chamar `recarregar` ali fazia um segundo
   * GET /turmas/minha igual ao primeiro.
   */
  private async depoisDeAgir(releOcultados = false): Promise<void> {
    // Ações que abriram perguntas ao lider fecham aqui: remover, contestar, gerar
    // novo código. Se falharem, a pergunta fica aberta e a tela tenta de novo.
    this.confirmandoRemover.set(null);
    this.confirmandoContestar.set(null);
    this.confirmandoCodigo.set(false);
    // O que a pessoa tinha marcado e nao salvou nao sobrevive a uma releitura:
    // vale o que o servidor tem. Nao reseta `lecionadasSalvas`: o feedback de
    // sucesso persiste ate a pessoa fazer uma nova alteracao (alternarMateria).
    this.marcadasLocais.set(null);
    // Contestar, restaurar e declarar materias nao mudam o que esta oculto:
    // reler a lista ai seria um GET a mais por toque.
    if (releOcultados && this.souLider()) {
      await this.carregarOcultados();
    }
  }

  private async carregarMaterias(): Promise<void> {
    this.erroLecionadas.set(null);
    try {
      await this.materiasRepo.carregar();
    } catch (e) {
      // A lista antiga (ou vazia) fica; o aviso diz que nao deu para atualizar.
      this.erroLecionadas.set(mensagemDeErro(e));
    }
  }

  protected alternarMateria(id: string): void {
    const atual = new Set(this.marcadas());
    if (!atual.delete(id)) {
      atual.add(id);
    }
    this.marcadasLocais.set(atual);
    this.lecionadasSalvas.set(false);
  }

  protected async salvarLecionadas(): Promise<void> {
    if (this.salvandoLecionadas()) {
      return;
    }
    this.salvandoLecionadas.set(true);
    this.erroLecionadas.set(null);
    try {
      await this.repo.declararLecionadas([...this.marcadas()]);
      this.lecionadasSalvas.set(true);
      // O repositório já releu a turma; aqui só se descarta o que estava marcado
      // localmente, porque agora vale o que o servidor gravou.
      await this.depoisDeAgir();
    } catch (e) {
      // 403 (conta que nao e de professor) e 404 (materia de outra turma) viram
      // a frase do servidor; as marcas ficam para a pessoa tentar de novo.
      this.erroLecionadas.set(mensagemDeErro(e));
    } finally {
      this.salvandoLecionadas.set(false);
    }
  }

  private async carregarOcultados(): Promise<void> {
    this.erroDosOcultados.set(null);
    try {
      this.ocultados.set(await this.moderacao.ocultados());
    } catch (e) {
      // A lista antiga fica: "não consegui atualizar" não é "nada oculto".
      this.erroDosOcultados.set(mensagemDeErro(e));
    }
  }

  protected pedirRemocao(usuarioId: string): void {
    this.erroDoMembro.set(null);
    this.confirmandoContestar.set(null);
    this.confirmandoRemover.set(usuarioId);
  }

  protected pedirContestar(usuarioId: string): void {
    this.erroDoDocente.set(null);
    this.confirmandoRemover.set(null);
    this.confirmandoContestar.set(usuarioId);
  }

  protected async contestar(usuarioId: string): Promise<void> {
    if (this.agindo()) {
      return;
    }
    this.agindo.set(true);
    this.erroDoDocente.set(null);
    try {
      // O repositório marca o contestado e relê a turma; a pergunta só fecha
      // depois disso, como no remover.
      await this.repo.contestar(usuarioId);
      await this.depoisDeAgir();
    } catch (e) {
      // A pergunta fica aberta: a pessoa continua com o poder, e a tela nao
      // pode sugerir o contrario.
      this.erroDoDocente.set(mensagemDeErro(e));
    } finally {
      this.agindo.set(false);
    }
  }

  /** Sem pergunta: restaurar so devolve o que contestar tirou, e e reversivel. */
  protected async restaurar(usuarioId: string): Promise<void> {
    if (this.agindo()) {
      return;
    }
    this.agindo.set(true);
    this.erroDoDocente.set(null);
    try {
      // O repositório já relê a turma (contestado: false, selo de volta).
      await this.repo.restaurar(usuarioId);
      await this.depoisDeAgir();
    } catch (e) {
      this.erroDoDocente.set(mensagemDeErro(e));
    } finally {
      this.agindo.set(false);
    }
  }

  /**
   * `comNovoCodigo`: remover não impede a volta — quem sai ainda tem o código
   * anotado. Gerar o código novo logo depois (a segunda chamada, de propósito, e
   * não uma rota só: são duas ações que o servidor já tem) fecha a porta.
   */
  protected async remover(
    usuarioId: string,
    comNovoCodigo = false,
  ): Promise<void> {
    if (this.agindo()) {
      return;
    }
    this.agindo.set(true);
    this.erroDoMembro.set(null);
    this.erroDaTroca.set(null);
    let saiu = false;
    try {
      await this.repo.removerMembro(usuarioId);
      saiu = true;
      this.confirmandoRemover.set(null);
      if (comNovoCodigo) {
        await this.repo.gerarNovoCodigo();
        // "Copiado ✓" era do código antigo; deixar aceso diria que o novo já foi.
        this.copiado.set(false);
      }
    } catch (e) {
      if (saiu) {
        // A pessoa JÁ saiu e a pergunta fechou junto com a linha dela: dizer só
        // "falhou" sugeriria que ela continua aqui. O código antigo segue valendo.
        this.erroDaTroca.set(
          `A pessoa saiu da turma, mas o código novo não foi gerado (${mensagemDeErro(e)}) ` +
            'Gere um novo código para ela não voltar com o atual.',
        );
      } else {
        // A pergunta fica aberta com o motivo: a pessoa continua na turma, e a
        // tela não pode sugerir o contrário.
        this.erroDoMembro.set(mensagemDeErro(e));
      }
    } finally {
      this.agindo.set(false);
    }
  }

  protected pedirNovoCodigo(): void {
    this.erroDoCodigo.set(null);
    this.confirmandoCodigo.set(true);
  }

  protected async gerarCodigo(): Promise<void> {
    if (this.agindo()) {
      return;
    }
    this.agindo.set(true);
    this.erroDoCodigo.set(null);
    try {
      await this.repo.gerarNovoCodigo();
      this.confirmandoCodigo.set(false);
      // "Copiado ✓" era do código antigo; deixar aceso diria que o novo já foi.
      this.copiado.set(false);
    } catch (e) {
      this.erroDoCodigo.set(mensagemDeErro(e));
    } finally {
      this.agindo.set(false);
    }
  }

  protected async reexibir(o: Ocultado): Promise<void> {
    if (this.agindo()) {
      return;
    }
    this.agindo.set(true);
    this.erroDoOcultado.set(null);
    try {
      await this.moderacao.reexibir(tipoModeravel(o), o.registroId);
      // Sai da lista já: o POST deu certo, e é isso que a tela tem de mostrar
      // mesmo que a releitura abaixo falhe.
      this.ocultados.update((lista) =>
        (lista ?? []).filter(
          (x) =>
            !(x.registroTipo === o.registroTipo && x.registroId === o.registroId),
        ),
      );
      await this.carregarOcultados();
    } catch (e) {
      this.erroDoOcultado.set(mensagemDeErro(e));
      // 404: o registro deixou de ser da turma desde que a lista foi lida (uma
      // anotação que o autor tornou pessoal, por exemplo). A linha que a pessoa
      // tocou é velha, e as outras podem ser também: reler em vez de deixá-la
      // tentando de novo um item que não existe mais. SEM_TURMA não: a pessoa está
      // sendo levada embora, e a lista não é mais dela.
      if (
        e instanceof ErroApi &&
        e.status === 404 &&
        e.codigo !== CODIGO_SEM_TURMA
      ) {
        await this.carregarOcultados();
      }
    } finally {
      this.agindo.set(false);
    }
  }

  /**
   * Manda o convite pelo compartilhamento do proprio celular.
   *
   * O codigo vai DENTRO do texto, nao anexado de outro jeito: quem recebe le uma
   * mensagem que ja diz de que turma se trata e como entrar. Mensagem sem o
   * codigo obriga o convidado a voltar e perguntar, que e o oposto de convidar.
   *
   * Sem `Share` — WebView antigo, navegador, permissao negada — cai para a area
   * de transferencia. Nao vira erro de tela: o objetivo e a pessoa SAIR daqui
   * com o codigo na mao, e o clipboard cumpre isso. Falhar os dois tambem nao
   * vira erro, porque o codigo continua escrito na tela e selecionavel.
   */
  protected async compartilhar(turma: MinhaTurma): Promise<void> {
    try {
      await Share.share(convite(turma));
    } catch {
      await this.copiar(turma.codigoConvite);
    }
  }

  protected async copiar(codigo: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(codigo);
      this.copiado.set(true);
    } catch {
      // Sem área de transferência o código continua na tela e selecionável.
      // Falhar aqui não vira erro: não impede ninguém de anotar.
      this.copiado.set(false);
    }
  }
}

/**
 * O texto do convite.
 *
 * Função pura, exportada, porque é aqui que o defeito moraria: uma mensagem sem
 * o código chega bonita e não convida ninguém — quem recebe tem de voltar e
 * perguntar como entra. `Share` é um proxy criado por `registerPlugin` e não
 * aceita spy, então testar pela chamada do plugin não prova nada; testar esta
 * função prova o que importa.
 */
export function convite(turma: Pick<MinhaTurma, 'nome' | 'codigoConvite'>): {
  title: string;
  text: string;
} {
  return {
    title: `Entrar na turma ${turma.nome}`,
    text:
      `Entra na turma ${turma.nome} no projetoFans — é onde a gente anota as provas e ` +
      `entregas. O código é ${turma.codigoConvite}.`,
  };
}

/** A rota de moderação é em minúsculas; a lista de ocultados vem em maiúsculas. */
function tipoModeravel(o: Ocultado): TipoModeravel {
  return o.registroTipo.toLowerCase() as TipoModeravel;
}

function rotuloDoTipo(tipo: Ocultado['registroTipo']): string {
  return tipo === 'NOTA' ? 'anotação' : tipo.toLowerCase();
}

/**
 * "ocultado em 1 set". Sem data (o servidor pode mandar nulo) ou ilegível vira
 * "sem data": melhor dizer que não se sabe do que inventar um dia.
 */
function ocultadoEm(iso: string | null): string {
  const quando = iso === null ? null : new Date(iso);
  if (quando === null || Number.isNaN(quando.getTime())) {
    return 'sem data';
  }
  return `ocultado em ${quando.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}`;
}

/** "entrou em 1 set". Data ilegível vira texto vazio, nunca "Invalid Date". */
function entrouEm(iso: string): string {
  const quando = new Date(iso);
  if (Number.isNaN(quando.getTime())) {
    return '';
  }
  return `entrou em ${quando.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}`;
}
