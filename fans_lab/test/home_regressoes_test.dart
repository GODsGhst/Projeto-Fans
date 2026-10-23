// Regressões da Home achadas pelo verificador V2 (volta 2): Sair sem "sessão expirada" falso,
// evento enviado aparece sem puxar a lista, um toque = uma tentativa, pré-carga, falha fechado.

import 'dart:async';
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
import 'package:fans_lab/screens/home_page.dart';
import 'package:fans_lab/screens/evento_detalhe_page.dart';
import 'package:fans_lab/screens/login_page.dart';
import 'package:fans_lab/widgets/cores.dart';

typedef Handler = Future<http.Response> Function(http.Request);

const _materiaJson = {
  'id': 'm1', 'nome': 'Banco de Dados', 'sigla': 'BD', 'corHex': '#1D4ED8', 'sala': null, 'professor': null,
};

void main() {
  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfiNoIsolate;
  });

  Future<AppDeps> montarDeps(WidgetTester tester, Handler handler) async {
    SharedPreferences.setMockInitialValues({});
    final db = (await tester.runAsync(AppDatabase.abrirEmMemoria))!;
    return AppDeps.padrao(client: MockClient(handler), abrirDb: () async => db, baseUrl: 'http://api');
  }

  Future<void> esperarQue(WidgetTester tester, bool Function() condicao) async {
    for (var i = 0; i < 200 && !condicao(); i++) {
      await tester.runAsync(() => Future.delayed(const Duration(milliseconds: 10)));
      await tester.pump(const Duration(milliseconds: 10));
    }
  }

  Future<void> assentar(WidgetTester tester, [int ms = 300]) async {
    await tester.runAsync(() => Future.delayed(Duration(milliseconds: ms)));
    await tester.pump(const Duration(milliseconds: 10));
  }

  Widget app(Widget home) => MaterialApp(theme: temaFans(Brightness.light), home: home);

  Map<String, dynamic> itemHome(String id, String tipo, String titulo, String data) => {
    'eventoId': id, 'tipo': tipo, 'titulo': titulo, 'data': data, 'hora': '19:00:00',
    'materiaSigla': 'BD', 'materiaCorHex': '#1D4ED8',
    'autoria': {'autorId': 'u1', 'autorNome': 'Ana', 'autorSelo': null, 'criadoEm': '2026-10-20T13:00:00Z',
      'atualizadoEm': null, 'editadoPorNome': null, 'editadoPorSelo': null},
    'feitoPeloUsuario': false,
  };

  http.Response json(Object corpo, int status) => http.Response(
    jsonEncode(corpo), status, headers: {'content-type': 'application/json; charset=utf-8'});

  RascunhoEvento rascunho() => RascunhoEvento(
    materiaId: 'm1', materiaSigla: 'BD', materiaCorHex: '#1D4ED8', tipo: TipoEvento.prova,
    titulo: 'Prova 3', data: DateTime(2026, 11, 5), criadoEm: DateTime(2026, 10, 22, 10));

  final sessaoU1 = Sessao(jwt: 'jwt-a', usuario: Usuario(id: 'u1', nome: 'Ana', email: 'a@x.com'), turmaId: 't1');

  Map<String, dynamic> eventoCriado() => {
    'id': 'novo', 'tipo': 'PROVA', 'titulo': 'Prova 3', 'data': '2026-11-05', 'hora': null, 'sala': null,
    'materiaId': 'm1', 'materiaSigla': 'BD', 'materiaCorHex': '#1D4ED8',
    'autoria': itemHome('x', 'PROVA', 't', '2026-11-05')['autoria'],
    'version': 0, 'visivelTurma': true, 'excluidoEm': null,
  };

  // ---- B3: pré-carga de matérias ----
  testWidgets('Home online pré-carrega as matérias no cache', (tester) async {
    final deps = await montarDeps(tester, (req) async {
      if (req.url.path.endsWith('/materias')) return json([_materiaJson], 200);
      return json([], 200);
    });
    await tester.pumpWidget(app(HomePage(deps: deps, aoSair: () {}, aoMudarTema: (_) {})));
    await esperarQue(tester, () => find.text('Nada nos próximos 14 dias.').evaluate().isNotEmpty);
    await assentar(tester);
    final cache = await tester.runAsync(() => deps.materias.listar());
    expect(cache, hasLength(1));
  });

  // ---- B5: Home recarrega ao voltar de qualquer tela ----
  testWidgets('voltar de Configurações recarrega a Home', (tester) async {
    var homes = 0;
    final deps = await montarDeps(tester, (req) async {
      if (req.url.path.endsWith('/home')) { homes++; return json([], 200); }
      return json([], 200);
    });
    await tester.pumpWidget(app(HomePage(deps: deps, aoSair: () {}, aoMudarTema: (_) {})));
    await esperarQue(tester, () => homes >= 1);
    await assentar(tester);
    expect(homes, 1);
    await tester.tap(find.byTooltip('Configurações'));
    await tester.pumpAndSettle();
    await tester.pageBack();
    await tester.pumpAndSettle();
    await esperarQue(tester, () => homes >= 2);
    expect(homes, 2);
  });

  // ---- Home sincroniza ao carregar online ----
  testWidgets('Home online envia o rascunho pendente e zera o contador', (tester) async {
    var posts = 0;
    final deps = await montarDeps(tester, (req) async {
      if (req.method == 'POST') { posts++; return json(eventoCriado(), 201); }
      return json([], 200);
    });
    await tester.runAsync(() => deps.rascunhos.inserir(rascunho()));
    await tester.pumpWidget(app(HomePage(deps: deps, aoSair: () {}, aoMudarTema: (_) {})));
    await esperarQue(tester, () => find.text('Nada nos próximos 14 dias.').evaluate().isNotEmpty);
    await assentar(tester);
    expect(posts, 1);
    expect(find.textContaining('aguardando envio'), findsNothing);
  });

  // ---- NOVO: a lista exibida é anterior ao envio ----
  testWidgets('depois do sync ao carregar, o evento enviado aparece na Home', (tester) async {
    var criado = false;
    final deps = await montarDeps(tester, (req) async {
      if (req.method == 'POST') { criado = true; return json(eventoCriado(), 201); }
      if (req.url.path.endsWith('/home')) {
        return json(criado ? [itemHome('novo', 'PROVA', 'Prova 3', '2026-11-05')] : [], 200);
      }
      return json([], 200);
    });
    await tester.runAsync(() => deps.rascunhos.inserir(rascunho()));
    await tester.pumpWidget(app(HomePage(deps: deps, aoSair: () {}, aoMudarTema: (_) {})));
    await esperarQue(tester, () => criado);
    await assentar(tester, 500);
    expect(criado, isTrue);
    expect(find.text('Prova 3'), findsOneWidget,
        reason: 'o evento foi criado no servidor, mas a lista na tela é de antes do envio');
  });

  // ---- 401 durante o sync ao carregar ----
  testWidgets('401 no envio ao carregar leva à sessão expirada e mantém a fila', (tester) async {
    final deps = await montarDeps(tester, (req) async {
      if (req.method == 'POST') return json({'status': 401}, 401);
      return json([], 200);
    });
    await tester.runAsync(() => deps.rascunhos.inserir(rascunho()));
    var expirou = 0;
    await tester.pumpWidget(app(HomePage(deps: deps, aoSair: () {}, aoSessaoExpirar: () { expirou++; }, aoMudarTema: (_) {})));
    await esperarQue(tester, () => expirou > 0);
    expect(expirou, 1);
    expect(await tester.runAsync(() => deps.rascunhos.listarPendentes()), hasLength(1));
  });

  // ---- RISCO (a): duas tentativas por toque ----
  testWidgets('um toque em sincronizar com rascunho preso em 400 faz um POST só', (tester) async {
    var posts = 0;
    final deps = await montarDeps(tester, (req) async {
      if (req.method == 'POST') { posts++; return json({'status': 400, 'detail': 'Título inválido'}, 400); }
      return json([], 200);
    });
    await tester.runAsync(() => deps.rascunhos.inserir(rascunho()));
    await tester.pumpWidget(app(HomePage(deps: deps, aoSair: () {}, aoMudarTema: (_) {})));
    await esperarQue(tester, () => posts >= 1);
    await assentar(tester, 500);
    final antes = posts;
    await tester.tap(find.byTooltip(RegExp('^Sincronizar')));
    await assentar(tester, 800);
    expect(posts - antes, 1, reason: 'um toque deveria ser uma tentativa');
  });

  // ---- spinner + trava do sync manual ----
  testWidgets('durante o sync manual o botão fica travado e mostra spinner', (tester) async {
    final liberar = Completer<void>();
    var primeiraCarga = true;
    final deps = await montarDeps(tester, (req) async {
      if (req.method == 'POST') {
        if (!primeiraCarga) { await liberar.future; }
        return json(eventoCriado(), 201);
      }
      return json([], 200);
    });
    await tester.pumpWidget(app(HomePage(deps: deps, aoSair: () {}, aoMudarTema: (_) {})));
    await esperarQue(tester, () => find.text('Nada nos próximos 14 dias.').evaluate().isNotEmpty);
    await assentar(tester);
    primeiraCarga = false;
    await tester.runAsync(() => deps.rascunhos.inserir(rascunho()));
    await tester.tap(find.byTooltip(RegExp('^Sincronizar')));
    await tester.pump();
    await assentar(tester, 100);
    final botao = tester.widget<IconButton>(find.ancestor(of: find.byType(CircularProgressIndicator), matching: find.byType(IconButton)));
    expect(botao.onPressed, isNull);
    expect(find.descendant(of: find.byType(AppBar), matching: find.byType(CircularProgressIndicator)), findsOneWidget);
    liberar.complete();
    await assentar(tester, 500);
  });

  // ---- B2c: fail-closed sem dono ----
  testWidgets('login sem dono gravado apaga a fila (falha fechado)', (tester) async {
    final deps = await montarDeps(tester, (req) async {
      if (req.url.path.endsWith('/auth/login')) {
        return json({'jwt': 'jwt-b', 'usuario': {'id': 'u2', 'nome': 'Bia', 'email': 'b@x.com', 'tipoConta': 'ALUNO', 'docenteStatus': null}, 'turmaId': 't1'}, 200);
      }
      return json([], 200);
    });
    await tester.runAsync(() => deps.rascunhos.inserir(rascunho()));
    await tester.pumpWidget(fans.FansLabApp(deps: deps));
    await tester.enterText(find.byType(TextFormField).at(0), 'b@x.com');
    await tester.enterText(find.byType(TextFormField).at(1), 'senha123');
    await tester.tap(find.text('Entrar'));
    await esperarQue(tester, () => find.byType(HomePage).evaluate().isNotEmpty);
    expect(await tester.runAsync(() => deps.rascunhos.listarPendentes()), isEmpty);
  });

  // ---- B2: mesma conta volta e mantém a fila (integração) ----
  testWidgets('mesma conta entra de novo depois do 401 e a fila continua', (tester) async {
    var logou = false;
    final deps = await montarDeps(tester, (req) async {
      if (req.url.path.endsWith('/auth/login')) {
        logou = true;
        return json({'jwt': 'jwt-a2', 'usuario': {'id': 'u1', 'nome': 'Ana', 'email': 'a@x.com', 'tipoConta': 'ALUNO', 'docenteStatus': null}, 'turmaId': 't1'}, 200);
      }
      if (req.method == 'POST') return json({'status': 400, 'detail': 'preso'}, 400); // mantém pendente
      if (!logou) return json({'status': 401}, 401);
      return json([], 200);
    });
    await tester.runAsync(() async {
      await deps.sessao.salvar(sessaoU1);
      await deps.rascunhos.inserir(rascunho());
    });
    await tester.pumpWidget(fans.FansLabApp(deps: deps, sessaoInicial: sessaoU1));
    await esperarQue(tester, () => find.byType(LoginPage).evaluate().isNotEmpty);
    expect(find.byType(LoginPage), findsOneWidget);
    await tester.enterText(find.byType(TextFormField).at(0), 'a@x.com');
    await tester.enterText(find.byType(TextFormField).at(1), 'senha123');
    await tester.tap(find.text('Entrar'));
    await esperarQue(tester, () => find.byType(HomePage).evaluate().isNotEmpty);
    await assentar(tester, 500);
    expect(await tester.runAsync(() => deps.rascunhos.listarPendentes()), hasLength(1));
  });

  // ---- B1 (detalhe): voltar durante o DELETE não derruba a rota de baixo ----
  testWidgets('excluir e voltar no meio: a rota de baixo continua na tela', (tester) async {
    final liberar = Completer<void>();
    final deps = await montarDeps(tester, (req) async {
      if (req.url.path.endsWith('/eventos/e1') && req.method == 'DELETE') {
        await liberar.future;
        return http.Response('', 204);
      }
      if (req.url.path.endsWith('/eventos/e1')) {
        return json({
          ...eventoCriado(), 'id': 'e1', 'materiais': <dynamic>[],
          'autoria': {...(eventoCriado()['autoria'] as Map<String, dynamic>), 'autorId': 'u1'},
        }, 200);
      }
      return http.Response('', 404);
    });
    await tester.runAsync(() => deps.sessao.salvar(sessaoU1));
    await tester.pumpWidget(MaterialApp(theme: temaFans(Brightness.light), home: const Scaffold(body: Center(child: Text('Rota base')))));
    Navigator.of(tester.element(find.text('Rota base'))).push(MaterialPageRoute(builder: (_) => EventoDetalhePage(deps: deps, eventoId: 'e1')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    await assentar(tester);
    await tester.ensureVisible(find.text('Excluir'));
    await tester.tap(find.text('Excluir'));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Excluir')));
    await tester.pump(const Duration(milliseconds: 300));
    // volta com o DELETE no ar
    Navigator.of(tester.element(find.byType(EventoDetalhePage))).pop();
    await tester.pump();
    liberar.complete();
    await assentar(tester, 500);
    await tester.pump(const Duration(seconds: 1));
    expect(find.byType(EventoDetalhePage), findsNothing);
    expect(find.text('Rota base'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  // ---- NOVO: Sair (Configurações) dispara um reload da Home que vira "Sessão expirada" ----
  testWidgets('Sair pelas Configurações não mostra "Sessão expirada"', (tester) async {
    final deps = await montarDeps(tester, (req) async {
      if (req.headers['Authorization'] == null) return json({'status': 401}, 401);
      return json([], 200);
    });
    deps.api.token = 'jwt-a';
    await tester.runAsync(() => deps.sessao.salvar(sessaoU1));
    await tester.pumpWidget(fans.FansLabApp(deps: deps, sessaoInicial: sessaoU1));
    await esperarQue(tester, () => find.text('Nada nos próximos 14 dias.').evaluate().isNotEmpty);
    await assentar(tester);
    await tester.tap(find.byTooltip('Configurações'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sair'));
    await tester.pumpAndSettle();
    await tester.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Sair')));
    await esperarQue(tester, () => find.byType(LoginPage).evaluate().isNotEmpty);
    await assentar(tester, 500);
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.byType(LoginPage), findsOneWidget);
    expect(find.text('Sessão expirada. Entre de novo.'), findsNothing);
  });

  // ---- risco (c): 401 no Detalhe leva ao login ao voltar? ----
  testWidgets('401 no Detalhe: ao voltar, a Home recarrega e chama aoSessaoExpirar', (tester) async {
    var homes = 0;
    final deps = await montarDeps(tester, (req) async {
      if (req.url.path.endsWith('/home')) {
        homes++;
        return homes == 1 ? json([itemHome('e1', 'PROVA', 'Prova 2', '2026-10-29')], 200) : json({'status': 401}, 401);
      }
      return json({'status': 401}, 401);
    });
    var expirou = 0;
    await tester.pumpWidget(app(HomePage(deps: deps, aoSair: () {}, aoSessaoExpirar: () { expirou++; }, aoMudarTema: (_) {})));
    await esperarQue(tester, () => find.text('Prova 2').evaluate().isNotEmpty);
    await tester.tap(find.text('Prova 2'));
    await tester.pumpAndSettle();
    await assentar(tester);
    expect(find.text('Sessão expirada — volte e entre de novo.'), findsOneWidget);
    expect(expirou, 0);
    await tester.pageBack();
    await tester.pumpAndSettle();
    await esperarQue(tester, () => expirou > 0);
    expect(expirou, 1);
  });
}
