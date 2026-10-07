import { Injectable, inject, signal } from '@angular/core';

import { ApiService } from '../core/api.service';
import { ErroApi } from '../core/http-error.interceptor';
import type { Painel } from './docente.models';

/**
 * `GET /painel`.
 *
 * Mesma regra da Home: NAO reordena, NAO filtra, NAO corta. A janela de 14 dias,
 * o teto de 6 por turma e o filtro de materia do professor sao do servidor; refazer
 * qualquer um aqui faria o painel e o calendario discordarem sobre o que "cai".
 *
 * Sem snapshot offline, de proposito: `pf.snapshot` guarda UMA turma (a ativa) e
 * o painel mistura todas. Falhou, o painel diz que falhou — nunca "nao ha nada".
 */
@Injectable({ providedIn: 'root' })
export class PainelRepository {
  private readonly api = inject(ApiService);

  /** `null` = ainda nao chegou. Diferente de `{turmas: []}`, que e "nao ha turma". */
  readonly painel = signal<Painel | null>(null);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.painel.set(await this.api.get<Painel>('/painel'));
    } catch (e) {
      // O painel anterior fica na tela: dado de 2 minutos atras com aviso de
      // falha e melhor que tela em branco. O que nunca acontece e sumir com ele
      // e mostrar "nenhuma turma" no lugar.
      this.erro.set(e instanceof ErroApi ? e.message : 'Não deu para carregar.');
    } finally {
      this.carregando.set(false);
    }
  }
}
