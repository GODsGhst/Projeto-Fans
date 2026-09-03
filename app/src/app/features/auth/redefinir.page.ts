import {
  ChangeDetectionStrategy,
  Component,
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
import { Espera } from './espera';
import { mensagemDeErro } from './erro';

/** O mesmo mínimo que o servidor exige (ResetSenhaRequest: @Size(min = 8)). */
const MINIMO = 8;

/**
 * A segunda metade do "esqueci a senha".
 *
 * A primeira metade existia inteira — tela, endpoint, token com prazo, e-mail —
 * e desembocava numa rota que não existia. `app.reset-senha-url-base` aponta
 * para `/senha/reset`, e `AuthService.resetarSenha` não tinha um único chamador:
 * quem clicasse no link do e-mail chegava numa página em branco, com um token
 * válido na mão e nenhum lugar para usá-lo.
 *
 * **Dois jeitos de trazer o token, e o segundo não é luxo.** O link do e-mail é
 * a via normal. Mas hoje o deploy roda no perfil `teste`, onde o `LogEmailSender`
 * só escreve o link no log do servidor — sem o campo de colar, o fluxo inteiro
 * fica inalcançável na única configuração em que ele de fato roda. E cliente de
 * e-mail quebra link comprido com quebra de linha, o que sobrevive à mudança
 * para SMTP de verdade.
 *
 * **A confirmação da senha é da tela, não do servidor.** Ele recebe uma senha
 * só e não tem como saber que houve um erro de digitação. Deixar passar
 * trocaria a senha por algo que a pessoa não sabe qual é — e o token, já
 * consumido, não serve para uma segunda tentativa.
 */
@Component({
  selector: 'app-redefinir',
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
  styleUrls: ['./auth.scss'],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/login" />
        </ion-buttons>
        <ion-title>Nova senha</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="pf-auth">
        @if (erro(); as e) {
          <p class="pf-erro" role="alert">{{ e }}</p>
        }

        @if (tokenDoLink === null) {
          <div class="marca">
            <b>Cole o código do e-mail.</b>
            <span>
              É o trecho depois de <code>token=</code> no link que você recebeu.
              Se o link abriu esta tela sozinho, ele já veio preenchido.
            </span>
          </div>

          <p class="rot-campo">código</p>
          <input
            #token
            class="campo--linha"
            type="text"
            name="token"
            autocapitalize="off"
            autocomplete="off"
            spellcheck="false"
            aria-label="Código de recuperação"
          />
        }

        <p class="rot-campo">senha nova</p>
        <input
          #senha
          class="campo--linha"
          type="password"
          name="senha"
          autocomplete="new-password"
          aria-label="Senha nova"
        />

        <p class="rot-campo">de novo</p>
        <input
          #confirma
          class="campo--linha"
          type="password"
          name="confirma"
          autocomplete="new-password"
          aria-label="Repita a senha nova"
        />

        <button
          class="botao"
          type="button"
          [disabled]="enviando()"
          (click)="
            salvar(tokenDoLink ?? token.value, senha.value, confirma.value)
          "
        >
          {{ rotulo() }}
        </button>

        <a class="link-txt" routerLink="/recuperar">Pedir outro link</a>
      </div>
    </ion-content>
  `,
})
export class RedefinirPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** `null` quando a pessoa chegou sem link — aí a tela pede o token à mão. */
  protected readonly tokenDoLink =
    inject(ActivatedRoute).snapshot.queryParamMap.get('token') || null;

  protected readonly erro = signal<string | null>(null);
  protected readonly enviando = signal(false);

  private readonly espera = new Espera();

  protected rotulo(): string {
    if (!this.enviando()) {
      return 'Salvar senha';
    }
    return this.espera.demorando() ? 'Acordando o servidor…' : 'Salvando…';
  }

  protected async salvar(
    token: string,
    senha: string,
    confirma: string,
  ): Promise<void> {
    if (this.enviando()) {
      return;
    }
    if (token.trim() === '') {
      this.erro.set('Cole o código que veio no e-mail.');
      return;
    }
    if (senha.length < MINIMO) {
      this.erro.set(`A senha precisa de pelo menos ${MINIMO} caracteres.`);
      return;
    }
    if (senha !== confirma) {
      this.erro.set('As duas senhas precisam ser iguais.');
      return;
    }

    this.enviando.set(true);
    this.erro.set(null);
    this.espera.comecar();
    try {
      await this.auth.resetarSenha(token.trim(), senha);
    } catch (e) {
      // A tela FICA. O token pode ter expirado, e quem está trancado do lado de
      // fora precisa ler o motivo e poder pedir outro link daqui mesmo.
      this.erro.set(mensagemDeErro(e));
      return;
    } finally {
      this.enviando.set(false);
      this.espera.terminar();
    }
    // Para o login, e não direto para dentro: o reset não emite sessão, e
    // entrar com a senha nova é o que confirma que ela é mesmo a que ficou.
    await this.router.navigateByUrl('/login');
  }
}
