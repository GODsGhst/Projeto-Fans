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
import 'package:fans_lab/models/evento.dart';
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
    // A nota de autoria empurra o Salvar para fora da área construída da lista.
    await tester.dragUntilVisible(
      find.text('Salvar'),
      find.byType(ListView),
      const Offset(0, -100),
    );
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

    await tester.dragUntilVisible(
      find.text('Salvar'),
      find.byType(ListView),
      const Offset(0, -100),
    );
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

  testWidgets(
    'salvar edição e voltar no meio: a rota de baixo continua na tela',
    (tester) async {
      final liberar = Completer<void>();
      final deps = await montarDeps(tester, (req) async {
        if (req.url.path.endsWith('/materias')) return _json([_materiaJson]);
        if (req.method == 'PATCH') {
          await liberar.future;
          return _json(_detalheJson('u1'));
        }
        return http.Response('', 404);
      });
      await tester.pumpWidget(
        MaterialApp(
          theme: temaFans(Brightness.light),
          home: const Scaffold(body: Center(child: Text('Rota base'))),
        ),
      );
      Navigator.of(tester.element(find.text('Rota base'))).push(
        MaterialPageRoute(
          builder: (_) => EventoFormPage(
            deps: deps,
            evento: Evento.fromJson(_detalheJson('u1')),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      await aguardar(tester);

      await tester.ensureVisible(find.text('Salvar'));
      await tester.tap(find.text('Salvar'));
      await tester.pump();

      // Volta com o PATCH ainda no ar; a animação não avança, então a página segue montada.
      Navigator.of(tester.element(find.byType(EventoFormPage))).pop();
      await tester.pump();
      liberar.complete();
      await aguardar(tester);
      await tester.pump(const Duration(seconds: 1));

      expect(find.byType(EventoFormPage), findsNothing);
      expect(find.text('Rota base'), findsOneWidget);
    },
  );

  testWidgets('evento sem rede: o botão de feito aparece e grava no aparelho', (
    tester,
  ) async {
    final deps = await montarDeps(tester, (req) async {
      throw http.ClientException('sem rede');
    });
    await tester.pumpWidget(
      MaterialApp(
        theme: temaFans(Brightness.light),
        home: EventoDetalhePage(deps: deps, eventoId: 'e1'),
      ),
    );
    await aguardar(tester);

    expect(find.text('Tentar de novo'), findsOneWidget);
    await tester.tap(find.text('Marcar como feito'));
    await aguardarTexto(tester, 'Salvo no aparelho');

    final pendentes = await tester.runAsync(() => deps.estado.pendentes());
    expect(pendentes, hasLength(1));
    expect(find.text('Desmarcar feito'), findsOneWidget);
  });

  testWidgets(
    'excluir: enquanto o DELETE roda, o botão fica travado e não manda outro',
    (tester) async {
      final liberar = Completer<void>();
      var deletes = 0;
      final deps = await montarDeps(tester, (req) async {
        if (req.url.path.endsWith('/eventos/e1') && req.method == 'DELETE') {
          deletes++;
          await liberar.future;
          return http.Response('', 204);
        }
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

      await tester.ensureVisible(find.text('Excluir'));
      await tester.tap(find.text('Excluir'));
      await tester.pump(const Duration(milliseconds: 300));
      await tester.tap(
        find.descendant(
          of: find.byType(AlertDialog),
          matching: find.text('Excluir'),
        ),
      );
      await tester.pump(const Duration(milliseconds: 300));

      final botao = tester.widget<TextButton>(find.byType(TextButton));
      expect(botao.onPressed, isNull);
      expect(
        find.descendant(
          of: find.byType(TextButton),
          matching: find.byType(CircularProgressIndicator),
        ),
        findsOneWidget,
      );

      // Toque no botão travado: não abre outra confirmação nem manda outro DELETE.
      await tester.tap(find.byType(TextButton));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.byType(AlertDialog), findsNothing);

      liberar.complete();
      await aguardar(tester);
      expect(deletes, 1);
    },
  );

  testWidgets(
    'marcar feito: página fechada no meio do salvamento não dá erro',
    (tester) async {
      // O banco abre com atraso de relógio simulado: o salvamento fica pendente
      // até o teste avançar o tempo, e aí a página já saiu da árvore.
      SharedPreferences.setMockInitialValues({});
      final db = (await tester.runAsync(() => AppDatabase.abrirEmMemoria()))!;
      final deps = AppDeps.padrao(
        client: MockClient((req) async {
          if (req.url.path.endsWith('/eventos/e1')) {
            return _json(_detalheJson('u2'));
          }
          if (req.method == 'PUT') return http.Response('', 204);
          return http.Response('', 404);
        }),
        abrirDb: () =>
            Future.delayed(const Duration(milliseconds: 100), () => db),
        baseUrl: 'http://api',
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: temaFans(Brightness.light),
          home: EventoDetalhePage(deps: deps, eventoId: 'e1'),
        ),
      );
      await aguardar(tester);

      await tester.ensureVisible(find.text('Marcar como feito'));
      await tester.tap(find.text('Marcar como feito'));
      await tester.pumpWidget(const MaterialApp(home: SizedBox()));
      await tester.pump(const Duration(milliseconds: 200));
      await aguardar(tester);

      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('editar: dois toques em Salvar mandam um PATCH só', (
    tester,
  ) async {
    final liberar = Completer<void>();
    var patches = 0;
    final deps = await montarDeps(tester, (req) async {
      if (req.url.path.endsWith('/materias')) return _json([_materiaJson]);
      if (req.method == 'PATCH') {
        patches++;
        await liberar.future;
        return _json(_detalheJson('u1'));
      }
      return http.Response('', 404);
    });
    await tester.pumpWidget(
      MaterialApp(
        theme: temaFans(Brightness.light),
        home: EventoFormPage(
          deps: deps,
          evento: Evento.fromJson(_detalheJson('u1')),
        ),
      ),
    );
    await aguardar(tester);

    await tester.ensureVisible(find.text('Salvar'));
    // Sem pump entre os dois toques: o botão ainda não foi redesenhado como desabilitado.
    await tester.tap(find.text('Salvar'));
    await tester.tap(find.text('Salvar'));
    await tester.pump();
    liberar.complete();
    await aguardar(tester);

    expect(patches, 1);
  });

  testWidgets('salvar edição: enquanto o PATCH roda, o Salvar mostra spinner', (
    tester,
  ) async {
    final liberar = Completer<void>();
    final deps = await montarDeps(tester, (req) async {
      if (req.url.path.endsWith('/materias')) return _json([_materiaJson]);
      if (req.method == 'PATCH') {
        await liberar.future;
        return _json(_detalheJson('u1'));
      }
      return http.Response('', 404);
    });
    await tester.pumpWidget(
      MaterialApp(
        theme: temaFans(Brightness.light),
        home: EventoFormPage(
          deps: deps,
          evento: Evento.fromJson(_detalheJson('u1')),
        ),
      ),
    );
    await aguardar(tester);

    await tester.ensureVisible(find.text('Salvar'));
    await tester.tap(find.text('Salvar'));
    await tester.pump();

    expect(
      find.descendant(
        of: find.widgetWithText(FilledButton, 'Salvar'),
        matching: find.byType(CircularProgressIndicator),
      ),
      findsOneWidget,
    );

    liberar.complete();
    await aguardar(tester);
  });

  testWidgets('marcar feito: enquanto o envio roda, o botão mostra spinner', (
    tester,
  ) async {
    final liberar = Completer<void>();
    final deps = await montarDeps(tester, (req) async {
      if (req.method == 'PUT') {
        await liberar.future;
        return http.Response('', 204);
      }
      if (req.url.path.endsWith('/eventos/e1')) {
        return _json(_detalheJson('u2'));
      }
      return http.Response('', 404);
    });
    await tester.pumpWidget(
      MaterialApp(
        theme: temaFans(Brightness.light),
        home: EventoDetalhePage(deps: deps, eventoId: 'e1'),
      ),
    );
    await aguardar(tester);

    await tester.ensureVisible(find.text('Marcar como feito'));
    await tester.tap(find.text('Marcar como feito'));
    // marcarLocal é I/O real: deixa o tempo passar até o PUT ficar preso.
    await aguardar(tester);

    expect(
      find.ancestor(
        of: find.byType(CircularProgressIndicator),
        matching: find.byType(FilledButton),
      ),
      findsOneWidget,
    );

    liberar.complete();
    await aguardar(tester);
  });

  testWidgets('fila: Sincronizar agora mostra spinner enquanto o envio roda', (
    tester,
  ) async {
    final liberar = Completer<void>();
    final deps = await montarDeps(tester, (req) async {
      if (req.method == 'POST') {
        await liberar.future;
        return http.Response(
          jsonEncode({'status': 400, 'detail': 'Título inválido'}),
          400,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }
      return http.Response('', 404);
    });
    await tester.runAsync(
      () => deps.rascunhos.inserir(
        RascunhoEvento(
          materiaId: 'm1',
          materiaSigla: 'BD',
          materiaCorHex: '#1D4ED8',
          tipo: TipoEvento.prova,
          titulo: 'Prova 3',
          data: DateTime(2026, 10, 25),
          criadoEm: DateTime(2026, 10, 20),
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

    await tester.tap(find.text('Sincronizar agora'));
    await aguardar(tester);

    expect(
      find.ancestor(
        of: find.byType(CircularProgressIndicator),
        matching: find.byType(FilledButton),
      ),
      findsOneWidget,
    );

    liberar.complete();
    await aguardar(tester);
  });

  testWidgets('selo do tipo: prova é bloco sólido, entrega é contorno', (
    tester,
  ) async {
    final cores = CoresFans.claro;
    BoxDecoration decoracaoDo(WidgetTester t, String texto) {
      final caixa = find.ancestor(
        of: find.text(texto),
        matching: find.byWidgetPredicate(
          (w) => w is Container && w.decoration is BoxDecoration,
        ),
      );
      return (t.widget<Container>(caixa.first).decoration as BoxDecoration);
    }

    final depsProva = await montarDeps(
      tester,
      (req) async => _json(_detalheJson('u2')),
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: temaFans(Brightness.light),
        home: EventoDetalhePage(deps: depsProva, eventoId: 'e1'),
      ),
    );
    await aguardar(tester);
    expect(tester.widget<Text>(find.text('Prova')).style?.color, cores.provaFg);
    expect(decoracaoDo(tester, 'Prova').color, cores.provaBg);

    await tester.pumpWidget(const SizedBox());
    final depsEntrega = await montarDeps(
      tester,
      (req) async => _json({..._detalheJson('u2'), 'tipo': 'ENTREGA'}),
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: temaFans(Brightness.light),
        home: EventoDetalhePage(deps: depsEntrega, eventoId: 'e1'),
      ),
    );
    await aguardar(tester);
    expect(tester.widget<Text>(find.text('Entrega')).style?.color, cores.ink);
    final contorno = decoracaoDo(tester, 'Entrega');
    expect(contorno.color, isNull);
    final lado = (contorno.border as Border).top;
    expect(lado.color, cores.ink3);
    expect(lado.width, 1);
  });

  testWidgets('materiais sem link mostram o tipo em português', (tester) async {
    Map<String, dynamic> material(String id, String tipo, String titulo) => {
      'id': id,
      'tipo': tipo,
      'titulo': titulo,
      'url': null,
      'dataAula': null,
      'autoria': _autoria('u2'),
    };
    final deps = await montarDeps(tester, (req) async {
      return _json({
        ..._detalheJson('u2'),
        'materiais': [
          material('a1', 'AULA', 'Aula 4'),
          material('a2', 'ADICIONAL', 'Lista extra'),
        ],
      });
    });
    await tester.pumpWidget(
      MaterialApp(
        theme: temaFans(Brightness.light),
        home: EventoDetalhePage(deps: deps, eventoId: 'e1'),
      ),
    );
    await aguardar(tester);

    expect(find.textContaining('Aula\n'), findsOneWidget);
    expect(find.textContaining('Material adicional\n'), findsOneWidget);
  });

  testWidgets('editar: matéria que sumiu da lista pede outra escolha', (
    tester,
  ) async {
    final deps = await montarDeps(tester, (req) async {
      if (req.url.path.endsWith('/materias')) return _json([_materiaJson]);
      return http.Response('', 404);
    });
    await tester.pumpWidget(
      MaterialApp(
        theme: temaFans(Brightness.light),
        home: EventoFormPage(
          deps: deps,
          evento: Evento.fromJson({..._detalheJson('u1'), 'materiaId': 'm9'}),
        ),
      ),
    );
    await aguardar(tester);

    expect(
      find.text(
        'A matéria original (BD) não está mais disponível — escolha outra.',
      ),
      findsOneWidget,
    );
    // A linha de aviso empurra o Salvar para fora da área já construída da lista.
    await tester.dragUntilVisible(
      find.text('Salvar'),
      find.byType(ListView),
      const Offset(0, -100),
    );
    await tester.tap(find.text('Salvar'));
    await tester.pump();
    expect(find.text('Escolha a matéria'), findsOneWidget);
  });

  testWidgets(
    'rascunho com matéria que sumiu: pede outra escolha com a sigla',
    (tester) async {
      final deps = await montarDeps(tester, (req) async {
        if (req.url.path.endsWith('/materias')) return _json([_materiaJson]);
        return http.Response('', 404);
      });
      await tester.pumpWidget(
        MaterialApp(
          theme: temaFans(Brightness.light),
          home: EventoFormPage(
            deps: deps,
            rascunho: RascunhoEvento(
              materiaId: 'm9',
              materiaSigla: 'FIS',
              materiaCorHex: '#B45309',
              tipo: TipoEvento.entrega,
              titulo: 'Lista 4',
              data: DateTime(2026, 10, 25),
              criadoEm: DateTime(2026, 10, 20),
            ),
          ),
        ),
      );
      await aguardar(tester);

      expect(
        find.text(
          'A matéria original (FIS) não está mais disponível — escolha outra.',
        ),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'evento excluído, do próprio autor: avisa e esconde Editar, Excluir e feito',
    (tester) async {
      final deps = await montarDeps(tester, (req) async {
        if (req.url.path.endsWith('/eventos/e1')) {
          return _json({
            ..._detalheJson('u1'),
            'excluidoEm': '2026-10-21T10:00:00Z',
          });
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

      expect(find.text('Prova 2'), findsOneWidget);
      expect(
        find.text(
          'Você excluiu este evento — ele não aparece mais para a turma.',
        ),
        findsOneWidget,
      );
      expect(find.text('Editar'), findsNothing);
      expect(find.text('Excluir'), findsNothing);
      expect(find.text('Marcar como feito'), findsNothing);
    },
  );

  testWidgets(
    'evento oculto pelo líder: o autor vê o aviso e continua podendo editar',
    (tester) async {
      final deps = await montarDeps(tester, (req) async {
        if (req.url.path.endsWith('/eventos/e1')) {
          return _json({..._detalheJson('u1'), 'visivelTurma': false});
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

      expect(find.text('Prova 2'), findsOneWidget);
      expect(
        find.text('Oculto pelo líder da turma — só você está vendo.'),
        findsOneWidget,
      );
      expect(find.text('Editar'), findsOneWidget);
      expect(find.text('Excluir'), findsOneWidget);
      expect(find.text('Marcar como feito'), findsOneWidget);
    },
  );

  testWidgets('evento de outra pessoa: diz quem pode editar ou apagar', (
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

    expect(find.text('Só Ana edita ou apaga este registro.'), findsOneWidget);
    expect(find.text('Marcar como feito'), findsOneWidget);
  });

  testWidgets('evento do próprio usuário: não há aviso de quem edita', (
    tester,
  ) async {
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
    expect(find.textContaining('edita ou apaga'), findsNothing);
  });

  testWidgets(
    'diálogo de excluir: Cancelar é o principal; Excluir é secundário em cor de erro',
    (tester) async {
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

      await tester.ensureVisible(find.text('Excluir'));
      await tester.tap(find.text('Excluir'));
      await tester.pump(const Duration(milliseconds: 300));

      final dialogo = find.byType(AlertDialog);
      expect(
        find.descendant(
          of: dialogo,
          matching: find.text('Ele some para a turma inteira.'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: dialogo,
          matching: find.text('Não dá para desfazer.'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: dialogo,
          matching: find.widgetWithText(FilledButton, 'Cancelar'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: dialogo,
          matching: find.widgetWithText(FilledButton, 'Excluir'),
        ),
        findsNothing,
      );
      final excluir = tester.widget<TextButton>(
        find.descendant(
          of: dialogo,
          matching: find.widgetWithText(TextButton, 'Excluir'),
        ),
      );
      expect(
        excluir.style?.foregroundColor?.resolve({}),
        temaFans(Brightness.light).colorScheme.error,
      );
    },
  );

  testWidgets(
    'servidor fora do ar (503) no detalhe: oferece marcar feito offline',
    (tester) async {
      final deps = await montarDeps(tester, (req) async {
        return http.Response('', 503);
      });
      await tester.pumpWidget(
        MaterialApp(
          theme: temaFans(Brightness.light),
          home: EventoDetalhePage(deps: deps, eventoId: 'e1'),
        ),
      );
      await aguardar(tester);

      expect(find.text('Tentar de novo'), findsOneWidget);
      expect(find.text('Marcar como feito'), findsOneWidget);
    },
  );

  testWidgets('formulário novo: a nota de autoria aparece antes de Salvar', (
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

    final nota = find.text(
      'Vai aparecer para a turma toda com o seu nome. Só você pode editar ou apagar depois.',
    );
    await tester.dragUntilVisible(
      find.text('Salvar'),
      find.byType(ListView),
      const Offset(0, -100),
    );
    expect(nota, findsOneWidget);
    expect(
      tester.getTopLeft(nota).dy,
      lessThan(tester.getTopLeft(find.text('Salvar')).dy),
    );
  });

  testWidgets(
    'editar evento: a nota de autoria do formulário novo não aparece',
    (tester) async {
      final deps = await montarDeps(tester, (req) async {
        if (req.url.path.endsWith('/materias')) return _json([_materiaJson]);
        return http.Response('', 404);
      });
      await tester.pumpWidget(
        MaterialApp(
          theme: temaFans(Brightness.light),
          home: EventoFormPage(
            deps: deps,
            evento: Evento.fromJson(_detalheJson('u1')),
          ),
        ),
      );
      await aguardar(tester);

      expect(find.text('Salvar'), findsOneWidget);
      expect(
        find.textContaining('Vai aparecer para a turma toda'),
        findsNothing,
      );
    },
  );
}
