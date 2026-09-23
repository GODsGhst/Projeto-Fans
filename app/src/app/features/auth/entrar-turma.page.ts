import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { ApiService } from '../../core/api.service';
import { AuthService, ROTA_LOGIN } from '../../core/auth.service';
import { mensagemDeErro } from './erro';

/** O que `POST /turmas` devolve. O `codigoConvite` é o motivo desta tela existir. */
interface TurmaCriada {
  id: string;
  nome: string;
  semestre: string | null;
  codigoConvite: string;
}

/**
 * O vínculo com a turma. Sem ele o app inteiro responde 404: o
 * TurmaScopeResolver não acha vínculo e não existe seletor de turma na UI.
 *
 * Duas saídas: entrar com o código de alguém, ou criar uma turma nova e virar
 * líder dela. Código inválido volta 404 de propósito — quem chuta código não pode
 * aprender nada sobre quais existem —, então a tela mostra a mensagem do servidor
 * e não mexe no que foi digitado.
 *
 * DEPOIS DE CRIAR, A TELA MOSTRA O CÓDIGO, e essa é a parte que não pode faltar.
 * O `POST /turmas` devolve o `codigoConvite` no corpo; a versão anterior desta
 * tela descartava a resposta e ia direto para as abas. Quem criava a turma virava
 * líder de uma turma que não conseguia convidar ninguém: o código existia no
 * banco, passou pela mão do app, e a pessoa nunca o via.
 *
 * TEM SAÍDA, e isso também não é detalhe. Quem chega aqui já tem sessão gravada em
 * disco — o cadastro grava antes de existir turma. Sem um "sair" explícito, quem
 * se cadastrasse com o e-mail errado ficaria presa entre uma turma que não quer e
 * um login que não alcança, e só reinstalar resolveria. O botão de voltar do Ionic
 * não serve: ele navega sem limpar a sessão, e a guarda traz a pessoa de volta.
 */
@Component({
  selector: 'app-entrar-turma',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent],
  styleUrls: ['./auth.scss'],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-title>{{
          criada() ? 'Turma criada' : 'Entrar na turma'
        }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="pf-auth">
        @if (criada(); as turma) {
          <!-- Passo obrigatório: sem o código na mão, a turma nasce sem ninguém. -->
          <div class="marca">
            <b>{{ turma.nome }}</b>
            <span>
              Você é o líder. Passe este código para a turma — é com ele que as
              pessoas entram, e ele não expira.
            </span>
          </div>

          <p class="rot-campo">código da turma</p>
          <p class="codigo-convite" data-testid="codigo-convite">
            {{ turma.codigoConvite }}
          </p>

          <button
            class="botao botao--fantasma"
            type="button"
            (click)="copiar(turma.codigoConvite)"
          >
            {{ copiado() ? 'Copiado ✓' : 'Copiar código' }}
          </button>

          <button class="botao" type="button" (click)="continuar()">
            Continuar
          </button>

          <p class="alerta">
            Anote em algum lugar. Ele fica no app, mas hoje só aparece aqui.
          </p>
        } @else {
          <div class="marca">
            <span>
              Peça o código para alguém que já está na turma. Ele tem até 8
              caracteres e não expira.
            </span>
          </div>

          @if (erro(); as e) {
            <p class="pf-erro" role="alert">{{ e }}</p>
          }

          <p class="rot-campo">código da turma</p>
          <input
            #codigo
            class="campo--linha campo--codigo"
            type="text"
            maxlength="8"
            autocapitalize="characters"
            placeholder="ABC12345"
            aria-label="Código da turma"
          />

          <button
            class="botao"
            type="button"
            [disabled]="enviando()"
            (click)="entrar(codigo.value)"
          >
            {{ enviando() ? 'Entrando…' : 'Entrar na turma' }}
          </button>

          <div class="divisor"><span>ou</span></div>

          @if (criandoTurma()) {
            <p class="rot-campo">nome da turma</p>
            <input
              #nome
              class="campo--linha"
              type="text"
              name="nome"
              placeholder="como a turma se chama"
              aria-label="Nome da turma"
            />

            <p class="rot-campo">
              semestre <span class="opcional">— opcional</span>
            </p>
            <input
              #semestre
              class="campo--linha"
              type="text"
              name="semestre"
              placeholder="2026.2"
              aria-label="Semestre"
            />

            <button
              class="botao"
              type="button"
              [disabled]="enviando()"
              (click)="criar(nome.value, semestre.value)"
            >
              {{ enviando() ? 'Criando…' : 'Criar turma' }}
            </button>
          } @else {
            <button
              class="botao botao--fantasma"
              type="button"
              (click)="criandoTurma.set(true)"
            >
              Criar uma turma nova
            </button>
          }

          <p class="alerta">
            Quem cria a turma vira o líder dela. O líder não edita registro de
            ninguém — ele só oculta o que não devia estar ali e transfere a
            liderança.
          </p>

          <!-- A saída. Quem chega aqui já tem sessão gravada; sem isto, entrar com
               o e-mail errado só se resolve reinstalando o app. -->
          <button class="link-txt" type="button" (click)="sair()">
            Sair desta conta
          </button>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .codigo-convite {
      margin: 0;
      font-family: var(--mono, monospace);
      font-size: 30px;
      font-weight: 700;
      letter-spacing: 0.22em;
      text-align: center;
      padding: 18px 12px;
      border-radius: var(--r-md);
      background: var(--surface-2, #fdfefc);
      border: 1px solid var(--accent-line, rgba(15, 118, 110, 0.28));
      color: var(--ink, #14181a);
      user-select: all;
    }
  `,
})
export class EntrarTurmaPage {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  protected readonly enviando = signal(false);
  protected readonly criandoTurma = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly criada = signal<TurmaCriada | null>(null);
  protected readonly copiado = signal(false);

  protected async entrar(codigo: string): Promise<void> {
    const limpo = codigo.trim().toUpperCase();
    // Validado aqui porque o servidor devolve a mesma frase genérica em inglês
    // para todo campo em branco, e "Invalid request content." não diz à pessoa
    // que ela esqueceu de digitar o código.
    if (limpo === '') {
      this.erro.set('Digite o código da turma.');
      return;
    }
    // O servidor guarda o código em caixa alta; quem digita minúsculo não pode
    // levar um 404 por causa disso.
    await this.tentar(async () => {
      await this.auth.entrarNaTurma(limpo);
      await this.router.navigateByUrl('/tabs/home');
    });
  }

  protected async criar(nome: string, semestre: string): Promise<void> {
    if (nome.trim() === '') {
      this.erro.set('Dê um nome à turma.');
      return;
    }
    await this.tentar(async () => {
      const turma = await this.api.post<TurmaCriada>('/turmas', {
        nome: nome.trim(),
        // Opcional e anulável: a turma é o grupo de pessoas, não o semestre.
        // Quem cria nem sempre sabe o período, e obrigar faz inventar — e o
        // valor inventado envelhece sem ninguém poder corrigir.
        semestre: semestre.trim() === '' ? null : semestre.trim(),
      });
      // Registrar o vínculo ANTES de mostrar o código: sem isto a guarda ainda
      // acha que a pessoa não tem turma e a devolve para cá ao tocar em Continuar.
      await this.auth.registrarTurma(turma.id);
      this.criada.set(turma);
    });
  }

  protected async copiar(codigo: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(codigo);
      this.copiado.set(true);
    } catch {
      // Sem área de transferência (permissão negada, WebView antigo) o código
      // continua na tela e selecionável — `user-select: all` no CSS. Falhar aqui
      // não pode virar erro de tela: não impede ninguém de anotar.
      this.copiado.set(false);
    }
  }

  protected async continuar(): Promise<void> {
    await this.router.navigateByUrl('/tabs/home');
  }

  protected async sair(): Promise<void> {
    await this.auth.sair();
    await this.router.navigateByUrl(ROTA_LOGIN);
  }

  private async tentar(acao: () => Promise<unknown>): Promise<void> {
    if (this.enviando()) {
      return;
    }
    this.enviando.set(true);
    this.erro.set(null);
    try {
      await acao();
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
    } finally {
      this.enviando.set(false);
    }
  }
}
