import { Injectable, inject } from '@angular/core';

import { ApiService } from '../core/api.service';
import { TurmaRepository } from './turma.repository';

/** Os dois tipos que o líder pode moderar. A rota do spec é em minúsculas. */
export type TipoModeravel = 'evento' | 'material' | 'nota';

/** Um pedido do líder para que você apague algo seu. */
export interface PedidoDeExclusao {
  registroTipo: 'EVENTO' | 'MATERIAL';
  registroId: string;
  titulo: string;
  motivo: string | null;
  pedidoPor: string;
  em: string;
}

/** Uma linha de `GET /moderacao/ocultados`. A rota é só do líder. */
export interface Ocultado {
  registroTipo: 'EVENTO' | 'MATERIAL' | 'NOTA';
  registroId: string;
  titulo: string;
  autorId: string;
  autorNome: string;
  /** Pode vir nulo: registro oculto antes de o servidor anotar o instante. */
  ocultadoEm: string | null;
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
  private readonly turmas = inject(TurmaRepository);

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
  ocultar(
    tipo: TipoModeravel,
    id: string,
    motivo: string | null,
  ): Promise<void> {
    return this.api.post<void>(`/moderacao/${tipo}/${id}/ocultar`, { motivo });
  }

  reexibir(tipo: TipoModeravel, id: string): Promise<void> {
    return this.api.post<void>(`/moderacao/${tipo}/${id}/reexibir`);
  }

  /**
   * Tudo que o líder tirou da lista e ainda está oculto.
   *
   * É o "desfazer" que não expira: o aviso logo depois de ocultar dura segundos,
   * e quem percebe o engano na semana seguinte precisa de um lugar onde achar
   * o registro — que, oculto, já não aparece em tela nenhuma da turma.
   */
  ocultados(): Promise<Ocultado[]> {
    return this.api.get<Ocultado[]>('/moderacao/ocultados');
  }

  /** Avisa o autor. Não apaga: apagar é só de quem criou. */
  pedirExclusao(
    tipo: TipoModeravel,
    id: string,
    motivo: string | null,
  ): Promise<void> {
    return this.api.post<void>(`/moderacao/${tipo}/${id}/pedir-exclusao`, {
      motivo,
    });
  }

  /**
   * Passa a liderança. Quem chama deixa de ser líder na mesma operação — a turma
   * nunca fica sem líder nem com dois.
   *
   * Recarrega a turma em seguida, e aqui e não na tela: o papel de todas as
   * telas sai do mesmo `TurmaRepository`, e o `garantirCarregada` delas não
   * busca de novo o que já tem. Sem isto a turma continuava mostrando o
   * ex-líder como líder até fechar o app.
   *
   * `carregar` não lança: guarda a falha em `erro` e mantém o dado velho, que é
   * certo para "não consegui atualizar" e errado aqui — o dado velho é
   * justamente o que acabou de deixar de valer. Então, se a releitura falhou,
   * esquece a turma e força uma busca nova na próxima tela.
   */
  async transferirLideranca(novoLiderUsuarioId: string): Promise<void> {
    await this.api.post<void>('/turmas/lideranca/transferir', {
      novoLiderUsuarioId,
    });
    await this.turmas.carregar();
    if (this.turmas.erro() !== null) {
      this.turmas.limpar();
    }
  }
}
