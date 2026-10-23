import 'dart:async';
import 'dart:convert';

import 'package:fans_lab/app_deps.dart';
import 'package:fans_lab/database/app_database.dart';
import 'package:fans_lab/models/rascunho_evento.dart';
import 'package:fans_lab/models/tipo_evento.dart';
import 'package:fans_lab/services/api_exception.dart';
import 'package:fans_lab/services/sync_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

typedef _Handler = Future<http.Response> Function(http.Request request);

final _autoria = <String, dynamic>{
  'autorId': 'a0000000-0000-4000-8000-000000000001',
  'autorNome': 'Ana',
  'autorSelo': null,
  'criadoEm': '2026-10-20T13:00:00Z',
  'atualizadoEm': null,
  'editadoPorNome': null,
  'editadoPorSelo': null,
};

Map<String, dynamic> _item(String id, {bool feito = false}) => {
  'eventoId': id,
  'tipo': 'PROVA',
  'titulo': 'Prova $id',
  'data': '2026-10-25',
  'hora': '19:00:00',
  'materiaSigla': 'BD',
  'materiaCorHex': '#1D4ED8',
  'autoria': _autoria,
  'feitoPeloUsuario': feito,
};

Map<String, dynamic> _evento(String id, String titulo) => {
  'id': id,
  'tipo': 'PROVA',
  'titulo': titulo,
  'data': '2026-10-25',
  'hora': null,
  'sala': null,
  'materiaId': 'm1',
  'materiaSigla': 'BD',
  'materiaCorHex': '#1D4ED8',
  'autoria': _autoria,
  'version': 1,
  'visivelTurma': true,
  'excluidoEm': null,
};

Map<String, dynamic> _problema(int status, String detalhe) => {
  'type': 'about:blank',
  'title': 'Erro',
  'status': status,
  'detail': detalhe,
};

Map<String, dynamic> _materiaJson(String id, String sigla) => {
  'id': id,
  'nome': 'Matéria $sigla',
  'sigla': sigla,
  'corHex': '#1D4ED8',
  'sala': null,
  'professor': null,
};

http.Response _json(Object corpo, [int status = 200]) => http.Response.bytes(
  utf8.encode(jsonEncode(corpo)),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

Future<AppDeps> _montar(_Handler handler) async {
  SharedPreferences.setMockInitialValues({});
  final db = await AppDatabase.abrirEmMemoria();
  return AppDeps.padrao(
    client: MockClient(handler),
    abrirDb: () async => db,
    baseUrl: 'http://api',
  );
}

RascunhoEvento _rascunho(String titulo) => RascunhoEvento(
  materiaId: 'm1',
  materiaSigla: 'BD',
  materiaCorHex: '#1D4ED8',
  tipo: TipoEvento.prova,
  titulo: titulo,
  data: DateTime(2026, 10, 25),
  criadoEm: DateTime.utc(2026, 10, 22),
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
  });

  group('HomeService', () {
    test('carregar online devolve a ordem do servidor e grava o cache', () async {
      final deps = await _montar(
        (req) async => switch ('${req.method} ${req.url.path}') {
          'GET /home' => _json([_item('A'), _item('B'), _item('C')]),
          _ => throw StateError('rota inesperada: ${req.method} ${req.url}'),
        },
      );

      final r = await deps.home.carregar();

      expect(r.offline, isFalse);
      expect(r.itens.map((i) => i.eventoId), ['A', 'B', 'C']);
      final cache = await deps.homeCache.listar();
      expect(cache.map((i) => i.eventoId), ['A', 'B', 'C']);
    });

    test('sem conexão depois de um carregar online devolve o cache com offline=true', () async {
      var online = true;
      final deps = await _montar((req) async {
        if (!online) throw http.ClientException('sem rede');
        return switch ('${req.method} ${req.url.path}') {
          'GET /home' => _json([_item('A'), _item('B')]),
          _ => throw StateError('rota inesperada: ${req.method} ${req.url}'),
        };
      });
      await deps.home.carregar();
      online = false;

      final r = await deps.home.carregar();

      expect(r.offline, isTrue);
      expect(r.salvoEm, isNotNull);
      expect(r.itens.map((i) => i.eventoId), ['A', 'B']);
    });

    test('sem conexão sem nunca ter carregado lança semConexao, nunca lista vazia', () async {
      final deps = await _montar((req) async => throw http.ClientException('sem rede'));

      await expectLater(
        deps.home.carregar(),
        throwsA(isA<ApiException>().having((e) => e.semConexao, 'semConexao', isTrue)),
      );
    });

    test('401 lança naoAutorizado mesmo com cache', () async {
      var autorizado = true;
      final deps = await _montar((req) async {
        if (!autorizado) return _json(_problema(401, 'Sessão expirada'), 401);
        return _json([_item('A')]);
      });
      await deps.home.carregar();
      autorizado = false;

      await expectLater(
        deps.home.carregar(),
        throwsA(isA<ApiException>().having((e) => e.naoAutorizado, 'naoAutorizado', isTrue)),
      );
    });

    test('feito pendente local prevalece sobre o que o servidor diz', () async {
      final deps = await _montar(
        (req) async => switch ('${req.method} ${req.url.path}') {
          'GET /home' => _json([_item('A', feito: false)]),
          _ => throw StateError('rota inesperada: ${req.method} ${req.url}'),
        },
      );
      await deps.estado.marcarLocal('A', true);

      final r = await deps.home.carregar();

      expect(r.itens.single.feitoPeloUsuario, isTrue);
    });

    test('materias sem conexão devolve o cache quando ele existe', () async {
      var online = true;
      final deps = await _montar((req) async {
        if (!online) throw http.ClientException('sem rede');
        return _json([
          {'id': 'm1', 'nome': 'Banco de Dados', 'sigla': 'BD', 'corHex': '#1D4ED8', 'sala': null, 'professor': null},
        ]);
      });
      await deps.home.materias();
      online = false;

      final lista = await deps.home.materias();

      expect(lista.single.sigla, 'BD');
    });

    test('materias sem conexão e sem cache lança, nunca lista vazia', () async {
      final deps = await _montar((req) async => throw http.ClientException('sem rede'));

      await expectLater(
        deps.home.materias(),
        throwsA(isA<ApiException>().having((e) => e.semConexao, 'semConexao', isTrue)),
      );
    });

    test('materias com 503 depois de um carregamento online devolve o cache', () async {
      var servidorCaiu = false;
      final deps = await _montar((req) async {
        if (servidorCaiu) return _json(_problema(503, 'Servidor indisponível'), 503);
        return _json([_materiaJson('m1', 'BD')]);
      });
      await deps.home.materias();
      servidorCaiu = true;

      final lista = await deps.home.materias();

      expect(lista.single.sigla, 'BD');
    });

    test('materias: online e offline devolvem a mesma ordem (por sigla), mesmo se o servidor manda fora de ordem', () async {
      var online = true;
      final deps = await _montar((req) async {
        if (!online) throw http.ClientException('sem rede');
        return _json([_materiaJson('m1', 'ZZ'), _materiaJson('m2', 'AA')]);
      });

      final aoVivo = await deps.home.materias();
      online = false;
      final offline = await deps.home.materias();

      expect(aoVivo.map((m) => m.sigla), ['AA', 'ZZ']);
      expect(offline.map((m) => m.sigla), ['AA', 'ZZ']);
    });

    test('503 depois de um carregar online devolve o cache com offline=true e os mesmos itens', () async {
      var servidorCaiu = false;
      final deps = await _montar((req) async {
        if (servidorCaiu) return _json(_problema(503, 'Servidor indisponível'), 503);
        return _json([_item('A'), _item('B')]);
      });
      await deps.home.carregar();
      servidorCaiu = true;

      final r = await deps.home.carregar();

      expect(r.offline, isTrue);
      expect(r.itens.map((i) => i.eventoId), ['A', 'B']);
    });

    test('503 sem nunca ter carregado lança ApiException com status 503, nunca lista vazia', () async {
      final deps = await _montar((req) async => _json(_problema(503, 'Servidor indisponível'), 503));

      await expectLater(
        deps.home.carregar(),
        throwsA(isA<ApiException>().having((e) => e.status, 'status', 503)),
      );
    });
  });

  group('SyncService', () {
    test('sincronizar envia 2 rascunhos (201), zera pendentes e grava ultimaSincronizacao', () async {
      final deps = await _montar(
        (req) async => switch ('${req.method} ${req.url.path}') {
          'POST /eventos' => _json(_evento('novo', 'P'), 201),
          _ => throw StateError('rota inesperada: ${req.method} ${req.url}'),
        },
      );
      await deps.rascunhos.inserir(_rascunho('P1'));
      await deps.rascunhos.inserir(_rascunho('P2'));

      final r = await deps.sync.sincronizar();

      expect(r.enviados, 2);
      expect(r.pendentes, 0);
      expect(r.semConexao, isFalse);
      expect(await deps.sessao.ultimaSincronizacao(), isNotNull);
    });

    test('sem conexão: rascunhos seguem pendentes e sem ultimoErro', () async {
      final deps = await _montar((req) async => throw http.ClientException('sem rede'));
      await deps.rascunhos.inserir(_rascunho('P1'));
      await deps.rascunhos.inserir(_rascunho('P2'));

      final r = await deps.sync.sincronizar();

      expect(r.semConexao, isTrue);
      expect(r.pendentes, 2);
      final pendentes = await deps.rascunhos.listarPendentes();
      expect(pendentes, hasLength(2));
      expect(pendentes.every((x) => x.ultimoErro == null), isTrue);
    });

    test('400 no 1º rascunho: conta erro, guarda ultimoErro e envia o 2º', () async {
      final deps = await _montar((req) async {
        final corpo = jsonDecode(req.body) as Map<String, dynamic>;
        if (corpo['titulo'] == 'P1') {
          return _json(_problema(400, 'Título inválido'), 400);
        }
        return _json(_evento('novo', 'P2'), 201);
      });
      await deps.rascunhos.inserir(_rascunho('P1'));
      await deps.rascunhos.inserir(_rascunho('P2'));

      final r = await deps.sync.sincronizar();

      expect(r.comErro, 1);
      expect(r.enviados, 1);
      final pendentes = await deps.rascunhos.listarPendentes();
      expect(pendentes.single.titulo, 'P1');
      expect(pendentes.single.ultimoErro, isNotNull);
    });

    test('401 no envio lança naoAutorizado', () async {
      final deps = await _montar((req) async => _json(_problema(401, 'Sessão expirada'), 401));
      await deps.rascunhos.inserir(_rascunho('P1'));

      await expectLater(
        deps.sync.sincronizar(),
        throwsA(isA<ApiException>().having((e) => e.naoAutorizado, 'naoAutorizado', isTrue)),
      );
    });

    test('feito pendente vai em PUT /eventos/<id>/estado-pessoal com {"feito": true}', () async {
      http.Request? enviado;
      final deps = await _montar((req) async {
        enviado = req;
        return http.Response('', 204);
      });
      await deps.estado.marcarLocal('e1', true);

      final r = await deps.sync.sincronizar();

      expect(enviado!.method, 'PUT');
      expect(enviado!.url.path, '/eventos/e1/estado-pessoal');
      expect(jsonDecode(enviado!.body), {'feito': true});
      expect(r.enviados, 1);
      expect(r.pendentes, 0);
    });

    test('feito pendente com 404 do servidor é descartado e conta erro', () async {
      final deps = await _montar((req) async => _json(_problema(404, 'Evento não encontrado'), 404));
      await deps.estado.marcarLocal('e1', true);

      final r = await deps.sync.sincronizar();

      expect(r.comErro, 1);
      expect(await deps.estado.pendentes(), isEmpty);
    });

    test('duas chamadas simultâneas de sincronizar() fazem exatamente 2 POSTs', () async {
      var posts = 0;
      final deps = await _montar((req) async {
        if (req.method == 'POST') posts++;
        return _json(_evento('novo', 'P'), 201);
      });
      await deps.rascunhos.inserir(_rascunho('P1'));
      await deps.rascunhos.inserir(_rascunho('P2'));

      final resultados = await Future.wait([
        deps.sync.sincronizar(),
        deps.sync.sincronizar(),
      ]);

      expect(posts, 2);
      expect(identical(resultados[0], resultados[1]), isTrue);
    });

    test('503 em tudo: não grava ultimaSincronizacao', () async {
      final deps = await _montar((req) async => _json(_problema(503, 'Servidor indisponível'), 503));
      await deps.rascunhos.inserir(_rascunho('P1'));
      await deps.estado.marcarLocal('e1', true);

      final r = await deps.sync.sincronizar();

      expect(r.comErro, 2);
      expect(r.semConexao, isFalse);
      expect(r.pendentes, 2);
      expect(await deps.sessao.ultimaSincronizacao(), isNull);
    });

    test('item inserido durante o envio entra na mesma rodada: 2 POSTs, pendentes 0', () async {
      var posts = 0;
      late AppDeps deps;
      Future<ResultadoSync>? segunda;
      deps = await _montar((req) async {
        if (req.method == 'POST') {
          posts++;
          if (posts == 1) {
            // Rascunho novo chega enquanto o 1º POST ainda não respondeu; a 2ª chamada pega a execução em curso.
            await deps.rascunhos.inserir(_rascunho('P2'));
            segunda = deps.sync.sincronizar();
          }
        }
        return _json(_evento('novo', 'P'), 201);
      });
      await deps.rascunhos.inserir(_rascunho('P1'));

      final r = await deps.sync.sincronizar();

      expect(identical(await segunda, r), isTrue);
      expect(posts, 2);
      expect(r.enviados, 2);
      expect(r.pendentes, 0);
      final todos = await deps.rascunhos.listar();
      expect(todos, hasLength(2));
      expect(todos.every((x) => x.sincronizado), isTrue);
    });

    test('rascunho que sempre dá 400 + chamada concorrente: comErro conta 1, não 2 (vale a última rodada)', () async {
      var posts = 0;
      late AppDeps deps;
      Future<ResultadoSync>? segunda;
      deps = await _montar((req) async {
        if (req.method == 'POST') {
          posts++;
          // A 2ª chamada entra enquanto a 1ª ainda envia: isso pede a rodada extra.
          if (posts == 1) segunda = deps.sync.sincronizar();
        }
        return _json(_problema(400, 'Título inválido'), 400);
      });
      await deps.rascunhos.inserir(_rascunho('P1'));

      final r = await deps.sync.sincronizar();

      expect(identical(await segunda, r), isTrue);
      expect(posts, 2);
      expect(r.comErro, 1);
      expect(r.enviados, 0);
      expect(r.pendentes, 1);
    });

    for (final (nome, erro) in <(String, Exception)>[
      ('TIMEOUT', TimeoutException('servidor demorou para responder')),
      ('ClientException', http.ClientException('sem rede')),
    ]) {
      test('chamada concorrente com POST em $nome: 1 POST só, semConexao, sem ultimaSincronizacao', () async {
        var posts = 0;
        final deps = await _montar((req) async {
          if (req.method == 'POST') posts++;
          throw erro;
        });
        await deps.rascunhos.inserir(_rascunho('P1'));

        final resultados = await Future.wait([
          deps.sync.sincronizar(),
          deps.sync.sincronizar(),
        ]);

        expect(posts, 1);
        expect(resultados.every((r) => r.semConexao), isTrue);
        expect(await deps.sessao.ultimaSincronizacao(), isNull);
      });
    }
  });
}
