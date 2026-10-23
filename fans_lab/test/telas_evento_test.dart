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
import 'package:fans_lab/models/sessao.dart';
import 'package:fans_lab/models/tipo_evento.dart';
import 'package:fans_lab/models/usuario.dart';
import 'package:fans_lab/screens/evento_detalhe_page.dart';
import 'package:fans_lab/screens/evento_form_page.dart';
import 'package:fans_lab/screens/fila_page.dart';
import 'package:fans_lab/widgets/cores.dart';

const _materiaJson = {
  'id': 'm1',
  'nome': 'Banco de Dados',
  'sigla': 'BD',
  'corHex': '#1D4ED8',
  'sala': null,
  'professor': null,
};

Map<String, dynamic> _autoria(String autorId) => {
  'autorId': autorId,
  'autorNome': 'Ana',
  'autorSelo': null,
  'criadoEm': '2026-10-20T13:00:00Z',
  'atualizadoEm': null,
  'editadoPorNome': null,
  'editadoPorSelo': null,
};

Map<String, dynamic> _detalheJson(String autorId) => {
  'id': 'e1',
  'tipo': 'PROVA',
  'titulo': 'Prova 2',
  'data': '2026-10-25',
  'hora': '19:00:00',
  'sala': 'B-10',
  'materiaId': 'm1',
  'materiaSigla': 'BD',
  'materiaCorHex': '#1D4ED8',
  'autoria': _autoria(autorId),
  'version': 3,
  'visivelTurma': true,
  'excluidoEm': null,
  'materiais': [
    {
      'id': 'mt1',
      'tipo': 'LINK',
      'titulo': 'Slides aula 3',
      'url': 'https://exemplo.com/slides',
      'dataAula': '2026-10-10',
      'autoria': _autoria(autorId),
    },
  ],
};

http.Response _json(Object corpo) => http.Response(
  jsonEncode(corpo),
  200,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

void main() {
  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfiNoIsolate;
  });

  /// Deps com banco em memória novo e a API simulada pelo [handler].
  Future<AppDeps> montarDeps(
    WidgetTester tester,
    Future<http.Response> Function(http.Request) handler,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final db = (await tester.runAsync(() => AppDatabase.abrirEmMemoria()))!;
    return AppDeps.padrao(
      client: MockClient(handler),
      abrirDb: () async => db,
      baseUrl: 'http://api',
    );
  }

  /// SQLite e SharedPreferences são I/O real: o teste precisa deixar o tempo passar.
  Future<void> aguardar(WidgetTester tester) async {
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 300)),
    );
    await tester.pump();
  }

  /// Espera um texto aparecer (ex.: SnackBar depois do sync), com limite de tempo.
  Future<void> aguardarTexto(WidgetTester tester, String texto) async {
    for (var i = 0; i < 40; i++) {
      await tester.pump();
      if (find.textContaining(texto).evaluate().isNotEmpty) return;
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 50)),
      );
    }
  }

  Future<void> escolherMateria(WidgetTester tester) async {
    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Banco de Dados').last);
    await tester.pumpAndSettle();
  }

  testWidgets('novo evento sem rede: fica salvo no aparelho e avisa', (
    tester,
  ) async {
    final deps = await montarDeps(tester, (req) async {
      if (req.url.path.endsWith('/materias')) return _json([_materiaJson]);
      if (req.method == 'POST') throw http.ClientException('sem rede');
      return http.Response('', 404);
    });
    await tester.pumpWidget(
      MaterialApp(
        theme: temaFans(Brightness.light),
        home: EventoFormPage(deps: deps),
      ),
    );
    await aguardar(tester);

    await escolherMateria(tester);
    await tester.enterText(
      find.widgetWithText(TextFormField, 'O que é'),
      'Prova 3',
    );
    await tester.ensureVisible(find.text('Salvar'));
    await tester.tap(find.text('Salvar'));
    await aguardarTexto(tester, 'Salvo no aparelho');

    final pendentes = await tester.runAsync(
      () => deps.rascunhos.listarPendentes(),
    );
    expect(pendentes, hasLength(1));
    expect(pendentes!.first.titulo, 'Prova 3');
    expect(find.textContaining('Salvo no aparelho'), findsOneWidget);
  });

  testWidgets('novo evento sem título: pede o título e não grava nada', (
    tester,
  ) async {
    final deps = await montarDeps(tester, (req) async {
      if (req.url.path.endsWith('/materias')) return _json([_materiaJson]);
      return http.Response('', 404);
    });
    await tester.pumpWidget(
      MaterialApp(
        theme: temaFans(Brightness.light),
        home: EventoFormPage(deps: deps),
      ),
    );
    await aguardar(tester);

    await tester.ensureVisible(find.text('Salvar'));
    await tester.tap(find.text('Salvar'));
    await tester.pump();

    expect(find.text('Informe o título'), findsOneWidget);
    final todos = await tester.runAsync(() => deps.rascunhos.listar());
    expect(todos, isEmpty);
  });

  testWidgets('fila mostra o rascunho aguardando envio', (tester) async {
    final deps = await montarDeps(tester, (req) async {
      return http.Response('', 404);
    });
    await tester.runAsync(
      () => deps.rascunhos.inserir(
        RascunhoEvento(
          materiaId: 'm1',
          materiaSigla: 'BD',
          materiaCorHex: '#1D4ED8',
          tipo: TipoEvento.entrega,
          titulo: 'Lista 4',
          data: DateTime(2026, 10, 25),
          criadoEm: DateTime.now(),
        ),
      ),
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: temaFans(Brightness.light),
        home: FilaPage(deps: deps),
      ),
    );
    await aguardar(tester);

    expect(find.text('Lista 4'), findsOneWidget);
    expect(find.textContaining('aguardando envio'), findsOneWidget);
  });

  testWidgets('evento de outra pessoa: mostra materiais e esconde Editar', (
    tester,
  ) async {
    final deps = await montarDeps(tester, (req) async {
      if (req.url.path.endsWith('/eventos/e1')) {
        return _json(_detalheJson('u2'));
      }
      return http.Response('', 404);
    });
    await tester.runAsync(
      () => deps.sessao.salvar(
        Sessao(
          jwt: 'jwt',
          usuario: Usuario(id: 'u1', nome: 'Otávio', email: 'o@x.com'),
          turmaId: 't1',
        ),
      ),
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: temaFans(Brightness.light),
        home: EventoDetalhePage(deps: deps, eventoId: 'e1'),
      ),
    );
    await aguardar(tester);

    expect(find.text('Slides aula 3'), findsOneWidget);
    expect(find.text('Editar'), findsNothing);
    expect(find.text('Excluir'), findsNothing);
  });

  testWidgets('evento do próprio usuário: mostra Editar', (tester) async {
    final deps = await montarDeps(tester, (req) async {
      if (req.url.path.endsWith('/eventos/e1')) {
        return _json(_detalheJson('u1'));
      }
      return http.Response('', 404);
    });
    await tester.runAsync(
      () => deps.sessao.salvar(
        Sessao(
          jwt: 'jwt',
          usuario: Usuario(id: 'u1', nome: 'Otávio', email: 'o@x.com'),
          turmaId: 't1',
        ),
      ),
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: temaFans(Brightness.light),
        home: EventoDetalhePage(deps: deps, eventoId: 'e1'),
      ),
    );
    await aguardar(tester);

    expect(find.text('Editar'), findsOneWidget);
    expect(find.text('Excluir'), findsOneWidget);
  });
}
