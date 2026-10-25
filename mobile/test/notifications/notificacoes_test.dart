// Porte de app/src/app/notifications/notificacoes.service.spec.ts. O fake do plugin tem os oito métodos
// da interface; o armazenamento é o SharedPreferences em memória; o relógio é injetado.

import 'package:flutter_test/flutter_test.dart';
import 'package:projetofans/core/armazenamento.dart';
import 'package:projetofans/data/models.dart';
import 'package:projetofans/notifications/notificacoes.dart';
import 'package:projetofans/notifications/reagendador.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Plugin falso. `pendentes` acompanha o que foi agendado e cancelado, como o plugin real faria.
class FakePlugin implements PluginNotificacoes {
  bool habilitado = true;
  bool concedePedido = true;
  bool exatoLiberado = false;
  bool exatoAoPedir = true;

  /// Ordem das chamadas, para provar cancelar-antes-de-agendar e canal-antes-de-agendar.
  final chamadas = <String>[];
  final lotes = <List<NotificacaoAgendada>>[];
  final canais = <CanalLembretes>[];
  final cancelados = <int>[];
  final pendentesDoPlugin = <PendenteNativo>[];
  int pedidos = 0;
  int pedidosExato = 0;

  @override
  Future<bool> notificacoesHabilitadas() async {
    chamadas.add('habilitadas');
    return habilitado;
  }

  /// Simula o tempo que o usuário leva no diálogo do Android.
  void Function()? aoPedirPermissao;

  @override
  Future<bool> pedirPermissao() async {
    pedidos++;
    chamadas.add('pedir');
    aoPedirPermissao?.call();
    habilitado = concedePedido;
    return concedePedido;
  }

  @override
  Future<bool> exatoConcedido() async {
    chamadas.add('exato?');
    return exatoLiberado;
  }

  @override
  Future<bool> pedirExato() async {
    pedidosExato++;
    chamadas.add('pedirExato');
    exatoLiberado = exatoAoPedir;
    return exatoAoPedir;
  }

  @override
  Future<void> criarCanal(CanalLembretes canal) async {
    chamadas.add('canal');
    canais.add(canal);
  }

  @override
  Future<List<PendenteNativo>> pendentes() async {
    chamadas.add('pendentes');
    return List.of(pendentesDoPlugin);
  }

  @override
  Future<void> cancelar(int id) async {
    chamadas.add('cancelar:$id');
    cancelados.add(id);
    pendentesDoPlugin.removeWhere((p) => p.id == id);
  }

  @override
  Future<void> agendar(List<NotificacaoAgendada> lote) async {
    chamadas.add('agendar');
    lotes.add(lote);
    for (final n in lote) {
      pendentesDoPlugin.add(PendenteNativo(n.id, n.tipo?.wire));
    }
  }
}

EventoAgendavel evento({
  String eventoId = 'e1',
  String? hora = '14:00',
  bool? visivelTurma,
  String? excluidoEm,
}) => EventoAgendavel(
  eventoId: eventoId,
  tipo: TipoEvento.prova,
  titulo: 'Prova 2 — integrais',
  data: '2026-09-10',
  materiaSigla: 'CALC',
  hora: hora,
  visivelTurma: visivelTurma,
  excluidoEm: excluidoEm,
);

void main() {
  late FakePlugin plugin;
  late Armazenamento arm;
  late DateTime agora;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    arm = Armazenamento(await SharedPreferences.getInstance());
    plugin = FakePlugin();
    // 12:00 de São Paulo do dia 1: a véspera (19h do dia 9) e o dia 10 ainda estão no futuro.
    agora = DateTime.parse('2026-09-01T15:00:00Z');
  });

  NotificacoesService servico({PluginNotificacoes? p, bool semPlugin = false}) =>
      NotificacoesService(
        semPlugin ? null : (p ?? plugin),
        arm,
        relogio: () => agora,
      );

  List<String> titulos(List<NotificacaoAgendada> lote) => [
    for (final n in lote) n.titulo,
  ];

  test('fora do aparelho: suportado é falso e nada estoura nem agenda', () async {
    final s = servico(semPlugin: true);
    expect(s.suportado, isFalse);
    await s.sincronizar([evento()]);
    await s.salvarPreferencias(const PreferenciasLembrete());
    await s.esquecer();
    expect(await s.estado(), EstadoAviso.semSuporte);
    expect(await s.testar(), ResultadoTeste.semSuporte);
    expect(s.epoca, 0);
  });

  test('sincronizar agenda os três padrões da prova, com ids distintos e canal de lembretes', () async {
    await servico().sincronizar([evento()]);

    final lote = plugin.lotes.single;
    expect(titulos(lote), [
      'Prova de CALC amanhã',
      'Hoje: prova de CALC',
      'Em 1 hora: prova de CALC · 14:00',
    ]);
    expect(lote.map((n) => n.id).toSet(), hasLength(3));
    expect(lote.map((n) => n.id), [
      idDoAviso('e1', TipoLembrete.vespera),
      idDoAviso('e1', TipoLembrete.noDia),
      idDoAviso('e1', TipoLembrete.umaHora),
    ]);
    // Sem permissão de exato, o lote sai inexato: nunca abre a tela de alarmes no meio do lote.
    expect(lote.every((n) => !n.exato), isTrue);
  });

  test('cancela os pendentes ANTES de agendar o lote novo', () async {
    plugin.pendentesDoPlugin.add(const PendenteNativo(111, 'NO_DIA'));
    plugin.pendentesDoPlugin.add(const PendenteNativo(222, 'VESPERA'));

    await servico().sincronizar([evento()]);

    final iCancela = plugin.chamadas.indexOf('cancelar:111');
    final iAgenda = plugin.chamadas.indexOf('agendar');
    expect(iCancela, greaterThanOrEqualTo(0));
    expect(iCancela, lessThan(iAgenda));
    expect(plugin.cancelados, containsAll([111, 222]));
  });

  test('o canal lembretes é criado antes de agendar, com importância alta e vibração', () async {
    await servico().sincronizar([evento()]);

    expect(plugin.chamadas.indexOf('canal'), lessThan(plugin.chamadas.indexOf('agendar')));
    final canal = plugin.canais.single;
    expect(canal.id, 'lembretes');
    expect(canal.importancia, 4);
    expect(canal.vibracao, isTrue);
  });

  test('lista vazia cancela os pendentes, poupa o teste, e NÃO pede permissão nem agenda', () async {
    plugin.habilitado = false;
    plugin.pendentesDoPlugin.add(const PendenteNativo(111, 'NO_DIA'));
    plugin.pendentesDoPlugin.add(const PendenteNativo(2000000001, null));

    await servico().sincronizar([]);

    expect(plugin.cancelados, [111]);
    expect(plugin.pedidos, 0);
    expect(plugin.lotes, isEmpty);
  });

  test('sincronizar e salvarPreferencias juntos: a fila faz o último agendamento respeitar a preferência', () async {
    final s = servico();
    // Sem await entre as duas: a fila é que impede a intercalação.
    final a = s.sincronizar([evento()]);
    final b = s.salvarPreferencias(const PreferenciasLembrete(noDia: false));
    await Future.wait([a, b]);

    expect(titulos(plugin.lotes.last), isNot(contains('Hoje: prova de CALC')));
  });

  test('sem lista, trocar o alarme tira o antigo; o novo aparece quando o sync chegar', () async {
    final s = servico();
    await s.salvarAlarme('e1', const AlarmeRelativo(2));

    await s.salvarAlarme('e1', const AlarmeRelativo(36));
    expect(plugin.lotes, isEmpty);
    expect(plugin.cancelados, contains(idDoAviso('e1', TipoLembrete.personalizado)));

    await s.sincronizar([evento(hora: null)]);
    expect(titulos(plugin.lotes.single), contains('Lembrete: prova de CALC'));
  });

  test('pede permissão só quando há o que avisar, e no máximo uma vez por execução', () async {
    plugin.habilitado = false;
    plugin.concedePedido = false;
    final s = servico();

    await s.sincronizar([]);
    expect(plugin.pedidos, 0);

    await s.sincronizar([evento()]);
    await s.sincronizar([evento()]);
    expect(plugin.pedidos, 1);
    expect(plugin.lotes, isEmpty);
  });

  test('um aviso que venceu enquanto o diálogo de permissão esperava não é agendado', () async {
    plugin.habilitado = false;
    // 10:30 de SP do dia 10: a véspera e o aviso das 7h já passaram; só o de 1 h antes das 14h falta.
    plugin.aoPedirPermissao = () =>
        agora = DateTime.parse('2026-09-10T13:30:00Z');

    await servico().sincronizar([evento()]);

    expect(plugin.lotes.single.map((n) => n.tipo), [TipoLembrete.umaHora]);
  });

  test('depois de uma recusa, o automático não pede de novo nem agenda', () async {
    plugin.habilitado = false;
    plugin.concedePedido = false;
    final s = servico();

    await s.sincronizar([evento()]);
    expect(await s.estado(), EstadoAviso.denied);
    await s.sincronizar([evento()]);

    expect(plugin.pedidos, 1);
    expect(plugin.lotes, isEmpty);
  });

  test('evento ocultado pelo líder não é agendado', () async {
    await servico().sincronizar([evento(visivelTurma: false)]);
    expect(plugin.lotes, isEmpty);
  });

  test('mudar preferência reagenda na hora com a última lista', () async {
    final s = servico();
    await s.sincronizar([evento()]);

    await s.salvarPreferencias(
      const PreferenciasLembrete(noDia: false),
    );

    expect(plugin.lotes, hasLength(2));
    expect(titulos(plugin.lotes.last), [
      'Prova de CALC amanhã',
      'Em 1 hora: prova de CALC · 14:00',
    ]);
  });

  test('preferência gravada antes de qualquer sync não agenda; vale quando a lista chega', () async {
    final s = servico();
    await s.salvarPreferencias(
      const PreferenciasLembrete(noDia: false, vespera: false),
    );
    expect(plugin.lotes, isEmpty);

    await s.sincronizar([evento()]);
    expect(titulos(plugin.lotes.single), ['Em 1 hora: prova de CALC · 14:00']);
  });

  test('alarme personalizado entra no agendamento e sai ao ser removido', () async {
    final s = servico();
    await s.sincronizar([evento(hora: null)]);
    expect(plugin.lotes.last, hasLength(2));

    await s.salvarAlarme(
      'e1',
      const AlarmeRelativo(36),
    );
    expect(titulos(plugin.lotes.last), contains('Lembrete: prova de CALC'));

    await s.salvarAlarme('e1', null);
    expect(titulos(plugin.lotes.last), isNot(contains('Lembrete: prova de CALC')));
    expect((await s.config()).personalizados, isEmpty);
  });

  test('sincronizar poda o alarme de evento que sumiu, oculto ou excluído', () async {
    final s = servico();
    await s.salvarAlarme('e1', const AlarmeRelativo(2));
    await s.salvarAlarme('e2', const AlarmeRelativo(2));

    await s.sincronizar([
      evento(),
      evento(eventoId: 'e2', visivelTurma: false),
    ]);

    expect((await s.config()).personalizados.keys, ['e1']);
  });

  test('preferência ilegível no disco vira o padrão sem derrubar nada', () async {
    SharedPreferences.setMockInitialValues({'pf.lembretes': '{nao-e-json'});
    arm = Armazenamento(await SharedPreferences.getInstance());

    final c = await servico().config();

    expect(c.noDia, isTrue);
    expect(c.vespera, isTrue);
    expect(c.umaHora, isTrue);
    expect(c.personalizados, isEmpty);
  });

  test('estado: granted quando liberado; prompt sem recusa; denied depois de recusa', () async {
    final s = servico();
    expect(await s.estado(), EstadoAviso.granted);

    plugin.habilitado = false;
    plugin.concedePedido = false;
    expect(await s.estado(), EstadoAviso.prompt);

    await s.sincronizar([evento()]);
    expect(await s.estado(), EstadoAviso.denied);
  });

  test('permitirExato abre o ajuste do Android, devolve granted e reagenda com exato', () async {
    final s = servico();
    await s.sincronizar([evento()]);
    expect(plugin.lotes.last.every((n) => !n.exato), isTrue);

    final r = await s.permitirExato();

    expect(r, EstadoExato.granted);
    expect(plugin.pedidosExato, 1);
    expect(plugin.lotes.last.every((n) => n.exato), isTrue);
  });

  test('testar agenda o aviso de teste em 10 s, sem tipo, depois de criar o canal', () async {
    final antes = agora;
    final r = await servico().testar();

    expect(r, ResultadoTeste.agendado);
    final teste = plugin.lotes.single.single;
    expect(teste.id, 2000000001);
    expect(teste.tipo, isNull);
    expect(teste.quando.isAfter(antes), isTrue);
    expect(teste.quando.difference(antes), const Duration(seconds: 10));
    expect(plugin.chamadas.indexOf('canal'), lessThan(plugin.chamadas.indexOf('agendar')));
  });

  test('testar com permissão negada devolve negado e não agenda', () async {
    plugin.habilitado = false;
    plugin.concedePedido = false;

    expect(await servico().testar(), ResultadoTeste.negado);
    expect(plugin.lotes, isEmpty);
  });

  test('"Testar agora" pede permissão de novo, mesmo depois de um pedido automático recusado', () async {
    plugin.habilitado = false;
    plugin.concedePedido = false;
    final s = servico();
    await s.sincronizar([evento()]);
    expect(plugin.pedidos, 1);

    await s.testar();

    expect(plugin.pedidos, 2);
  });

  test('o aviso de teste não é cancelado quando os lembretes são reagendados', () async {
    final s = servico();
    await s.testar();
    expect(plugin.pendentesDoPlugin.map((p) => p.id), contains(2000000001));

    await s.sincronizar([evento()]);

    expect(plugin.cancelados, isNot(contains(2000000001)));
  });

  test('esquecer cancela os pendentes exceto o teste, apaga os personalizados e mantém os três flags', () async {
    final s = servico();
    await s.salvarPreferencias(const PreferenciasLembrete(umaHora: false));
    await s.salvarAlarme('e1', const AlarmeRelativo(2));
    await s.sincronizar([evento()]);
    await s.testar();

    await s.esquecer();

    expect(plugin.cancelados, isNot(contains(2000000001)));
    final c = await s.config();
    expect(c.personalizados, isEmpty);
    expect([c.noDia, c.vespera, c.umaHora], [true, true, false]);
  });

  test('depois de esquecer, salvar preferência não reagenda a lista antiga', () async {
    final s = servico();
    await s.sincronizar([evento()]);
    final lotes = plugin.lotes.length;

    await s.esquecer();
    await s.salvarPreferencias(const PreferenciasLembrete());

    expect(plugin.lotes, hasLength(lotes));
  });

  test('esquecer sobe a época; fora do aparelho ela fica em 0', () async {
    final s = servico();
    expect(s.epoca, 0);
    await s.esquecer();
    expect(s.epoca, 1);

    final semPlugin = servico(semPlugin: true);
    await semPlugin.esquecer();
    expect(semPlugin.epoca, 0);
  });

  test('avisos agendados levam o tipo no payload; o de teste não leva', () async {
    await servico().sincronizar([evento()]);

    expect(
      plugin.lotes.single.map((n) => n.tipo),
      [TipoLembrete.vespera, TipoLembrete.noDia, TipoLembrete.umaHora],
    );
  });

  test('sem lista, desligar um tipo cancela só os avisos daquele tipo e não agenda', () async {
    plugin.pendentesDoPlugin.addAll([
      PendenteNativo(idDoAviso('e1', TipoLembrete.vespera), 'VESPERA'),
      PendenteNativo(idDoAviso('e1', TipoLembrete.noDia), 'NO_DIA'),
      const PendenteNativo(2000000001, null),
    ]);

    await servico().salvarPreferencias(const PreferenciasLembrete(vespera: false));

    expect(plugin.cancelados, [idDoAviso('e1', TipoLembrete.vespera)]);
    expect(plugin.lotes, isEmpty);
  });

  test('sem lista, remover o alarme cancela direto o id do personalizado, sem agendar', () async {
    final s = servico();
    await s.salvarAlarme('e1', const AlarmeRelativo(2));

    // Só a remoção conta: o salvarAlarme anterior também cancelou o mesmo id.
    plugin.cancelados.clear();
    plugin.chamadas.clear();

    await s.salvarAlarme('e1', null);

    expect(plugin.cancelados, [idDoAviso('e1', TipoLembrete.personalizado)]);
    expect(plugin.chamadas, isNot(contains('pendentes')));
    expect(plugin.lotes, isEmpty);
  });
}
