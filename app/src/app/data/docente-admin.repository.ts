import { Injectable, inject } from '@angular/core';

import { ApiService } from '../core/api.service';
import type { DocenteStatus, TipoConta } from './models';

/** Uma linha de `GET /admin/docentes`: a CONTA, nunca a turma (spec 2.2). */
export interface DocenteAdmin {
  usuarioId: string;
  nome: string;
  email: string;
  tipoConta: Exclude<TipoConta, 'ALUNO'>;
  docenteStatus: DocenteStatus;
  /** Quando a conta foi criada — o servidor nao devolve a data da decisao. */
  criadoEm: string;
  /**
   * Hoje o servidor devolve sempre `false`: o cadastro nao verifica o e-mail, e
   * qualquer pessoa pode se cadastrar com o endereco de outra. A tela avisa o admin
   * antes de aprovar (A27); quando houver verificacao, o valor passa a vir verdadeiro.
   */
  emailVerificado: boolean;
}

/**
 * Aprovar e recusar conta docente. So o admin da plataforma: para qualquer outra
 * pessoa o servidor responde 404, entao a tela nao precisa de checagem propria
 * para ser segura — o link no perfil e so comodidade.
 *
 * O admin decide QUEM a pessoa e, nao ONDE ela manda: aprovar vale para todas as
 * turmas, e a lista nao traz turma nem conteudo (V6 continua valendo).
 */
@Injectable({ providedIn: 'root' })
export class DocenteAdminRepository {
  private readonly api = inject(ApiService);

  listar(status: DocenteStatus): Promise<DocenteAdmin[]> {
    return this.api.get<DocenteAdmin[]>('/admin/docentes', { status });
  }

  aprovar(usuarioId: string): Promise<void> {
    return this.api.post<void>(`/admin/docentes/${usuarioId}/aprovar`);
  }

  /**
   * Serve tambem para REVOGAR quem estava aprovado — nao existe rota "revogar".
   * O efeito e imediato: o status e lido do banco a cada requisicao, nao do JWT,
   * entao o poder some em todas as turmas na hora.
   */
  recusar(usuarioId: string): Promise<void> {
    return this.api.post<void>(`/admin/docentes/${usuarioId}/recusar`);
  }
}
