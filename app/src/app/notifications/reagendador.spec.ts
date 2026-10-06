import type { ItemHome } from '../data/models';
import {
  LEMBRETES_PADRAO,
  LIMITE_AGENDAMENTOS,
  calcularAgendamentos,
  idDoAviso,
  instantePersonalizado,
  podarPersonalizados,
  rotuloInstante,
} from './reagendador';
import type {
  ConfigLembretes,
  EventoAgendavel,
  TipoLembrete,
} from './reagendador';

/**
 * O reagendador e funcao pura de proposito: e onde um bug de notificacao
 * moraria — off-by-one de dia, fuso, evento no passado, evento hoje, hora nula.
 * Cada um desses e um teste de duas linhas aqui em vez de um teste de
 * integracao com relogio falso.
 *
 * Todo instante deste arquivo e escrito em UTC de proposito. Se o `agora` fosse
 * hora local, a suite passaria nesta maquina e falharia em outra — que e
 * exatamente a classe de bug que o teste de fuso persegue.
 */
const SP = 'America/Sao_Paulo';

/** So a vespera: os testes da vespera nao podem quebrar porque nasceram outros avisos. */
const SO_VESPERA: ConfigLembretes = {
  ...LEMBRETES_PADRAO,
  noDia: false,
  umaHora: false,
};

const NENHUM_PADRAO: ConfigLembretes = {
  ...LEMBRETES_PADRAO,
  noDia: false,
  vespera: false,
  umaHora: false,
};

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

/** Instantes em ISO, para o `expect` mostrar o que veio quando falha. */
function quando(
  eventos: EventoAgendavel[],
  agora: string,
  config: ConfigLembretes,
): [TipoLembrete, string][] {
  return calcularAgendamentos(eventos, new Date(agora), '19:00', SP, config).map(
    (a) => [a.tipo, a.dispararEm.toISOString()],
  );
}

describe('calcularAgendamentos — vespera', () => {
  it('agenda 19h do dia anterior', () => {
    const agora = new Date('2026-09-01T15:00:00Z');

    const [a] = calcularAgendamentos([evento()], agora, '19:00', SP, SO_VESPERA);

    // 19:00 em Sao Paulo (UTC-3) e 22:00Z do dia 9 — vespera do dia 10.
    expect(a.dispararEm.toISOString()).toBe('2026-09-09T22:00:00.000Z');
    expect(a.eventoId).toBe('e1');
    expect(a.tipo).toBe('VESPERA');

    // Virada de mes: a vespera do dia 1 e o ultimo dia do mes anterior, e
    // agosto tem 31 dias. `dia - 1` ingenuo em cima de string daria "2026-09-00".
    //
    // `agora` proprio, e nao o de cima: a vespera de 01/09 e 31/08 as 19h em SP,
    // ou seja 2026-08-31T22:00Z — que ja passou em relacao ao `agora` do primeiro
    // caso. Reusar aquele fazia o proprio filtro de "disparo ja passou" descartar
    // o evento, e o teste da virada de mes acusava a funcao de um erro que era do
    // teste.
    const antesDaVirada = new Date('2026-08-30T12:00:00Z');
    const [b] = calcularAgendamentos(
      [evento({ data: '2026-09-01' })],
      antesDaVirada,
      '19:00',
      SP,
      SO_VESPERA,
    );
    expect(b.dispararEm.toISOString()).toBe('2026-08-31T22:00:00.000Z');
  });

  it('virada de ano: a vespera de 1/jan e 31/dez do ano anterior', () => {
    expect(
      quando(
        [evento({ data: '2027-01-01' })],
        '2026-12-20T12:00:00Z',
        SO_VESPERA,
      ),
    ).toEqual([['VESPERA', '2026-12-31T22:00:00.000Z']]);
  });

  it('ignora evento cujo disparo ja passou', () => {
    // 20:30 em Sao Paulo do dia 9: a vespera das 19h ja foi.
    expect(quando([evento()], '2026-09-09T23:30:00Z', SO_VESPERA)).toEqual([]);
  });

  it('evento de hoje nao gera vespera', () => {
    // 06:00 em Sao Paulo do proprio dia do evento. A vespera foi ontem as 19h.
    expect(quando([evento()], '2026-09-10T09:00:00Z', SO_VESPERA)).toEqual([]);
  });

  it('evento de amanha agenda para hoje 19h', () => {
    // 08:00 em Sao Paulo do dia 10; evento no dia 11.
    expect(
      quando([evento({ data: '2026-09-11' })], '2026-09-10T11:00:00Z', SO_VESPERA),
    ).toEqual([['VESPERA', '2026-09-10T22:00:00.000Z']]);
  });

  it('hora nula do evento nao afeta a hora do aviso', () => {
    // Hora do evento e opcional (decisao 2.6). O aviso e as 19h dos dois jeitos:
    // deixar a hora do evento vazar para o disparo faria a prova sem horario
    // avisar a meia-noite.
    const [semHora, comHora] = calcularAgendamentos(
      [
        evento({ eventoId: 'sem', hora: null }),
        evento({ eventoId: 'com', hora: '08:00' }),
      ],
      new Date('2026-09-01T15:00:00Z'),
      '19:00',
      SP,
      SO_VESPERA,
    );

    expect(semHora.dispararEm.toISOString()).toBe('2026-09-09T22:00:00.000Z');
    expect(comHora.dispararEm.toISOString()).toBe(
      semHora.dispararEm.toISOString(),
    );
  });

  it('respeita America/Sao_Paulo e nao desloca por UTC', () => {
    // O bug classico: montar a data com `new Date('2026-09-09T19:00')` usa o
    // fuso da MAQUINA. Passa no notebook de quem escreveu e avisa na hora
    // errada no celular de quem usa. O mesmo evento nos dois fusos tem de dar
    // instantes diferentes — se derem o mesmo, o parametro `timezone` e enfeite.
    const agora = new Date('2026-09-01T15:00:00Z');

    const [sp] = calcularAgendamentos([evento()], agora, '19:00', SP, SO_VESPERA);
    const [utc] = calcularAgendamentos(
      [evento()],
      agora,
      '19:00',
      'UTC',
      SO_VESPERA,
    );

    expect(sp.dispararEm.toISOString()).toBe('2026-09-09T22:00:00.000Z');
    expect(utc.dispararEm.toISOString()).toBe('2026-09-09T19:00:00.000Z');
  });
});

describe('calcularAgendamentos — os tres padrao', () => {
  const AGORA = '2026-09-01T15:00:00Z';

  it('prova com hora gera os tres, em ordem de instante, com texto claro', () => {
    const r = calcularAgendamentos(
      [evento({ hora: '14:00' })],
      new Date(AGORA),
      '19:00',
      SP,
      LEMBRETES_PADRAO,
    );

    expect(r.map((a) => [a.tipo, a.dispararEm.toISOString()])).toEqual([
      ['VESPERA', '2026-09-09T22:00:00.000Z'],
      // 07:00 em SP do dia 10.
      ['NO_DIA', '2026-09-10T10:00:00.000Z'],
      // 14:00 - 1 h = 13:00 em SP.
      ['UMA_HORA', '2026-09-10T16:00:00.000Z'],
    ]);
    expect(r.map((a) => a.titulo)).toEqual([
      'Prova de CALC2 amanhã',
      'Hoje: prova de CALC2',
      'Em 1 hora: prova de CALC2 · 14:00',
    ]);
    expect(r[1].corpo).toBe('Prova 2 — integrais · 14:00');
  });

  it('entrega diz "entrega"', () => {
    const r = calcularAgendamentos(
      [evento({ tipo: 'ENTREGA', materiaSigla: 'BD', hora: '14:00' })],
      new Date(AGORA),
      '19:00',
      SP,
      LEMBRETES_PADRAO,
    );
    expect(r.map((a) => a.titulo)).toEqual([
      'Entrega de BD amanhã',
      'Hoje: entrega de BD',
      'Em 1 hora: entrega de BD · 14:00',
    ]);
  });

  it('sem hora: no dia e vespera, e nenhum "1 hora antes" inventado', () => {
    expect(quando([evento({ hora: null })], AGORA, LEMBRETES_PADRAO)).toEqual([
      ['VESPERA', '2026-09-09T22:00:00.000Z'],
      ['NO_DIA', '2026-09-10T10:00:00.000Z'],
    ]);
  });

  it('hora como o backend manda: "14:00:00" vira 14:00, e campo ausente e "sem hora"', () => {
    // O Jackson serializa LocalTime com segundos, e omite campo nulo do JSON.
    // `undefined` nao e `=== null`: sem normalizar, a prova sem horario ganhava
    // um "1 hora antes" e o texto dizia "· undefined".
    const [comSegundos] = calcularAgendamentos(
      [evento({ hora: '14:00:00' })],
      new Date(AGORA),
      '19:00',
      SP,
      { ...NENHUM_PADRAO, umaHora: true },
    );
    expect(comSegundos.titulo).toBe('Em 1 hora: prova de CALC2 · 14:00');

    const semCampo = evento();
    delete (semCampo as { hora?: string | null }).hora;
    expect(quando([semCampo], AGORA, LEMBRETES_PADRAO)).toEqual([
      ['VESPERA', '2026-09-09T22:00:00.000Z'],
      ['NO_DIA', '2026-09-10T10:00:00.000Z'],
    ]);
  });

  it('evento as 06:30 pula o "no dia" — avisar as 7h de prova que ja comecou e ruido', () => {
    expect(quando([evento({ hora: '06:30' })], AGORA, LEMBRETES_PADRAO)).toEqual([
      ['VESPERA', '2026-09-09T22:00:00.000Z'],
      ['UMA_HORA', '2026-09-10T08:30:00.000Z'],
    ]);
    // Exatamente as 7h tambem pula: "pule se >= horario do evento".
    expect(
      quando([evento({ hora: '07:00' })], AGORA, LEMBRETES_PADRAO).map(
        ([t]) => t,
      ),
    ).not.toContain('NO_DIA');
  });

  it('evento as 08:00: "1 hora antes" ja toca as 07:00, entao o "no dia" nao repete', () => {
    // Os dois cairiam no MESMO instante (07:00) com dois textos diferentes.
    expect(quando([evento({ hora: '08:00' })], AGORA, LEMBRETES_PADRAO)).toEqual([
      ['VESPERA', '2026-09-09T22:00:00.000Z'],
      // 08:00 - 1 h = 07:00 em SP.
      ['UMA_HORA', '2026-09-10T10:00:00.000Z'],
    ]);
    // Antes das 8h tambem: as 07:30, o "1 hora antes" (06:30) vem primeiro.
    expect(
      quando([evento({ hora: '07:30' })], AGORA, LEMBRETES_PADRAO).map(([t]) => t),
    ).toEqual(['VESPERA', 'UMA_HORA']);
  });

  it('o "no dia" so some se o "1 hora antes" estiver ligado para cobri-lo', () => {
    const as8 = [evento({ hora: '08:00' })];
    // Sem o "1 hora antes", nada mais avisa de manha: o "no dia" fica.
    expect(quando(as8, AGORA, { ...NENHUM_PADRAO, noDia: true })).toEqual([
      ['NO_DIA', '2026-09-10T10:00:00.000Z'],
    ]);
    // 09:00: o "1 hora antes" cai as 08:00, uma hora depois do "no dia" — sao
    // dois avisos distintos, e os dois ficam.
    expect(
      quando([evento({ hora: '09:00' })], AGORA, LEMBRETES_PADRAO).map(([t]) => t),
    ).toEqual(['VESPERA', 'NO_DIA', 'UMA_HORA']);
  });

  it('no dia depois das 7h: so o que ainda nao passou', () => {
    // 09:00 em SP do dia 10, prova as 14:00: vespera e "no dia" ja foram.
    expect(
      quando([evento({ hora: '14:00' })], '2026-09-10T12:00:00Z', LEMBRETES_PADRAO),
    ).toEqual([['UMA_HORA', '2026-09-10T16:00:00.000Z']]);
  });

  it('cada liga/desliga desliga so o seu', () => {
    const e = [evento({ hora: '14:00' })];
    expect(quando(e, AGORA, NENHUM_PADRAO)).toEqual([]);
    expect(quando(e, AGORA, { ...NENHUM_PADRAO, noDia: true })).toEqual([
      ['NO_DIA', '2026-09-10T10:00:00.000Z'],
    ]);
    expect(quando(e, AGORA, { ...NENHUM_PADRAO, umaHora: true })).toEqual([
      ['UMA_HORA', '2026-09-10T16:00:00.000Z'],
    ]);
  });

  it('evento oculto ou excluido nao gera aviso nenhum — nem o personalizado', () => {
    // O fantasma que a A16 descreve: o lider oculta uma prova e o celular de
    // quem ja sincronizou continua avisando por um evento que sumiu da Home de
    // todo mundo. O excluido pelo autor tem o mesmo destino.
    const comAlarme: ConfigLembretes = {
      ...LEMBRETES_PADRAO,
      personalizados: { e1: { modo: 'RELATIVO', horasAntes: 2 } },
    };
    expect(quando([evento({ visivelTurma: false })], AGORA, comAlarme)).toEqual(
      [],
    );
    expect(
      quando([evento({ excluidoEm: '2026-09-01T10:00:00Z' })], AGORA, comAlarme),
    ).toEqual([]);
  });

  it(`corta em ${LIMITE_AGENDAMENTOS}, e o que fica de fora e o mais distante`, () => {
    // 150 eventos x 3 avisos = 450. O Android recusa alarme alem de ~500
    // pendentes; o corte tem de levar embora o fim da fila, nunca o amanha.
    const eventos = Array.from({ length: 150 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 8, 10 + i));
      return evento({
        eventoId: `e${i}`,
        hora: '14:00',
        data: d.toISOString().slice(0, 10),
      });
    });

    const r = calcularAgendamentos(
      eventos,
      new Date(AGORA),
      '19:00',
      SP,
      LEMBRETES_PADRAO,
    );

    expect(r.length).toBe(LIMITE_AGENDAMENTOS);
    expect(r[0].eventoId).toBe('e0');
    const instantes = r.map((a) => a.dispararEm.getTime());
    expect(instantes).toEqual([...instantes].sort((a, b) => a - b));
    expect(r.some((a) => a.eventoId === 'e149')).toBeFalse();
  });
});

describe('alarme personalizado', () => {
  const AGORA = '2026-09-01T15:00:00Z';

  it('relativo de 36 h com hora conta da hora do evento', () => {
    // Prova 10/09 08:00 em SP = 11:00Z; 36 h antes = 08/09 20:00 em SP.
    expect(
      quando([evento()], AGORA, {
        ...NENHUM_PADRAO,
        personalizados: { e1: { modo: 'RELATIVO', horasAntes: 36 } },
      }),
    ).toEqual([['PERSONALIZADO', '2026-09-08T23:00:00.000Z']]);
  });

  it('relativo de 36 h sem hora conta das 7h do dia', () => {
    // 10/09 07:00 em SP = 10:00Z; 36 h antes = 08/09 19:00 em SP.
    expect(
      quando([evento({ hora: null })], AGORA, {
        ...NENHUM_PADRAO,
        personalizados: { e1: { modo: 'RELATIVO', horasAntes: 36 } },
      }),
    ).toEqual([['PERSONALIZADO', '2026-09-08T22:00:00.000Z']]);
  });

  it('exato e hora de parede em Sao Paulo, nao no fuso da maquina', () => {
    expect(
      instantePersonalizado(
        { modo: 'EXATO', data: '2026-09-05', hora: '18:30' },
        evento(),
        SP,
      )?.toISOString(),
    ).toBe('2026-09-05T21:30:00.000Z');
  });

  it('o instante do exato segue o fuso PEDIDO, e nao o da maquina', () => {
    // Em SP o teste acima passaria tambem com `new Date('2026-09-05T18:30')`
    // se a maquina estivesse em SP. Trocar o fuso pedido prova que o instante
    // sai do argumento: a mesma hora de parede, tres instantes diferentes.
    const exato = { modo: 'EXATO', data: '2026-09-05', hora: '18:30' } as const;
    const em = (fuso: string) =>
      instantePersonalizado(exato, evento(), fuso)!.getTime();

    expect(em(SP)).toBe(Date.UTC(2026, 8, 5, 21, 30));
    expect(em('UTC')).toBe(Date.UTC(2026, 8, 5, 18, 30));
    expect(em('Asia/Tokyo')).toBe(Date.UTC(2026, 8, 5, 9, 30));
  });

  it('nao depende dos tres liga/desliga', () => {
    // Quem desligou tudo e marcou um alarme a mao pediu exatamente aquele.
    const r = calcularAgendamentos(
      [evento()],
      new Date(AGORA),
      '19:00',
      SP,
      {
        ...NENHUM_PADRAO,
        personalizados: {
          e1: { modo: 'EXATO', data: '2026-09-05', hora: '18:30' },
        },
      },
    );
    expect(r.length).toBe(1);
    expect(r[0].tipo).toBe('PERSONALIZADO');
    expect(r[0].titulo).toBe('Lembrete: prova de CALC2');
    // Pode tocar dias antes: o corpo diz QUANDO e a prova.
    expect(r[0].corpo).toBe('Prova 2 — integrais · qui, 10 set, 08:00');
  });

  it('passado nao agenda', () => {
    expect(
      quando([evento()], AGORA, {
        ...NENHUM_PADRAO,
        personalizados: {
          e1: { modo: 'EXATO', data: '2026-08-20', hora: '10:00' },
        },
      }),
    ).toEqual([]);
  });

  it('a tela mostra o instante como o relogio de Sao Paulo mostra', () => {
    expect(rotuloInstante(new Date('2026-10-09T22:00:00Z'), SP)).toBe(
      'sex, 9 out, 19:00',
    );
  });
});

describe('podarPersonalizados', () => {
  it('fica so o que veio no /sync e e da turma', () => {
    const alarme = { modo: 'RELATIVO', horasAntes: 2 } as const;
    const ficam = podarPersonalizados(
      { vivo: alarme, sumiu: alarme, oculto: alarme, excluido: alarme },
      [
        evento({ eventoId: 'vivo' }),
        evento({ eventoId: 'oculto', visivelTurma: false }),
        evento({ eventoId: 'excluido', excluidoEm: '2026-09-02T10:00:00Z' }),
      ],
    );
    expect(Object.keys(ficam)).toEqual(['vivo']);
  });
});

describe('idDoAviso', () => {
  it('um id por (evento, tipo), estavel, e fora do id do aviso de teste', () => {
    const tipos: TipoLembrete[] = ['NO_DIA', 'VESPERA', 'UMA_HORA', 'PERSONALIZADO'];
    const ids = tipos.map((t) => idDoAviso('e1', t));

    // Com o id so do evento, o segundo `schedule` substituia o primeiro.
    expect(new Set(ids).size).toBe(4);
    expect(idDoAviso('e1', 'VESPERA')).toBe(ids[1]);
    for (const id of ids) {
      expect(Number.isInteger(id)).toBeTrue();
      expect(id).toBeGreaterThanOrEqual(0);
      expect(id).toBeLessThan(2_000_000_001);
    }
  });
});
