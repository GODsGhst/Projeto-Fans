import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { AuthService } from '../../core/auth.service';
import { Espera } from './espera';
import { mensagemDeErro } from './erro';

/**
 * A porta do app. Sem ela nao existe token, e toda chamada volta 401 — era o
 * unico bloqueio entre o app instalado e um colega conseguindo testar (A11).
 *
 * Tres saidas, como no mockup: entrar, criar conta e esqueci a senha. A tela
 * fica FORA das abas de proposito: quem nao entrou nao tem turma, e sem turma
 * nao ha aba nenhuma que responda outra coisa alem de 404.
 *
 * Erro nunca em silencio: senha errada, servidor fora e falta de rede sao
 * mensagens diferentes, e todas vem prontas do interceptor central.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent],
  styleUrls: ['./auth.scss'],
  template: `
    <ion-content [fullscreen]="true">
      <div class="pf-auth">
        <div class="marca">
          <b>projetoFans</b>
          <span
            >O que cai na semana e o que foi dado em cada aula, mantido pela
            turma.</span
          >
        </div>

        @if (erro(); as e) {
          <p class="pf-erro" role="alert">{{ e }}</p>
        }

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
          autocomplete="current-password"
          placeholder="sua senha"
          aria-label="Senha"
          (keyup.enter)="entrar(email.value, senha.value)"
        />

        <button
          class="botao"
          type="button"
          [disabled]="enviando()"
          (click)="entrar(email.value, senha.value)"
        >
          {{ rotuloDoBotao() }}
        </button>

        <button class="link-txt" type="button" (click)="ir('/recuperar')">
          Esqueci a senha
        </button>

        <div class="divisor"><span>ou</span></div>

        <button
          class="botao botao--fantasma"
          type="button"
          (click)="ir('/cadastro')"
        >
          Criar conta
        </button>

        <button class="botao botao--fantasma" type="button" disabled>
          Entrar com Google
        </button>
        <p class="alerta">
          O login por Google fica disponível quando o projeto no Google Cloud
          existir. Enquanto isso, e-mail e senha funcionam normalmente.
        </p>
      </div>
    </ion-content>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly enviando = signal(false);
  private readonly espera = new Espera();

  /**
   * O servidor gratuito dorme e leva ate ~45 s para acordar. Um botao que so
   * diz "Entrando…" nesse tempo comunica travamento, nao espera.
   */
  protected readonly rotuloDoBotao = computed(() => {
    if (!this.enviando()) {
      return 'Entrar';
    }
    return this.espera.demorando() ? 'Acordando o servidor…' : 'Entrando…';
  });
  protected readonly erro = signal<string | null>(null);

  protected async entrar(email: string, senha: string): Promise<void> {
    if (this.enviando()) {
      return;
    }
    this.enviando.set(true);
    this.erro.set(null);
    this.espera.comecar();
    try {
      await this.auth.entrar(email.trim(), senha);
      await this.router.navigateByUrl('/tabs/home');
    } catch (e) {
      // Nada de console aqui: o corpo do pedido carrega a senha.
      this.erro.set(mensagemDeErro(e));
    } finally {
      this.enviando.set(false);
      this.espera.terminar();
    }
  }

  protected ir(rota: string): void {
    void this.router.navigateByUrl(rota);
  }
}
