import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
import { EventoRepository } from '../../data/evento.repository';
import { AuthService } from '../../core/auth.service';
import { ModeracaoRepository } from '../../data/moderacao.repository';
import { TurmaRepository } from '../../data/turma.repository';
import { mensagemDeErro } from '../auth/erro';
import type { EventoDetalhe } from '../../data/models';
import { EventoCardComponent } from '../../shared/evento-card.component';
import { MaterialLinhaComponent } from '../../shared/material-linha.component';
import { eventoVm } from '../evento-vm';
import { materialVm } from '../material-vm';

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
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    EventoCardComponent,
    MaterialLinhaComponent, RouterLink],
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
              O registro foi excluído por quem criou, ou o líder tirou da lista da turma.
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
            [autoria]="e.autoria" />

          @if (e.sala) {
            <p class="sala">nesta vez, na sala <b>{{ e.sala }}</b></p>
          }

          <!-- O líder tira da lista da turma. Não apaga: o registro continua
               existindo, com autoria, e volta em "não listados" para quem o
               criou. É o contrapeso do papel. -->
          @if (souLider()) {
            <div class="do-lider">
              @if (ocultando()) {
                <p class="rot-campo">por quê <span class="opcional">— opcional</span></p>
                <input
                  #motivo
                  class="campo--linha"
                  type="text"
                  name="motivo"
                  maxlength="140"
                  placeholder="foto indevida, duplicado…"
                  aria-label="Motivo" />
                <p class="cache-aviso">
                  Fica registrado com o seu nome. Quem criou continua vendo o registro em "não
                  listados", e você pode reexibir.
                </p>
                <button class="botao" type="button" [disabled]="enviandoModeracao()"
                        (click)="ocultar(motivo.value)">
                  {{ enviandoModeracao() ? 'Ocultando…' : 'Ocultar da turma' }}
                </button>
                <button class="botao botao--fantasma" type="button" (click)="ocultando.set(false)">
                  Cancelar
                </button>
              } @else {
                <button class="botao botao--fantasma" type="button" (click)="ocultando.set(true)">
                  Ocultar da turma
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
                <button class="perigo" type="button" [disabled]="apagando()" (click)="apagar()">
                  {{ apagando() ? 'Apagando…' : 'Sim, apagar' }}
                </button>
                <button class="neutro" type="button" (click)="confirmando.set(false)">
                  Cancelar
                </button>
              } @else {
                <a class="neutro" [routerLink]="['/tabs/eventos', id, 'editar']">Editar</a>
                <button class="neutro" type="button" (click)="confirmando.set(true)">Apagar</button>
              }
            </div>
            @if (erroDaAcao(); as e2) {
              <p class="pf-erro" role="alert">{{ e2 }}</p>
            }
          }

          <!-- FORA do @if de materiais de proposito. Anexar e mais necessario
               quando nao ha nada anexado; escondido ali, o botao so aparecia para
               quem ja tinha resolvido o problema. -->
          <a class="botao botao--fantasma anexar" [routerLink]="['/tabs/eventos', id, 'anexar']">
            Anexar material
          </a>

          @if (materiais().length) {
            <p class="pf-rotulo">materiais</p>
            @for (m of materiais(); track m.id) {
              @if (m.url; as endereco) {
                <a class="abrir" [href]="endereco" target="_blank" rel="noopener noreferrer">
                  <app-material-linha [tipo]="m.tipo" [titulo]="m.titulo" [autoria]="m.autoria" />
                </a>
              } @else {
                <app-material-linha [tipo]="m.tipo" [titulo]="m.titulo" [autoria]="m.autoria" />
              }
            }
          }
        }

        @if (semMaterial()) {
          <div class="pf-vazio">
            <b>Nenhum material vinculado.</b>
            <span>
              Só aparece aqui o que alguém vinculou a esta prova ou entrega — a matéria inteira
              fica na tela da matéria.
            </span>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: `
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
    .do-autor .perigo {
      border-color: var(--m-vermelho, #B91C1C);
      color: var(--m-vermelho, #B91C1C);
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

  private readonly agora = new Date();

  protected readonly evento = computed(() => {
    const d = this.detalhe();
    return d === null ? null : eventoVm(d, this.agora);
  });

  protected readonly materiais = computed(() =>
    (this.detalhe()?.materiais ?? []).map((m) => materialVm(m, this.agora)),
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
  protected readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly turmas = inject(TurmaRepository);
  private readonly moderacao = inject(ModeracaoRepository);

  /** O papel é lido da turma, nunca da sessão: a liderança se transfere. */
  protected readonly souLider = this.turmas.souLider;
  protected readonly ocultando = signal(false);
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
      await this.moderacao.ocultar('evento', this.id, motivo.trim() === '' ? null : motivo.trim());
    } catch (e) {
      this.erroDaAcao.set(mensagemDeErro(e));
      return;
    } finally {
      this.enviandoModeracao.set(false);
      this.ocultando.set(false);
    }
    await this.router.navigateByUrl('/tabs/home');
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

  constructor() {
    // O papel do usuário na turma não vem na sessão; esta tela precisa dele para
    // decidir se oferece moderar. `garantir` não refaz a chamada se já houver.
    void this.turmas.garantirCarregada();
    void this.carregar(this.id);
  }

  private async carregar(id: string): Promise<void> {
    try {
      this.detalhe.set(await this.repo.detalhe(id));
    } catch (e) {
      if (e instanceof ErroApi && e.classe === 'NAO_ENCONTRADO') {
        this.sumiu.set(true);
      } else {
        // Nunca virar "nao ha material vinculado": falhar ao buscar e outra tela.
        this.erro.set(e instanceof Error ? e.message : 'Não deu para carregar o evento.');
      }
    } finally {
      this.carregando.set(false);
    }
  }
}
