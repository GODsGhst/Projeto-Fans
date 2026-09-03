import { Injectable, inject, signal } from '@angular/core';

import { ApiService } from '../core/api.service';
import { ModeracaoRepository } from './moderacao.repository';
import type { PedidoDeExclusao } from './moderacao.repository';
import type { ItemHome, MeuQuadro, NaoListados } from './models';

/**
 * Meu quadro e Nao listados.
 *
 * `feito` e estado pessoal: vive em `estado_pessoal`, nunca no fato
 * compartilhado. Marcar feito nao altera nada do evento da turma — e por isso
 * que a chamada e `PUT /eventos/{id}/estado-pessoal`, e nao um PATCH no evento.
 *
 * Os dois erros sao SEPARADOS de proposito. Sao duas chamadas independentes, e
 * falhar em "nao listados" — secao que a maioria das pessoas nunca ve — nao pode
 * derrubar o quadro inteiro. Com um signal so, a segunda falha apagava a
 * primeira e a tela escondia dado que tinha chegado bem.
 */
@Injectable({ providedIn: 'root' })
export class QuadroRepository {
  private readonly api = inject(ApiService);
  private readonly moderacao = inject(ModeracaoRepository);

  readonly aFazer = signal<ItemHome[]>([]);
  readonly feito = signal<ItemHome[]>([]);
  /** Ocultos ou excluidos DO PROPRIO autor. Vazio para quase todo mundo. */
  readonly naoListados = signal<NaoListados | null>(null);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly erroNaoListados = signal<string | null>(null);

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const quadro = await this.api.get<MeuQuadro>('/meu-quadro');
      this.aFazer.set(quadro.aFazer);
      this.feito.set(quadro.feito);
    } catch (e) {
      // Nao relanca, e isso NAO e engolir: o erro fica no signal, e ler o signal
      // e o tratamento. Mesmo padrao do HomeRepository. O que a regra proibe e
      // catch que devolve lista vazia como se fosse sucesso — aqui as listas
      // ficam como estavam e a tela decide o que mostrar olhando `erro()`.
      this.erro.set(mensagem(e, 'Não deu para carregar o quadro.'));
    } finally {
      this.carregando.set(false);
    }
  }

  /** Pedidos do líder para eu apagar algo meu. Vazio para quase todo mundo. */
  readonly pedidos = signal<PedidoDeExclusao[]>([]);

  async carregarPedidos(): Promise<void> {
    try {
      this.pedidos.set(await this.moderacao.meusPedidos());
    } catch {
      // Falhar aqui não vira aviso na tela: pedido é raro, e um erro sobre algo
      // que quase nunca existe assustaria mais do que informa. A seção
      // simplesmente não aparece, como quando não há pedido nenhum.
    }
  }

  async carregarNaoListados(): Promise<void> {
    this.erroNaoListados.set(null);
    try {
      this.naoListados.set(await this.api.get<NaoListados>('/nao-listados'));
    } catch (e) {
      this.erroNaoListados.set(
        mensagem(e, 'Não deu para carregar os não listados.'),
      );
    }
  }

  /** Marca e rele o quadro: o servidor e quem diz em qual coluna o item cai. */
  async marcar(eventoId: string, feito: boolean): Promise<void> {
    await this.api.put<void>(`/eventos/${eventoId}/estado-pessoal`, { feito });
    await this.carregar();
  }
}

function mensagem(e: unknown, padrao: string): string {
  return e instanceof Error ? e.message : padrao;
}
