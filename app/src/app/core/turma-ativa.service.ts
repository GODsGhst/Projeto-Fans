import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

import { AuthService } from './auth.service';
import { StorageService } from './storage.service';

const CHAVE_TURMA_ATIVA = 'pf.turmaAtiva';

/**
 * Como o app "recarrega" depois de trocar de turma. Token e nao `location.reload()`
 * solto para o teste nao recarregar o navegador do Karma.
 */
export const RECARREGAR_APP = new InjectionToken<() => void>('RECARREGAR_APP', {
  providedIn: 'root',
  factory: () => () => location.reload(),
});

export interface TurmaRef {
  turmaId: string;
  nome: string;
}

/** Guarda o dono junto: ver `daSessao`. */
interface Ativa extends TurmaRef {
  usuarioId: string;
}

/**
 * A turma ativa do DOCENTE (spec 2.8): o que o app manda em `X-Turma-Id`. Aluno
 * tem uma turma so e nunca passa por aqui — o interceptor nem lê este servico para ele.
 *
 * **Por que o dono vai junto.** O aparelho e a chave de Preferences sao
 * compartilhados: sair e entrar com outro docente deixaria o id da turma do
 * primeiro indo no cabecalho do segundo, e o servidor responde 404 a tudo (nao e
 * membro). `daSessao` so devolve a turma se o dono for quem esta logado, sem
 * precisar que o logout se lembre de limpar nada.
 *
 * **Trocar recarrega o app.** Calendario, materias, turma, eventos e notas guardam
 * dado em signals de servicos `providedIn: 'root'` que nao sabem que a turma
 * mudou: sem recarregar, o titulo diria "ADS 3B" sobre as provas da 3A, que e
 * exatamente o erro que este app nao pode cometer. Recarregar custa um segundo
 * de tela; refazer a invalidacao de cada repositorio custa um bug por repositorio.
 * (ponytail: se o recarregar incomodar, dar `limpar()` a cada repositorio e
 * trocar so o `RECARREGAR_APP`.)
 */
@Injectable({ providedIn: 'root' })
export class TurmaAtivaService {
  private readonly auth = inject(AuthService);
  private readonly storage = inject(StorageService);
  private readonly recarregarApp = inject(RECARREGAR_APP);

  private readonly _ativa = signal<Ativa | null>(null);

  readonly turmaId = computed(() => this.daSessao()?.turmaId ?? null);
  readonly nome = computed(() => this.daSessao()?.nome ?? null);

  /**
   * Leitura do disco, disparada na construcao. Quem precisa do valor certo (o
   * interceptor, a troca) espera esta promessa: as primeiras requisicoes do app
   * saem antes de o disco responder, e sem a espera sairiam sem o cabecalho.
   */
  readonly pronto: Promise<void> = this.lerDoDisco();

  /**
   * O docente tocou numa turma do painel. Igual a atual: nada acontece (nem
   * limpeza, nem recarga). Primeira escolha: sem recarga, porque ainda nao havia
   * turma "antiga" cujos dados pudessem estar na tela.
   */
  async escolher(turma: TurmaRef): Promise<void> {
    await this.pronto;
    if (this.turmaId() === turma.turmaId) {
      return;
    }
    const havia = this.turmaId() !== null;
    await this.gravar(turma);
    if (havia) {
      this.recarregarApp();
    }
  }

  /**
   * O painel chegou: confere a turma ativa contra as que a pessoa TEM.
   *
   * Cobre tres coisas que o disco nao sabe: a primeira vez (nenhuma ativa — vale
   * a primeira do painel), a turma da qual a pessoa saiu ou foi removida (o
   * cabecalho com ela viraria 404 em tudo) e a turma renomeada. Silencioso: nao
   * recarrega, porque quem chama e o painel, a primeira tela do docente.
   *
   * So chame com um painel que CHEGOU. Falha de rede nao e "zero turmas", e
   * esquecer a ativa por causa dela seria punir quem esta so sem sinal.
   */
  async conciliar(turmas: readonly TurmaRef[]): Promise<void> {
    await this.pronto;
    const atual = this.turmaId();
    const nova = turmas.find((t) => t.turmaId === atual) ?? turmas[0] ?? null;
    if (nova === null) {
      this._ativa.set(null);
      await this.apagarDoDisco();
    } else if (nova.turmaId !== atual || nova.nome !== this.nome()) {
      await this.gravar(nova);
    }
  }

  /** So vale se o dono for quem esta logado agora. */
  private daSessao(): Ativa | null {
    const ativa = this._ativa();
    return ativa !== null && ativa.usuarioId === this.auth.usuario()?.id
      ? ativa
      : null;
  }

  private async gravar(turma: TurmaRef): Promise<void> {
    const usuarioId = this.auth.usuario()?.id;
    if (usuarioId === undefined) {
      return;
    }
    const trocou = this.turmaId() !== turma.turmaId;
    const ativa: Ativa = { usuarioId, turmaId: turma.turmaId, nome: turma.nome };
    // Memoria primeiro: a partir daqui o interceptor ja manda a turma nova. O
    // disco vai atras e, se falhar, o app so nao lembra na proxima abertura.
    this._ativa.set(ativa);
    try {
      // `pf.snapshot` e UM so e e da turma antiga. So na troca de verdade: renomear
      // a mesma turma nao pode apagar o cache offline de ninguem.
      if (trocou) {
        await this.storage.limpar();
      }
      await Preferences.set({
        key: CHAVE_TURMA_ATIVA,
        value: JSON.stringify(ativa),
      });
    } catch (e) {
      console.error('[turma-ativa] falha ao gravar a turma ativa', e);
    }
  }

  private async lerDoDisco(): Promise<void> {
    try {
      const { value } = await Preferences.get({ key: CHAVE_TURMA_ATIVA });
      const lido = value === null ? null : (JSON.parse(value) as Partial<Ativa>);
      if (
        typeof lido?.usuarioId === 'string' &&
        typeof lido.turmaId === 'string' &&
        typeof lido.nome === 'string'
      ) {
        this._ativa.set(lido as Ativa);
      }
    } catch (e) {
      // Ilegivel: sem turma ativa, o painel escolhe de novo na proxima carga.
      console.error('[turma-ativa] turma ativa ilegivel, descartando', e);
    }
  }

  private async apagarDoDisco(): Promise<void> {
    try {
      await Preferences.remove({ key: CHAVE_TURMA_ATIVA });
    } catch (e) {
      console.error('[turma-ativa] falha ao apagar a turma ativa', e);
    }
  }
}
