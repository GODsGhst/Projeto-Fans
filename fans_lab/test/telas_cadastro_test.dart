import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:fans_lab/app_deps.dart';
import 'package:fans_lab/database/app_database.dart';
import 'package:fans_lab/main.dart' as fans;
import 'package:fans_lab/models/rascunho_evento.dart';
import 'package:fans_lab/models/sessao.dart';
import 'package:fans_lab/models/tipo_evento.dart';
import 'package:fans_lab/models/usuario.dart';
import 'package:fans_lab/screens/cadastro_page.dart';
import 'package:fans_lab/screens/entrar_turma_page.dart';
import 'package:fans_lab/screens/home_page.dart';
import 'package:fans_lab/screens/login_page.dart';
import 'package:fans_lab/widgets/cores.dart';

void main() {
  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfiNoIsolate;
  });

  Future<AppDeps> montarDeps(
    WidgetTester tester,
    Future<http.Response> Function(http.Request) handler,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final db = (await tester.runAsync(AppDatabase.abrirEmMemoria))!;
    return AppDeps.padrao(
      client: MockClient(handler),
      abrirDb: () async => db,
      baseUrl: 'http://api',
    );
  }

  Future<void> esperarAparecer(WidgetTester tester, Finder f) async {
    for (var i = 0; i < 200 && f.evaluate().isEmpty; i++) {
      await tester.runAsync(() => Future.delayed(const Duration(milliseconds: 10)));
      await tester.pump(const Duration(milliseconds: 10));
    }
  }

  http.Response json(Object corpo, int status) => http.Response(
    jsonEncode(corpo),
    status,
    headers: {'content-type': 'application/json; charset=utf-8'},
  );

  Finder campo(String rotulo) => find.widgetWithText(TextFormField, rotulo);

  testWidgets('cadastro: senha curta e senhas diferentes não chamam a API', (tester) async {
    var chamadas = 0;
    final deps = await montarDeps(tester, (_) async {
      chamadas++;
      return json({'status': 500}, 500);
    });
    await tester.pumpWidget(MaterialApp(
      theme: temaFans(Brightness.light),
      home: CadastroPage(deps: deps, aoEntrar: (_) {}),
    ));

    await tester.enterText(campo('Nome'), 'Prof');
    await tester.enterText(campo('E-mail'), 'prof@x.com');
    await tester.enterText(campo('Senha'), 'curta');
    await tester.enterText(campo('Repita a senha'), 'outra');
    await tester.tap(find.widgetWithText(FilledButton, 'Criar conta'));
    await tester.pump();

    expect(find.text('A senha precisa de pelo menos 8 caracteres.'), findsOneWidget);
    expect(find.text('As senhas não são iguais.'), findsOneWidget);
    expect(chamadas, 0);
  });

  testWidgets('conta nova: login → criar conta → código da turma → Home', (tester) async {
    final caminhos = <String>[];
    String? codigoEnviado;
    final deps = await montarDeps(tester, (req) async {
      caminhos.add('${req.method} ${req.url.path}');
      if (req.url.path.endsWith('/auth/registrar')) {
        return json({
          'jwt': 'jwt-novo',
          'usuario': {'id': 'u9', 'nome': 'Prof', 'email': 'prof@x.com'},
          'turmaId': null,
        }, 200);
      }
      if (req.url.path.endsWith('/turmas/entrar')) {
        codigoEnviado = (jsonDecode(req.body) as Map)['codigoConvite'] as String;
        return json({'id': 'mb1', 'turmaId': 't1', 'papel': 'ALUNO'}, 200);
      }
      if (req.url.path.endsWith('/home')) return json([], 200);
      if (req.url.path.endsWith('/materias')) return json([], 200);
      return json({'status': 404}, 404);
    });
    await tester.pumpWidget(fans.FansLabApp(deps: deps));

    await tester.tap(find.text('Não tem conta? Criar conta'));
    await tester.pumpAndSettle();
    await tester.enterText(campo('Nome'), 'Prof');
    await tester.enterText(campo('E-mail'), 'prof@x.com');
    await tester.enterText(campo('Senha'), 'senha-longa');
    await tester.enterText(campo('Repita a senha'), 'senha-longa');
    await tester.tap(find.widgetWithText(FilledButton, 'Criar conta'));
    await esperarAparecer(tester, find.byType(EntrarTurmaPage));
    await tester.pump(const Duration(seconds: 1)); // fim da animação de saída do cadastro

    expect(find.byType(CadastroPage), findsNothing, reason: 'o cadastro sai da pilha');
    expect(find.textContaining('Olá, Prof.'), findsOneWidget);

    await tester.enterText(campo('Código da turma'), ' turma01 ');
    await tester.tap(find.widgetWithText(FilledButton, 'Entrar na turma'));
    await esperarAparecer(tester, find.text('Nada nos próximos 14 dias.'));

    expect(codigoEnviado, 'TURMA01', reason: 'sem espaços e em maiúsculas');
    expect(find.byType(HomePage), findsOneWidget);
    expect(caminhos.first, 'POST /auth/registrar');
    final salva = await tester.runAsync(deps.sessao.carregar);
    expect(salva!.turmaId, 't1', reason: 'reabrir o app vai direto para a Home');
  });

  test('validarEmail recusa o que o @Email do servidor recusa', () {
    expect(validarEmail('prof@gmail.com'), isNull);
    expect(validarEmail('a.b-c+d@sub.exemplo.com.br'), isNull);
    for (final ruim in ['prof@gmail.com.', 'prof@gmail..com', 'prof@gmail.com,', 'prof@gmail', 'prof gmail.com']) {
      expect(validarEmail(ruim), 'E-mail inválido.', reason: ruim);
    }
  });

  testWidgets('sair da tela da turma não apaga a fila do aparelho', (tester) async {
    final deps = await montarDeps(tester, (_) async => json({'status': 404}, 404));
    await tester.runAsync(() => deps.rascunhos.inserir(RascunhoEvento(
      materiaId: 'm1',
      materiaSigla: 'BD',
      materiaCorHex: '#1D4ED8',
      tipo: TipoEvento.prova,
      titulo: 'Pendente',
      data: DateTime(2026, 11, 5),
      criadoEm: DateTime(2026, 10, 25),
    )));
    final semTurma = Sessao(
      jwt: 'jwt',
      usuario: Usuario(id: 'u9', nome: 'Prof', email: 'prof@x.com'),
    );
    await tester.pumpWidget(fans.FansLabApp(deps: deps, sessaoInicial: semTurma));
    await esperarAparecer(tester, find.byType(EntrarTurmaPage));

    await tester.tap(find.text('Sair'));
    await esperarAparecer(tester, find.text('Não tem conta? Criar conta'));

    final fila = await tester.runAsync(deps.rascunhos.listarPendentes);
    expect(fila, hasLength(1));
  });

  testWidgets('código errado: mostra a mensagem e continua na tela', (tester) async {
    final deps = await montarDeps(tester, (req) async {
      if (req.url.path.endsWith('/auth/registrar')) {
        return json({
          'jwt': 'jwt-novo',
          'usuario': {'id': 'u9', 'nome': 'Prof', 'email': 'prof@x.com'},
          'turmaId': null,
        }, 200);
      }
      return json({'status': 404}, 404);
    });
    await tester.pumpWidget(fans.FansLabApp(deps: deps));
    await tester.tap(find.text('Não tem conta? Criar conta'));
    await tester.pumpAndSettle();
    await tester.enterText(campo('Nome'), 'Prof');
    await tester.enterText(campo('E-mail'), 'prof@x.com');
    await tester.enterText(campo('Senha'), 'senha-longa');
    await tester.enterText(campo('Repita a senha'), 'senha-longa');
    await tester.tap(find.widgetWithText(FilledButton, 'Criar conta'));
    await esperarAparecer(tester, find.byType(EntrarTurmaPage));

    await tester.enterText(campo('Código da turma'), 'ERRADO1');
    await tester.tap(find.widgetWithText(FilledButton, 'Entrar na turma'));
    await esperarAparecer(tester, find.text('Código de turma não encontrado.'));

    expect(find.text('Código de turma não encontrado.'), findsOneWidget);
    expect(find.byType(EntrarTurmaPage), findsOneWidget);
  });
}
