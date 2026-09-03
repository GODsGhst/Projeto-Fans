import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { AuthService } from '../../core/auth.service';
import { Espera } from './espera';
import { mensagemDeErro } from './erro';

/**
 * Criar conta. O passo seguinte NAO sao as abas.
 *
 * Quem acabou de se cadastrar nao tem vinculo de turma, e toda rota protegida
 * passa pelo TurmaScopeResolver, que responde 404 para usuario sem vinculo. Cair
 * nas abas agora seria um app inteiro vazio sem explicacao — entao daqui a
 * pessoa vai para /entrar-turma, com a sessao ja valida (o POST /turmas/entrar
 * exige Bearer).
 */
@Component({
  selector: 'app-cadastro',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
  ],
  styleUrls: ['./auth.scss'],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/login" />
        </ion-buttons>
        <ion-title>Criar conta</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="pf-auth">
        @if (erro(); as e) {
          <p class="pf-erro" role="alert">{{ e }}</p>
        }

        <p class="rot-campo">seu nome</p>
        <input
          #nome
          class="campo--linha"
          type="text"
          autocomplete="name"
          placeholder="como a turma vai te ver"
          aria-label="Nome"
        />

        <p class="rot-campo">e-mail</p>
        <input
          #email
          class="campo--linha"
          type="email"
          inputmode="email"
          autocomplete="email"
          placeholder="voce@exemplo.com"
          aria-label="E-mail"
        />

        <p class="rot-campo">senha</p>
        <input
          #senha
          class="campo--linha"
          type="password"
          autocomplete="new-password"
          placeholder="mínimo 8 caracteres"
          aria-label="Senha"
        />

        <p class="alerta">
          Seu nome aparece em tudo que você postar. É assim que a turma sabe de
          quem veio a informação — não existe registro anônimo aqui.
        </p>

        <button
          class="botao"
          type="button"
          [disabled]="enviando()"
          (click)="criar(nome.value, email.value, senha.value)"
        >
          {{ rotuloDoBotao() }}
        </button>
      </div>
    </ion-content>
  `,
})
export class CadastroPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly enviando = signal(false);
  private readonly espera = new Espera();

  /**
   * O servidor gratuito dorme e leva ate ~45 s para acordar. Um botao que so
   * diz "Criando…" nesse tempo comunica travamento, nao espera.
   */
  protected readonly rotuloDoBotao = computed(() => {
    if (!this.enviando()) {
      return 'Criar conta';
    }
    return this.espera.demorando() ? 'Acordando o servidor…' : 'Criando…';
  });
  protected readonly erro = signal<string | null>(null);

  protected async criar(
    nome: string,
    email: string,
    senha: string,
  ): Promise<void> {
    if (this.enviando()) {
      return;
    }
    this.enviando.set(true);
    this.erro.set(null);
    this.espera.comecar();
    try {
      await this.auth.registrar(nome.trim(), email.trim(), senha);
      await this.router.navigateByUrl('/entrar-turma');
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
    } finally {
      this.enviando.set(false);
      this.espera.terminar();
    }
  }
}
