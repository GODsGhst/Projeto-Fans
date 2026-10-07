import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { CODIGO_SEM_TURMA, ErroApi } from '../core/http-error.interceptor';
import type { PapelMembro, Selo } from './models';

export interface MembroDaTurma {
  usuarioId: string;
  nome: string;
  papel: PapelMembro;
  entrouEm: string;
  /**
   * So docente tem os tres. Opcionais porque o backend OMITE campo nulo e porque
   * aluno nao os tem. `selo` ausente = sem poder aqui (pendente, recusado ou
   * contestado); `lecionadas` sao SIGLAS, o que o lider precisa para julgar a
   * declaracao.
   */
  selo?: Selo | null;
  contestado?: boolean;
  lecionadas?: string[];
}

/**
 * Ate onde ESTA pessoa alcanca nesta turma (spec 7): NENHUM = e aluno para
 * efeito de poder; MATERIAS = so nas `materiaIds`; TURMA = na turma toda
 * (coordenacao).
 */
export type TipoAlcance = 'NENHUM' | 'MATERIAS' | 'TURMA';

export interface MeuAlcance {
  tipo: TipoAlcance;
  materiaIds: string[];
}

export interface MinhaTurma {
  id: string;
  nome: string;
  semestre: string | null;
  codigoConvite: string;
  membros: MembroDaTurma[];
  /** Opcional: servidor ou snapshot antigo nao o manda, e ausente quer dizer NENHUM. */
  meuAlcance?: MeuAlcance;
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

  constructor() {
    // Este repositório é `providedIn: 'root'` e vive até fechar o app, mas a
    // sessão não: sair e entrar com outra conta, no mesmo aparelho, deixava a
    // turma e o papel da conta anterior na tela até recarregar, e o
    // `garantirCarregada` das telas não busca de novo o que já tem. Zerar aqui,
    // e não em `auth.service.ts`, mantém a regra ao lado do dado que ela limpa.
    // Lê `usuario()` e não `autenticado()` porque o AuthService apaga os dois
    // juntos (sair, 401) e `usuario` é o sinal que `souLider` já lê.
    //
    // `turmaId()` também: quem o líder removeu perde o vínculo com a conta
    // intacta (o interceptor de erro chama `registrarTurma(null)` diante de
    // SEM_TURMA, de qualquer rota). Sem isto, a turma antiga ficava em memória e
    // `souLider` seguia respondendo pelo papel dela quando a pessoa entrasse noutra.
    effect(() => {
      if (this.auth.usuario() === null || this.auth.turmaId() === null) {
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
   * Esta pessoa pode corrigir e ocultar o registro dessa materia (`null` = nota,
   * que nao tem materia)? Mesmo padrao do `souLider`: lido da turma, nunca da
   * sessao, e falso enquanto nao se sabe.
   *
   * So esconde botao. Quem decide e o servidor (que le o status do banco a cada
   * requisicao); permissao velha aqui vira 403 com mensagem, nao brecha.
   */
  alcanca(materiaId: string | null): boolean {
    const a = this.turma()?.meuAlcance;
    switch (a?.tipo) {
      case 'TURMA':
        return true;
      case 'MATERIAS':
        return materiaId !== null && a.materiaIds.includes(materiaId);
      default:
        return false;
    }
  }

  /**
   * O selo que o registro dessa materia vai levar se esta pessoa o postar ou
   * corrigir: coordenacao na turma toda, professor nas materias dele. Serve para
   * AVISAR antes de salvar; o selo de verdade e carimbado pelo servidor.
   */
  seloNa(materiaId: string | null): Selo | null {
    if (!this.alcanca(materiaId)) {
      return null;
    }
    return this.turma()?.meuAlcance?.tipo === 'TURMA' ? 'COORDENACAO' : 'PROFESSOR';
  }

  /** O papel desta pessoa NESTA turma, ou `null` enquanto nao se sabe. */
  readonly meuMembro = computed(() => {
    const eu = this.auth.usuario();
    return eu === null
      ? null
      : (this.turma()?.membros.find((m) => m.usuarioId === eu.id) ?? null);
  });

  /**
   * Substitui o conjunto de materias que o professor leciona. Vale na hora, sem
   * fila (spec 2.3). Conta pendente pode declarar: fica inerte ate a aprovacao.
   * Reler em seguida: o selo e o alcance dependem do que ficou gravado.
   */
  async declararLecionadas(materiaIds: string[]): Promise<void> {
    await this.api.put<void>('/turmas/minha/lecionadas', { materiaIds });
    await this.carregar();
  }

  /**
   * O lider contesta a declaracao de um docente: ele perde poder e selo NESTA
   * turma ate o lider restaurar (spec 2.4). Nao tira ninguem da turma.
   *
   * A marca entra na lista antes da releitura, como em `removerMembro`: o POST
   * ja deu certo, e e isso que a tela tem de mostrar mesmo se `carregar` falhar.
   */
  async contestar(usuarioId: string): Promise<void> {
    await this.api.post<void>(`/turmas/minha/docentes/${usuarioId}/contestar`);
    this.marcarContestado(usuarioId, true);
    await this.carregar();
  }

  async restaurar(usuarioId: string): Promise<void> {
    await this.api.post<void>(`/turmas/minha/docentes/${usuarioId}/restaurar`);
    this.marcarContestado(usuarioId, false);
    await this.carregar();
  }

  private marcarContestado(usuarioId: string, contestado: boolean): void {
    this.turma.update((t) =>
      t === null
        ? t
        : {
            ...t,
            membros: t.membros.map((m) =>
              m.usuarioId === usuarioId
                ? // Contestado nao tem selo; restaurado so volta a ter com a releitura.
                  { ...m, contestado, ...(contestado ? { selo: null } : {}) }
                : m,
            ),
          },
    );
  }

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
      // SEM_TURMA: o servidor responde assim a quem o lider removeu. O interceptor
      // ja esqueceu o vinculo e esta levando a pessoa para entrar noutra turma;
      // aqui so falta nao deixar um aviso de erro numa tela de que ela esta saindo.
      // Um 404 SEM o codigo (proxy, portal cativo, servidor acordando) NAO e isso:
      // cai no aviso comum, e ninguem perde a turma por um tropeco de rede.
      if (e instanceof ErroApi && e.codigo === CODIGO_SEM_TURMA) {
        this.limpar();
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
