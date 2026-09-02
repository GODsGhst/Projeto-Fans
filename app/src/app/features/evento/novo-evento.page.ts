import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { EventoRepository } from '../../data/evento.repository';
import { HomeRepository } from '../../data/home.repository';
import { MateriaRepository } from '../../data/materia.repository';
import type { TipoEvento } from '../../data/models';
import { MateriaChipComponent } from '../../shared/materia-chip.component';
import { Espera } from '../auth/espera';
import { mensagemDeErro } from '../auth/erro';

/**
 * Cadastrar prova ou entrega — o outro lado do app, que ate agora so lia.
 *
 * Qualquer membro posta, sem fila e sem aprovacao (nao-negociavel 9), e o
 * registro sai com o nome de quem postou: autoria e o unico mecanismo de
 * confianca deste app.
 *
 * **Hora e opcional, e isso e comum.** `null` e valor valido: obrigar horario
 * faz o aluno inventar dado, e um "00:00" mentiria sobre o combinado.
 *
 * **Sem materia nao ha evento possivel.** Um seletor vazio nao explica nada —
 * quem chega aqui antes de a turma cadastrar a primeira materia precisa de uma
 * frase e de uma porta, nao de uma lista em branco.
 */
@Component({
  selector: 'app-novo-evento',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    MateriaChipComponent,
    RouterLink,
  ],
  styleUrls: ['../auth/auth.scss'],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/home" />
        </ion-buttons>
        <ion-title>O que vai cair</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="pf-auth">
        @if (carregando()) {
          <p class="pf-aviso">Carregando…</p>
        } @else if (erroDasMaterias(); as e) {
          <!-- Falhar ao perguntar nao e "a turma nao tem materia". -->
          <p class="pf-aviso">{{ e }}</p>
        } @else if (semMateria()) {
          <div class="pf-vazio">
            <b>Nenhuma matéria cadastrada ainda.</b>
            <span>
              Prova e entrega pertencem a uma matéria — sem matéria não dá para adicionar. Crie a
              primeira e volte aqui.
            </span>
          </div>
          <!-- Classe botao-vazio, nao botao: o teste exige que NAO exista botao
               de cadastrar quando nao ha materia, e ele tem razao — nao ha o que
               cadastrar. Este link leva embora da tela, nao envia nada dela.
               Visualmente e o mesmo; semanticamente e o oposto. -->
          <a class="botao-vazio" routerLink="/tabs/materias/nova">Adicionar matéria</a>
        } @else {
          @if (erro(); as e) {
            <p class="pf-erro" role="alert">{{ e }}</p>
          }

          <p class="rot-campo">tipo</p>
          <div class="seg" role="group" aria-label="Tipo">
            <button
              type="button"
              data-tipo="PROVA"
              [attr.aria-pressed]="tipo() === 'PROVA'"
              (click)="tipo.set('PROVA')">
              Prova
            </button>
            <button
              type="button"
              data-tipo="ENTREGA"
              [attr.aria-pressed]="tipo() === 'ENTREGA'"
              (click)="tipo.set('ENTREGA')">
              Entrega
            </button>
          </div>

          <p class="rot-campo">matéria</p>
          <div class="chips-pick" role="group" aria-label="Matéria">
            @for (m of materias(); track m.id) {
              <button
                type="button"
                [attr.data-materia]="m.id"
                [attr.aria-pressed]="materiaEscolhida() === m.id"
                [attr.aria-label]="m.nome"
                (click)="materiaId.set(m.id)">
                <app-materia-chip [cor]="m.corHex" [sigla]="m.sigla" />
              </button>
            }
          </div>

          <p class="rot-campo">o que é</p>
          <input
            #titulo
            class="campo--linha"
            type="text"
            maxlength="120"
            placeholder="Prova 2 — normalização"
            aria-label="Título" />

          <p class="rot-campo">quando</p>
          <input #data class="campo--linha" type="date" aria-label="Data" />

          <p class="rot-campo">hora <span class="opcional">— opcional</span></p>
          <input #hora class="campo--linha" type="time" aria-label="Hora" />

          <p class="rot-campo">sala <span class="opcional">— só se for em outra</span></p>
          <input
            #sala
            class="campo--linha"
            type="text"
            maxlength="40"
            placeholder="na sala de sempre"
            aria-label="Sala, se diferente da habitual" />

          <p class="alerta">
            <!-- Nao prometa o aviso da vespera aqui. O modulo reagendador.ts
                 calcula o horario e e testado, mas ninguem o chama e nao ha
                 plugin de notificacao instalado: o app nunca agendou nada. A
                 frase antiga dizia que o aviso da vespera saia as 19h — quem
                 lesse confiaria e perderia a prova. Ela volta quando o
                 agendamento existir de verdade, nao antes. -->
            A hora só entra se a turma precisar saber dela. Sem ela, a prova continua aparecendo
            no dia certo.
          </p>

          <p class="alerta alerta--turma">
            Vai aparecer para a turma toda com o seu nome. Só você pode editar ou apagar depois.
          </p>

          <button
            class="botao"
            type="button"
            [disabled]="enviando()"
            (click)="cadastrar(titulo.value, data.value, hora.value, sala.value)">
            {{ rotuloDoBotao() }}
          </button>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .botao-vazio {
      display: block;
      text-align: center;
      font-size: 14.5px;
      font-weight: 700;
      padding: 14px;
      border-radius: var(--r-md);
      background: var(--accent);
      color: var(--accent-ink);
      text-decoration: none;
      box-shadow: var(--e2);
    }

    .opcional {
      font-weight: 400;
    }

    /* Link que age como botao: a saida honesta quando nao ha materia. */
    a.botao {
      display: block;
      text-align: center;
      text-decoration: none;
    }

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

    .chips-pick {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    /* Nao escolhida fica apagada, nunca recolorida: a cor identifica materia. */
    .chips-pick button {
      padding: 0;
      background: none;
      border: 0;
      opacity: 0.38;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }

    .chips-pick button[aria-pressed='true'] {
      opacity: 1;
    }

    .chips-pick button:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    .alerta--turma {
      color: var(--ink-2);
      border-color: var(--accent);
    }
  `,
})
export class NovoEventoPage {
  private readonly materiasRepo = inject(MateriaRepository);
  private readonly eventos = inject(EventoRepository);
  private readonly home = inject(HomeRepository);
  private readonly router = inject(Router);

  protected readonly materias = this.materiasRepo.materias;
  protected readonly carregando = this.materiasRepo.carregando;
  protected readonly erroDasMaterias = this.materiasRepo.erro;

  protected readonly tipo = signal<TipoEvento>('PROVA');
  protected readonly materiaId = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);

  private readonly espera = new Espera();

  /** Sem materia de verdade: carregou, nao falhou, e a turma nao tem nenhuma. */
  protected readonly semMateria = computed(
    () =>
      !this.carregando() && this.erroDasMaterias() === null && this.materias().length === 0,
  );

  /** A primeira ja vem marcada: um seletor sem escolha feita nao ajuda ninguem. */
  protected readonly materiaEscolhida = computed(
    () => this.materiaId() ?? this.materias()[0]?.id ?? null,
  );

  protected readonly rotuloDoBotao = computed(() => {
    if (!this.enviando()) {
      return 'Adicionar';
    }
    return this.espera.demorando() ? 'Acordando o servidor…' : 'Adicionando…';
  });

  constructor() {
    // O repositorio relanca de proposito e a tela ja mostra o erro pelo signal.
    // Este catch registra e evita rejeicao solta — nunca vira "sem materia".
    this.materiasRepo
      .carregar()
      .catch((e: unknown) => console.error('[novo-evento] falha ao carregar as matérias', e));
  }

  protected async cadastrar(
    titulo: string,
    data: string,
    hora: string,
    sala: string,
  ): Promise<void> {
    if (this.enviando()) {
      return;
    }
    const materiaId = this.materiaEscolhida();
    if (materiaId === null || titulo.trim() === '' || data === '') {
      this.erro.set('Escolha a matéria e preencha o que é e quando.');
      return;
    }

    this.enviando.set(true);
    this.erro.set(null);
    this.espera.comecar();
    let criado;
    try {
      criado = await this.eventos.criar({
        materiaId,
        tipo: this.tipo(),
        titulo: titulo.trim(),
        data,
        // `null`, nao `''`: hora ausente e um valor, nao um campo mal preenchido.
        hora: hora === '' ? null : hora,
        // Vazia significa "na sala de sempre" — quem le resolve olhando a
        // materia. Copiar a sala da materia para ca faria a disciplina mudar de
        // sala e reescrever onde as provas passadas aconteceram.
        sala: sala.trim() === '' ? null : sala.trim(),
      });
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
      return;
    } finally {
      this.enviando.set(false);
      this.espera.terminar();
    }

    // Abre o que acabou de ser criado, em vez de voltar para a Home.
    //
    // Duas razoes. A pessoa acabou de descrever a prova e quer ver que ela
    // existe — voltar para uma lista e faze-la procurar o proprio registro. E o
    // passo seguinte natural, anexar o material que ela cobre, esta nessa tela.
    //
    // A Home nao precisa mais ser recarregada aqui: ela recarrega sozinha ao
    // entrar na aba (`ionViewWillEnter`), e uma chamada a menos importa num
    // servidor que dorme.
    await this.router.navigateByUrl(`/tabs/eventos/${criado.id}`);
  }
}
