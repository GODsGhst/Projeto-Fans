import { environment } from '../../../environments/environment';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { AuthService } from '../../core/auth.service';
import { mensagemDeErro } from './erro';

/**
 * Esqueci a senha.
 *
 * A confirmacao e a mesma exista a conta ou nao — o backend responde 204 nos
 * dois casos de proposito, e a tela nao pode desfazer isso: resposta diferente
 * transformaria esta tela num jeito de descobrir quem tem conta no app.
 *
 * Falha de rede, porem, e outra coisa e aparece como erro: dizer "enviamos" sem
 * ter enviado seria mentir para quem esta trancado do lado de fora.
 *
 * E ha um caso em que NADA e enviado, por configuracao e nao por falha: o deploy
 * roda no perfil `teste`, onde o `LogEmailSender` so escreve o link no log do
 * servidor. A tela inteira sai do ar nesse caso — `environment.recuperacaoPorEmail`
 * —, porque um formulario que aceita o e-mail e responde "ja esta a caminho"
 * quando nada foi mandado e a mesma mentira, so que mais educada. Quem esqueceu
 * a senha ficaria esperando um e-mail que nunca existiu.
 */
@Component({
  selector: 'app-recuperar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent],
  styleUrls: ['./auth.scss'],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/login" />
        </ion-buttons>
        <ion-title>Esqueci a senha</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="pf-auth">
        @if (!recuperacaoAtiva) {
          <div class="marca">
            <b>Recuperar senha ainda não está no ar.</b>
            <span>
              Esta versão de teste não envia e-mail. Se você perdeu a senha, crie outra conta com
              outro e-mail e entre na turma de novo com o mesmo código — nada do que a turma
              cadastrou se perde.
            </span>
          </div>
        } @else {
          <div class="marca">
            <span>Manda o e-mail da conta e o link de reset chega nele.</span>
          </div>
        }

        @if (erro(); as e) {
          <p class="pf-erro" role="alert">{{ e }}</p>
        }

        @if (recuperacaoAtiva && enviado()) {
          <p class="alerta" role="status">
            Se existe conta com esse e-mail, o link de reset já está a caminho dele.
          </p>
        } @else if (recuperacaoAtiva) {
          <p class="rot-campo">e-mail</p>
          <input
            #email
            class="campo--linha"
            type="email"
            inputmode="email"
            autocomplete="email"
            placeholder="voce@exemplo.com"
            aria-label="E-mail" />

          <button class="botao" type="button" [disabled]="enviando()" (click)="pedir(email.value)">
            {{ enviando() ? 'Enviando…' : 'Enviar link' }}
          </button>
        }

        <p class="alerta">
          A resposta é a mesma exista a conta ou não. Isso é de propósito: resposta diferente
          transformaria esta tela num jeito de descobrir quem tem conta no app.
        </p>
      </div>
    </ion-content>
  `,
})
export class RecuperarPage {
  protected readonly recuperacaoAtiva = environment.recuperacaoPorEmail;

  private readonly auth = inject(AuthService);

  protected readonly enviando = signal(false);
  protected readonly enviado = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected async pedir(email: string): Promise<void> {
    if (this.enviando()) {
      return;
    }
    this.enviando.set(true);
    this.erro.set(null);
    try {
      await this.auth.esqueciSenha(email.trim());
      this.enviado.set(true);
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
    } finally {
      this.enviando.set(false);
    }
  }
}
