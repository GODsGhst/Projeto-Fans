import { Injectable, inject } from '@angular/core';

import { ApiService } from '../core/api.service';
import type { AtualizarMaterialRequest, CriarMaterialRequest, Material } from './models';

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

  criar(req: CriarMaterialRequest): Promise<Material> {
    return this.api.post<Material>('/materiais', req);
  }

  /** So o autor. `version` no `If-Match`. */
  atualizar(materialId: string, version: number, req: AtualizarMaterialRequest): Promise<Material> {
    return this.api.patch<Material>(`/materiais/${materialId}`, req, version);
  }

  excluir(materialId: string, version: number): Promise<void> {
    return this.api.delete<void>(`/materiais/${materialId}`, version);
  }
}
