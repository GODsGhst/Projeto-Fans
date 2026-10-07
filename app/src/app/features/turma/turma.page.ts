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

import { ModeracaoRepository } from '../../data/moderacao.repository';
import type {
  Ocultado,
  TipoModeravel,
} from '../../data/moderacao.repository';
import { TurmaRepository } from '../../data/turma.repository';
import type { MinhaTurma } from '../../data/turma.repository';
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
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, RouterLink],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-title>{{ turma()?.nome ?? 'A turma' }}</ion-title>
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

          @for (m of membros(); track m.usuarioId) {
            <div class="membro">
              <span class="inicial">{{ m.inicial }}</span>
              <span class="quem">
                <span class="nome">{{ m.nome }}</span>
                <span class="desde">{{ m.desde }}</span>
              </span>
              @if (m.ehLider) {
                <span class="papel">líder</span>
              } @else if (souLider() && confirmandoRemover() !== m.usuarioId) {
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
              }
            </div>
            @if (confirmandoRemover() === m.usuarioId) {
              <p class="alerta" role="status">
                <b>{{ m.nome }}</b> perde o acesso à turma. O que ele postou
                continua.
              </p>
              @if (erroDoMembro(); as e) {
                <p class="pf-erro" role="alert">{{ e }}</p>
              }
              <span class="confirmar">
                <button
                  class="botao botao--fio botao--pilula"
                  type="button"
                  [disabled]="agindo()"
                  (click)="remover(m.usuarioId)"
                >
                  {{ agindo() ? 'Removendo…' : 'Remover da turma' }}
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
      gap: 11px;
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
      flex: 1;
    }
    .membro .nome {
      font-size: 14.5px;
      font-weight: 600;
      letter-spacing: -0.01em;
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
    })),
  );

  protected readonly souLider = this.repo.souLider;

  private readonly moderacao = inject(ModeracaoRepository);

  /** Um por vez: ação rara, e duas perguntas abertas juntas confundem. */
  protected readonly confirmandoCodigo = signal(false);
  protected readonly confirmandoRemover = signal<string | null>(null);
  protected readonly agindo = signal(false);
  protected readonly erroDoCodigo = signal<string | null>(null);
  protected readonly erroDoMembro = signal<string | null>(null);
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
    void this.recarregar();
  }

  private async recarregar(): Promise<void> {
    // `carregar` não lança: a falha fica em `erro`. E se a turma sumiu (404), ele
    // já levou a pessoa embora — `souLider` volta falso e nada abaixo roda.
    await this.repo.carregar();
    if (this.souLider()) {
      await this.carregarOcultados();
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
    this.confirmandoRemover.set(usuarioId);
  }

  protected async remover(usuarioId: string): Promise<void> {
    if (this.agindo()) {
      return;
    }
    this.agindo.set(true);
    this.erroDoMembro.set(null);
    try {
      await this.repo.removerMembro(usuarioId);
      this.confirmandoRemover.set(null);
    } catch (e) {
      // A pergunta fica aberta com o motivo: a pessoa continua na turma, e a tela
      // não pode sugerir o contrário.
      this.erroDoMembro.set(mensagemDeErro(e));
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
