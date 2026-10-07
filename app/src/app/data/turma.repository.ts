import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ApiService } from '../core/api.service';
import { ROTA_ENTRAR_TURMA } from '../core/auth.guard';
import { AuthService } from '../core/auth.service';
import { ErroApi } from '../core/http-error.interceptor';
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
  semestre: string | null;
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
  private readonly router = inject(Router);

  readonly turma = signal<MinhaTurma | null>(null);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);

  constructor() {
    // Este repositório é `providedIn: 'root'` e vive até fechar o app, mas a
    // sessão não: sair e entrar com outra conta, no mesmo aparelho, deixava a
    // turma e o papel da conta anterior na tela até recarregar, e o
    // `garantirCarregada` das telas não busca de novo o que já tem. Zerar aqui,
    // e não em `auth.service.ts`, mantém a regra ao lado do dado que ela limpa.
    // Lê `usuario()` e não `autenticado()` porque o AuthService apaga os dois
    // juntos (sair, 401) e `usuario` é o sinal que `souLider` já lê.
    effect(() => {
      if (this.auth.usuario() === null) {
        this.limpar();
      }
    });
  }

  /** `false` enquanto não se sabe. Na dúvida, não oferecer é melhor que oferecer e falhar. */
  readonly souLider = computed(() => {
    const eu = this.auth.usuario();
    const t = this.turma();
    if (eu === null || t === null) {
      return false;
    }
    return t.membros.some((m) => m.usuarioId === eu.id && m.papel === 'LIDER');
  });

  /**
   * Renomear a turma e acertar o período. Só o líder.
   *
   * O código de convite NÃO muda junto: ele identifica a turma e está anotado no
   * celular de todo mundo. Trocá-lo na virada de semestre expulsaria a turma
   * inteira do próprio grupo.
   */
  async renomear(nome: string, semestre: string | null): Promise<void> {
    this.turma.set(
      await this.api.patch<MinhaTurma>('/turmas/minha', { nome, semestre }),
    );
  }

  /**
   * Remove um membro. Só o líder; o servidor recusa o próprio líder (409).
   *
   * O membro sai da lista antes da releitura: o DELETE já deu certo, e é isso que
   * a tela tem de mostrar mesmo se `carregar` falhar em seguida — ele guarda a
   * falha em `erro` e mantém o dado velho, que aqui ainda teria a pessoa removida.
   */
  async removerMembro(usuarioId: string): Promise<void> {
    await this.api.delete<void>(`/turmas/minha/membros/${usuarioId}`);
    this.turma.update((t) =>
      t === null
        ? t
        : { ...t, membros: t.membros.filter((m) => m.usuarioId !== usuarioId) },
    );
    await this.carregar();
  }

  /**
   * Troca o código de convite. O antigo para de funcionar; quem já entrou fica.
   *
   * A resposta é a turma inteira, então ela substitui a que está em tela: o
   * código novo aparece na hora, sem uma segunda ida ao servidor.
   */
  async gerarNovoCodigo(): Promise<void> {
    this.turma.set(await this.api.post<MinhaTurma>('/turmas/minha/codigo'));
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.turma.set(await this.api.get<MinhaTurma>('/turmas/minha'));
    } catch (e) {
      // 404 aqui nao e "nao achei": e "voce nao esta em turma nenhuma" — o
      // servidor responde assim a quem o lider removeu. Deixar como erro comum
      // prendia a pessoa numa tela de aviso, com o app inteiro respondendo 404 e
      // nenhum caminho para entrar noutra turma.
      if (e instanceof ErroApi && e.status === 404) {
        await this.ficouSemTurma();
        return;
      }
      // A turma NÃO é limpa: se já havia dado, ele continua valendo enquanto o
      // aviso explica que a atualização falhou. Zerar transformaria "não
      // consegui atualizar" em "a turma sumiu".
      this.erro.set(
        e instanceof Error ? e.message : 'Não deu para carregar a turma.',
      );
    } finally {
      this.carregando.set(false);
    }
  }

  /**
   * Esquece o vinculo e leva a pessoa para onde se entra numa turma.
   *
   * A navegacao e explicita porque a guarda so roda quando a rota ativa: quem ja
   * esta dentro das abas nao passa por ela, e ficaria olhando uma tela de erro.
   */
  private async ficouSemTurma(): Promise<void> {
    this.limpar();
    // Falha ao gravar em disco nao pode impedir a saida: em memoria a sessao ja
    // esta sem turma, e preso aqui a pessoa nao sai.
    await this.auth
      .registrarTurma(null)
      .catch((e: unknown) =>
        console.error('[turma] falha ao gravar a sessao sem turma', e),
      );
    await this.router
      .navigateByUrl(ROTA_ENTRAR_TURMA)
      .catch((e: unknown) =>
        console.error('[turma] falha ao ir para a tela de entrar na turma', e),
      );
  }

  /** Esquece a turma e o aviso de erro: a próxima tela que precisar busca de novo. */
  limpar(): void {
    this.turma.set(null);
    this.erro.set(null);
  }

  /** Carrega só se ainda não houver nada — para quem precisa do papel, não da tela. */
  async garantirCarregada(): Promise<void> {
    if (this.turma() === null && !this.carregando()) {
      await this.carregar();
    }
  }
}
