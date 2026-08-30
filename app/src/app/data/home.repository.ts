import { Injectable, inject, signal } from '@angular/core';

import { ApiService } from '../core/api.service';
import { ErroApi } from '../core/http-error.interceptor';
import { StorageService } from '../core/storage.service';
import type { ItemHome } from './models';

/**
 * `GET /home`.
 *
 * NAO reordena, NAO filtra, NAO corta: a ordem, a janela de 14 dias e o teto de
 * 6 sao calculados no servidor (Secao 6.1 do spec). Replicar qualquer um deles
 * aqui e a violacao mais provavel desta camada — e a que ninguem percebe ate a
 * turma perder uma prova.
 */
@Injectable({ providedIn: 'root' })
export class HomeRepository {
  private readonly api = inject(ApiService);
  private readonly storage = inject(StorageService);

  readonly itens = signal<ItemHome[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);
  /** Ligado quando a lista exibida veio do snapshot, nao do servidor. */
  readonly offline = signal(false);
  /** Hora do snapshot em uso. A tela mostra "dados de <hora>", nunca dado velho mudo. */
  readonly ultimoSync = signal<string | null>(null);

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const doServidor = await this.api.get<ItemHome[]>('/home');
      this.itens.set(doServidor);
      this.offline.set(false);
      this.ultimoSync.set(null);
      await this.storage.mesclar({ eventos: doServidor });
    } catch (e) {
      await this.degradar(e);
    } finally {
      this.carregando.set(false);
    }
  }

  /**
   * Falhou. A unica coisa proibida aqui e ficar em silencio com a lista vazia:
   * "nao ha provas" e "falhei ao buscar as provas" nao podem se parecer.
   */
  private async degradar(e: unknown): Promise<void> {
    const erro = e instanceof ErroApi ? e : null;
    this.erro.set(erro?.message ?? 'Não deu para carregar.');

    if (erro?.classe !== 'OFFLINE') {
      this.offline.set(false);
      return;
    }

    this.offline.set(true);
    const snapshot = await this.storage.ler();
    if (snapshot) {
      this.itens.set(snapshot.eventos);
      this.ultimoSync.set(snapshot.ultimoSync);
    } else {
      this.ultimoSync.set(null);
    }
  }
}
