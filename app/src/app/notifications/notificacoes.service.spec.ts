import { TestBed } from '@angular/core/testing';

import {
  NotificacoesService,
  PLUGIN_NOTIFICACOES,
} from './notificacoes.service';
import type { PluginNotificacoes } from './notificacoes.service';
import type { EventoAgendavel } from './reagendador';

/** Daqui a muitos dias: a véspera é sempre futura, em qualquer dia que se rode. */
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

function plugin(
  permissao: string,
  pendentes: number[] = [],
): jasmine.SpyObj<PluginNotificacoes> {
  const p = jasmine.createSpyObj<PluginNotificacoes>('plugin', [
    'checkPermissions',
    'requestPermissions',
    'getPending',
    'cancel',
    'schedule',
  ]);
  p.checkPermissions.and.resolveTo({ display: permissao });
  p.requestPermissions.and.resolveTo({ display: 'granted' });
  p.getPending.and.resolveTo({
    notifications: pendentes.map((id) => ({ id })),
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

describe('NotificacoesService', () => {
  it('fora do aparelho nao faz nada — nem estoura', async () => {
    await servicoCom(null).sincronizar([PROVA]);
    // Sem expect de plugin porque não há plugin. O teste é o `await` retornar.
    expect(true).toBeTrue();
  });

  it('agenda a vespera da prova', async () => {
    const p = plugin('granted');
    await servicoCom(p).sincronizar([PROVA]);

    expect(p.schedule).toHaveBeenCalledTimes(1);
    const agendadas = p.schedule.calls.mostRecent().args[0].notifications;
    expect(agendadas.length).toBe(1);
    expect(agendadas[0].title).toContain('CALC');
    expect(agendadas[0].schedule.at instanceof Date).toBeTrue();
  });

  it('agenda com allowWhileIdle — sem ele o aviso das 19h nao dispara', async () => {
    // Nao e detalhe de configuracao. Sem `allowWhileIdle` o plugin usa
    // `alarmManager.set(RTC, ...)`: alarme inexato que nao acorda o aparelho, e
    // as 19h o celular esta em Doze. Este teste existe porque o defeito e
    // invisivel — a suite passava, o `schedule` era chamado, e nada aparecia no
    // celular. Se alguem tirar a flag, quebra aqui e nao no dia da prova.
    const p = plugin('granted');
    await servicoCom(p).sincronizar([PROVA]);

    const agendadas = p.schedule.calls.mostRecent().args[0].notifications;
    expect(agendadas[0].schedule.allowWhileIdle).toBeTrue();
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

  it('o mesmo evento recebe o mesmo id em toda execucao', async () => {
    // Se o id mudasse, cancelar nunca encontraria o que foi agendado antes.
    const p1 = plugin('granted');
    const p2 = plugin('granted');
    await servicoCom(p1).sincronizar([PROVA]);
    TestBed.resetTestingModule();
    await servicoCom(p2).sincronizar([PROVA]);

    expect(p1.schedule.calls.mostRecent().args[0].notifications[0].id).toBe(
      p2.schedule.calls.mostRecent().args[0].notifications[0].id,
    );
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

  it('pede permissao so quando ha o que avisar', async () => {
    const p = plugin('prompt');
    await servicoCom(p).sincronizar([PROVA]);

    expect(p.requestPermissions).toHaveBeenCalled();
    expect(p.schedule).toHaveBeenCalled();
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

  it('testar() agenda para daqui a segundos, com a mesma flag do aviso real', async () => {
    // "Mesma flag" e o ponto: um teste que passasse sem `allowWhileIdle`
    // provaria que o BOTAO funciona e nao que o AVISO chega — que e a diferenca
    // exata entre a suite verde e o celular mudo.
    const p = plugin('granted');
    const r = await servicoCom(p).testar();

    expect(r).toBe('agendado');
    const n = p.schedule.calls.mostRecent().args[0].notifications[0];
    expect(n.schedule.allowWhileIdle).toBeTrue();
    const emSegundos = n.schedule.at.getTime() - Date.now();
    expect(emSegundos).toBeGreaterThan(0);
    expect(emSegundos).toBeLessThanOrEqual(60_000);
  });

  it('testar() com permissao negada devolve negado e nao agenda', async () => {
    const p = plugin('denied');
    expect(await servicoCom(p).testar()).toBe('negado');
    expect(p.schedule).not.toHaveBeenCalled();
  });
});
