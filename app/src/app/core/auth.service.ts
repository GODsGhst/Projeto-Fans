import { Injectable, computed, inject, signal } from '@angular/core';

import type { Membro, SessaoResponse, Usuario } from '../data/models';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';

/** Para onde o 401 devolve o usuario. */
export const ROTA_LOGIN = '/login';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly storage = inject(StorageService);

  private readonly _token = signal<string | null>(null);
  private readonly _usuario = signal<Usuario | null>(null);
  private readonly _turmaId = signal<string | null>(null);

  readonly token = this._token.asReadonly();
  readonly usuario = this._usuario.asReadonly();
  readonly turmaId = this._turmaId.asReadonly();
  readonly autenticado = computed(() => this._token() !== null);

  /**
   * Ter sessao e ter turma sao coisas diferentes, e confundi-las cria um beco sem
   * saida: quem se cadastra ganha token ANTES de entrar em turma, e se fechar o
   * app nesse instante volta autenticado e sem vinculo. Caindo nas abas, ve 404
   * em tudo e nao tem como sair — nem para o login, nem para a tela de turma.
   */
  readonly temTurma = computed(() => this._turmaId() !== null);

  /** Chamada no bootstrap: sessao gravada sobrevive a fechar o app. */
  async restaurar(): Promise<void> {
    const sessao = await this.storage.lerSessao();
    if (sessao) {
      this._token.set(sessao.jwt);
      this._usuario.set(sessao.usuario);
      this._turmaId.set(sessao.turmaId ?? null);
    }
  }

  async registrar(nome: string, email: string, senha: string): Promise<void> {
    await this.aplicar(
      await this.api.post<SessaoResponse>('/auth/registrar', {
        nome,
        email,
        senha,
      }),
    );
  }

  async entrar(email: string, senha: string): Promise<void> {
    await this.aplicar(
      await this.api.post<SessaoResponse>('/auth/login', { email, senha }),
    );
  }

  async entrarComGoogle(idToken: string): Promise<void> {
    await this.aplicar(
      await this.api.post<SessaoResponse>('/auth/google', { idToken }),
    );
  }

  /** 204 sempre, mesmo para e-mail inexistente: a lista de contas nao e enumeravel. */
  async esqueciSenha(email: string): Promise<void> {
    await this.api.post<void>('/auth/senha/esqueci', { email });
  }

  async resetarSenha(token: string, novaSenha: string): Promise<void> {
    await this.api.post<void>('/auth/senha/reset', { token, novaSenha });
  }

  async entrarNaTurma(codigoConvite: string): Promise<Membro> {
    const membro = await this.api.post<Membro>('/turmas/entrar', {
      codigoConvite,
    });
    await this.registrarTurma(membro.turmaId);
    return membro;
  }

  /**
   * Chamado tambem por quem CRIA a turma — criar tambem vincula, e esquecer isso
   * deixaria o proprio lider preso na tela de entrar na turma.
   */
  async registrarTurma(turmaId: string): Promise<void> {
    this._turmaId.set(turmaId);
    const usuario = this._usuario();
    const jwt = this._token();
    if (jwt !== null && usuario !== null) {
      await this.storage.gravarSessao(jwt, usuario, turmaId);
    }
  }

  /** Sai de verdade: token, usuario e o snapshot local da turma. */
  async sair(): Promise<void> {
    this._token.set(null);
    this._usuario.set(null);
    this._turmaId.set(null);
    await this.storage.limparSessao();
    await this.storage.limpar();
  }

  definirSessao(jwt: string, usuario: Usuario, turmaId?: string | null): void {
    this._token.set(jwt);
    this._usuario.set(usuario);
    this._turmaId.set(turmaId ?? null);
  }

  /**
   * Encerramento sincrono, para o interceptor de 401 nao ter que esperar disco
   * antes de redirecionar. O apagamento em disco vai atras.
   */
  encerrarSessao(): void {
    this._token.set(null);
    this._usuario.set(null);
    this._turmaId.set(null);
    this.storage
      .limparSessao()
      .catch((e: unknown) =>
        console.error('[auth] falha ao apagar a sessao local', e),
      );
  }

  private async aplicar(sessao: SessaoResponse): Promise<void> {
    this.definirSessao(sessao.jwt, sessao.usuario, sessao.turmaId);
    await this.storage.gravarSessao(sessao.jwt, sessao.usuario, sessao.turmaId);
  }
}
