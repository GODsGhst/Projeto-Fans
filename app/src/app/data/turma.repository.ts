import { Injectable, computed, inject, signal } from '@angular/core';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import type { PapelMembro } from './models';

export interface MembroDaTurma {
  usuarioId: string;
  nome: string;
  papel: PapelMembro;
  entrouEm: string;
}

export interface MinhaTurma {
  id: string;
  nome: string;
  semestre: string;
  codigoConvite: string;
  membros: MembroDaTurma[];
}

/**
 * A turma e quem sou eu dentro dela.
 *
 * **Por que virou repositório.** `GET /turmas/minha` era buscado direto por duas
 * telas, cada uma com a própria cópia do tipo e do tratamento de erro, e uma
 * terceira estava para chegar — a de um evento, que precisa saber se quem olha é
 * o líder para oferecer moderar. Três cópias da mesma pergunta é onde uma delas
 * começa a responder diferente.
 *
 * **O papel é lido, nunca guardado na sessão.** Seria mais barato gravá-lo no
 * login, e ficaria errado no minuto seguinte: a liderança se transfere, e uma
 * sessão antiga continuaria mostrando botões de líder para quem já não é — ou
 * escondendo de quem passou a ser. O servidor recusa de qualquer jeito; o
 * problema é a tela mentir sobre o que a pessoa pode fazer.
 */
@Injectable({ providedIn: 'root' })
export class TurmaRepository {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly turma = signal<MinhaTurma | null>(null);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);

  /** `false` enquanto não se sabe. Na dúvida, não oferecer é melhor que oferecer e falhar. */
  readonly souLider = computed(() => {
    const eu = this.auth.usuario();
    const t = this.turma();
    if (eu === null || t === null) {
      return false;
    }
    return t.membros.some((m) => m.usuarioId === eu.id && m.papel === 'LIDER');
  });

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.turma.set(await this.api.get<MinhaTurma>('/turmas/minha'));
    } catch (e) {
      // A turma NÃO é limpa: se já havia dado, ele continua valendo enquanto o
      // aviso explica que a atualização falhou. Zerar transformaria "não
      // consegui atualizar" em "a turma sumiu".
      this.erro.set(e instanceof Error ? e.message : 'Não deu para carregar a turma.');
    } finally {
      this.carregando.set(false);
    }
  }

  /** Carrega só se ainda não houver nada — para quem precisa do papel, não da tela. */
  async garantirCarregada(): Promise<void> {
    if (this.turma() === null && !this.carregando()) {
      await this.carregar();
    }
  }
}
