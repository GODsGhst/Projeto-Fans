import { TestBed } from '@angular/core/testing';
import { Preferences } from '@capacitor/preferences';

import {
  NotificacoesService,
  PLUGIN_NOTIFICACOES,
} from './notificacoes.service';
import type { PluginNotificacoes } from './notificacoes.service';
import { LEMBRETES_PADRAO, idDoAviso } from './reagendador';
import type { EventoAgendavel } from './reagendador';

/** Daqui a muitos dias: todo aviso e sempre futuro, em qualquer dia que se rode. */
function daquiA(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

const PROVA: EventoAgendavel = {
  eventoId: 'e1',
  tipo: 'PROVA',
  titulo: 'Prova 1',
  data: daquiA(10),
  hora: '19:00',
  materiaSigla: 'CALC',
};

type Agendadas = Parameters<
  PluginNotificacoes['schedule']
>[0]['notifications'];

/** Id fixo do aviso do "Testar agora" (ver `ID_TESTE` no servico). */
const ID_TESTE = 2_000_000_001;

/** Pendente como o plugin devolve: so o id, ou o id com o `extra` que o servico gravou. */
type Pendente = number | { id: number; extra?: { tipo?: string } };

function plugin(
  permissao: string,
  pendentes: Pendente[] = [],
  exato = 'denied',
): jasmine.SpyObj<PluginNotificacoes> {
  const p = jasmine.createSpyObj<PluginNotificacoes>('plugin', [
    'checkPermissions',
    'requestPermissions',
    'checkExactNotificationSetting',
    'changeExactNotificationSetting',
    'createChannel',
    'getPending',
    'cancel',
    'schedule',
  ]);
  p.checkPermissions.and.resolveTo({ display: permissao });
  p.requestPermissions.and.resolveTo({ display: 'granted' });
  p.checkExactNotificationSetting.and.resolveTo({ exact_alarm: exato });
  p.changeExactNotificationSetting.and.resolveTo({ exact_alarm: 'granted' });
  p.createChannel.and.resolveTo();
  p.getPending.and.resolveTo({
    notifications: pendentes.map((n) => (typeof n === 'number' ? { id: n } : n)),
  });
  p.cancel.and.resolveTo();
  p.schedule.and.resolveTo();
  return p;
}

function servicoCom(p: PluginNotificacoes | null): NotificacoesService {
  TestBed.configureTestingModule({
    providers: [{ provide: PLUGIN_NOTIFICACOES, useValue: p }],
  });
  return TestBed.inject(NotificacoesService);
}

function ultimas(p: jasmine.SpyObj<PluginNotificacoes>): Agendadas {
  return p.schedule.calls.mostRecent().args[0].notifications;
}

describe('NotificacoesService', () => {
  // As preferencias vivem no Preferences de verdade (localStorage no
  // navegador do teste). Sem limpar, um teste herdaria o toggle do outro.
  beforeEach(() => Preferences.remove({ key: 'pf.lembretes' }));
  afterEach(() => Preferences.remove({ key: 'pf.lembretes' }));

  it('fora do aparelho nao faz nada — nem estoura', async () => {
    const s = servicoCom(null);
    await s.sincronizar([PROVA]);
    expect(s.suportado).toBeFalse();
  });

  it('agenda os tres padrao da prova', async () => {
    const p = plugin('granted');
    await servicoCom(p).sincronizar([PROVA]);

    expect(p.schedule).toHaveBeenCalledTimes(1);
    const agendadas = ultimas(p);
    expect(agendadas.length).toBe(3);
    expect(agendadas.every((n) => n.title.includes('CALC'))).toBeTrue();
    expect(agendadas.every((n) => n.schedule.at instanceof Date)).toBeTrue();
    // Um id por aviso: com o mesmo id o segundo substituiria o primeiro.
    expect(new Set(agendadas.map((n) => n.id)).size).toBe(3);
  });

  it('agenda com allowWhileIdle — sem ele o aviso das 19h nao dispara', async () => {
    // Nao e detalhe de configuracao. Sem `allowWhileIdle` o plugin usa
    // `alarmManager.set(RTC, ...)`: alarme inexato que nao acorda o aparelho, e
    // as 19h o celular esta em Doze. Este teste existe porque o defeito e
    // invisivel — a suite passava, o `schedule` era chamado, e nada aparecia no
    // celular. Se alguem tirar a flag, quebra aqui e nao no dia da prova.
    const p = plugin('granted');
    await servicoCom(p).sincronizar([PROVA]);

    expect(ultimas(p).every((n) => n.schedule.allowWhileIdle)).toBeTrue();
  });

  it('cria o canal "lembretes" ANTES de agendar, e todo aviso vai nele', async () => {
    // Num canal que nao existe o aviso cai no "default" do plugin: importancia
    // media, sem som, sem descer por cima da tela.
    const p = plugin('granted');
    await servicoCom(p).sincronizar([PROVA]);

    expect(p.createChannel).toHaveBeenCalledBefore(p.schedule);
    const canal = p.createChannel.calls.mostRecent().args[0];
    expect(canal.id).toBe('lembretes');
    expect(canal.importance).toBe(4);
    expect(canal.vibration).toBeTrue();
    expect(ultimas(p).every((n) => n.channelId === 'lembretes')).toBeTrue();
  });

  it('sem permissao de exato, agenda inexato — e nao abre a tela do Android a cada carga', async () => {
    // O plugin 8.3 assume exato e, sem a permissao, abre "Alarmes e lembretes"
    // a cada `schedule`. Com o `resume` reagendando, voltar daquela tela
    // reabria a tela. Quem pede o exato e o botao dos Ajustes.
    const negado = plugin('granted', [], 'denied');
    await servicoCom(negado).sincronizar([PROVA]);
    expect(ultimas(negado).every((n) => !n.isExactNotification)).toBeTrue();

    TestBed.resetTestingModule();
    const dado = plugin('granted', [], 'granted');
    await servicoCom(dado).sincronizar([PROVA]);
    expect(ultimas(dado).every((n) => n.isExactNotification)).toBeTrue();
  });

  it('cancela o que ja estava agendado antes de reagendar', async () => {
    // Reagendar sem cancelar duplicaria o aviso a cada abertura da Home.
    const p = plugin('granted', [111, 222]);
    await servicoCom(p).sincronizar([PROVA]);

    expect(p.cancel).toHaveBeenCalledWith({
      notifications: [{ id: 111 }, { id: 222 }],
    });
    expect(p.cancel).toHaveBeenCalledBefore(p.schedule);
  });

  it('o mesmo aviso recebe o mesmo id em toda execucao', async () => {
    // Se o id mudasse, cancelar nunca encontraria o que foi agendado antes.
    const p1 = plugin('granted');
    const p2 = plugin('granted');
    await servicoCom(p1).sincronizar([PROVA]);
    TestBed.resetTestingModule();
    await servicoCom(p2).sincronizar([PROVA]);

    expect(ultimas(p1).map((n) => n.id)).toEqual(ultimas(p2).map((n) => n.id));
  });

  it('lista vazia cancela os pendentes e NAO pede permissao', async () => {
    // É o caso "apagaram a última prova da semana": o aviso tem de sumir, e
    // perguntar da permissão aqui seria pedir para avisar sobre nada.
    const p = plugin('prompt', [111]);
    await servicoCom(p).sincronizar([]);

    expect(p.cancel).toHaveBeenCalled();
    expect(p.checkPermissions).not.toHaveBeenCalled();
    expect(p.schedule).not.toHaveBeenCalled();
  });

  it('pede permissao so quando ha o que avisar — e uma vez por execucao', async () => {
    // A segunda vez e o `resume` que volta do proprio dialogo. Pedir de novo
    // ali abriria o dialogo em laco para quem so fechou a caixa.
    const p = plugin('prompt');
    p.requestPermissions.and.resolveTo({ display: 'prompt' });
    const s = servicoCom(p);
    await s.sincronizar([PROVA]);
    await s.sincronizar([PROVA]);

    expect(p.requestPermissions).toHaveBeenCalledTimes(1);
    expect(p.schedule).not.toHaveBeenCalled();
  });

  it('permissao negada nao vira segundo pedido nem agendamento', async () => {
    const p = plugin('denied');
    await servicoCom(p).sincronizar([PROVA]);

    expect(p.requestPermissions).not.toHaveBeenCalled();
    expect(p.schedule).not.toHaveBeenCalled();
  });

  it('evento ocultado pelo lider nao e agendado', async () => {
    const p = plugin('granted');
    await servicoCom(p).sincronizar([{ ...PROVA, visivelTurma: false }]);

    expect(p.schedule).not.toHaveBeenCalled();
  });

  it('mudar a preferencia reagenda na hora com a ultima lista', async () => {
    const p = plugin('granted');
    const s = servicoCom(p);
    await s.sincronizar([PROVA]);

    await s.salvarPreferencias({ noDia: false, vespera: true, umaHora: false });

    expect(p.schedule).toHaveBeenCalledTimes(2);
    expect(ultimas(p).map((n) => n.title)).toEqual(['Prova de CALC amanhã']);
    expect((await s.config()).noDia).toBeFalse();
  });

  it('preferencia gravada antes de qualquer /sync vale quando a lista chegar', async () => {
    const p = plugin('granted');
    const s = servicoCom(p);
    await s.salvarPreferencias({ noDia: false, vespera: false, umaHora: true });
    expect(p.schedule).not.toHaveBeenCalled();

    await s.sincronizar([PROVA]);
    expect(ultimas(p).map((n) => n.title)).toEqual([
      'Em 1 hora: prova de CALC · 19:00',
    ]);
  });

  it('o alarme personalizado entra no agendamento e sai quando removido', async () => {
    const p = plugin('granted');
    const s = servicoCom(p);
    await s.salvarPreferencias({ noDia: false, vespera: false, umaHora: false });
    await s.sincronizar([PROVA]);
    expect(p.schedule).not.toHaveBeenCalled();

    await s.salvarAlarme('e1', { modo: 'RELATIVO', horasAntes: 36 });
    expect(ultimas(p).map((n) => n.title)).toEqual(['Lembrete: prova de CALC']);

    await s.salvarAlarme('e1', null);
    expect((await s.config()).personalizados).toEqual({});
    // Nada mais a agendar: so cancela o que havia, sem `schedule` novo.
    expect(p.schedule).toHaveBeenCalledTimes(1);
    // Quatro leituras dos pendentes: salvarPreferencias SEM lista (cancela por
    // tipo o que a pessoa desligou), o sincronizar vazio, o alarme novo e a
    // remocao dele.
    expect(p.getPending).toHaveBeenCalledTimes(4);
  });

  it('o /sync poda o alarme de evento que sumiu, oculto ou excluido', async () => {
    // A lista do /sync traz a turma inteira, inclusive oculto e excluido: ali,
    // e so ali, "nao veio" quer dizer "nao existe".
    const alarme = { modo: 'RELATIVO', horasAntes: 2 } as const;
    await Preferences.set({
      key: 'pf.lembretes',
      value: JSON.stringify({
        ...LEMBRETES_PADRAO,
        personalizados: { e1: alarme, sumiu: alarme, oculto: alarme },
      }),
    });
    const s = servicoCom(plugin('granted'));

    await s.sincronizar([
      PROVA,
      { ...PROVA, eventoId: 'oculto', visivelTurma: false },
    ]);

    expect(Object.keys((await s.config()).personalizados)).toEqual(['e1']);
  });

  it('preferencia ilegivel no disco vira o padrao, sem derrubar nada', async () => {
    await Preferences.set({ key: 'pf.lembretes', value: '{nao e json' });
    spyOn(console, 'error');
    expect(await servicoCom(plugin('granted')).config()).toEqual(
      LEMBRETES_PADRAO,
    );
  });

  it('estado() conta a verdade, inclusive o "nao" definitivo', async () => {
    // O `denied` e o estado que justifica a tela de Ajustes existir: o servico
    // volta em silencio, e sem alguem perguntando o estado o app nao tem um so
    // lugar que diga que os avisos estao desligados.
    expect(await servicoCom(plugin('denied')).estado()).toBe('denied');
    TestBed.resetTestingModule();
    expect(await servicoCom(plugin('granted')).estado()).toBe('granted');
    TestBed.resetTestingModule();
    expect(await servicoCom(null).estado()).toBe('sem-suporte');
  });

  it('permitirExato() abre o ajuste do Android e reagenda com o exato', async () => {
    const p = plugin('granted', [], 'denied');
    const s = servicoCom(p);
    await s.sincronizar([PROVA]);
    p.checkExactNotificationSetting.and.resolveTo({ exact_alarm: 'granted' });

    expect(await s.permitirExato()).toBe('granted');
    expect(p.changeExactNotificationSetting).toHaveBeenCalled();
    expect(ultimas(p).every((n) => n.isExactNotification)).toBeTrue();
  });

  it('testar() agenda para daqui a segundos, com o mesmo canal e a mesma flag do aviso real', async () => {
    // "Mesma flag" e o ponto: um teste que passasse sem `allowWhileIdle`
    // provaria que o BOTAO funciona e nao que o AVISO chega — que e a diferenca
    // exata entre a suite verde e o celular mudo.
    const p = plugin('granted');
    const r = await servicoCom(p).testar();

    expect(r).toBe('agendado');
    const n = ultimas(p)[0];
    expect(n.schedule.allowWhileIdle).toBeTrue();
    expect(n.channelId).toBe('lembretes');
    expect(p.createChannel).toHaveBeenCalledBefore(p.schedule);
    const emSegundos = n.schedule.at.getTime() - Date.now();
    expect(emSegundos).toBeGreaterThan(0);
    expect(emSegundos).toBeLessThanOrEqual(60_000);
  });

  it('testar() com permissao negada devolve negado e nao agenda', async () => {
    const p = plugin('denied');
    expect(await servicoCom(p).testar()).toBe('negado');
    expect(p.schedule).not.toHaveBeenCalled();
  });

  it('"Testar agora" nao e cancelado quando a pessoa volta e a Home reagenda', async () => {
    // O teste vive dez segundos no AlarmManager e a pessoa sai da tela de
    // Ajustes nesse meio tempo: a Home reagenda, o `resume` reagenda. Cancelar
    // TODO pendente tirava o aviso antes de tocar — o botao "funcionava" sem
    // provar nada.
    const p = plugin('granted', [111, ID_TESTE, 222]);
    await servicoCom(p).sincronizar([PROVA]);

    expect(p.cancel).toHaveBeenCalledWith({
      notifications: [{ id: 111 }, { id: 222 }],
    });

    // So o teste pendente: nada a cancelar, e `cancel` nem e chamado.
    TestBed.resetTestingModule();
    const so = plugin('granted', [ID_TESTE]);
    await servicoCom(so).sincronizar([PROVA]);
    expect(so.cancel).not.toHaveBeenCalled();
  });

  it('lista vazia tambem poupa o aviso de teste', async () => {
    const p = plugin('granted', [111, ID_TESTE]);
    await servicoCom(p).sincronizar([]);

    expect(p.cancel).toHaveBeenCalledOnceWith({ notifications: [{ id: 111 }] });
  });

  it('testar() pede a permissao de novo mesmo depois de um pedido fechado sem resposta', async () => {
    // O pedido automatico e um so por execucao (o `resume` que volta do proprio
    // dialogo nao pode reabri-lo). Mas "Testar agora" e gesto explicito: se o
    // primeiro dialogo foi fechado sem resposta, o botao nao pode virar beco
    // sem saida devolvendo "negado" para sempre.
    const p = plugin('prompt');
    p.requestPermissions.and.resolveTo({ display: 'prompt' });
    const s = servicoCom(p);
    await s.sincronizar([PROVA]);
    expect(p.requestPermissions).toHaveBeenCalledTimes(1);

    p.requestPermissions.and.resolveTo({ display: 'granted' });
    expect(await s.testar()).toBe('agendado');
    expect(p.requestPermissions).toHaveBeenCalledTimes(2);

    // O automatico continua sendo um so: `jaPediu` segue valendo para ele.
    p.checkPermissions.and.resolveTo({ display: 'prompt' });
    p.requestPermissions.calls.reset();
    await s.sincronizar([PROVA]);
    expect(p.requestPermissions).not.toHaveBeenCalled();
  });

  it('sincronizar + salvarPreferencias juntos: o ultimo schedule respeita a preferencia', async () => {
    // A Home, o `resume` e um toque nos Ajustes caem juntos. Sem a fila, o
    // `sincronizar` le a config ANTES de a preferencia ser gravada e agenda por
    // ultimo com o padrao — e o aviso que a pessoa acabou de desligar toca.
    //
    // A intercalacao e forcada, nao esperada por sorte: a PRIMEIRA resposta do
    // sistema sobre permissao demora 40 ms, e a preferencia chega 5 ms depois do
    // `sincronizar` ja ter calculado a lista com o padrao. Sem a fila, a
    // preferencia roda inteira nesses 40 ms e o `sincronizar` — com a lista
    // velha na mao — agenda por ULTIMO.
    const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const p = plugin('granted');
    const s = servicoCom(p);
    await s.sincronizar([PROVA]); // aquece o Preferences antes de medir
    p.schedule.calls.reset();
    let primeira = true;
    p.checkPermissions.and.callFake(async () => {
      if (primeira) {
        primeira = false;
        await dormir(40);
      }
      return { display: 'granted' };
    });

    await Promise.all([
      s.sincronizar([PROVA]),
      dormir(5).then(() =>
        s.salvarPreferencias({ noDia: false, vespera: true, umaHora: false }),
      ),
    ]);

    expect(ultimas(p).map((n) => n.title)).toEqual(['Prova de CALC amanhã']);
  });

  it('esquecer() cancela os pendentes e apaga os personalizados — e mantem os liga/desliga', async () => {
    // Sair da conta nao cancelava nada: os alarmes da conta velha tocavam por
    // semanas no mesmo celular.
    const p = plugin('granted', [111, ID_TESTE]);
    const s = servicoCom(p);
    await s.salvarPreferencias({ noDia: false, vespera: true, umaHora: true });
    await s.salvarAlarme('e1', { modo: 'RELATIVO', horasAntes: 2 });
    await s.sincronizar([PROVA]);
    p.cancel.calls.reset();
    p.schedule.calls.reset();

    await s.esquecer();

    expect(p.cancel).toHaveBeenCalledOnceWith({
      notifications: [{ id: 111 }],
    });
    const c = await s.config();
    expect(c.personalizados).toEqual({});
    // Sao do aparelho, nao da conta.
    expect([c.noDia, c.vespera, c.umaHora]).toEqual([false, true, true]);

    // A lista da conta velha foi esquecida: mexer nas preferencias agora nao a
    // reagenda por tras.
    await s.salvarPreferencias({ noDia: true, vespera: true, umaHora: true });
    expect(p.schedule).not.toHaveBeenCalled();
  });

  it('esquecer() sobe a epoca e, fora do aparelho, nao faz nada', async () => {
    const p = plugin('granted');
    const s = servicoCom(p);
    const antes = s.epoca;
    await s.esquecer();
    expect(s.epoca).toBe(antes + 1);

    TestBed.resetTestingModule();
    const web = servicoCom(null);
    await expectAsync(web.esquecer()).toBeResolved();
    expect(web.epoca).toBe(0);
  });

  it('um sincronizar que ja estava na fila nao reagenda por cima do esquecer()', async () => {
    const p = plugin('granted', [111]);
    const ordem: string[] = [];
    p.cancel.and.callFake(async () => void ordem.push('cancel'));
    p.schedule.and.callFake(async () => void ordem.push('schedule'));
    const s = servicoCom(p);
    await Promise.all([s.sincronizar([PROVA]), s.esquecer()]);

    // Ordem da fila: sincronizar cancela e agenda; o esquecer vem DEPOIS e
    // cancela tudo de novo, zerando a lista.
    expect(ordem).toEqual(['cancel', 'schedule', 'cancel']);
    p.schedule.calls.reset();
    await s.salvarPreferencias({ noDia: true, vespera: true, umaHora: true });
    expect(p.schedule).not.toHaveBeenCalled();
  });

  it('os avisos agendados levam o tipo; o de teste nao', async () => {
    const p = plugin('granted');
    const s = servicoCom(p);
    await s.sincronizar([PROVA]);
    expect(ultimas(p).map((n) => n.extra?.tipo).sort()).toEqual([
      'NO_DIA',
      'UMA_HORA',
      'VESPERA',
    ]);

    await s.testar();
    expect(ultimas(p)[0].extra).toBeUndefined();
  });

  it('sem lista, desligar um liga/desliga cancela o que ja estava agendado desse tipo', async () => {
    // O /sync e um servidor gratuito que dorme. Sem a lista nao ha o que
    // recalcular, mas desligar tem de valer na hora — senao o aviso que a pessoa
    // acabou de desligar toca.
    const p = plugin('granted', [
      { id: 1, extra: { tipo: 'VESPERA' } },
      { id: 2, extra: { tipo: 'NO_DIA' } },
      { id: 3 },
      { id: ID_TESTE },
    ]);
    const s = servicoCom(p);

    await s.salvarPreferencias({ noDia: true, vespera: false, umaHora: true });

    expect(p.cancel).toHaveBeenCalledOnceWith({ notifications: [{ id: 1 }] });
    expect(p.schedule).not.toHaveBeenCalled();
    expect((await s.config()).vespera).toBeFalse();
  });

  it('sem lista, remover o alarme cancela direto o id estavel daquele evento', async () => {
    // O alarme de um evento criado depois do ultimo /sync nao esta na lista: o
    // reagendamento nao o conhece, mas o id e estavel (`idDoAviso`) e da para
    // cancelar sem consultar nada.
    const p = plugin('granted');
    const s = servicoCom(p);

    await s.salvarAlarme('e1', null);

    expect(p.cancel).toHaveBeenCalledOnceWith({
      notifications: [{ id: idDoAviso('e1', 'PERSONALIZADO') }],
    });
    expect(p.getPending).not.toHaveBeenCalled();
    expect(p.schedule).not.toHaveBeenCalled();
  });

  it('sem lista, trocar o alarme tira o aviso antigo — o novo nasce quando a lista chegar', async () => {
    const p = plugin('granted');
    const s = servicoCom(p);

    await s.salvarAlarme('e1', { modo: 'RELATIVO', horasAntes: 2 });
    expect(p.cancel).toHaveBeenCalledOnceWith({
      notifications: [{ id: idDoAviso('e1', 'PERSONALIZADO') }],
    });
    expect(p.schedule).not.toHaveBeenCalled();

    await s.sincronizar([PROVA]);
    expect(ultimas(p).map((n) => n.id)).toContain(
      idDoAviso('e1', 'PERSONALIZADO'),
    );
  });
});
