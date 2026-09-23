import { Injectable, InjectionToken, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

import {
  NOTIFICACAO_HORA_VESPERA,
  TIMEZONE_PADRAO,
  calcularAgendamentos,
} from './reagendador';
import type { EventoAgendavel } from './reagendador';

/**
 * O pedaço do plugin que este serviço usa — e só ele.
 *
 * Tipo estrutural em vez do tipo do plugin para o teste poder passar um objeto
 * de quatro métodos em vez de simular a superfície inteira do Capacitor.
 */
export interface PluginNotificacoes {
  checkPermissions(): Promise<{ display: string }>;
  requestPermissions(): Promise<{ display: string }>;
  getPending(): Promise<{ notifications: { id: number }[] }>;
  cancel(opcoes: { notifications: { id: number }[] }): Promise<unknown>;
  schedule(opcoes: {
    notifications: {
      id: number;
      title: string;
      body: string;
      schedule: { at: Date; allowWhileIdle: boolean };
    }[];
  }): Promise<unknown>;
}

/**
 * `null` fora do aparelho.
 *
 * No navegador o plugin existe como objeto e estoura "not implemented" na
 * primeira chamada. Resolver a ausência aqui, uma vez, evita o `try/catch` em
 * volta de cada uso — e é o que deixa `ng test` rodar sem nenhum mock global.
 */
export const PLUGIN_NOTIFICACOES =
  new InjectionToken<PluginNotificacoes | null>(
    'plugin de notificações locais',
    {
      providedIn: 'root',
      factory: () => (Capacitor.isNativePlatform() ? LocalNotifications : null),
    },
  );

/**
 * Agenda no aparelho o aviso da véspera de cada prova e entrega.
 *
 * `calcularAgendamentos` estava pronto e testado desde o começo, e ninguém o
 * chamava: o app inteiro sabia calcular a hora do aviso e nunca avisou nada.
 *
 * **Local, não empurrado pelo servidor** (decisão 2.3 do spec): o host gratuito
 * hiberna, e um job das 19h não roda num servidor dormindo.
 *
 * **Cancela tudo e reagenda tudo, a cada carga da Home.** A alternativa é
 * guardar no aparelho o que já foi agendado e calcular a diferença — mais
 * código, e um estado a mais que pode divergir do servidor. O jeito burro é
 * idempotente: o que a Home não trouxe não volta a ser agendado, e é assim que
 * a prova que o líder ocultou para de avisar sem nenhum código de remoção.
 *
 * **A permissão é pedida quando há o que avisar**, não na abertura do app.
 * Perguntar antes de existir uma prova é pedir para ouvir não — e no Android o
 * não é para sempre, sem segunda chance.
 */
@Injectable({ providedIn: 'root' })
export class NotificacoesService {
  private readonly plugin = inject(PLUGIN_NOTIFICACOES);

  async sincronizar(eventos: readonly EventoAgendavel[]): Promise<void> {
    if (this.plugin === null) {
      return;
    }
    const agendamentos = calcularAgendamentos(
      eventos,
      new Date(),
      NOTIFICACAO_HORA_VESPERA,
      TIMEZONE_PADRAO,
    );
    if (agendamentos.length === 0) {
      // Sem nada a agendar não se pede permissão — mas o cancelamento acontece:
      // é o caso "a última prova da semana foi apagada".
      await this.limparPendentes();
      return;
    }
    if (!(await this.permitido())) {
      return;
    }
    await this.limparPendentes();
    await this.plugin.schedule({
      notifications: agendamentos.map((a) => ({
        id: idDe(a.eventoId),
        title: a.titulo,
        body: a.corpo,
        // `allowWhileIdle` NAO e otimizacao: e a diferenca entre avisar e nao
        // avisar. Sem ele o plugin chama `alarmManager.set(RTC, ...)` — alarme
        // inexato e que NAO acorda o aparelho. As 19h o celular esta parado na
        // mesa, em Doze, e o Android adia o disparo por horas. Com ele a chamada
        // vira `RTC_WAKEUP`, que e o unico tipo que atravessa o Doze.
        //
        // O caminho exato nao salva: desde o Android 14 o SCHEDULE_EXACT_ALARM
        // deixou de ser concedido na instalacao, entao `canScheduleExactAlarms()`
        // e falso e o plugin cai no ramo inexato de qualquer jeito. Quem decide
        // se o aviso aparece e esta linha, nao a permissao.
        //
        // Preco: em Doze o disparo pode derivar alguns minutos. Para um aviso da
        // vespera as 19h isso nao e nada — e a alternativa e nao avisar.
        schedule: { at: a.dispararEm, allowWhileIdle: true },
      })),
    });
  }

  /**
   * O que o sistema operacional responde sobre avisos, neste aparelho, agora.
   *
   * Existe porque o servico falha em silencio de proposito: permissao negada
   * faz `sincronizar` voltar sem agendar e sem reclamar, que e o certo no meio
   * de uma carga de tela — mas deixava o app sem NENHUM lugar que dissesse
   * "o Android esta bloqueando os seus avisos". No Android o "nao" e para
   * sempre; se a tela nao contar, ninguem descobre.
   */
  async estado(): Promise<EstadoAviso> {
    if (this.plugin === null) {
      return 'sem-suporte';
    }
    const atual = await this.plugin.checkPermissions();
    return atual.display === 'granted' || atual.display === 'denied'
      ? atual.display
      : 'prompt';
  }

  /**
   * Um aviso daqui a dez segundos.
   *
   * O aviso de verdade e da vespera as 19h — o que significa que conferir se a
   * notificacao funciona custava esperar ate o dia seguinte. Foi exatamente
   * esse custo que deixou um defeito real (alarme sem `allowWhileIdle`, que o
   * Doze engolia) viver sem ninguem perceber: a suite passava, `schedule` era
   * chamado, e o celular nao tocava.
   *
   * Dez segundos, e nao um ou dois: o alarme atravessa o AlarmManager de
   * verdade, com a mesma flag do aviso real. Um teste que desenhasse a
   * notificacao na hora provaria menos do que o usuario precisa saber.
   */
  async testar(): Promise<ResultadoTeste> {
    if (this.plugin === null) {
      return 'sem-suporte';
    }
    if (!(await this.permitido())) {
      return 'negado';
    }
    await this.plugin.schedule({
      notifications: [
        {
          id: ID_TESTE,
          title: 'Teste de aviso',
          body: 'Se voce esta lendo isto, o aviso da vespera vai chegar.',
          schedule: {
            at: new Date(Date.now() + 10_000),
            allowWhileIdle: true,
          },
        },
      ],
    });
    return 'agendado';
  }

  private async limparPendentes(): Promise<void> {
    const pendentes = await this.plugin!.getPending();
    if (pendentes.notifications.length > 0) {
      await this.plugin!.cancel(pendentes);
    }
  }

  private async permitido(): Promise<boolean> {
    const atual = await this.plugin!.checkPermissions();
    if (atual.display === 'granted') {
      return true;
    }
    if (atual.display === 'denied') {
      // Não adianta perguntar de novo: no Android o segundo pedido nem chega a
      // aparecer. Quem mudar de ideia muda nos ajustes do sistema.
      return false;
    }
    return (await this.plugin!.requestPermissions()).display === 'granted';
  }
}

/**
 * UUID do evento -> inteiro, que é o único id que o Android aceita.
 *
 * djb2. Precisa ser ESTÁVEL, não único no universo: o mesmo evento tem de
 * receber o mesmo id em toda execução, senão cancelar não encontra o que
 * agendou. Duas provas colidirem custaria um aviso perdido entre 2^31
 * possibilidades para uma dúzia de eventos — e a próxima carga da Home
 * reagenda.
 */
function idDe(eventoId: string): number {
  let h = 5381;
  for (let i = 0; i < eventoId.length; i++) {
    h = ((h << 5) + h + eventoId.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** O que a tela de Ajustes precisa saber para nao mentir sobre os avisos. */
export type EstadoAviso = 'sem-suporte' | 'granted' | 'denied' | 'prompt';

/** `negado` e informacao, nao erro: e o unico estado que o usuario pode consertar. */
export type ResultadoTeste = 'agendado' | 'negado' | 'sem-suporte';

/**
 * Id fixo do aviso de teste.
 *
 * Fora da faixa que `idDe` produz na pratica, mas a garantia real e outra: uma
 * carga da Home cancela TODO pendente antes de reagendar, inclusive este. Quem
 * toca em "testar" fica dez segundos na tela de Ajustes, entao na pratica nao
 * colide com nada — e se colidisse, o preco seria um aviso de teste perdido.
 */
const ID_TESTE = 2_000_000_001;
