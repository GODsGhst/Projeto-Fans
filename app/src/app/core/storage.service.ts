import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

import type { ItemHome, Materia, Usuario } from '../data/models';

/**
 * Um snapshot JSON por turma, versionado por `ultimoSync` (Secao 8 do spec).
 *
 * Existe por dois motivos: agendar notificacao local precisa da lista de eventos
 * no aparelho, e ficar offline nao pode virar tela branca. `ultimoSync` e o que
 * permite dizer "dados de 09:15", em vez de mentir que o dado e fresco.
 */
export interface SnapshotLocal {
  eventos: ItemHome[];
  materias: Materia[];
  ultimoSync: string;
}

interface SessaoLocal {
  jwt: string;
  usuario: Usuario;
  /** Ausente = tem sessao e nao tem turma. Estado real, nao corrompido. */
  turmaId?: string | null;
}

const CHAVE_SNAPSHOT = 'pf.snapshot';
const CHAVE_SESSAO = 'pf.sessao';

/**
 * Capacitor Preferences, nao SQLite: uma turma gera centenas de eventos por
 * semestre, nao centenas de milhares. Rever se passar de ~2000 eventos.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  async ler(): Promise<SnapshotLocal | null> {
    return this.lerJson<SnapshotLocal>(CHAVE_SNAPSHOT);
  }

  async gravar(s: SnapshotLocal): Promise<void> {
    await Preferences.set({ key: CHAVE_SNAPSHOT, value: JSON.stringify(s) });
  }

  async limpar(): Promise<void> {
    await Preferences.remove({ key: CHAVE_SNAPSHOT });
  }

  /**
   * Home e Materias gravam partes distintas do mesmo snapshot. Sem a mescla, a
   * ultima a gravar apagaria o pedaco da outra.
   */
  async mesclar(parcial: Partial<Omit<SnapshotLocal, 'ultimoSync'>>): Promise<void> {
    const atual = await this.ler();
    await this.gravar({
      eventos: parcial.eventos ?? atual?.eventos ?? [],
      materias: parcial.materias ?? atual?.materias ?? [],
      ultimoSync: new Date().toISOString(),
    });
  }

  async lerSessao(): Promise<SessaoLocal | null> {
    return this.lerJson<SessaoLocal>(CHAVE_SESSAO);
  }

  async gravarSessao(jwt: string, usuario: Usuario, turmaId?: string | null): Promise<void> {
    await Preferences.set({
      key: CHAVE_SESSAO,
      value: JSON.stringify({ jwt, usuario, turmaId: turmaId ?? null }),
    });
  }

  async limparSessao(): Promise<void> {
    await Preferences.remove({ key: CHAVE_SESSAO });
  }

  private async lerJson<T>(chave: string): Promise<T | null> {
    const { value } = await Preferences.get({ key: chave });
    if (value === null) {
      return null;
    }
    try {
      return JSON.parse(value) as T;
    } catch (e) {
      // Snapshot corrompido nao pode derrubar o app nem passar por dado valido:
      // descarta, avisa, e o proximo carregamento busca do servidor.
      console.error(`[storage] ${chave} ilegivel, descartando`, e);
      await Preferences.remove({ key: chave });
      return null;
    }
  }
}
