import { Injectable, inject } from '@angular/core';

import { ApiService } from '../core/api.service';
import type {
  AtualizarMaterialRequest,
  CriarMaterialRequest,
  Material,
} from './models';

/**
 * Materiais.
 *
 * Nao existe listagem por materia aqui de proposito: material chega pela tela da
 * materia (`MateriaRepository.detalhe`) ou pelos vinculos de um evento
 * (`EventoRepository.detalhe`). Um `GET /materiais?materia=` daria a alguem o
 * caminho de despejar a materia inteira na tela de uma prova.
 */
@Injectable({ providedIn: 'root' })
export class MaterialRepository {
  private readonly api = inject(ApiService);

  /** Um material, para a tela de editar. `GET /materiais/{id}` ja existia sem chamador. */
  detalhe(materialId: string): Promise<Material> {
    return this.api.get<Material>(`/materiais/${materialId}`);
  }

  criar(req: CriarMaterialRequest): Promise<Material> {
    return this.api.post<Material>('/materiais', req);
  }

  /** So o autor. `version` no `If-Match`. */
  atualizar(
    materialId: string,
    version: number,
    req: AtualizarMaterialRequest,
  ): Promise<Material> {
    return this.api.patch<Material>(`/materiais/${materialId}`, req, version);
  }

  /**
   * Pede o resumo por IA, com a chave DESTE aparelho no header.
   *
   * A chave viaja em header e nunca em corpo: corpo de requisicao acaba em log
   * de acesso e em relatorio de erro com muito mais facilidade, e ela e a unica
   * coisa que trafega aqui que nao pertence ao projeto.
   *
   * `refazer` existe porque a chamada custa dinheiro: sem ele, abrir a tela de
   * novo cobraria de novo. Com resumo ja gerado o servidor devolve o que tem.
   */
  resumir(
    materialId: string,
    chave: string,
    refazer = false,
  ): Promise<Material> {
    return this.api.post<Material>(
      `/materiais/${materialId}/resumo${refazer ? '?refazer=true' : ''}`,
      {},
      { 'X-IA-Key': chave },
    );
  }

  excluir(materialId: string, version: number): Promise<void> {
    return this.api.delete<void>(`/materiais/${materialId}`, version);
  }
}
