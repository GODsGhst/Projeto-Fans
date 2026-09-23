import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { EventoRepository } from '../../data/evento.repository';
import { MateriaRepository } from '../../data/materia.repository';
import type { Material } from '../../data/models';
import { mensagemDeErro } from '../auth/erro';

/**
 * Anexar material a uma prova ou entrega.
 *
 * **Por que isto e uma tela separada.** A tela da prova mostra SO o que ja esta
 * vinculado, e isso e decisao do projeto: buscar material por materia la
 * despejaria a disciplina inteira dentro de uma prova. Mas anexar exige escolher
 * entre os materiais da materia — a acao precisa de um lugar, e o lugar nao pode
 * ser dentro do conteudo da prova. Aqui a lista da materia e o assunto da tela,
 * nao um vazamento nela.
 *
 * `POST /eventos/{id}/materiais/{materialId}` e o `DELETE` correspondente ja
 * existiam no backend, e `vincularMaterial`/`desvincularMaterial` ja existiam no
 * repositorio do app — sem nenhum chamador. Esta tela e o chamador.
 *
 * O material continua pertencendo a MATERIA. Anexar nao move nada: cria um
 * vinculo. Desanexar apaga o vinculo e nao apaga o material, que continua na
 * materia para a proxima prova.
 */
@Component({
  selector: 'app-anexar-material',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    RouterLink,
  ],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button [defaultHref]="voltarPara" />
        </ion-buttons>
        <ion-title>Anexar material</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="pf-pilha">
        @if (carregando()) {
          <p class="pf-aviso">Carregando…</p>
        } @else if (erro(); as e) {
          <p class="pf-erro" role="alert">{{ e }}</p>
        }

        @if (disponiveis().length) {
          <p class="pf-rotulo">material desta matéria</p>
          @for (m of disponiveis(); track m.id) {
            <button
              class="anexavel"
              type="button"
              [attr.aria-pressed]="m.anexado"
              (click)="alternar(m.id, m.anexado)"
            >
              <span class="marca" aria-hidden="true">
                <svg viewBox="0 0 20 20">
                  <rect x="2.5" y="2.5" width="15" height="15" rx="4.5" />
                  @if (m.anexado) {
                    <path d="M6.4 10.3l2.5 2.5 4.7-5.1" />
                  }
                </svg>
              </span>
              <span class="quem">
                <span class="titulo">{{ m.titulo }}</span>
                <span class="meta">{{ m.rotuloDoTipo }}</span>
              </span>
            </button>
          }

          <p class="pf-cache-aviso">
            Anexar não move o material: ele continua na matéria e pode ser
            anexado a outra prova. Desanexar tira só o vínculo.
          </p>
        } @else if (!carregando() && semMaterial()) {
          <div class="pf-vazio">
            <b>Esta matéria ainda não tem material.</b>
            <span
              >Adicione o material na matéria e volte aqui para anexá-lo a esta
              prova.</span
            >
          </div>
          <a
            class="botao"
            [routerLink]="['/tabs/materias', materiaId(), 'material', 'novo']"
          >
            Adicionar material
          </a>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .anexavel {
      display: flex;
      align-items: center;
      gap: 11px;
      width: 100%;
      text-align: left;
      font: inherit;
      cursor: pointer;
      padding: 12px 13px;
      border-radius: var(--r-md);
      background: var(--surface);
      border: 1px solid var(--rule);
      box-shadow: var(--e1);
      color: var(--ink);
      transition: transform var(--dur-toque) var(--mola);
      -webkit-tap-highlight-color: transparent;
    }
    .anexavel:active {
      transform: scale(var(--press));
    }
    .anexavel:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    /* Anexado ganha o quadro cheio, nao so outra cor: em escala de cinza o
       estado tem de continuar legivel. Mesma regra do resto do app. */
    .anexavel .marca svg {
      width: 20px;
      height: 20px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.7;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    /* Cor cheia, nao --accent-line: aqui a borda e o UNICO indicador de que o
       item esta escolhido, e --accent-line sobre --surface compoe 1.49:1 — bem
       abaixo dos 3:1 da 1.4.11. --accent-line continua servindo onde e poco
       decorativo (turma.page.ts), que e para o que foi desenhada. */
    .anexavel[aria-pressed='true'] {
      border-color: var(--accent);
    }
    .anexavel[aria-pressed='true'] .marca svg rect {
      fill: var(--accent);
      stroke: var(--accent);
    }
    .anexavel[aria-pressed='true'] .marca svg path {
      stroke: var(--accent-ink);
    }
    .anexavel .quem {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .anexavel .titulo {
      font-size: 14.5px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .anexavel .meta {
      font-size: 11.5px;
      color: var(--ink-3);
    }
  `,
})
export class AnexarMaterialPage {
  private readonly eventos = inject(EventoRepository);
  private readonly materias = inject(MateriaRepository);

  private readonly eventoId =
    inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly voltarPara = `/tabs/eventos/${this.eventoId}`;
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly materiaId = signal('');

  private readonly daMateria = signal<Material[]>([]);
  private readonly anexados = signal<ReadonlySet<string>>(new Set());

  /** Carregou, nao falhou, e a materia nao tem material nenhum. */
  protected readonly semMaterial = computed(
    () => this.erro() === null && this.daMateria().length === 0,
  );

  protected readonly disponiveis = computed(() =>
    this.daMateria().map((m) => ({
      id: m.id,
      titulo: m.titulo,
      anexado: this.anexados().has(m.id),
      rotuloDoTipo:
        m.tipo === 'AULA' ? 'material de aula' : 'material adicional',
    })),
  );

  constructor() {
    void this.carregar();
  }

  private async carregar(): Promise<void> {
    try {
      const evento = await this.eventos.detalhe(this.eventoId);
      this.materiaId.set(evento.materiaId);
      this.anexados.set(new Set(evento.materiais.map((m) => m.id)));

      const detalhe = await this.materias.detalhe(evento.materiaId);
      this.daMateria.set([
        ...detalhe.materiaisAula,
        ...detalhe.materiaisAdicionais,
      ]);
    } catch (e) {
      // Nao limpa a lista: falhar ao buscar nao pode virar "esta materia nao tem
      // material", que e a frase oposta e manda a pessoa cadastrar de novo.
      this.erro.set(mensagemDeErro(e));
    } finally {
      this.carregando.set(false);
    }
  }

  /**
   * O estado so muda DEPOIS que o servidor confirma.
   *
   * Marcar na hora e desmarcar se falhar seria mais rapido de ver e pior de
   * confiar: material que pisca "anexado" e volta atras ensina a pessoa a nao
   * acreditar na tela — e ela vai para a prova achando que anexou.
   */
  protected async alternar(
    materialId: string,
    anexado: boolean,
  ): Promise<void> {
    this.erro.set(null);
    try {
      if (anexado) {
        await this.eventos.desvincularMaterial(this.eventoId, materialId);
      } else {
        await this.eventos.vincularMaterial(this.eventoId, materialId);
      }
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
      return;
    }
    const proximo = new Set(this.anexados());
    if (anexado) {
      proximo.delete(materialId);
    } else {
      proximo.add(materialId);
    }
    this.anexados.set(proximo);
  }
}
