import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:fans_lab/app_deps.dart';
import 'package:fans_lab/database/app_database.dart';
import 'package:fans_lab/models/rascunho_evento.dart';
import 'package:fans_lab/models/tipo_evento.dart';
import 'package:fans_lab/screens/fila_page.dart';
import 'package:fans_lab/screens/home_page.dart';
import 'package:fans_lab/widgets/cores.dart';

// Envio parcial (1 enviado, depois a rede cai) nao pode dizer "nada foi enviado" — achado do V1.

http.Response _json(Object corpo, [int status = 200]) => http.Response.bytes(
  utf8.encode(jsonEncode(corpo)),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

Map<String, dynamic> _eventoJson(String id) => {
  'id': id,
  'tipo': 'PROVA',
  'titulo': 'P',
  'data': '2026-10-25',
  'hora': null,
  'sala': null,
  'materiaId': 'm1',
  'materiaSigla': 'BD',
  'materiaCorHex': '#1D4ED8',
  'autoria': {
    'autorId': 'a1',
    'autorNome': 'Ana',
    'autorSelo': null,
    'criadoEm': '2026-10-20T13:00:00Z',
    'atualizadoEm': null,
    'editadoPorNome': null,
    'editadoPorSelo': null,
  },
  'version': 1,
  'visivelTurma': true,
  'excluidoEm': null,
};

RascunhoEvento _rascunho(String titulo) => RascunhoEvento(
  materiaId: 'm1',
  materiaSigla: 'BD',
  materiaCorHex: '#1D4ED8',
  tipo: TipoEvento.prova,
  titulo: titulo,
  data: DateTime(2026, 10, 25),
  criadoEm: DateTime.utc(2026, 10, 22),
);

/// 1º POST aceito, os seguintes caem sem conexão: envio parcial.
http.Client _clienteParcial() {
  var posts = 0;
  return MockClient((req) async {
    if (req.method == 'GET') return _json(<Object>[]);
    posts++;
    if (posts == 1) return _json(_eventoJson('novo'), 201);
    throw http.ClientException('sem rede');
  });
}

/// Todo POST cai sem conexão: nada foi enviado.
http.Client _clienteOffline() => MockClient((req) async {
  if (req.method == 'GET') return _json(<Object>[]);
  throw http.ClientException('sem rede');
});

void main() {
  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfiNoIsolate;
  });

  Future<void> esperarQue(WidgetTester tester, bool Function() condicao) async {
    for (var i = 0; i < 300 && !condicao(); i++) {
      await tester.runAsync(() => Future.delayed(const Duration(milliseconds: 10)));
      await tester.pump(const Duration(milliseconds: 10));
    }
  }

  Future<AppDeps> montar(WidgetTester tester, http.Client client) async {
    SharedPreferences.setMockInitialValues({});
    final db = (await tester.runAsync(AppDatabase.abrirEmMemoria))!;
    return AppDeps.padrao(client: client, abrirDb: () async => db, baseUrl: 'http://api');
  }

  Widget app(Widget home) => MaterialApp(theme: temaFans(Brightness.light), home: home);

  const parcial = 'Enviados: 1 · a conexão caiu antes do resto.';
  const semEnvio = 'Sem conexão — nada foi enviado.';

  testWidgets('home: envio parcial mostra o que foi enviado', (tester) async {
    final deps = await montar(tester, _clienteParcial());
    await tester.pumpWidget(app(HomePage(deps: deps, aoSair: () {}, aoMudarTema: (_) {})));
    await esperarQue(tester, () => find.text('Nada nos próximos 14 dias.').evaluate().isNotEmpty);
    await tester.runAsync(() async {
      await deps.rascunhos.inserir(_rascunho('P1'));
      await deps.rascunhos.inserir(_rascunho('P2'));
    });

    await tester.tap(find.byTooltip('Sincronizar'));
    await esperarQue(tester, () => find.text(parcial).evaluate().isNotEmpty);

    expect(find.text(parcial), findsOneWidget);
    expect(find.text(semEnvio), findsNothing);
  });

  testWidgets('home: sem envio algum continua dizendo que nada foi enviado', (tester) async {
    final deps = await montar(tester, _clienteOffline());
    await tester.pumpWidget(app(HomePage(deps: deps, aoSair: () {}, aoMudarTema: (_) {})));
    await esperarQue(tester, () => find.text('Nada nos próximos 14 dias.').evaluate().isNotEmpty);
    await tester.runAsync(() => deps.rascunhos.inserir(_rascunho('P1')));

    await tester.tap(find.byTooltip('Sincronizar'));
    await esperarQue(tester, () => find.text(semEnvio).evaluate().isNotEmpty);

    expect(find.text(semEnvio), findsOneWidget);
    expect(find.text(parcial), findsNothing);
  });

  testWidgets('fila: envio parcial mostra o que foi enviado', (tester) async {
    final deps = await montar(tester, _clienteParcial());
    await tester.runAsync(() async {
      await deps.rascunhos.inserir(_rascunho('P1'));
      await deps.rascunhos.inserir(_rascunho('P2'));
    });
    await tester.pumpWidget(app(FilaPage(deps: deps)));
    await esperarQue(tester, () => find.text('Sincronizar agora').evaluate().isNotEmpty);

    await tester.tap(find.text('Sincronizar agora'));
    await esperarQue(tester, () => find.text(parcial).evaluate().isNotEmpty);

    expect(find.text(parcial), findsOneWidget);
    expect(find.text(semEnvio), findsNothing);
  });

  testWidgets('fila: sem envio algum continua dizendo que nada foi enviado', (tester) async {
    final deps = await montar(tester, _clienteOffline());
    await tester.runAsync(() => deps.rascunhos.inserir(_rascunho('P1')));
    await tester.pumpWidget(app(FilaPage(deps: deps)));
    await esperarQue(tester, () => find.text('Sincronizar agora').evaluate().isNotEmpty);

    await tester.tap(find.text('Sincronizar agora'));
    await esperarQue(tester, () => find.text(semEnvio).evaluate().isNotEmpty);

    expect(find.text(semEnvio), findsOneWidget);
    expect(find.text(parcial), findsNothing);
  });
}
