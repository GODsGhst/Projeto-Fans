import { Injectable, InjectionToken, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';

import {
  LEMBRETES_PADRAO,
  NOTIFICACAO_HORA_VESPERA,
  TIMEZONE_PADRAO,
  calcularAgendamentos,
  idDoAviso,
  podarPersonalizados,
} from './reagendador';
import type {
  AlarmePersonalizado,
  ConfigLembretes,
  EventoAgendavel,
  PreferenciasLembrete,
  TipoLembrete,
} from './reagendador';

/** Uma notificacao como este servico a manda — sempre no canal e com as flags abaixo. */
interface NotificacaoAgendada {
  id: number;
  title: string;
  body: string;
  channelId: string;
  isExactNotification: boolean;
  schedule: { at: Date; allowWhileIdle: boolean };
  /** So os avisos de lembrete levam o tipo; o de teste nao. Ver `cancelarTipos`. */
  extra?: { tipo: TipoLembrete };
}

/**
 * O pedaço do plugin que este serviço usa — e só ele.
 *
 * Tipo estrutural em vez do tipo do plugin para o teste poder passar um objeto
 * de poucos métodos em vez de simular a superfície inteira do Capacitor.
 */
export interface PluginNotificacoes {
  checkPermissions(): Promise<{ display: string }>;
  requestPermissions(): Promise<{ display: string }>;
  checkExactNotificationSetting(): Promise<{ exact_alarm: string }>;
  changeExactNotificationSetting(): Promise<{ exact_alarm: string }>;
  createChannel(canal: typeof CANAL): Promise<void>;
  getPending(): Promise<{
    notifications: { id: number; extra?: { tipo?: string } }[];
  }>;
  cancel(opcoes: { notifications: { id: number }[] }): Promise<unknown>;
  schedule(opcoes: { notifications: NotificacaoAgendada[] }): Promise<unknown>;
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
 * Agenda no aparelho os lembretes de cada prova e entrega: os três padrão (no
 * dia, véspera, uma hora antes) e o alarme que a pessoa marcou no evento.
 *
 * **Local, não empurrado pelo servidor** (decisão 2.3 do spec): o host gratuito
 * hiberna, e um job das 19h não roda num servidor dormindo.
 *
 * **Cancela tudo e reagenda tudo**, a cada `/sync` e a cada mudança de
 * preferência. A alternativa é guardar no aparelho o que já foi agendado e
 * calcular a diferença — mais código, e um estado a mais que pode divergir do
 * servidor. O jeito burro é idempotente: o que não deve tocar simplesmente não
 * volta a ser agendado.
 *
 * **A permissão é pedida quando há o que avisar**, não na abertura do app.
 * Perguntar antes de existir uma prova é pedir para ouvir não — e no Android o
 * não é para sempre, sem segunda chance.
 */
@Injectable({ providedIn: 'root' })
export class NotificacoesService {
  private readonly plugin = inject(PLUGIN_NOTIFICACOES);

  /** Falso no navegador. As telas usam para dizer que lembrete é coisa do app. */
  readonly suportado = this.plugin !== null;

  private _epoca = 0;

  /**
   * Sobe a cada `esquecer()`. Quem busca uma lista (o `/sync`) anota a época ao
   * sair e descarta a resposta se ela mudou na volta: o servidor gratuito leva
   * quase um minuto para acordar, tempo de sobra para a pessoa sair da conta no
   * meio — e uma lista que chega depois reagendaria os avisos da conta velha.
   */
  get epoca(): number {
    return this._epoca;
  }

  /**
   * A última lista do `/sync` nesta execução. `null` = ainda não chegou nenhuma.
   *
   * Em memória: é o que "mudar a preferência reagenda na hora" precisa.
   * ponytail: sem lista (o `/sync` ainda não voltou, ou falhou offline), a
   * preferência fica gravada e só vale no próximo `/sync`; gravar a lista em
   * disco se isso incomodar.
   */
  private ultimaLista: readonly EventoAgendavel[] | null = null;

  /**
   * Um trabalho por vez — gravar preferência e reagendar. A Home, o `resume` e
   * um toque nos Ajustes podem cair juntos; intercalados, o cancelar de um passa
   * antes do agendar do outro e o aviso que a pessoa acabou de desligar volta a
   * ser agendado, ou a poda do `/sync` regrava o disco por cima do alarme que
   * acabou de ser salvo.
   */
  private fila: Promise<void> = Promise.resolve();

  /** Um pedido de permissão por execução: o `resume` que volta do próprio diálogo não pode reabri-lo. */
  private jaPediu = false;

  /**
   * Recebe a turma INTEIRA (o `/sync`, com oculto e excluído) e reagenda.
   *
   * É também onde o alarme personalizado de evento que sumiu sai do disco. Só
   * aqui, porque só esta lista sabe o que deixou de existir — ver
   * `podarPersonalizados`.
   */
  async sincronizar(eventos: readonly EventoAgendavel[]): Promise<void> {
    if (this.plugin === null) {
      return;
    }
    await this.emFila(async () => {
      this.ultimaLista = eventos;
      const config = await this.config();
      const ficam = podarPersonalizados(config.personalizados, eventos);
      if (
        Object.keys(ficam).length !==
        Object.keys(config.personalizados).length
      ) {
        await this.gravar({ ...config, personalizados: ficam });
      }
      await this.reagendarAgora();
    });
  }

  /** O que está gravado neste aparelho, completado com o padrão. */
  async config(): Promise<ConfigLembretes> {
    const { value } = await Preferences.get({ key: CHAVE_LEMBRETES });
    if (value === null) {
      return LEMBRETES_PADRAO;
    }
    try {
      // Espalhado sobre o padrão: um liga/desliga que nascer depois chega
      // ligado para quem já tinha gravado os outros.
      return { ...LEMBRETES_PADRAO, ...(JSON.parse(value) as ConfigLembretes) };
    } catch (e) {
      // Mesmo trato do snapshot (core/storage.service.ts): ilegível não derruba
      // o app nem passa por válido — descarta, avisa, e vale o padrão.
      console.error('[lembretes] preferencias ilegiveis, descartando', e);
      await Preferences.remove({ key: CHAVE_LEMBRETES });
      return LEMBRETES_PADRAO;
    }
  }

  /**
   * Os três liga/desliga. Reagenda na hora com a última lista conhecida.
   *
   * Sem lista ainda (o `/sync` não voltou), desligar vale mesmo assim: o que o
   * aparelho já tem agendado do tipo desligado é cancelado direto. Ligar, não —
   * criar aviso precisa dos eventos, e o próximo `/sync` os cria.
   */
  async salvarPreferencias(p: PreferenciasLembrete): Promise<void> {
    await this.emFila(async () => {
      const atual = await this.config();
      await this.gravar({
        ...atual,
        noDia: p.noDia,
        vespera: p.vespera,
        umaHora: p.umaHora,
      });
      if (this.plugin !== null && this.ultimaLista === null) {
        const desligados = new Set<TipoLembrete>();
        if (!p.noDia) desligados.add('NO_DIA');
        if (!p.vespera) desligados.add('VESPERA');
        if (!p.umaHora) desligados.add('UMA_HORA');
        await this.cancelarTipos(desligados);
      }
      await this.reagendarAgora();
    });
  }

  /**
   * O alarme deste evento; `null` remove. Reagenda na hora.
   *
   * Sem lista, o que dá para fazer sem ela é tirar do aparelho o aviso antigo
   * deste evento: o id é estável (`idDoAviso`), então não precisa saber mais
   * nada. O aviso novo só nasce quando uma lista o incluir — quem salva chama o
   * `/sync` em seguida (`SyncRepository.reagendarAvisos(true)`).
   */
  async salvarAlarme(
    eventoId: string,
    alarme: AlarmePersonalizado | null,
  ): Promise<void> {
    await this.emFila(async () => {
      const atual = await this.config();
      const personalizados = { ...atual.personalizados };
      if (alarme === null) {
        delete personalizados[eventoId];
      } else {
        personalizados[eventoId] = alarme;
      }
      await this.gravar({ ...atual, personalizados });
      if (this.plugin !== null && this.ultimaLista === null) {
        await this.cancelarIds([idDoAviso(eventoId, 'PERSONALIZADO')]);
      }
      await this.reagendarAgora();
    });
  }

  /**
   * Sair da conta (ou perder a sessão): nada do que era dela pode tocar depois.
   *
   * Cancela os avisos pendentes, apaga os alarmes personalizados (são eventos da
   * turma da conta que saiu) e esquece a lista. Os três liga/desliga ficam: são
   * do aparelho, e quem entrar em seguida usa o mesmo celular.
   *
   * Dentro da fila, para um `/sync` já a caminho não reagendar por cima. A época
   * sobe antes, de forma síncrona: ela é o que invalida uma resposta que ainda
   * está no ar.
   */
  async esquecer(): Promise<void> {
    if (this.plugin === null) {
      return;
    }
    this._epoca++;
    await this.emFila(async () => {
      this.ultimaLista = null;
      try {
        await this.limparPendentes();
      } finally {
        // Mesmo se o cancelar falhar, os alarmes da conta velha saem do disco —
        // senão o próximo `/sync` os reagendaria para a conta nova.
        await this.gravar({ ...(await this.config()), personalizados: {} });
      }
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

  /** Se o Android deixa este app usar alarme no horário exato. */
  async estadoExato(): Promise<EstadoExato> {
    if (this.plugin === null) {
      return 'sem-suporte';
    }
    return (await this.plugin.checkExactNotificationSetting()).exact_alarm ===
      'granted'
      ? 'granted'
      : 'denied';
  }

  /**
   * Abre a tela "Alarmes e lembretes" do Android e devolve o que a pessoa
   * escolheu. Reagenda em seguida: o que já estava agendado continua inexato
   * até ser agendado de novo.
   */
  async permitirExato(): Promise<EstadoExato> {
    if (this.plugin === null) {
      return 'sem-suporte';
    }
    const r = await this.plugin.changeExactNotificationSetting();
    await this.emFila(() => this.reagendarAgora());
    return r.exact_alarm === 'granted' ? 'granted' : 'denied';
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
   * verdade, com o mesmo canal e as mesmas flags do aviso real. Um teste que
   * desenhasse a notificacao na hora provaria menos do que o usuario precisa
   * saber.
   */
  async testar(): Promise<ResultadoTeste> {
    if (this.plugin === null) {
      return 'sem-suporte';
    }
    // `forcar`: o toque em "Testar agora" é gesto explícito, então pode pedir a
    // permissão de novo. Sem isso, quem fechou o primeiro diálogo sem responder
    // (`jaPediu`) ficava com um botão que só devolve "negado" — e sem como sair.
    if (!(await this.permitido(true))) {
      return 'negado';
    }
    await this.plugin.createChannel(CANAL);
    await this.plugin.schedule({
      notifications: [
        notificacao(
          ID_TESTE,
          'Teste de lembrete',
          'Se voce esta lendo isto, os lembretes vao chegar.',
          new Date(Date.now() + 10_000),
          (await this.estadoExato()) === 'granted',
        ),
      ],
    });
    return 'agendado';
  }

  private emFila(trabalho: () => Promise<void>): Promise<void> {
    const vez = this.fila.then(trabalho);
    // O erro chega a quem chamou por `vez`; a fila so nao pode ficar presa
    // num trabalho que falhou, senao nenhum outro roda ate fechar o app.
    this.fila = vez.then(
      () => undefined,
      () => undefined,
    );
    return vez;
  }

  private async reagendarAgora(): Promise<void> {
    if (this.plugin === null || this.ultimaLista === null) {
      return;
    }
    const agendamentos = calcularAgendamentos(
      this.ultimaLista,
      new Date(),
      NOTIFICACAO_HORA_VESPERA,
      TIMEZONE_PADRAO,
      await this.config(),
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
    // Antes do primeiro `schedule`: notificação num canal que não existe cai no
    // canal "default" do plugin, de importância média — sem som e sem
    // aparecer por cima da tela. Criar de novo é inofensivo: o Android só
    // atualiza nome e descrição de um canal que já existe.
    await this.plugin.createChannel(CANAL);
    // Lido uma vez por lote, nao por aviso: sao ate 400, e cada leitura e uma
    // ida e volta pela ponte do Capacitor.
    const exato = (await this.estadoExato()) === 'granted';
    await this.limparPendentes();
    await this.plugin.schedule({
      notifications: agendamentos.map((a) =>
        notificacao(
          idDoAviso(a.eventoId, a.tipo),
          a.titulo,
          a.corpo,
          a.dispararEm,
          exato,
          a.tipo,
        ),
      ),
    });
  }

  private async gravar(config: ConfigLembretes): Promise<void> {
    await Preferences.set({
      key: CHAVE_LEMBRETES,
      value: JSON.stringify(config),
    });
  }

  /**
   * Cancela os avisos de lembrete — TODOS menos o de teste.
   *
   * O "Testar agora" vive dez segundos no AlarmManager, e a pessoa não fica
   * parada na tela de Ajustes: ela volta para a Home (que reagenda) ou fecha o
   * diálogo de permissão (o `resume` reagenda). Cancelar o teste junto fazia o
   * aviso sumir antes de tocar, e o botão "funcionava" sem nunca provar nada.
   */
  private async limparPendentes(): Promise<void> {
    const { notifications } = await this.plugin!.getPending();
    await this.cancelarIds(
      notifications.filter((n) => n.id !== ID_TESTE).map((n) => n.id),
    );
  }

  /**
   * Sem a lista do `/sync` não dá para recalcular nada — mas desligar um
   * liga/desliga tem de valer na hora mesmo assim. O `/sync` é um servidor
   * gratuito que dorme, e ele ficar fora do ar não pode manter tocando o que a
   * pessoa acabou de desligar.
   *
   * O tipo vai gravado em cada aviso (`extra.tipo`), porque `idDoAviso` é um hash
   * e não se desfaz. ponytail: aviso agendado por versão antiga do app não tem
   * `extra` e só some no próximo `/sync`; some sozinho depois de um semestre.
   */
  private async cancelarTipos(tipos: ReadonlySet<TipoLembrete>): Promise<void> {
    if (tipos.size === 0) {
      return;
    }
    const { notifications } = await this.plugin!.getPending();
    await this.cancelarIds(
      notifications
        .filter(
          (n) =>
            n.id !== ID_TESTE && tipos.has(n.extra?.tipo as TipoLembrete),
        )
        .map((n) => n.id),
    );
  }

  /**
   * Cancelar id que não está pendente é inofensivo no plugin — por isso dá para
   * cancelar um id estável (`idDoAviso`) sem consultar a lista de pendentes.
   */
  private async cancelarIds(ids: readonly number[]): Promise<void> {
    if (ids.length > 0) {
      await this.plugin!.cancel({ notifications: ids.map((id) => ({ id })) });
    }
  }

  /**
   * `forcar` é o gesto explícito da pessoa ("Testar agora"): pode perguntar de
   * novo mesmo depois de um pedido fechado sem resposta. O pedido automático
   * (uma carga de tela, um `resume`) continua sendo um só por execução — é o
   * laço do diálogo que o `jaPediu` existe para evitar.
   */
  private async permitido(forcar = false): Promise<boolean> {
    const atual = await this.plugin!.checkPermissions();
    if (atual.display === 'granted') {
      return true;
    }
    if (atual.display === 'denied' || (this.jaPediu && !forcar)) {
      // Não adianta perguntar de novo: no Android o segundo pedido nem chega a
      // aparecer. Quem mudar de ideia muda nos ajustes do sistema.
      return false;
    }
    this.jaPediu = true;
    return (await this.plugin!.requestPermissions()).display === 'granted';
  }
}

function notificacao(
  id: number,
  title: string,
  body: string,
  at: Date,
  exato: boolean,
  tipo?: TipoLembrete,
): NotificacaoAgendada {
  return {
    id,
    title,
    body,
    channelId: CANAL.id,
    // Explícito, e lido do sistema a cada lote. O plugin 8.3 tem `true` como
    // padrão e, sem a permissão de alarme exato, ABRE a tela "Alarmes e
    // lembretes" do Android a cada `schedule` — ou seja, a cada abertura da
    // Home e a cada volta do fundo, num laço: voltar daquela tela é um
    // `resume`, que reagenda, que abre a tela. Pedir o exato é decisão da
    // pessoa, no botão dos Ajustes; aqui só se usa o que ela já deu.
    isExactNotification: exato,
    // `allowWhileIdle` NAO e otimizacao: e a diferenca entre avisar e nao
    // avisar. Sem ele o plugin chama `alarmManager.set(RTC, ...)` — alarme
    // inexato e que NAO acorda o aparelho. As 19h o celular esta parado na
    // mesa, em Doze, e o Android adia o disparo por horas. Com ele a chamada
    // vira `RTC_WAKEUP`, que e o unico tipo que atravessa o Doze.
    //
    // O caminho exato nao salva sozinho: desde o Android 14 o
    // SCHEDULE_EXACT_ALARM deixou de ser concedido na instalacao, entao
    // `canScheduleExactAlarms()` e falso ate a pessoa permitir nos Ajustes, e
    // o alarme cai no ramo inexato. Quem decide se o aviso aparece e esta
    // linha, nao a permissao.
    //
    // Preco: sem o alarme exato, o Android 12+ pode atrasar o disparo em ate
    // 1 HORA (documentacao oficial de alarmes inexatos) — nao "alguns minutos".
    // A alternativa e nao avisar, entao segue assim; mas a pessoa precisa
    // saber, e por isso os Ajustes e a tela do evento avisam e oferecem o botao
    // "Permitir horario exato".
    schedule: { at, allowWhileIdle: true },
    // O tipo viaja no proprio aviso porque `idDoAviso` e um hash e nao se
    // desfaz: e por ele que `cancelarTipos` acha, sem a lista do `/sync`, o que
    // pertence a um liga/desliga que a pessoa acabou de desligar.
    ...(tipo === undefined ? {} : { extra: { tipo } }),
  };
}

/**
 * Canal próprio, e não o "default" do plugin: importância 4 (alta) é o que faz o
 * aviso tocar e descer por cima da tela, e é a pessoa quem desliga o canal nos
 * ajustes do Android se quiser — sem desligar o app inteiro.
 *
 * Sem `sound` de propósito: canal de importância alta sem som definido toca o
 * som padrão de notificação do aparelho. Um arquivo próprio exigiria `res/raw`.
 */
const CANAL = {
  id: 'lembretes',
  name: 'Lembretes',
  description: 'Provas e entregas da turma',
  importance: 4,
  vibration: true,
} as const;

/** Por aparelho: lembrete é preferência de quem usa, não fato da turma. */
const CHAVE_LEMBRETES = 'pf.lembretes';

/** O que a tela de Ajustes precisa saber para nao mentir sobre os avisos. */
export type EstadoAviso = 'sem-suporte' | 'granted' | 'denied' | 'prompt';

/** Sem o exato o aviso ainda chega — mas o Android pode atrasar ate 1 hora. */
export type EstadoExato = 'sem-suporte' | 'granted' | 'denied';

/** `negado` e informacao, nao erro: e o unico estado que o usuario pode consertar. */
export type ResultadoTeste = 'agendado' | 'negado' | 'sem-suporte';

/**
 * Id fixo do aviso de teste, fora da faixa de `idDoAviso` (que para em
 * 1_999_999_999). Fora da faixa e tambem o que deixa `limparPendentes` poupa-lo:
 * o teste vive dez segundos e a pessoa sai da tela de Ajustes nesse meio tempo,
 * o que reagenda os lembretes de verdade.
 */
const ID_TESTE = 2_000_000_001;
