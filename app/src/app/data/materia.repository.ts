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
    this.servidorRespondeu = false;
    const emVoo = this.api.get<Materia[]>('/materias');
    void this.aquecerDoDisco();
    try {
      const doServidor = await emVoo;
      this.servidorRespondeu = true;
      this.materias.set(doServidor);
      await this.storage.mesclar({ materias: doServidor });
    } catch (e) {
      this.erro.set(
        e instanceof Error ? e.message : 'Não deu para carregar as matérias.',
      );
      throw e;
    } finally {
      this.carregando.set(false);
    }
  }

  /**
   * Poe na tela as materias que ja estao no aparelho, antes de perguntar.
   *
   * O `mesclar` abaixo ja gravava esta lista desde sempre — e ninguem nunca a
   * lia de volta. Era trabalho de escrita puro, sem beneficiario: o cache existia
   * no disco e a aba abria em branco a cada vez, esperando o servidor acordar.
   *
   * Mesma regra da Home: so quando nao ha nada em tela, e sem tocar em `erro`.
   */
  private servidorRespondeu = false;

  private async aquecerDoDisco(): Promise<void> {
    if (this.materias().length > 0) {
      return;
    }
    const snapshot = await this.storage.ler();
    // `servidorRespondeu` cobre a corrida: turma que apagou todas as materias
    // recebe lista vazia do servidor, e sem esta guarda o disco a repintaria.
    if (
      !this.servidorRespondeu &&
      snapshot !== null &&
      snapshot.materias.length > 0
    ) {
      this.materias.set(snapshot.materias);
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
