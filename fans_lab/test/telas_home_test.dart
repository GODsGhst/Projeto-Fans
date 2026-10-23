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

  // Espera uma condição sem pumpAndSettle (o spinner nunca assenta).
  Future<void> esperarQue(WidgetTester tester, bool Function() condicao) async {
    for (var i = 0; i < 200 && !condicao(); i++) {
      await tester.runAsync(() => Future.delayed(const Duration(milliseconds: 10)));
      await tester.pump(const Duration(milliseconds: 10));
    }
  }

  Future<void> esperarAparecer(WidgetTester tester, Finder f) =>
      esperarQue(tester, () => f.evaluate().isNotEmpty);

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

  RascunhoEvento rascunho() => RascunhoEvento(
    materiaId: 'm1',
    materiaSigla: 'BD',
    materiaCorHex: '#1D4ED8',
    tipo: TipoEvento.prova,
    titulo: 'Prova 3',
    data: DateTime(2026, 11, 5),
    criadoEm: DateTime(2026, 10, 22, 10),
  );

  final sessaoU1 = Sessao(
    jwt: 'jwt-a',
    usuario: Usuario(id: 'u1', nome: 'Ana', email: 'a@x.com'),
    turmaId: 't1',
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

  testWidgets('401 chama aoSessaoExpirar e o rascunho continua no banco', (tester) async {
    final deps = await montarDeps(tester, (_) async => json({'status': 401}, 401));
    await tester.runAsync(() => deps.rascunhos.inserir(rascunho()));
    var expirou = 0;
    var saiu = 0;
    await tester.pumpWidget(
      app(
        HomePage(
          deps: deps,
          aoSair: () { saiu++; },
          aoSessaoExpirar: () { expirou++; },
          aoMudarTema: (_) {},
        ),
      ),
    );
    await esperarQue(tester, () => expirou > 0);

    expect(expirou, 1);
    expect(saiu, 0);
    expect(await tester.runAsync(() => deps.rascunhos.listarPendentes()), hasLength(1));
  });

  testWidgets('401 na app volta ao login e não apaga a fila', (tester) async {
    // Passa pelo FansLabApp de verdade: é ali que o 401 apaga (ou não) a fila.
    final deps = await montarDeps(tester, (_) async => json({'status': 401}, 401));
    await tester.runAsync(() => deps.rascunhos.inserir(rascunho()));
    await tester.pumpWidget(fans.FansLabApp(deps: deps, sessaoInicial: sessaoU1));
    await esperarQue(tester, () => find.byType(LoginPage).evaluate().isNotEmpty);

    expect(find.byType(LoginPage), findsOneWidget);
    expect(await tester.runAsync(() => deps.rascunhos.listarPendentes()), hasLength(1));
  });

  testWidgets('entrar com outra conta apaga a fila de quem saiu', (tester) async {
    final deps = await montarDeps(tester, (req) async {
      if (req.url.path.endsWith('/auth/login')) {
        return json({
          'jwt': 'jwt-b',
          'usuario': {
            'id': 'u2',
            'nome': 'Bia',
            'email': 'b@x.com',
            'tipoConta': 'ALUNO',
            'docenteStatus': null,
          },
          'turmaId': 't1',
        }, 200);
      }
      return json([], 200);
    });
    // A conta u1 deixou um rascunho e a sessão expirou.
    await tester.runAsync(() async {
      await deps.sessao.salvar(sessaoU1);
      await deps.sessao.limpar();
      await deps.rascunhos.inserir(rascunho());
    });
    await tester.pumpWidget(fans.FansLabApp(deps: deps));

    await tester.enterText(find.byType(TextFormField).at(0), 'b@x.com');
    await tester.enterText(find.byType(TextFormField).at(1), 'senha123');
    await tester.tap(find.text('Entrar'));
    await esperarQue(tester, () => find.byType(HomePage).evaluate().isNotEmpty);

    expect(find.byType(HomePage), findsOneWidget);
    expect(await tester.runAsync(() => deps.rascunhos.listarPendentes()), isEmpty);
  });

  testWidgets('dado salvo que não lê mostra erro, nunca spinner', (tester) async {
    final deps = await montarDeps(tester, (req) async {
      if (!req.url.path.endsWith('/home')) return json({'status': 404}, 404);
      // Mesmo eventoId duas vezes quebra a chave única do cache depois do 200.
      return json([
        itemHome('e1', 'PROVA', 'Prova 2', '2026-10-29'),
        itemHome('e1', 'ENTREGA', 'Lista 4', '2026-10-21'),
      ], 200);
    });
    await tester.pumpWidget(
      app(HomePage(deps: deps, aoSair: () {}, aoMudarTema: (_) {})),
    );
    const erro = 'Não foi possível ler os dados salvos no aparelho.';
    await esperarAparecer(tester, find.text(erro));

    expect(find.text(erro), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  testWidgets('login com fonte 2x em 360 dp: título sem quebra e sem exceção', (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final deps = await montarDeps(tester, (_) async => json({}, 200));
    await tester.pumpWidget(
      MaterialApp(
        theme: temaFans(Brightness.light),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaler: const TextScaler.linear(2.0)),
          child: child!,
        ),
        home: LoginPage(deps: deps, aoEntrar: (_) {}),
      ),
    );
    await tester.pump();

    expect(tester.takeException(), isNull);
    expect(find.text('projetoFans'), findsOneWidget);
    // Sem FittedBox acima, o título quebra em duas linhas ("projetoFan" / "s").
    expect(
      find.ancestor(of: find.text('projetoFans'), matching: find.byType(FittedBox)),
      findsOneWidget,
    );
  });

  testWidgets('home com 1 pendente: sincronizar diz quantos aguardam envio', (tester) async {
    final deps = await montarDeps(tester, (req) async {
      // Sem rede no envio: o rascunho continua pendente e a contagem fica em 1.
      if (req.method == 'POST') throw http.ClientException('sem rede');
      return json([], 200);
    });
    await tester.runAsync(() => deps.rascunhos.inserir(rascunho()));
    await tester.pumpWidget(
      app(HomePage(deps: deps, aoSair: () {}, aoMudarTema: (_) {})),
    );
    await esperarAparecer(
      tester,
      find.byTooltip('Sincronizar (1 aguardando envio)'),
    );

    expect(find.byTooltip('Sincronizar (1 aguardando envio)'), findsOneWidget);
    expect(find.byTooltip('Sincronizar'), findsNothing);
  });
}
