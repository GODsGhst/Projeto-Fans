import { Injectable, inject, signal } from '@angular/core';

import { ApiService } from '../core/api.service';
import { ErroApi } from '../core/http-error.interceptor';
import { StorageService } from '../core/storage.service';
import type { ItemHome } from './models';
import { SyncRepository } from './sync.repository';

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
  private readonly sync = inject(SyncRepository);

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
    // A chamada sai PRIMEIRO e o disco e lido em paralelo. Aguardar o disco
    // antes de perguntar atrasaria a resposta do servidor pelo tempo de um I/O
    // local — pequeno, mas na direcao errada: o objetivo e encurtar a espera.
    this.servidorRespondeu = false;
    const doServidorEmVoo = this.api.get<ItemHome[]>('/home');
    void this.aquecerDoDisco();
    // Lembretes saem do `/sync`, NAO desta lista: a Home tem teto de 6 e janela
    // de 14 dias, e com ela de fonte a setima prova da semana ficava sem aviso.
    // Em paralelo e sem `await`: a tela nao espera a turma inteira descer, nem
    // o sistema operacional responder sobre permissao, para mostrar as provas.
    // `reagendarAvisos` nao lanca — falha dele nao vira erro da Home.
    void this.sync.reagendarAvisos();
    try {
      const doServidor = await doServidorEmVoo;
      this.servidorRespondeu = true;
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
   * Poe na tela o que ja esta no aparelho, ANTES de perguntar ao servidor.
   *
   * O snapshot ja era gravado, e era lido so no `degradar()` — ou seja, so
   * depois de a requisicao falhar, e ela leva 75 s para desistir. Na pratica o
   * dado estava no disco enquanto a tela mostrava "Carregando…" por mais de um
   * minuto, porque o servidor gratuito estava acordando. Ler primeiro e revalidar
   * atras troca essa espera por conteudo imediato.
   *
   * SO quando nao ha nada em tela E o servidor ainda nao respondeu. As duas
   * guardas sao necessarias e diferentes: a primeira impede piscar de volta para
   * o disco ao reentrar na aba; a segunda cobre a corrida em que o servidor
   * responde LISTA VAZIA antes de o disco chegar — sem ela, a semana realmente
   * vazia seria repintada com provas velhas, que e mentir sobre o presente.
   *
   * Nao mexe em `erro` nem em `offline`: isto nao e uma falha, e uma partida
   * adiantada. Marcar offline aqui faria toda abertura do app anunciar "sem
   * conexao" antes de ter tentado.
   */
  private servidorRespondeu = false;

  private async aquecerDoDisco(): Promise<void> {
    if (this.itens().length > 0) {
      return;
    }
    const snapshot = await this.storage.ler();
    if (
      this.servidorRespondeu ||
      snapshot === null ||
      snapshot.eventos.length === 0
    ) {
      return;
    }
    this.itens.set(snapshot.eventos);
    this.ultimoSync.set(snapshot.ultimoSync);
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
