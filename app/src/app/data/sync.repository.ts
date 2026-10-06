import { Injectable, inject } from '@angular/core';

import { ApiService } from '../core/api.service';
import { NotificacoesService } from '../notifications/notificacoes.service';
import type { EventoAgendavel } from '../notifications/reagendador';
import type { Evento } from './models';

/**
 * `GET /sync`, so o pedaco que os lembretes leem.
 *
 * Para oculto e excluido de quem nao e o autor, o item chega como lapide: so
 * `id`, `visivelTurma` e `excluidoEm`. Por isso tudo aqui e `Partial` — o
 * reagendador olha as flags antes de ler qualquer conteudo.
 */
interface RespostaSync {
  eventosAlterados: (Partial<Evento> & Pick<Evento, 'id'>)[];
}

/**
 * Busca a turma inteira no `/sync` e entrega aos lembretes.
 *
 * O `/sync`, e nao a Home, porque a Home tem teto de 6 e janela de 14 dias: com
 * ela de fonte, a setima prova da semana ficava sem aviso. E porque o `/sync` e
 * a unica rota que devolve oculto e excluido de proposito — e e assim que o
 * aparelho aprende o que desagendar.
 *
 * Sem `desde`: a lista inteira, toda vez. "Cancela tudo e reagenda tudo" precisa
 * do todo, e o todo de uma turma sao centenas de eventos por semestre.
 * ponytail: payload cresce com o semestre; passar `desde` + mesclar num cache
 * local se um dia pesar.
 */
@Injectable({ providedIn: 'root' })
export class SyncRepository {
  private readonly api = inject(ApiService);
  private readonly notificacoes = inject(NotificacoesService);

  /** Em voo: quem chega junto reaproveita a mesma ida ao servidor. */
  private emVoo: Promise<void> | null = null;
  /** Instante do ultimo `/sync` que chegou E foi entregue aos lembretes. */
  private ultimoOk = 0;
  /** Numero da ultima ida iniciada. So a resposta da mais nova e aplicada. */
  private sequencia = 0;
  /** A epoca dos lembretes que `emVoo` e `ultimoOk` enxergam. Ver `NotificacoesService.epoca`. */
  private epocaVista = 0;

  /**
   * Nao lanca. Roda atras da Home e do `resume`, e nenhum dos dois pode quebrar
   * porque o servidor gratuito estava dormindo: os avisos ja agendados continuam
   * valendo, e a proxima carga tenta de novo. O erro vai para o console — nao e
   * uma lista vazia fingindo sucesso, e nada e desagendado por causa dele.
   *
   * **Sem `forcar`, nao repete trabalho.** Home e `resume` chamam a cada entrada
   * e a cada volta do fundo, e cada chamada baixa a turma inteira: quem chega
   * com uma ida em voo espera por ela, e quem chega menos de 60 s depois da
   * ultima que deu certo nem sai. `forcar` e para quem acabou de mudar o que o
   * `/sync` devolveria (evento criado, alarme salvo) — esse sempre vai, senao a
   * lista velha deixaria o aviso novo de fora.
   *
   * **So a ultima ida vale.** Uma resposta atrasada que chegasse depois de um
   * evento criado traria a turma sem ele, e a poda do alarme personalizado
   * (`podarPersonalizados`) apagaria o que a pessoa acabou de marcar.
   */
  async reagendarAvisos(forcar = false): Promise<void> {
    if (!this.notificacoes.suportado) {
      // No navegador nao ha o que agendar, e o servidor dorme: uma chamada
      // pesada a toa e uma chamada a menos para o que a tela precisa.
      return;
    }
    if (this.epocaVista !== this.notificacoes.epoca) {
      // Saiu da conta: nem a ida em voo nem a janela de 60 s sao da conta nova.
      this.epocaVista = this.notificacoes.epoca;
      this.emVoo = null;
      this.ultimoOk = 0;
    }
    if (!forcar) {
      if (this.emVoo !== null) {
        return this.emVoo;
      }
      if (Date.now() - this.ultimoOk < JANELA_MS) {
        return;
      }
    }
    const voo = this.buscarEEntregar();
    this.emVoo = voo;
    try {
      await voo;
    } finally {
      // Uma ida forcada pode ter tomado o lugar desta: nao apagar a dela.
      if (this.emVoo === voo) {
        this.emVoo = null;
      }
    }
  }

  private async buscarEEntregar(): Promise<void> {
    const minha = ++this.sequencia;
    const epoca = this.notificacoes.epoca;
    try {
      const r = await this.api.get<RespostaSync>('/sync');
      if (minha !== this.sequencia || epoca !== this.notificacoes.epoca) {
        // Passada para tras por uma ida mais nova, ou de uma conta que ja saiu.
        return;
      }
      await this.notificacoes.sincronizar(r.eventosAlterados.map(agendavel));
      this.ultimoOk = Date.now();
    } catch (e) {
      console.error('[sync] lembretes nao reagendados; os de antes continuam', e);
    }
  }
}

/** Dentro desta janela, depois de um `/sync` bom, nao se pergunta de novo. */
const JANELA_MS = 60_000;

function agendavel(e: RespostaSync['eventosAlterados'][number]): EventoAgendavel {
  return {
    eventoId: e.id,
    // Lapide nao tem estes campos; o `as` e seguro porque `daTurma` descarta a
    // lapide antes de alguem ler tipo, titulo ou data.
    tipo: e.tipo as Evento['tipo'],
    titulo: e.titulo as string,
    data: e.data as string,
    hora: e.hora ?? null,
    materiaSigla: e.materiaSigla as string,
    visivelTurma: e.visivelTurma,
    excluidoEm: e.excluidoEm ?? null,
  };
}
