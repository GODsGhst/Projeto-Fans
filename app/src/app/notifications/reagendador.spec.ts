import type { ItemHome } from '../data/models';
import { calcularAgendamentos } from './reagendador';
import type { EventoAgendavel } from './reagendador';

/**
 * O reagendador e funcao pura de proposito: e onde um bug de notificacao
 * moraria — off-by-one de dia, fuso, evento no passado, evento hoje, hora nula.
 * Cada um desses e um teste de duas linhas aqui em vez de um teste de
 * integracao com relogio falso.
 *
 * Todo instante deste arquivo e escrito em UTC de proposito. Se o `agora` fosse
 * hora local, a suite passaria nesta maquina e falharia em outra — que e
 * exatamente a classe de bug que o ultimo teste persegue.
 */
const SP = 'America/Sao_Paulo';

function evento(patch: Partial<EventoAgendavel> = {}): EventoAgendavel {
  const base: ItemHome = {
    eventoId: 'e1',
    tipo: 'PROVA',
    titulo: 'Prova 2 — integrais',
    data: '2026-09-10',
    hora: '08:00',
    materiaSigla: 'CALC2',
    materiaCorHex: '#0369A1',
    autoria: {
      autorId: 'u1',
      autorNome: 'Otavio',
      criadoEm: '2026-09-01T12:00:00Z',
      atualizadoEm: '2026-09-01T12:00:00Z',
    },
    feitoPeloUsuario: false,
  };
  return { ...base, ...patch };
}

describe('calcularAgendamentos', () => {
  it('agenda 19h do dia anterior', () => {
    const agora = new Date('2026-09-01T15:00:00Z');

    const [a] = calcularAgendamentos([evento()], agora, '19:00', SP);

    // 19:00 em Sao Paulo (UTC-3) e 22:00Z do dia 9 — vespera do dia 10.
    expect(a.dispararEm.toISOString()).toBe('2026-09-09T22:00:00.000Z');
    expect(a.eventoId).toBe('e1');

    // Virada de mes: a vespera do dia 1 e o ultimo dia do mes anterior, e
    // agosto tem 31 dias. `dia - 1` ingenuo em cima de string daria "2026-09-00".
    //
    // `agora` proprio, e nao o de cima: a vespera de 01/09 e 31/08 as 19h em SP,
    // ou seja 2026-08-31T22:00Z — que ja passou em relacao ao `agora` do primeiro
    // caso. Reusar aquele fazia o proprio filtro de "disparo ja passou" descartar
    // o evento, e o teste da virada de mes acusava a funcao de um erro que era do
    // teste.
    const antesDaVirada = new Date('2026-08-30T12:00:00Z');
    const [b] = calcularAgendamentos([evento({ data: '2026-09-01' })], antesDaVirada, '19:00', SP);
    expect(b.dispararEm.toISOString()).toBe('2026-08-31T22:00:00.000Z');
  });

  it('ignora evento cujo disparo ja passou', () => {
    // 20:30 em Sao Paulo do dia 9: a vespera das 19h ja foi.
    const agora = new Date('2026-09-09T23:30:00Z');

    expect(calcularAgendamentos([evento()], agora, '19:00', SP)).toEqual([]);
  });

  it('evento de hoje nao gera agendamento', () => {
    // 06:00 em Sao Paulo do proprio dia do evento. A vespera foi ontem as 19h.
    const agora = new Date('2026-09-10T09:00:00Z');

    expect(calcularAgendamentos([evento({ data: '2026-09-10' })], agora, '19:00', SP)).toEqual([]);
  });

  it('evento de amanha agenda para hoje 19h', () => {
    // 08:00 em Sao Paulo do dia 10; evento no dia 11.
    const agora = new Date('2026-09-10T11:00:00Z');

    const [a] = calcularAgendamentos([evento({ data: '2026-09-11' })], agora, '19:00', SP);

    expect(a.dispararEm.toISOString()).toBe('2026-09-10T22:00:00.000Z');
  });

  it('hora nula do evento nao afeta a hora do aviso', () => {
    // Hora do evento e opcional (decisao 2.6). O aviso e as 19h dos dois jeitos:
    // deixar a hora do evento vazar para o disparo faria a prova sem horario
    // avisar a meia-noite.
    const agora = new Date('2026-09-01T15:00:00Z');

    const [semHora, comHora] = calcularAgendamentos(
      [evento({ eventoId: 'sem', hora: null }), evento({ eventoId: 'com', hora: '08:00' })],
      agora,
      '19:00',
      SP,
    );

    expect(semHora.dispararEm.toISOString()).toBe('2026-09-09T22:00:00.000Z');
    expect(comHora.dispararEm.toISOString()).toBe(semHora.dispararEm.toISOString());
  });

  it('evento oculto nao gera agendamento', () => {
    // O fantasma que a A16 descreve: o lider oculta uma prova e o celular de
    // quem ja sincronizou continua avisando as 19h por um evento que sumiu da
    // Home de todo mundo. O excluido pelo autor tem o mesmo destino.
    const agora = new Date('2026-09-01T15:00:00Z');

    expect(
      calcularAgendamentos([evento({ visivelTurma: false })], agora, '19:00', SP),
    ).toEqual([]);
    expect(
      calcularAgendamentos(
        [evento({ excluidoEm: '2026-09-01T10:00:00Z' })],
        agora,
        '19:00',
        SP,
      ),
    ).toEqual([]);
  });

  it('respeita America/Sao_Paulo e nao desloca por UTC', () => {
    // O bug classico: montar a data com `new Date('2026-09-09T19:00')` usa o
    // fuso da MAQUINA. Passa no notebook de quem escreveu e avisa na hora
    // errada no celular de quem usa. O mesmo evento nos dois fusos tem de dar
    // instantes diferentes — se derem o mesmo, o parametro `timezone` e enfeite.
    const agora = new Date('2026-09-01T15:00:00Z');

    const [sp] = calcularAgendamentos([evento()], agora, '19:00', SP);
    const [utc] = calcularAgendamentos([evento()], agora, '19:00', 'UTC');

    expect(sp.dispararEm.toISOString()).toBe('2026-09-09T22:00:00.000Z');
    expect(utc.dispararEm.toISOString()).toBe('2026-09-09T19:00:00.000Z');
  });
});
