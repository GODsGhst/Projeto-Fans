import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { AuthService, ROTA_LOGIN } from '../../core/auth.service';
import type { Perfil } from '../../data/models';
import { mensagemDeErro } from '../auth/erro';

/**
 * A conta de quem esta logado: nome, senha e a saida.
 *
 * Fica no rodape do menu (no PC) e na quinta aba (no celular) porque e onde todo
 * app com conta guarda isso — procurar "sair" dentro da tela da turma, como era
 * antes, obrigava a saber que ele estava la.
 *
 * Falhar ao carregar NAO esconde "Sair da conta" nem os links: perfil que nao
 * carrega nao pode trancar a pessoa dentro de uma sessao que ela quer encerrar.
 */
@Component({
  selector: 'app-perfil',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, RouterLink],
  styleUrls: ['../auth/auth.scss'],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-title>Perfil</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="pf-auth">
        <!-- "Carregando" so na primeira vez: ao voltar para a aba o perfil ja
             esta na tela, e o aviso empurraria tudo para baixo a cada toque. -->
        @if (carregando() && !perfil()) {
          <p class="pf-aviso">Carregando…</p>
        } @else if (erroCarga(); as e) {
          <p class="pf-aviso" role="alert">{{ e }}</p>
          <button class="botao botao--fantasma" type="button" (click)="carregar()">
            Tentar de novo
          </button>
        }

        @if (perfil(); as p) {
          <div class="topo">
            <span class="pf-avatar grande" aria-hidden="true">{{
              inicial()
            }}</span>
            <b>{{ p.nome }}</b>
            <span class="email">{{ p.email }}</span>
            @if (p.adminPlataforma) {
              <span class="selo">Admin da plataforma</span>
            }
          </div>

          <!-- Form, e nao campo solto: Enter no campo salva, como em qualquer
               formulario. Sem FormsModule, entao o preventDefault e nosso. -->
          <form (submit)="$event.preventDefault(); salvarNome(nome.value)">
            <p class="pf-rotulo">nome</p>
            <input
              #nome
              class="campo--linha"
              type="text"
              name="nome"
              maxlength="120"
              autocomplete="name"
              [value]="p.nome"
              aria-label="Nome"
            />
            @if (erroNome(); as e) {
              <p class="pf-erro" role="alert">{{ e }}</p>
            }
            @if (nomeSalvo()) {
              <p class="alerta" role="status">Nome atualizado.</p>
            }
            <button class="botao" type="submit" [disabled]="salvandoNome()">
              {{ salvandoNome() ? 'Salvando…' : 'Salvar nome' }}
            </button>
          </form>

          <p class="pf-rotulo">senha</p>
          @if (p.temSenha) {
            <!-- O e-mail escondido e o que o gerenciador de senha usa para saber
                 DE QUAL conta e a senha nova; sem ele a troca nao atualiza nada
                 salvo, e no proximo login ele oferece a senha velha. -->
            <form
              (submit)="$event.preventDefault(); trocarSenha(atual, nova, confirma)"
            >
              <input
                hidden
                type="email"
                autocomplete="username"
                readonly
                [value]="p.email"
              />
              <p class="rot-campo">senha atual</p>
              <input
                #atual
                class="campo--linha"
                type="password"
                name="senhaAtual"
                autocomplete="current-password"
                aria-label="Senha atual"
              />
              <p class="rot-campo">nova senha</p>
              <input
                #nova
                class="campo--linha"
                type="password"
                name="novaSenha"
                maxlength="72"
                autocomplete="new-password"
                placeholder="pelo menos 8 caracteres"
                aria-label="Nova senha"
              />
              <p class="rot-campo">confirmar a nova senha</p>
              <input
                #confirma
                class="campo--linha"
                type="password"
                name="confirmarSenha"
                maxlength="72"
                autocomplete="new-password"
                aria-label="Confirmar a nova senha"
              />
              @if (erroSenha(); as e) {
                <p class="pf-erro" role="alert">{{ e }}</p>
              }
              @if (senhaTrocada()) {
                <p class="alerta" role="status">Senha trocada.</p>
              }
              <button class="botao" type="submit" [disabled]="trocandoSenha()">
                {{ trocandoSenha() ? 'Trocando…' : 'Trocar senha' }}
              </button>
            </form>
          } @else {
            <p class="pf-cache-aviso">
              Esta conta entra pelo Google e não tem senha aqui. Para trocar a
              senha, troque a da sua conta Google.
            </p>
          }
        }

        <p class="pf-rotulo">conta</p>
        <a class="botao botao--fantasma" routerLink="/tabs/turma">Minha turma</a>
        <a class="botao botao--fantasma" routerLink="/tabs/ajustes">Ajustes</a>
        <button class="botao botao--fantasma" type="button" (click)="sair()">
          Sair da conta
        </button>
      </div>
    </ion-content>
  `,
  styles: `
    /* Os forms existem pelo Enter e pelo gerenciador de senha, nao pelo layout:
       display: contents devolve os campos ao flex do .pf-auth e o espacamento
       fica o mesmo de antes. */
    form {
      display: contents;
    }
    .topo {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 18px 0 8px;
      text-align: center;
    }
    .topo b {
      margin-top: 8px;
      font-size: 22px;
      letter-spacing: -0.02em;
    }
    .topo .email {
      font-size: 14px;
      color: var(--ink-3);
      overflow-wrap: anywhere;
    }
    .pf-avatar.grande {
      width: 72px;
      height: 72px;
      font-size: 30px;
    }
    /* Papel, nao posto: mesma marca discreta do "lider" na tela da turma. */
    .topo .selo {
      margin-top: 4px;
      padding: 3px 9px;
      font-size: 11px;
      font-weight: 700;
      color: var(--accent);
      background: var(--accent-soft);
      border-radius: var(--r-pill);
    }
  `,
})
export class PerfilPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly perfil = signal<Perfil | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erroCarga = signal<string | null>(null);

  // Espalhar quebra por code point: `trim()[0]` pegava meia surrogate de um
  // emoji e o avatar mostrava lixo.
  protected readonly inicial = computed(() =>
    ([...(this.perfil()?.nome ?? '').trim()][0] ?? '?').toUpperCase(),
  );

  protected readonly salvandoNome = signal(false);
  protected readonly erroNome = signal<string | null>(null);
  protected readonly nomeSalvo = signal(false);

  protected readonly trocandoSenha = signal(false);
  protected readonly erroSenha = signal<string | null>(null);
  protected readonly senhaTrocada = signal(false);

  /**
   * Toda vez que a aba aparece, e nao no `constructor`: o Ionic mantem a pagina
   * viva, entao uma falha na primeira abertura (servidor dormindo, sem rede)
   * ficava na tela ate matar o app. Mesmo motivo da Home.
   */
  ionViewWillEnter(): void {
    void this.carregar();
  }

  protected async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erroCarga.set(null);
    // Falha de recarga nao apaga o perfil que ja esta na tela: o aviso diz que
    // nao atualizou, e o que estava ali continua valendo.
    try {
      this.perfil.set(await this.auth.obterPerfil());
    } catch (e) {
      this.erroCarga.set(mensagemDeErro(e));
    } finally {
      this.carregando.set(false);
    }
  }

  protected async salvarNome(valor: string): Promise<void> {
    if (this.salvandoNome()) {
      return;
    }
    this.nomeSalvo.set(false);
    // Mesma regra do servidor (@NotBlank depois do trim): pegar aqui poupa a ida
    // e diz o motivo na hora.
    const nome = valor.trim();
    if (nome === '') {
      this.erroNome.set('O nome não pode ficar em branco.');
      return;
    }
    this.salvandoNome.set(true);
    this.erroNome.set(null);
    try {
      this.perfil.set(await this.auth.atualizarNome(nome));
      this.nomeSalvo.set(true);
    } catch (e) {
      this.erroNome.set(mensagemDeErro(e));
    } finally {
      this.salvandoNome.set(false);
    }
  }

  /**
   * Recebe os campos, e nao os valores, porque o sucesso tem de limpa-los: senha
   * que fica escrita na tela depois de trocada e senha exposta a quem pegar o
   * celular.
   */
  protected async trocarSenha(
    atual: HTMLInputElement,
    nova: HTMLInputElement,
    confirma: HTMLInputElement,
  ): Promise<void> {
    if (this.trocandoSenha()) {
      return;
    }
    this.senhaTrocada.set(false);
    // Confirmacao e tamanho sao conferidos aqui e nao no servidor: o servidor
    // nem recebe a confirmacao, e errar a digitacao da senha nova trancaria a
    // pessoa fora da propria conta no proximo login.
    // So espacos voltava do servidor como 400 generico, em ingles. O teto de 72
    // e o do bcrypt — em bytes la, entao senha cheia de acento ainda pode
    // passar daqui e voltar "Senha muito longa", com frase propria.
    const erro =
      atual.value === ''
        ? 'Digite a senha atual.'
        : nova.value.length < 8
          ? 'A nova senha precisa de pelo menos 8 caracteres.'
          : nova.value.trim() === ''
            ? 'A nova senha não pode ser só espaços.'
            : nova.value.length > 72
              ? 'A nova senha pode ter no máximo 72 caracteres.'
              : nova.value !== confirma.value
                ? 'A confirmação não bate com a nova senha.'
                : null;
    this.erroSenha.set(erro);
    if (erro !== null) {
      return;
    }

    this.trocandoSenha.set(true);
    try {
      await this.auth.trocarSenha(atual.value, nova.value);
      atual.value = nova.value = confirma.value = '';
      this.senhaTrocada.set(true);
    } catch (e) {
      this.erroSenha.set(mensagemDeErro(e));
    } finally {
      this.trocandoSenha.set(false);
    }
  }

  protected async sair(): Promise<void> {
    await this.auth.sair();
    await this.router.navigateByUrl(ROTA_LOGIN);
  }
}
