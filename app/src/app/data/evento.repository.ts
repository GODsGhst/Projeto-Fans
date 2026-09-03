import { Injectable, inject, signal } from '@angular/core';

import { ApiService } from '../core/api.service';
import type {
  AtualizarEventoRequest,
  CriarEventoRequest,
  Evento,
  EventoDetalhe,
} from './models';

/**
 * Eventos: o Calendario e a tela de um evento.
 *
 * A janela do calendario vem da tela (`de`/`ate`), mas quem decide o que e
 * visivel continua sendo o servidor. Nada aqui reordena ou filtra o que voltou.
 */
@Injectable({ providedIn: 'root' })
export class EventoRepository {
  private readonly api = inject(ApiService);

  readonly eventos = signal<Evento[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);

  /** `GET /eventos?de=&ate=` — datas em ISO `AAAA-MM-DD`. */
  async carregarPeriodo(de: string, ate: string): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.eventos.set(await this.api.get<Evento[]>('/eventos', { de, ate }));
    } catch (e) {
      // Nunca esvaziar a lista por causa de falha: a tela mostraria "nada
      // marcado" quando a verdade e "nao consegui perguntar".
      this.erro.set(mensagem(e));
      throw e;
    } finally {
      this.carregando.set(false);
    }
  }

  /** Traz SOMENTE os materiais vinculados a este evento — nunca a materia inteira. */
  detalhe(eventoId: string): Promise<EventoDetalhe> {
    return this.api.get<EventoDetalhe>(`/eventos/${eventoId}`);
  }

  /** Qualquer membro cria, sem aprovacao e sem fila. */
  criar(req: CriarEventoRequest): Promise<Evento> {
    return this.api.post<Evento>('/eventos', req);
  }

  /** So o autor. `version` vai no `If-Match`: divergiu, 409. */
  atualizar(
    eventoId: string,
    version: number,
    req: AtualizarEventoRequest,
  ): Promise<Evento> {
    return this.api.patch<Evento>(`/eventos/${eventoId}`, req, version);
  }

  /** Exclusao logica no servidor: a linha continua existindo em "Nao listados". */
  excluir(eventoId: string, version: number): Promise<void> {
    return this.api.delete<void>(`/eventos/${eventoId}`, version);
  }

  vincularMaterial(eventoId: string, materialId: string): Promise<void> {
    return this.api.post<void>(`/eventos/${eventoId}/materiais/${materialId}`);
  }

  desvincularMaterial(eventoId: string, materialId: string): Promise<void> {
    return this.api.delete<void>(
      `/eventos/${eventoId}/materiais/${materialId}`,
    );
  }
}

function mensagem(e: unknown): string {
  return e instanceof Error ? e.message : 'Não deu para carregar.';
}
