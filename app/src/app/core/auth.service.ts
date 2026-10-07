import { Injectable, computed, inject, signal } from '@angular/core';

import type {
  AtualizarNomeResponse,
  Membro,
  Perfil,
  SessaoResponse,
  TipoConta,
  Usuario,
} from '../data/models';
import { NotificacoesService } from '../notifications/notificacoes.service';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';

/** Para onde o 401 devolve o usuario. */
export const ROTA_LOGIN = '/login';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly storage = inject(StorageService);
  // Sem ciclo de DI: `NotificacoesService` so conhece o plugin do Capacitor.
  private readonly lembretes = inject(NotificacoesService);

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

  /**
   * Pelo TIPO da conta, nao pelo status (spec 2.9): o professor pendente tambem
   * usa a interface de docente — painel e varias turmas —, e cair no app de aluno
   * (uma turma so) faria ele "perder" as outras ate ser aprovado. O status so
   * muda o aviso; o poder o servidor confere a cada requisicao.
   *
   * Sessao gravada antes dos docentes nao tem `tipoConta`: ausente e aluno.
   */
  readonly ehDocente = computed(() => {
    const tipo = this._usuario()?.tipoConta;
    return tipo !== undefined && tipo !== 'ALUNO';
  });

  /** Chamada no bootstrap: sessao gravada sobrevive a fechar o app. */
  async restaurar(): Promise<void> {
    const sessao = await this.storage.lerSessao();
    if (sessao) {
      this._token.set(sessao.jwt);
      this._usuario.set(sessao.usuario);
      this._turmaId.set(sessao.turmaId ?? null);
      // Sem `await`: o app abre com o ultimo status conhecido e a atualizacao
      // chega depois. Esperar prenderia a abertura numa rede lenta por um dado
      // que so troca um aviso.
      void this.atualizarTipoDaSessao();
    }
  }

  /**
   * O admin aprova e recusa com o app fechado, entao o status gravado no
   * aparelho envelhece. Esta leitura o poe em dia — e so isso: o servidor decide
   * o poder pelo banco a cada requisicao, nao por aqui.
   *
   * Falha (sem rede, servidor dormindo) NAO desloga: vale o ultimo conhecido. O
   * 401 de token vencido ja e tratado pelo interceptor, como em qualquer rota.
   */
  private async atualizarTipoDaSessao(): Promise<void> {
    const jwt = this._token();
    try {
      const eu = await this.api.get<Perfil>('/eu');
      const atual = this._usuario();
      // Mesma guarda do atualizarNome: se a pessoa saiu (ou outra entrou) durante
      // a ida, gravar isto ressuscitaria a sessao encerrada.
      if (jwt === null || atual === null || this._token() !== jwt) {
        return;
      }
      if (
        atual.tipoConta !== eu.tipoConta ||
        atual.docenteStatus !== eu.docenteStatus
      ) {
        await this.renovarSessao(jwt, {
          ...atual,
          tipoConta: eu.tipoConta,
          docenteStatus: eu.docenteStatus,
        });
      }
    } catch (e) {
      console.warn('[auth] nao atualizei o tipo da conta; fica o gravado', e);
    }
  }

  /**
   * `tipoConta` so vai no corpo quando NAO e aluno: o aluno continua mandando
   * exatamente o que mandava (o servidor assume ALUNO sem o campo), e nada muda
   * para quem ja usa o app. Docente nasce PENDENTE no servidor — o app nao
   * escolhe isso.
   */
  async registrar(
    nome: string,
    email: string,
    senha: string,
    tipoConta: TipoConta = 'ALUNO',
  ): Promise<void> {
    await this.aplicar(
      await this.api.post<SessaoResponse>('/auth/registrar', {
        nome,
        email,
        senha,
        ...(tipoConta === 'ALUNO' ? {} : { tipoConta }),
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

  async obterPerfil(): Promise<Perfil> {
    return this.api.get<Perfil>('/eu');
  }

  /**
   * Renomeia e ja troca a sessao: o JWT carrega o nome, entao o servidor sempre
   * devolve um token novo, e guardar so o perfil deixaria o token velho valendo.
   */
  async atualizarNome(nome: string): Promise<Perfil> {
    // Token de antes da ida: se a pessoa saiu (ou outra entrou) enquanto o PATCH
    // estava no ar, gravar a resposta ressuscitaria a sessao encerrada — num PC
    // compartilhado, quem senta depois acharia a conta de quem saiu logada.
    const antes = this._token();
    const r = await this.api.patch<AtualizarNomeResponse>('/eu', { nome });
    if (this._token() === antes) {
      // So o que e de `Usuario`: o resto do perfil (admin, temSenha) nao mora na
      // sessao. Montar {id, nome, email} a mao perderia tipoConta e docenteStatus
      // a cada renomeacao, e o docente cairia na interface de aluno.
      const { adminPlataforma: _a, temSenha: _t, ...usuario } = r.perfil;
      await this.renovarSessao(r.jwt, usuario);
    }
    return r.perfil;
  }

  /**
   * Senha atual errada volta 400, nunca 401 — de proposito: 401 aqui passaria
   * pelo interceptor como sessao expirada e deslogaria quem so errou a senha.
   */
  async trocarSenha(senhaAtual: string, novaSenha: string): Promise<void> {
    // A troca derruba todo token emitido antes, inclusive o desta sessao; o
    // servidor devolve um novo para quem trocou. Mesma guarda do atualizarNome.
    const antes = this._token();
    const r = await this.api.post<{ jwt: string }>('/eu/senha', {
      senhaAtual,
      novaSenha,
    });
    const usuario = this._usuario();
    if (this._token() === antes && usuario) {
      await this.renovarSessao(r.jwt, usuario);
    }
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
   *
   * `null` e a pessoa que o lider removeu: a conta continua valida, a turma nao.
   * Alem do vinculo, sai o que era DA turma e vive no aparelho — o snapshot
   * offline e os lembretes agendados. Sem isto ela continuaria recebendo aviso de
   * prova de uma turma em que nao esta mais (e o alarme nao sabe disso).
   */
  async registrarTurma(turmaId: string | null): Promise<void> {
    this._turmaId.set(turmaId);
    const usuario = this._usuario();
    const jwt = this._token();
    if (jwt !== null && usuario !== null) {
      await this.storage.gravarSessao(jwt, usuario, turmaId);
    }
    if (turmaId === null) {
      this.esquecerLembretes();
      await this.storage.limpar();
    }
  }

  /** Sai de verdade: token, usuario, o snapshot local da turma e os lembretes. */
  async sair(): Promise<void> {
    this._token.set(null);
    this._usuario.set(null);
    this._turmaId.set(null);
    this.esquecerLembretes();
    await this.storage.limparSessao();
    await this.storage.limpar();
  }

  definirSessao(jwt: string, usuario: Usuario, turmaId?: string | null): void {
    this._token.set(jwt);
    this._usuario.set(usuario);
    this._turmaId.set(turmaId ?? null);
  }

  /**
   * Token e usuario novos, mesma turma. Nao passa por `definirSessao` porque ela
   * zera a turma quando nao recebe uma, e quem so trocou o nome cairia na tela
   * de entrar na turma.
   */
  async renovarSessao(jwt: string, usuario: Usuario): Promise<void> {
    this._token.set(jwt);
    this._usuario.set(usuario);
    await this.storage.gravarSessao(jwt, usuario, this._turmaId());
  }

  /**
   * Encerramento sincrono, para o interceptor de 401 nao ter que esperar disco
   * antes de redirecionar. O apagamento em disco vai atras.
   */
  encerrarSessao(): void {
    this._token.set(null);
    this._usuario.set(null);
    this._turmaId.set(null);
    this.esquecerLembretes();
    this.storage
      .limparSessao()
      .catch((e: unknown) =>
        console.error('[auth] falha ao apagar a sessao local', e),
      );
  }

  /**
   * Os avisos agendados no aparelho sao da conta que saiu — e tocam por semanas
   * se ninguem os cancelar: o alarme nao sabe que a sessao acabou. Cai aqui por
   * `sair()` e por 401 (`encerrarSessao`), os dois caminhos que perdem a sessao.
   *
   * Sem `await`, como o apagar da sessao: o 401 nao espera disco para
   * redirecionar, e falha aqui vai para o console em vez de travar a saida.
   */
  private esquecerLembretes(): void {
    this.lembretes
      .esquecer()
      .catch((e: unknown) =>
        console.error('[auth] falha ao cancelar os lembretes', e),
      );
  }

  private async aplicar(sessao: SessaoResponse): Promise<void> {
    this.definirSessao(sessao.jwt, sessao.usuario, sessao.turmaId);
    await this.storage.gravarSessao(sessao.jwt, sessao.usuario, sessao.turmaId);
  }
}
