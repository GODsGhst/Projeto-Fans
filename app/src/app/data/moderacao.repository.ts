import { Injectable, inject } from '@angular/core';

import { ApiService } from '../core/api.service';

/** Os dois tipos que o líder pode moderar. A rota do spec é em minúsculas. */
export type TipoModeravel = 'evento' | 'material';

/** Um pedido do líder para que você apague algo seu. */
export interface PedidoDeExclusao {
  registroTipo: 'EVENTO' | 'MATERIAL';
  registroId: string;
  titulo: string;
  motivo: string | null;
  pedidoPor: string;
  em: string;
}

/**
 * Os poderes do líder, e a transferência do cargo.
 *
 * Estes quatro endpoints existiam no servidor desde sempre e o app não chamava
 * nenhum — enquanto duas telas prometiam, com estas palavras, que "o líder só
 * oculta o que não devia estar ali e transfere a liderança". O papel existia nos
 * dados e não tinha um único botão.
 *
 * **Ocultar não apaga.** O registro continua no banco, com autoria, e volta em
 * "não listados" para quem o criou — é o contrapeso do papel: o líder tira da
 * lista da turma, não da existência. `reexibir` desfaz.
 *
 * **`pedirExclusao` não exclui.** Ele avisa o autor de que o líder acha que
 * aquilo deveria sair. Quem apaga é sempre quem criou.
 */
@Injectable({ providedIn: 'root' })
export class ModeracaoRepository {
  private readonly api = inject(ApiService);

  /**
   * Os pedidos de exclusão sobre o que EU criei.
   *
   * O outro lado de `pedirExclusao`. Sem isto o pedido ficava só no diário de
   * moderação: o líder achava que tinha pedido e o autor nunca ficava sabendo.
   */
  meusPedidos(): Promise<PedidoDeExclusao[]> {
    return this.api.get<PedidoDeExclusao[]>('/moderacao/pedidos');
  }

  /** Tira da lista da turma. O autor continua vendo em "não listados". */
  ocultar(tipo: TipoModeravel, id: string, motivo: string | null): Promise<void> {
    return this.api.post<void>(`/moderacao/${tipo}/${id}/ocultar`, { motivo });
  }

  reexibir(tipo: TipoModeravel, id: string): Promise<void> {
    return this.api.post<void>(`/moderacao/${tipo}/${id}/reexibir`);
  }

  /** Avisa o autor. Não apaga: apagar é só de quem criou. */
  pedirExclusao(tipo: TipoModeravel, id: string, motivo: string | null): Promise<void> {
    return this.api.post<void>(`/moderacao/${tipo}/${id}/pedir-exclusao`, { motivo });
  }

  /**
   * Passa a liderança. Quem chama deixa de ser líder na mesma operação — a turma
   * nunca fica sem líder nem com dois.
   */
  transferirLideranca(novoLiderUsuarioId: string): Promise<void> {
    return this.api.post<void>('/turmas/lideranca/transferir', { novoLiderUsuarioId });
  }
}
