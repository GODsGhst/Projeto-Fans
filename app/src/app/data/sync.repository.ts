import { Injectable, inject } from '@angular/core';

import { ApiService } from '../core/api.service';
import type { SyncResponse } from './models';

/**
 * Delta para o reagendador local de notificacoes.
 *
 * A resposta inclui eventos ocultos e excluidos de proposito: sem eles o
 * aparelho manteria uma notificacao agendada para um evento que a turma nao ve
 * mais — um fantasma que so some reinstalando o app.
 */
@Injectable({ providedIn: 'root' })
export class SyncRepository {
  private readonly api = inject(ApiService);

  /** @param desde ISO 8601. Use `servidorEm` da resposta anterior. */
  delta(desde: string): Promise<SyncResponse> {
    return this.api.get<SyncResponse>('/sync', { desde });
  }

  /** `POST /devices` no login, `DELETE /devices/{token}` no logout. */
  registrarDevice(fcmToken: string, plataforma: 'android' | 'ios' | 'web'): Promise<void> {
    return this.api.post<void>('/devices', { fcmToken, plataforma });
  }

  removerDevice(fcmToken: string): Promise<void> {
    return this.api.delete<void>(`/devices/${encodeURIComponent(fcmToken)}`);
  }
}
