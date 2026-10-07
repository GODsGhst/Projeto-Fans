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
  IonIcon,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkOutline,
  closeCircleOutline,
  documentTextOutline,
  ellipseOutline,
  flagOutline,
  hourglassOutline,
  square,
} from 'ionicons/icons';

import { AuthService } from '../../core/auth.service';
import { TurmaAtivaService } from '../../core/turma-ativa.service';
import { statusDocente, tipoDaConta } from '../../data/docente.models';
import type { TurmaDoPainel } from '../../data/docente.models';
import { PainelRepository } from '../../data/painel.repository';
import { EventoCardComponent } from '../../shared/evento-card.component';
import { MateriaChipComponent } from '../../shared/materia-chip.component';
import { eventoVm } from '../evento-vm';

/**
 * O painel do docente (spec 2.9 e 8): a entrada do app para quem da aula, no lugar
 * da Home e do Meu quadro.
 *
 * Tres perguntas, nesta ordem: em qual turma estou agora (os cartoes — tocar
 * troca), o que vem ai nas minhas materias (agrupado por turma) e onde eu crio
 * algo. O que cai, em que ordem e quantos sao calculados NO SERVIDOR; aqui se
 * renderiza na ordem que veio, como a Home.
 *
 * O aviso do topo vem do STATUS da conta, e e so um aviso: ver o painel nao e
 * poder (spec 7). Quem confere o poder a cada requisicao e o servidor.
 *
 * Carregando, falhou e vazio sao tres telas distintas: "falhei ao buscar suas
 * turmas" nunca pode se passar por "voce nao tem turma".
 */
@Component({
  selector: 'app-painel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonIcon,
    RouterLink,
    EventoCardComponent,
    MateriaChipComponent,
  ],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-title>Painel</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="pf-pilha">
        @if (carregando()) {
          <p class="pf-aviso">Carregando…</p>
        } @else if (erro(); as e) {
          <p class="pf-aviso">{{ e }}</p>
        }

        @if (faixa(); as f) {
          <div class="faixa" [class.faixa--solida]="f.solida" role="status">
            <ion-icon aria-hidden="true" [name]="f.icone" />
            <p>
              <b>{{ f.titulo }}</b> {{ f.texto }}
            </p>
          </div>
        }
        <!-- Uma por turma: a contestacao e do lider DAQUELA turma e nas outras
             nada muda. Contestada, o selo some la — o aviso diz por que. -->
        @for (t of contestadas(); track t.turmaId) {
          <div class="faixa" role="status">
            <ion-icon aria-hidden="true" name="flag-outline" />
            <p>
              <b>Contestado em {{ t.nome }}.</b> O líder contestou sua
              declaração. Lá você está como aluno, sem selo, até ele restaurar.
              Nas outras turmas nada muda.
            </p>
          </div>
        }

        @if (grupos().length) {
          <p class="pf-rotulo">minhas turmas · toque para trocar</p>
          <div class="turmas" role="group" aria-label="Turma ativa">
            @for (g of grupos(); track g.turma.turmaId) {
              <button
                type="button"
                class="tcard"
                [attr.aria-pressed]="ativa(g.turma)"
                (click)="escolher(g.turma)"
              >
                <span class="tc-topo">
                  <span class="nome">{{ g.turma.nome }}</span>
                  @if (ativa(g.turma)) {
                    <span class="ativa"
                      ><ion-icon aria-hidden="true" name="checkmark-outline" />ativa</span
                    >
                  }
                </span>
                <span class="sub"
                  >{{ g.turma.semestre ? g.turma.semestre + ' · ' : ''
                  }}{{ g.eventos.length }}
                  {{ g.eventos.length === 1 ? 'próximo' : 'próximos' }}</span
                >
                <span class="tc-linha">
                  <!-- Texto + forma + contorno, nunca so cor, e nao parece chip
                       de materia (que e pilula cheia): spec 8, Cards. -->
                  @if (g.turma.selo === 'PROFESSOR') {
                    <span class="selo selo--prof"
                      ><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 9.5 12 5l9.5 4.5L12 14z" /><path d="M6.5 11.8V16c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8v-4.2" /></svg
                      >Professor</span
                    >
                  } @else if (g.turma.selo === 'COORDENACAO') {
                    <span class="selo selo--coord"
                      ><svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 20 6v5.5c0 4.4-3.2 7.8-8 9.5-4.8-1.7-8-5.1-8-9.5V6z" /></svg
                      >Coordenação</span
                    >
                  }
                  @if (g.turma.contestado) {
                    <span class="tag"
                      ><ion-icon aria-hidden="true" name="flag-outline" />contestado</span
                    >
                  }
                  @if (g.turma.papel === 'COORDENADOR') {
                    <span class="sub">turma inteira</span>
                  } @else {
                    @for (m of g.turma.lecionadas; track m.materiaId) {
                      <app-materia-chip [cor]="m.corHex" [sigla]="m.sigla" />
                    }
                  }
                </span>
              </button>
            }
          </div>

          @for (g of grupos(); track g.turma.turmaId) {
            <p class="pf-rotulo">
              {{ g.turma.nome }} · próximos
              {{
                g.turma.papel === 'COORDENADOR'
                  ? 'da turma inteira'
                  : 'das minhas matérias'
              }}
            </p>
            <!-- O card inteiro leva ao evento, como na Home. Evento de outra
                 turma do docente abre sem trocar a ativa (spec 4). -->
            @for (e of g.eventos; track e.id) {
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
            } @empty {
              <p class="nada">{{ semProximos(g.turma) }}</p>
            }
          }
        } @else if (vazia()) {
          <div class="pf-vazio">
            <b>Nenhuma turma ainda.</b>
            <span>Entre numa turma com o código de convite.</span>
          </div>
        }

        <!-- Cria na turma ATIVA (o cabecalho decide), por isso o nome no rotulo:
             quem tem duas turmas precisa ver onde a prova vai cair. -->
        @if (turmaAtiva.nome(); as nome) {
          <p class="pf-rotulo">criar em {{ nome }}</p>
          <div class="origem" role="group" aria-label="Atalhos">
            <a routerLink="/tabs/eventos/novo" [queryParams]="{ tipo: 'PROVA' }">
              <ion-icon aria-hidden="true" name="square" />Nova prova
            </a>
            <a routerLink="/tabs/eventos/novo" [queryParams]="{ tipo: 'ENTREGA' }">
              <ion-icon aria-hidden="true" name="ellipse-outline" />Nova entrega
            </a>
            <a [routerLink]="rotaNovoMaterial()">
              <ion-icon aria-hidden="true" name="document-text-outline" />Novo material
            </a>
          </div>
        }

        <a class="botao botao--fantasma" routerLink="/entrar-turma">
          Entrar em outra turma
        </a>
      </div>
    </ion-content>
  `,
  styles: `
    .faixa { display: flex; gap: 10px; padding: 11px 13px; font-size: 13px; line-height: 1.45; background: var(--rule-soft); border: 1px dashed var(--ink-3); border-radius: var(--r-md); }
    .faixa--solida { border-style: solid; }
    .faixa ion-icon { flex: none; margin-top: 1px; font-size: 18px; color: var(--ink-2); }
    .faixa p, .nada { margin: 0; }
    .turmas { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
    .tcard, .origem a { display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--rule); border-radius: var(--r-md); box-shadow: var(--e1); }
    .tcard { gap: 7px; min-height: 96px; padding: 12px; font: inherit; color: var(--ink); text-align: left; cursor: pointer; }
    .tcard:active, .origem a:active { transform: scale(var(--press)); }
    .tcard[aria-pressed='true'] { background: var(--accent-soft); border-color: var(--accent-line); box-shadow: inset 0 0 0 1.5px var(--accent); }
    .tcard:focus-visible, .origem a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .tc-topo { display: flex; justify-content: space-between; gap: 6px; }
    .nome { font-size: 15.5px; font-weight: 700; }
    .ativa { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 700; }
    .sub, .nada { font-size: 12px; color: var(--ink-3); }
    .tcard[aria-pressed='true'] .sub { color: var(--ink-2); }
    .tc-linha { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
    .selo, .tag { display: inline-flex; align-items: center; gap: 4px; padding: 1px 7px 1px 4px; font-size: 11px; font-weight: 600; white-space: nowrap; border-radius: var(--r-sm); }
    .selo { background: var(--surface-2); border: 1px solid currentColor; }
    .selo svg { width: 12px; height: 12px; }
    .selo--prof { color: var(--ink); }
    .selo--coord { color: var(--accent); }
    .tag { color: var(--ink-2); border: 1px dashed var(--ink-3); }
    .origem { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }
    .origem a { align-items: center; gap: 7px; min-height: 76px; padding: 14px 6px; font-size: 11.5px; font-weight: 600; color: var(--ink-2); text-align: center; text-decoration: none; }
    .origem ion-icon { font-size: 22px; }
  `,
})
export class PainelPage {
  private readonly repo = inject(PainelRepository);
  private readonly auth = inject(AuthService);
  protected readonly turmaAtiva = inject(TurmaAtivaService);

  protected readonly carregando = this.repo.carregando;
  protected readonly erro = this.repo.erro;

  /**
   * Cada turma com os proximos ja formatados. Na ordem que o servidor mandou:
   * sem `sort`, sem `filter`, sem `slice`.
   */
  protected readonly grupos = computed(() => {
    const agora = new Date();
    return (this.repo.painel()?.turmas ?? []).map((turma) => ({
      turma,
      eventos: turma.proximos.map((i) => ({
        id: i.eventoId,
        ...eventoVm(i, agora),
      })),
    }));
  });

  protected readonly contestadas = computed(() =>
    this.grupos()
      .map((g) => g.turma)
      .filter((t) => t.contestado),
  );

  /** Carregou, nao falhou, e a pessoa nao tem turma. */
  protected readonly vazia = computed(
    () =>
      !this.carregando() &&
      this.erro() === null &&
      this.repo.painel() !== null &&
      this.grupos().length === 0,
  );

  /** Aviso do STATUS da conta. Aprovado nao tem aviso: nada a dizer. */
  protected readonly faixa = computed(() => {
    const usuario = this.auth.usuario();
    const conta = tipoDaConta(usuario) === 'COORDENADOR' ? 'coordenação' : 'professor';
    switch (statusDocente(usuario)) {
      case 'PENDENTE':
        return {
          icone: 'hourglass-outline',
          solida: false,
          titulo: 'Em análise.',
          texto: `Sua conta de ${conta} espera aprovação — até lá você posta como aluno, sem selo.`,
        };
      case 'RECUSADO':
        return {
          icone: 'close-circle-outline',
          solida: true,
          titulo: 'Não aprovado.',
          texto: `Seu cadastro de ${conta} não foi aprovado. Você continua nas turmas como aluno, sem selo.`,
        };
      default:
        return null;
    }
  });

  /**
   * "Novo material" precisa da materia na rota. Com uma so declarada na turma
   * ativa nao ha o que perguntar; com varias (ou nenhuma, ou coordenacao) a lista
   * de materias deixa escolher.
   */
  protected readonly rotaNovoMaterial = computed(() => {
    const ativa = this.grupos().find((g) => this.ativa(g.turma))?.turma;
    return ativa?.lecionadas.length === 1
      ? ['/tabs/materias', ativa.lecionadas[0].materiaId, 'material', 'novo']
      : ['/tabs/materias'];
  });

  constructor() {
    addIcons({
      checkmarkOutline,
      closeCircleOutline,
      documentTextOutline,
      ellipseOutline,
      flagOutline,
      hourglassOutline,
      square,
    });
  }

  protected ativa(t: TurmaDoPainel): boolean {
    return this.turmaAtiva.turmaId() === t.turmaId;
  }

  protected escolher(t: TurmaDoPainel): Promise<void> {
    return this.turmaAtiva.escolher({ turmaId: t.turmaId, nome: t.nome });
  }

  /**
   * Professor sem materia declarada nao ve nada por REGRA (o filtro e pelas
   * declaradas), nao por falta de prova: dizer so "nada nos proximos 14 dias"
   * esconderia o motivo e a unica acao que resolve.
   */
  protected semProximos(t: TurmaDoPainel): string {
    return t.papel === 'PROFESSOR' && t.lecionadas.length === 0
      ? 'Você ainda não declarou matérias aqui. Faça isso na aba Turma.'
      : 'Nada nos próximos 14 dias.';
  }

  /**
   * Recarrega toda vez que a aba aparece, como a Home: o componente das abas do
   * Ionic nasce uma vez e fica vivo, e o colega que cadastrou uma prova nao
   * apareceria ate matar o app.
   *
   * So concilia a turma ativa com um painel que CHEGOU. Falha de rede nao e "zero
   * turmas": esquecer a ativa por causa dela puniria quem so esta sem sinal.
   */
  async ionViewWillEnter(): Promise<void> {
    await this.repo.carregar();
    const painel = this.repo.painel();
    if (this.repo.erro() === null && painel !== null) {
      await this.turmaAtiva.conciliar(
        painel.turmas.map(({ turmaId, nome }) => ({ turmaId, nome })),
      );
    }
  }
}
