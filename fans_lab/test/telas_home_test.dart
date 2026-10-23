import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:fans_lab/app_deps.dart';
import 'package:fans_lab/database/app_database.dart';
import 'package:fans_lab/screens/home_page.dart';
import 'package:fans_lab/screens/login_page.dart';
import 'package:fans_lab/widgets/cores.dart';

typedef Handler = Future<http.Response> Function(http.Request);

void main() {
  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfiNoIsolate;
  });

  Future<AppDeps> montarDeps(WidgetTester tester, Handler handler) async {
    SharedPreferences.setMockInitialValues({});
    // Banco e HTTP são I/O real: criados fora da zona falsa do testWidgets.
    final db = (await tester.runAsync(AppDatabase.abrirEmMemoria))!;
    return AppDeps.padrao(
      client: MockClient(handler),
      abrirDb: () async => db,
      baseUrl: 'http://api',
    );
  }

  // Espera um texto aparecer sem pumpAndSettle (o spinner nunca assenta).
  Future<void> esperarAparecer(WidgetTester tester, Finder f) async {
    for (var i = 0; i < 200 && f.evaluate().isEmpty; i++) {
      await tester.runAsync(() => Future.delayed(const Duration(milliseconds: 10)));
      await tester.pump(const Duration(milliseconds: 10));
    }
  }

  Widget app(Widget home) =>
      MaterialApp(theme: temaFans(Brightness.light), home: home);

  Map<String, dynamic> itemHome(String id, String tipo, String titulo, String data) => {
    'eventoId': id,
    'tipo': tipo,
    'titulo': titulo,
    'data': data,
    'hora': '19:00:00',
    'materiaSigla': 'BD',
    'materiaCorHex': '#1D4ED8',
    'autoria': {
      'autorId': 'u1',
      'autorNome': 'Ana',
      'autorSelo': null,
      'criadoEm': '2026-10-20T13:00:00Z',
      'atualizadoEm': null,
      'editadoPorNome': null,
      'editadoPorSelo': null,
    },
    'feitoPeloUsuario': false,
  };

  http.Response json(Object corpo, int status) => http.Response(
    jsonEncode(corpo),
    status,
    headers: {'content-type': 'application/json; charset=utf-8'},
  );

  testWidgets('login com 401 mostra a mensagem do servidor', (tester) async {
    final deps = await montarDeps(
      tester,
      (_) async => json({'status': 401, 'detail': 'E-mail ou senha incorretos.'}, 401),
    );
    await tester.pumpWidget(app(LoginPage(deps: deps, aoEntrar: (_) {})));

    await tester.enterText(find.byType(TextFormField).at(0), 'a@b.com');
    await tester.enterText(find.byType(TextFormField).at(1), 'errada');
    await tester.tap(find.text('Entrar'));
    await esperarAparecer(tester, find.text('E-mail ou senha incorretos.'));

    expect(find.text('E-mail ou senha incorretos.'), findsOneWidget);
  });

  testWidgets('home mostra os itens na ordem que o servidor mandou', (tester) async {
    final deps = await montarDeps(tester, (req) async {
      if (!req.url.path.endsWith('/home')) return json({'status': 404}, 404);
      // Primeiro do JSON é o mais tarde: a tela não pode reordenar por data.
      return json([
        itemHome('e1', 'PROVA', 'Prova 2', '2026-10-29'),
        itemHome('e2', 'ENTREGA', 'Lista 4', '2026-10-21'),
      ], 200);
    });
    await tester.pumpWidget(
      app(HomePage(deps: deps, aoSair: () {}, aoMudarTema: (_) {})),
    );
    await esperarAparecer(tester, find.text('Prova 2'));

    expect(find.text('Lista 4'), findsOneWidget);
    expect(
      tester.getTopLeft(find.text('Prova 2')).dy,
      lessThan(tester.getTopLeft(find.text('Lista 4')).dy),
    );
  });

  testWidgets('home com lista vazia mostra o texto de semana vazia', (tester) async {
    final deps = await montarDeps(tester, (req) async => json([], 200));
    await tester.pumpWidget(
      app(HomePage(deps: deps, aoSair: () {}, aoMudarTema: (_) {})),
    );
    await esperarAparecer(tester, find.text('Nada nos próximos 14 dias.'));

    expect(find.text('Nada nos próximos 14 dias.'), findsOneWidget);
  });

  testWidgets('falha sem cache mostra Tentar de novo, nunca lista vazia', (tester) async {
    final deps = await montarDeps(tester, (_) async {
      throw http.ClientException('sem rede');
    });
    await tester.pumpWidget(
      app(HomePage(deps: deps, aoSair: () {}, aoMudarTema: (_) {})),
    );
    await esperarAparecer(tester, find.text('Tentar de novo'));

    expect(find.text('Tentar de novo'), findsOneWidget);
    expect(find.text('Nada nos próximos 14 dias.'), findsNothing);
  });
}
