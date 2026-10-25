// Porte de app/src/app/notifications/reagendador.spec.ts. Instantes em UTC de propósito: se o agora
// fosse hora local, a suíte passaria nesta máquina e falharia em outra.

import 'package:flutter_test/flutter_test.dart';
import 'package:projetofans/data/models.dart';
import 'package:projetofans/notifications/reagendador.dart';

const _sp = 'America/Sao_Paulo';
const _agoraPadrao = '2026-09-01T15:00:00Z';

/// Só a véspera: os testes da véspera não podem quebrar porque nasceram outros avisos.
const _soVespera = ConfigLembretes(noDia: false, umaHora: false);

const _nenhum = ConfigLembretes(vespera: false, noDia: false, umaHora: false);

EventoAgendavel evento({
  String eventoId = 'e1',
  TipoEvento tipo = TipoEvento.prova,
  String titulo = 'Prova 2 — integrais',
  String data = '2026-09-10',
  String? hora = '08:00',
  String materiaSigla = 'CALC2',
  bool? visivelTurma,
  String? excluidoEm,
}) => EventoAgendavel(
  eventoId: eventoId,
  tipo: tipo,
  titulo: titulo,
  data: data,
  materiaSigla: materiaSigla,
  hora: hora,
  visivelTurma: visivelTurma,
  excluidoEm: excluidoEm,
);

/// (tipo, instante ISO) de cada aviso, na ordem devolvida.
List<(String, String)> quando(
  List<EventoAgendavel> eventos,
  String agora,
  ConfigLembretes config, {
  String fuso = _sp,
}) => [
  for (final a in calcularAgendamentos(
    eventos,
    DateTime.parse(agora),
    '19:00',
    fuso,
    config,
  ))
    (a.tipo.wire, a.dispararEm.toIso8601String()),
];

String _iso(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

void main() {
  setUpAll(() => localizacao(_sp));

  group('calcularAgendamentos — véspera', () {
    test('agenda 19h do dia anterior, e a virada de mês', () {
      final r = calcularAgendamentos(
        [evento()],
        DateTime.parse(_agoraPadrao),
        '19:00',
        _sp,
        _soVespera,
      );
      // 19:00 em São Paulo (UTC-3) é 22:00Z do dia 9 — véspera do dia 10.
      expect(r.single.dispararEm.toIso8601String(), '2026-09-09T22:00:00.000Z');
      expect(r.single.eventoId, 'e1');
      expect(r.single.tipo, TipoLembrete.vespera);

      // A véspera de 01/09 é 31/08, que tem 31 dias. Dia - 1 ingênuo daria "2026-09-00".
      // `agora` próprio: a véspera de 01/09 já passou em relação ao agora de cima.
      expect(
        quando(
          [evento(data: '2026-09-01')],
          '2026-08-30T12:00:00Z',
          _soVespera,
        ),
        [('VESPERA', '2026-08-31T22:00:00.000Z')],
      );
    });

    test('virada de ano: a véspera de 1/jan é 31/dez do ano anterior', () {
      expect(
        quando(
          [evento(data: '2027-01-01')],
          '2026-12-20T12:00:00Z',
          _soVespera,
        ),
        [('VESPERA', '2026-12-31T22:00:00.000Z')],
      );
    });

    test('ignora evento cujo disparo já passou', () {
      // 20:30 de São Paulo do dia 9: a véspera das 19h já foi.
      expect(quando([evento()], '2026-09-09T23:30:00Z', _soVespera), isEmpty);
    });

    test('evento de hoje não gera véspera', () {
      // 06:00 de São Paulo do próprio dia do evento. A véspera foi ontem às 19h.
      expect(quando([evento()], '2026-09-10T09:00:00Z', _soVespera), isEmpty);
    });

    test('evento de amanhã agenda véspera hoje 19h', () {
      expect(
        quando(
          [evento(data: '2026-09-11')],
          '2026-09-10T11:00:00Z',
          _soVespera,
        ),
        [('VESPERA', '2026-09-10T22:00:00.000Z')],
      );
    });

    test('hora nula do evento não muda a hora do aviso', () {
      final r = calcularAgendamentos(
        [
          evento(eventoId: 'sem', hora: null),
          evento(eventoId: 'com', hora: '08:00'),
        ],
        DateTime.parse(_agoraPadrao),
        '19:00',
        _sp,
        _soVespera,
      );
      expect(
        r[0].dispararEm.toIso8601String(),
        '2026-09-09T22:00:00.000Z',
      );
      expect(r[1].dispararEm, r[0].dispararEm);
    });

    test('respeita America/Sao_Paulo: o mesmo evento em UTC sai 19:00Z', () {
      expect(
        quando([evento()], _agoraPadrao, _soVespera),
        [('VESPERA', '2026-09-09T22:00:00.000Z')],
      );
      expect(
        quando([evento()], _agoraPadrao, _soVespera, fuso: 'UTC'),
        [('VESPERA', '2026-09-09T19:00:00.000Z')],
      );
    });
  });

  group('calcularAgendamentos — os três padrão', () {
    test('prova com hora gera os três, em ordem de instante, com texto', () {
      final r = calcularAgendamentos(
        [evento(hora: '14:00')],
        DateTime.parse(_agoraPadrao),
        '19:00',
        _sp,
        ConfigLembretes.padrao,
      );
      expect(
        [for (final a in r) (a.tipo.wire, a.dispararEm.toIso8601String())],
        [
          ('VESPERA', '2026-09-09T22:00:00.000Z'),
          // 07:00 de São Paulo do dia 10.
          ('NO_DIA', '2026-09-10T10:00:00.000Z'),
          // 14:00 - 1 h = 13:00 de São Paulo.
          ('UMA_HORA', '2026-09-10T16:00:00.000Z'),
        ],
      );
      expect([for (final a in r) a.titulo], [
        'Prova de CALC2 amanhã',
        'Hoje: prova de CALC2',
        'Em 1 hora: prova de CALC2 · 14:00',
      ]);
      expect(r[1].corpo, 'Prova 2 — integrais · 14:00');
    });

    test('entrega diz "entrega"', () {
      final r = calcularAgendamentos(
        [
          evento(
            tipo: TipoEvento.entrega,
            materiaSigla: 'BD',
            hora: '14:00',
          ),
        ],
        DateTime.parse(_agoraPadrao),
        '19:00',
        _sp,
        ConfigLembretes.padrao,
      );
      expect([for (final a in r) a.titulo], [
        'Entrega de BD amanhã',
        'Hoje: entrega de BD',
        'Em 1 hora: entrega de BD · 14:00',
      ]);
    });

    test('sem hora: no dia e véspera, e nenhum "1 hora antes" inventado', () {
      expect(
        quando([evento(hora: null)], _agoraPadrao, ConfigLembretes.padrao),
        [
          ('VESPERA', '2026-09-09T22:00:00.000Z'),
          ('NO_DIA', '2026-09-10T10:00:00.000Z'),
        ],
      );
    });

    test('hora "14:00:00" vira 14:00 no título; nula conta como sem hora', () {
      final comSegundos = calcularAgendamentos(
        [evento(hora: '14:00:00')],
        DateTime.parse(_agoraPadrao),
        '19:00',
        _sp,
        const ConfigLembretes(vespera: false, noDia: false, umaHora: true),
      );
      expect(comSegundos.single.titulo, 'Em 1 hora: prova de CALC2 · 14:00');
      expect(
        quando([evento(hora: null)], _agoraPadrao, ConfigLembretes.padrao),
        hasLength(2),
      );
    });

    test('evento às 06:30 pula o "no dia"; às 07:00 também', () {
      expect(
        quando([evento(hora: '06:30')], _agoraPadrao, ConfigLembretes.padrao),
        [
          ('VESPERA', '2026-09-09T22:00:00.000Z'),
          ('UMA_HORA', '2026-09-10T08:30:00.000Z'),
        ],
      );
      expect(
        quando([evento(hora: '07:00')], _agoraPadrao, ConfigLembretes.padrao)
            .map((t) => t.$1),
        isNot(contains('NO_DIA')),
      );
    });

    test('evento às 08:00: "1 hora antes" já toca às 07:00, então o no dia não repete', () {
      expect(
        quando([evento(hora: '08:00')], _agoraPadrao, ConfigLembretes.padrao),
        [
          ('VESPERA', '2026-09-09T22:00:00.000Z'),
          ('UMA_HORA', '2026-09-10T10:00:00.000Z'),
        ],
      );
      expect(
        quando([evento(hora: '07:30')], _agoraPadrao, ConfigLembretes.padrao)
            .map((t) => t.$1),
        ['VESPERA', 'UMA_HORA'],
      );
    });

    test('o "no dia" só some se o "1 hora antes" estiver ligado para cobri-lo', () {
      final as8 = [evento(hora: '08:00')];
      expect(
        quando(as8, _agoraPadrao, const ConfigLembretes(vespera: false, umaHora: false)),
        [('NO_DIA', '2026-09-10T10:00:00.000Z')],
      );
      expect(
        quando([evento(hora: '09:00')], _agoraPadrao, ConfigLembretes.padrao)
            .map((t) => t.$1),
        ['VESPERA', 'NO_DIA', 'UMA_HORA'],
      );
    });

    test('no dia depois das 7h: só o que ainda não passou', () {
      expect(
        quando(
          [evento(hora: '14:00')],
          '2026-09-10T12:00:00Z',
          ConfigLembretes.padrao,
        ),
        [('UMA_HORA', '2026-09-10T16:00:00.000Z')],
      );
    });

    test('cada liga/desliga desliga só o seu', () {
      final e = [evento(hora: '14:00')];
      expect(quando(e, _agoraPadrao, _nenhum), isEmpty);
      expect(
        quando(e, _agoraPadrao, const ConfigLembretes(vespera: false, umaHora: false)),
        [('NO_DIA', '2026-09-10T10:00:00.000Z')],
      );
      expect(
        quando(e, _agoraPadrao, const ConfigLembretes(vespera: false, noDia: false)),
        [('UMA_HORA', '2026-09-10T16:00:00.000Z')],
      );
    });

    test('evento oculto ou excluído não gera aviso nenhum, nem o personalizado', () {
      const comAlarme = ConfigLembretes(
        personalizados: {'e1': AlarmeRelativo(2)},
      );
      expect(
        quando([evento(visivelTurma: false)], _agoraPadrao, comAlarme),
        isEmpty,
      );
      expect(
        quando(
          [evento(excluidoEm: '2026-09-01T10:00:00Z')],
          _agoraPadrao,
          comAlarme,
        ),
        isEmpty,
      );
    });

    test('excluidoEm vazio conta como excluído; item sem data é descartado sem derrubar o lote', () {
      expect(
        quando([evento(excluidoEm: '')], _agoraPadrao, ConfigLembretes.padrao),
        isEmpty,
      );
      final r = quando(
        [evento(data: ''), evento(eventoId: 'ok')],
        _agoraPadrao,
        _soVespera,
      );
      expect(r, [('VESPERA', '2026-09-09T22:00:00.000Z')]);
    });

    test('corta em $limiteAgendamentos e o que fica de fora é o mais distante', () {
      // 150 eventos x 3 avisos = 450. O corte leva o fim da fila, nunca o amanhã.
      final eventos = [
        for (var i = 0; i < 150; i++)
          evento(
            eventoId: 'e$i',
            hora: '14:00',
            data: _iso(DateTime.utc(2026, 9, 10 + i)),
          ),
      ];
      final r = calcularAgendamentos(
        eventos,
        DateTime.parse(_agoraPadrao),
        '19:00',
        _sp,
        ConfigLembretes.padrao,
      );
      expect(r, hasLength(limiteAgendamentos));
      expect(r.first.eventoId, 'e0');
      expect(r.any((a) => a.eventoId == 'e149'), isFalse);
      final instantes = [for (final a in r) a.dispararEm.millisecondsSinceEpoch];
      expect(instantes, [...instantes]..sort());
    });
  });

  group('alarme personalizado', () {
    test('relativo de 36 h com hora conta da hora do evento', () {
      // Prova 10/09 08:00 em SP é 11:00Z; 36 h antes é 08/09 23:00Z.
      expect(
        quando(
          [evento()],
          _agoraPadrao,
          const ConfigLembretes(
            vespera: false,
            noDia: false,
            umaHora: false,
            personalizados: {'e1': AlarmeRelativo(36)},
          ),
        ),
        [('PERSONALIZADO', '2026-09-08T23:00:00.000Z')],
      );
    });

    test('relativo de 36 h sem hora conta das 7h do dia', () {
      expect(
        quando(
          [evento(hora: null)],
          _agoraPadrao,
          const ConfigLembretes(
            vespera: false,
            noDia: false,
            umaHora: false,
            personalizados: {'e1': AlarmeRelativo(36)},
          ),
        ),
        [('PERSONALIZADO', '2026-09-08T22:00:00.000Z')],
      );
    });

    test('exato é hora de parede em São Paulo, não no fuso da máquina', () {
      expect(
        instantePersonalizado(
          const AlarmeExato('2026-09-05', '18:30'),
          evento(),
          _sp,
        )!.toIso8601String(),
        '2026-09-05T21:30:00.000Z',
      );
    });

    test('o instante do exato segue o fuso PEDIDO', () {
      const exato = AlarmeExato('2026-09-05', '18:30');
      int em(String fuso) =>
          instantePersonalizado(exato, evento(), fuso)!.millisecondsSinceEpoch;

      expect(em(_sp), DateTime.utc(2026, 9, 5, 21, 30).millisecondsSinceEpoch);
      expect(em('UTC'), DateTime.utc(2026, 9, 5, 18, 30).millisecondsSinceEpoch);
      expect(em('Asia/Tokyo'), DateTime.utc(2026, 9, 5, 9, 30).millisecondsSinceEpoch);
    });

    test('não depende dos três liga/desliga', () {
      final r = calcularAgendamentos(
        [evento()],
        DateTime.parse(_agoraPadrao),
        '19:00',
        _sp,
        const ConfigLembretes(
          vespera: false,
          noDia: false,
          umaHora: false,
          personalizados: {'e1': AlarmeExato('2026-09-05', '18:30')},
        ),
      );
      expect(r, hasLength(1));
      expect(r.single.tipo, TipoLembrete.personalizado);
      expect(r.single.titulo, 'Lembrete: prova de CALC2');
      // Pode tocar dias antes: o corpo diz QUANDO é a prova.
      expect(r.single.corpo, 'Prova 2 — integrais · qui, 10 set, 08:00');
    });

    test('passado não agenda', () {
      expect(
        quando(
          [evento()],
          _agoraPadrao,
          const ConfigLembretes(
            vespera: false,
            noDia: false,
            umaHora: false,
            personalizados: {'e1': AlarmeExato('2026-08-20', '10:00')},
          ),
        ),
        isEmpty,
      );
    });

    test('horas não positivas não agendam (negativo cairia depois da prova)', () {
      for (final h in [0.0, -2.0, double.nan, double.infinity]) {
        expect(
          instantePersonalizado(AlarmeRelativo(h), evento(), _sp),
          isNull,
          reason: 'horasAntes=$h',
        );
      }
    });

    test('a tela mostra o instante como o relógio de São Paulo mostra', () {
      expect(
        rotuloInstante(DateTime.parse('2026-10-09T22:00:00Z'), _sp),
        'sex, 9 out, 19:00',
      );
    });
  });

  test('podarPersonalizados fica só o que veio no /sync e é da turma', () {
    const alarme = AlarmeRelativo(2);
    final ficam = podarPersonalizados(
      {'vivo': alarme, 'sumiu': alarme, 'oculto': alarme, 'excluido': alarme},
      [
        evento(eventoId: 'vivo'),
        evento(eventoId: 'oculto', visivelTurma: false),
        evento(eventoId: 'excluido', excluidoEm: '2026-09-02T10:00:00Z'),
      ],
    );
    expect(ficam.keys, ['vivo']);
  });

  group('idDoAviso', () {
    test('quatro tipos do mesmo evento dão quatro ids distintos, estáveis, no intervalo', () {
      final tipos = [
        TipoLembrete.noDia,
        TipoLembrete.vespera,
        TipoLembrete.umaHora,
        TipoLembrete.personalizado,
      ];
      final ids = [for (final t in tipos) idDoAviso('e1', t)];
      expect(ids.toSet(), hasLength(4));
      expect(idDoAviso('e1', TipoLembrete.vespera), ids[1]);
      for (final id in ids) {
        expect(id, inInclusiveRange(0, 1999999999));
      }
    });

    // Valores gerados pelo próprio algoritmo do Ionic (djb2, UTF-16, int32). Se algum divergir, um aviso
    // já agendado pelo app antigo não seria cancelado na migração.
    test('reproduz o id do Ionic bit a bit', () {
      expect(idDoAviso('e1', TipoLembrete.noDia), 1279121055);
      expect(idDoAviso('e1', TipoLembrete.vespera), 597973547);
      expect(idDoAviso('e1', TipoLembrete.umaHora), 355213375);
      expect(idDoAviso('e1', TipoLembrete.personalizado), 1929997904);
      expect(
        idDoAviso('0b7c1f2e-9d3a-4e8b-a1f0-123456789abc', TipoLembrete.vespera),
        1609458,
      );
      expect(idDoAviso('é-prova-ç', TipoLembrete.umaHora), 1940647933);
      expect(idDoAviso('x', TipoLembrete.personalizado), 969236366);
    });
  });
}
