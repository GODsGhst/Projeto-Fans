import {
  ChangeDetectionStrategy,
  Component,
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

import { AuthService } from '../../core/auth.service';
import { EventoRepository } from '../../data/evento.repository';
import { HomeRepository } from '../../data/home.repository';
import { MateriaRepository } from '../../data/materia.repository';
import type { EventoDetalhe, TipoEvento } from '../../data/models';
import { SyncRepository } from '../../data/sync.repository';
import { TurmaRepository } from '../../data/turma.repository';
import { MateriaChipComponent } from '../../shared/materia-chip.component';
import { SeloComponent, prefixoDoSelo } from '../../shared/selo.component';
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
    SeloComponent,
    RouterLink,
  ],
  styleUrls: ['../auth/auth.scss'],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/home" />
        </ion-buttons>
        <ion-title>{{ editando() ? 'Editar' : 'O que vai cair' }}</ion-title>
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
              Prova e entrega pertencem a uma matéria — sem matéria não dá para
              adicionar. Crie a primeira e volte aqui.
            </span>
          </div>
          <!-- Elemento a, nao button: o teste exige que nao exista BOTAO de cadastrar
               quando nao ha materia, e ele tem razao — nao ha o que cadastrar.
               Este elemento leva embora da tela; nao envia nada dela. Aparencia
               igual, papel oposto, e a tag e o que carrega essa diferenca. -->
          <a class="botao" routerLink="/tabs/materias/nova"
            >Adicionar matéria</a
          >
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
              (click)="tipo.set('PROVA')"
            >
              Prova
            </button>
            <button
              type="button"
              data-tipo="ENTREGA"
              [attr.aria-pressed]="tipo() === 'ENTREGA'"
              (click)="tipo.set('ENTREGA')"
            >
              Entrega
            </button>
          </div>

          <p class="rot-campo">matéria</p>
          <div class="chips-pick" role="group" aria-label="Matéria">
            @for (m of materiasEscolhiveis(); track m.id) {
              <button
                type="button"
                [attr.data-materia]="m.id"
                [attr.aria-pressed]="materiaEscolhida() === m.id"
                [attr.aria-label]="m.nome"
                (click)="materiaId.set(m.id)"
              >
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
            [value]="valorInicial().titulo"
            aria-label="Título"
          />

          <p class="rot-campo">quando</p>
          <input
            #data
            class="campo--linha"
            type="date"
            [value]="valorInicial().data"
            aria-label="Data"
          />

          <p class="rot-campo">hora <span class="opcional">— opcional</span></p>
          <input
            #hora
            class="campo--linha"
            type="time"
            [value]="valorInicial().hora"
            aria-label="Hora"
          />

          <p class="rot-campo">
            sala <span class="opcional">— só se for em outra</span>
          </p>
          <input
            #sala
            class="campo--linha"
            type="text"
            maxlength="40"
            placeholder="na sala de sempre"
            [value]="valorInicial().sala"
            aria-label="Sala, se diferente da habitual"
          />

          <p class="alerta">
            <!-- Nao prometa o aviso da vespera aqui. O modulo reagendador.ts
                 calcula o horario e e testado, mas ninguem o chama e nao ha
                 plugin de notificacao instalado: o app nunca agendou nada. A
                 frase antiga dizia que o aviso da vespera saia as 19h — quem
                 lesse confiaria e perderia a prova. Ela volta quando o
                 agendamento existir de verdade, nao antes. -->
            A hora só entra se a turma precisar saber dela. Sem ela, a prova
            continua aparecendo no dia certo.
          </p>

          <p class="alerta alerta--turma" role="status">
            @if (editandoAlheio()) {
              <!-- Autoria visivel e o nao-negociavel 1: quem corrige NAO vira
                   o autor, e o card diz quem mexeu. -->
              A autoria continua sendo de <b>{{ autorDoOriginal() }}</b>: ao
              salvar, o card passa a mostrar “editado por
              {{ meuNomeNoCard() }}”. A versão de agora fica guardada no
              histórico.
            } @else if (seloAoSalvar(); as s) {
              Vai aparecer para a turma toda com o seu nome e o selo
              <app-selo [selo]="s" />. Só você pode apagar depois.
            } @else if (docenteSemSelo()) {
              Vai aparecer com o seu nome, <b>sem selo</b>: nesta matéria você
              é aluno.
            } @else {
              Vai aparecer para a turma toda com o seu nome. Só você pode editar
              ou apagar depois.
            }
          </p>

          <button
            class="botao"
            type="button"
            [disabled]="enviando()"
            (click)="
              cadastrar(titulo.value, data.value, hora.value, sala.value)
            "
          >
            {{ rotuloDoBotao() }}
          </button>
        }
      </div>
    </ion-content>
  `,
  styles: `
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
  private readonly sync = inject(SyncRepository);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly turmas = inject(TurmaRepository);

  protected readonly materias = this.materiasRepo.materias;
  protected readonly carregando = this.materiasRepo.carregando;
  protected readonly erroDasMaterias = this.materiasRepo.erro;

  /**
   * `?tipo=PROVA|ENTREGA&materiaId=` — os atalhos do painel do docente abrem esta
   * tela ja com o tipo (e a materia, quando so ha uma declarada). Valor que nao
   * for um dos dois tipos e ignorado: o padrao e o de sempre, nunca um tipo
   * inventado pela URL.
   */
  private readonly consulta = inject(ActivatedRoute).snapshot.queryParamMap;
  protected readonly tipo = signal<TipoEvento>(
    this.consulta.get('tipo') === 'ENTREGA' ? 'ENTREGA' : 'PROVA',
  );
  protected readonly materiaId = signal<string | null>(null);
  /** Pre-escolha da URL; so vale se a materia existir na turma (ver `materiaEscolhida`). */
  private readonly materiaDaRota = this.consulta.get('materiaId');
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);

  private readonly espera = new Espera();

  /**
   * O `id` na rota é o que separa adicionar de editar.
   *
   * A mesma página atende os dois porque é o MESMO formulário: seis campos, a
   * mesma validação, a mesma lista de matérias. Duas páginas seriam ~150 linhas
   * de quase-cópia, e quase-cópia diverge — o campo de sala entrou aqui num dia
   * em que uma segunda página teria ficado para trás sem ninguém notar.
   */
  private readonly editandoId =
    inject(ActivatedRoute).snapshot.paramMap.get('id') || null;
  protected readonly editando = computed(() => this.original() !== null);

  /** O evento sendo editado; `null` no modo de adicionar. */
  private readonly original = signal<EventoDetalhe | null>(null);

  /** O que os campos mostram ao abrir. Vazio quando é um evento novo. */
  protected readonly valorInicial = computed(() => {
    const o = this.original();
    return {
      titulo: o?.titulo ?? '',
      data: o?.data ?? '',
      // O servidor devolve "19:00:00"; o input type=time mostraria os segundos e
      // devolveria "19:00:00" no PATCH. Corta para HH:mm, como eventoVm.
      hora: o?.hora ? o.hora.slice(0, 5) : '',
      sala: o?.sala ?? '',
    };
  });

  /** Sem materia de verdade: carregou, nao falhou, e a turma nao tem nenhuma. */
  protected readonly semMateria = computed(
    () =>
      !this.carregando() &&
      this.erroDasMaterias() === null &&
      this.materias().length === 0,
  );

  /**
   * Corrigir o registro de OUTRA pessoa (so docente chega aqui: o servidor so
   * deixa quem alcanca a materia). Muda o aviso e a lista de materias.
   */
  protected readonly editandoAlheio = computed(() => {
    const o = this.original();
    const eu = this.auth.usuario();
    return o !== null && eu !== null && o.autoria.autorId !== eu.id;
  });

  /**
   * Ao corrigir registro alheio, so as materias que a pessoa alcanca: o servidor
   * confere origem E destino, e oferecer outra levaria o professor a um 403 so
   * depois de preencher tudo.
   */
  protected readonly materiasEscolhiveis = computed(() =>
    this.editandoAlheio()
      ? this.materias().filter((m) => this.turmas.alcanca(m.id))
      : this.materias(),
  );

  /**
   * A tocada (ou a do registro, ao editar); senao a da URL, se existir na turma;
   * senao a primeira — um seletor sem escolha feita nao ajuda ninguem.
   */
  protected readonly materiaEscolhida = computed(() => {
    const lista = this.materiasEscolhiveis();
    return (
      this.materiaId() ??
      lista.find((m) => m.id === this.materiaDaRota)?.id ??
      lista[0]?.id ??
      null
    );
  });

  /** O selo que este registro vai levar, para AVISAR antes de salvar. */
  protected readonly seloAoSalvar = computed(() =>
    this.turmas.seloNa(this.materiaEscolhida()),
  );

  /** Conta docente, turma ja lida, e nenhum poder na materia escolhida. */
  protected readonly docenteSemSelo = computed(
    () =>
      this.auth.ehDocente() &&
      this.turmas.turma() !== null &&
      this.seloAoSalvar() === null,
  );

  protected readonly autorDoOriginal = computed(
    () => this.original()?.autoria.autorNome ?? '',
  );

  /** "Prof. Marcos" / "Coord. Helena": como o card vai assinar a correcao. */
  protected readonly meuNomeNoCard = computed(
    () => prefixoDoSelo(this.seloAoSalvar()) + (this.auth.usuario()?.nome ?? ''),
  );

  protected readonly rotuloDoBotao = computed(() => {
    const editando = this.editando();
    if (!this.enviando()) {
      return editando ? 'Salvar' : 'Adicionar';
    }
    if (this.espera.demorando()) {
      return 'Acordando o servidor…';
    }
    return editando ? 'Salvando…' : 'Adicionando…';
  });

  constructor() {
    // O repositorio relanca de proposito e a tela ja mostra o erro pelo signal.
    // Este catch registra e evita rejeicao solta — nunca vira "sem materia".
    this.materiasRepo
      .carregar()
      .catch((e: unknown) =>
        console.error('[novo-evento] falha ao carregar as matérias', e),
      );

    // O alcance vem da turma. Aluno nunca tem poder, entao nao pergunta: so a
    // conta docente precisa do aviso de selo e da lista filtrada.
    if (this.auth.ehDocente()) {
      void this.turmas.garantirCarregada();
    }

    // Falsy, não `!== null`: rota sem o parâmetro devolve `null` no Angular e
    // `undefined` num Map, e um `GET /eventos/undefined` é o tipo de chamada que
    // vaza para produção porque no teste "só" polui o console.
    if (this.editandoId) {
      void this.carregarOriginal(this.editandoId);
    }
  }

  private async carregarOriginal(id: string): Promise<void> {
    try {
      const evento = await this.eventos.detalhe(id);
      this.original.set(evento);
      this.tipo.set(evento.tipo);
      this.materiaId.set(evento.materiaId);
    } catch (e) {
      // Sem o original não dá para editar: salvar mandaria campos em branco por
      // cima do que existe, e PATCH aqui SUBSTITUI o objeto inteiro.
      this.erro.set(mensagemDeErro(e));
    }
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
    const original = this.original();
    let alvo = original?.id ?? '';
    try {
      const corpo = {
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
      };
      if (original !== null) {
        // `version` no If-Match: sem ele, salvar por cima da edição que outra
        // pessoa fez enquanto esta tela estava aberta passaria despercebido.
        await this.eventos.atualizar(original.id, original.version, corpo);
      } else {
        alvo = (await this.eventos.criar(corpo)).id;
      }
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
      return;
    } finally {
      this.enviando.set(false);
      this.espera.terminar();
    }

    // Os lembretes sao calculados de uma lista que o aparelho baixou ANTES deste
    // evento existir: sem baixar de novo, o alarme que a pessoa marcar na tela
    // seguinte seria gravado, a tela diria "Vai tocar" e nada tocaria. `forcar`
    // porque a janela de 60 s deixaria passar justo a lista velha. Sem `await`:
    // a tela abre ja, e `reagendarAvisos` nao lanca. Vale tambem para a edicao —
    // mudar data ou hora muda quando os avisos tocam.
    void this.sync.reagendarAvisos(true);

    // Abre o que acabou de ser criado, em vez de voltar para a Home.
    //
    // Duas razoes. A pessoa acabou de descrever a prova e quer ver que ela
    // existe — voltar para uma lista e faze-la procurar o proprio registro. E o
    // passo seguinte natural, anexar o material que ela cobre, esta nessa tela.
    //
    // A Home nao precisa mais ser recarregada aqui: ela recarrega sozinha ao
    // entrar na aba (`ionViewWillEnter`), e uma chamada a menos importa num
    // servidor que dorme.
    await this.router.navigateByUrl(`/tabs/eventos/${alvo}`);
  }
}
