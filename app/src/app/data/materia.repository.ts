import { Injectable, inject, signal } from '@angular/core';

import { ApiService } from '../core/api.service';
import { StorageService } from '../core/storage.service';
import type { CriarMateriaRequest, Materia, MateriaDetalhe } from './models';

/**
 * Materias da turma. `corHex` vem sempre do servidor, de uma paleta de 12 hues
 * validadas — o app nunca inventa cor, e nunca mostra cor sem sigla.
 */
@Injectable({ providedIn: 'root' })
export class MateriaRepository {
  private readonly api = inject(ApiService);
  private readonly storage = inject(StorageService);

  readonly materias = signal<Materia[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const doServidor = await this.api.get<Materia[]>('/materias');
      this.materias.set(doServidor);
      await this.storage.mesclar({ materias: doServidor });
    } catch (e) {
      this.erro.set(e instanceof Error ? e.message : 'Não deu para carregar as matérias.');
      throw e;
    } finally {
      this.carregando.set(false);
    }
  }

  /** Materiais separados por tipo mais os eventos da materia. */
  detalhe(materiaId: string): Promise<MateriaDetalhe> {
    return this.api.get<MateriaDetalhe>(`/materias/${materiaId}`);
  }

  criar(req: CriarMateriaRequest): Promise<Materia> {
    return this.api.post<Materia>('/materias', req);
  }
}
