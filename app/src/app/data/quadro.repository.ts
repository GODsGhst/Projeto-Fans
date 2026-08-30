import { Injectable, inject, signal } from '@angular/core';

import { ApiService } from '../core/api.service';
import type { ItemHome, MeuQuadro, NaoListados } from './models';

/**
 * Meu quadro e Nao listados.
 *
 * `feito` e estado pessoal: vive em `estado_pessoal`, nunca no fato
 * compartilhado. Marcar feito nao altera nada do evento da turma — e por isso
 * que a chamada e `PUT /eventos/{id}/estado-pessoal`, e nao um PATCH no evento.
 */
@Injectable({ providedIn: 'root' })
export class QuadroRepository {
  private readonly api = inject(ApiService);

  readonly aFazer = signal<ItemHome[]>([]);
  readonly feito = signal<ItemHome[]>([]);
  /** Ocultos ou excluidos DO PROPRIO autor. Vazio para quase todo mundo. */
  readonly naoListados = signal<NaoListados | null>(null);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const quadro = await this.api.get<MeuQuadro>('/meu-quadro');
      this.aFazer.set(quadro.aFazer);
      this.feito.set(quadro.feito);
    } catch (e) {
      this.erro.set(mensagem(e, 'Não deu para carregar o quadro.'));
      throw e;
    } finally {
      this.carregando.set(false);
    }
  }

  async carregarNaoListados(): Promise<void> {
    try {
      this.naoListados.set(await this.api.get<NaoListados>('/nao-listados'));
    } catch (e) {
      this.erro.set(mensagem(e, 'Não deu para carregar os não listados.'));
      throw e;
    }
  }

  async marcar(eventoId: string, feito: boolean): Promise<void> {
    await this.api.put<void>(`/eventos/${eventoId}/estado-pessoal`, { feito });
    await this.carregar();
  }
}

function mensagem(e: unknown, padrao: string): string {
  return e instanceof Error ? e.message : padrao;
}
