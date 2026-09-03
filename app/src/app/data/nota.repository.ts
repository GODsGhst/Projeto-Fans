import { Injectable, inject, signal } from '@angular/core';

import { ApiService } from '../core/api.service';
import type { AlcanceNota } from '../shared/tipos';

export interface Nota {
  id: string;
  alcance: AlcanceNota;
  /** `AAAA-MM-DD`. A anotação está presa a um dia. */
  data: string;
  texto: string;
  autorId: string;
  /** Só vem na nota da TURMA — assinar o próprio rascunho seria ruído. */
  autorNome?: string | null;
  criadoEm: string;
  atualizadoEm: string;
  version: number;
}

export interface SalvarNota {
  alcance: AlcanceNota;
  data: string;
  texto: string;
}

/**
 * Anotações do período.
 *
 * **Não existe `GET /notas/{id}`**, e a ausência é a regra do servidor, não uma
 * economia daqui: com ele, adivinhar um UUID seria o caminho de ler o rascunho
 * pessoal de outra pessoa. A leitura é sempre por janela de dias, e o servidor
 * já devolve só o que quem pergunta pode ler.
 *
 * A lista fica no repositório porque duas telas a querem — o calendário e a de
 * escrever, que volta para ela.
 */
@Injectable({ providedIn: 'root' })
export class NotaRepository {
  private readonly api = inject(ApiService);

  readonly notas = signal<Nota[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);

  async carregar(de: string, ate: string): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.notas.set(await this.api.get<Nota[]>('/notas', { de, ate }));
    } catch (e) {
      // A lista NÃO é limpa: se já havia anotação em tela, ela continua valendo
      // enquanto o aviso explica que a atualização falhou.
      this.erro.set(
        e instanceof Error ? e.message : 'Não deu para carregar as anotações.',
      );
    } finally {
      this.carregando.set(false);
    }
  }

  criar(req: SalvarNota): Promise<Nota> {
    return this.api.post<Nota>('/notas', req);
  }

  /** Só o autor. `version` no `If-Match`; PATCH substitui o objeto inteiro. */
  atualizar(id: string, version: number, req: SalvarNota): Promise<Nota> {
    return this.api.patch<Nota>(`/notas/${id}`, req, version);
  }

  excluir(id: string, version: number): Promise<void> {
    return this.api.delete<void>(`/notas/${id}`, version);
  }
}
