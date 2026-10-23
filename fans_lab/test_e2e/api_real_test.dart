// E2E contra o backend REAL. Fica fora de test/ para o `flutter test` padrão não depender de servidor.
//
//   cd fans_lab && API_URL=http://localhost:8080/api/v1 \
//     E2E_EMAIL=... E2E_SENHA=... [E2E_EMAIL_2=... E2E_SENHA_2=...] \
//     flutter test test_e2e/api_real_test.dart
//
// E2E_EMAIL/E2E_SENHA: um aluno que já pertence a uma turma com ao menos 1 matéria.
// E2E_EMAIL_2/E2E_SENHA_2 (opcional): outro membro da MESMA turma; liga os testes de autoria alheia.
// Os testes rodam EM ORDEM e compartilham estado; cada um limpa o que criou no tearDownAll.
import 'dart:convert';
import 'dart:io';

import 'package:fans_lab/app_deps.dart';
import 'package:fans_lab/database/app_database.dart';
import 'package:fans_lab/models/evento.dart';
import 'package:fans_lab/models/formatos.dart';
import 'package:fans_lab/models/materia.dart';
import 'package:fans_lab/models/rascunho_evento.dart';
import 'package:fans_lab/models/sessao.dart';
import 'package:fans_lab/models/tipo_evento.dart';
import 'package:fans_lab/services/api_exception.dart';
import 'package:fans_lab/services/api_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

final _baseUrl = Platform.environment['API_URL'] ?? 'http://localhost:8080/api/v1';
final _email = Platform.environment['E2E_EMAIL'];
final _senha = Platform.environment['E2E_SENHA'];
final _email2 = Platform.environment['E2E_EMAIL_2'];
final _senha2 = Platform.environment['E2E_SENHA_2'];
final _temColega = _email2 != null && _senha2 != null;

final _horaCurta = RegExp(r'^\d{2}:\d{2}$');
final _corHex = RegExp(r'^#[0-9A-Fa-f]{6}$');

/// Data daqui a [dias]. +2 e não +1: o servidor usa America/Sao_Paulo e esta máquina pode estar em UTC.
DateTime _em(int dias) {
  final n = DateTime.now().add(Duration(days: dias));
  return DateTime(n.year, n.month, n.day);
}

/// HTTP cru, SEM passar pelo ApiService: é a "verdade" do servidor para comparar com o que o app entendeu.
Future<(int, Object?)> _cru(String metodo, String caminho, String? token, {Object? corpo}) async {
  final c = HttpClient();
  try {
    final req = await c.openUrl(metodo, Uri.parse('$_baseUrl$caminho'));
    req.headers.set('Accept', 'application/json');
    if (token != null) req.headers.set('Authorization', 'Bearer $token');
    if (corpo != null) {
      req.headers.contentType = ContentType.json;
      req.add(utf8.encode(jsonEncode(corpo)));
    }
    final resp = await req.close();
    final texto = await utf8.decodeStream(resp);
    return (resp.statusCode, texto.isEmpty ? null : jsonDecode(texto));
  } finally {
    c.close(force: true);
  }
}

Future<ApiException> _falha(Future<Object?> Function() f) async {
  try {
    await f();
  } on ApiException catch (e) {
    return e;
  }
  fail('esperava ApiException, mas a chamada terminou sem erro');
}

void main() {
  late ApiService api; // logado como o aluno principal
  late Sessao sessao;
  late List<Materia> materias;
  final criados = <String>[]; // ids de evento a apagar no fim, caso um teste falhe no meio
  late Evento evento; // criado no teste criarEvento, evolui nos seguintes
  ApiService? apiColega;

  setUpAll(() {
    // Se algum import iniciar o binding de teste, o HttpClient viraria um mock que responde 400.
    HttpOverrides.global = null;
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
    if (_email == null || _senha == null) {
      throw StateError('Defina E2E_EMAIL e E2E_SENHA (e API_URL, se não for $_baseUrl).');
    }
    api = ApiService(baseUrl: _baseUrl);
  });

  tearDownAll(() async {
    for (final id in criados) {
      try {
        final d = await api.evento(id);
        if (d.evento.excluidoEm == null) await api.excluirEvento(id, d.evento.version);
      } on ApiException catch (e) {
        // ignore: avoid_print
        print('limpeza: não apaguei $id (${e.status}): ${e.mensagem}');
      }
    }
  });

  group('API real', () {
    test('login devolve Sessao com jwt, usuario e turmaId', () async {
      sessao = await api.login(_email!, _senha!);
      expect(sessao.jwt, isNotEmpty);
      expect(sessao.usuario.email, _email);
      expect(sessao.turmaId, isNotNull, reason: 'o aluno do E2E precisa estar numa turma');
      api.token = sessao.jwt;
    });

    test('home: ordem == a do servidor, autoria preenchida, hora em HH:mm', () async {
      final itens = await api.home();
      final (status, bruto) = await _cru('GET', '/home', sessao.jwt);
      expect(status, 200);
      final lista = (bruto as List).cast<Map<String, dynamic>>();

      expect(itens, isNotEmpty);
      expect(itens.length, lessThanOrEqualTo(6));
      expect(itens.map((i) => i.eventoId).toList(), lista.map((j) => j['eventoId']).toList(),
          reason: 'o app não pode reordenar a Home');
      // Ordem por urgência = data crescente. Conferido no JSON do servidor, não no app.
      final datas = lista.map((j) => j['data'] as String).toList();
      expect(datas, [...datas]..sort());

      for (var k = 0; k < itens.length; k++) {
        final i = itens[k];
        expect(i.autoria.autorId, isNotEmpty);
        expect(i.autoria.autorNome, isNotEmpty);
        expect(i.autoria.criadoEm.isUtc, isTrue);
        expect(i.materiaSigla, isNotEmpty);
        expect(i.materiaCorHex, matches(_corHex));
        expect(i.hora == null || _horaCurta.hasMatch(i.hora!), isTrue, reason: 'hora: ${i.hora}');
        // O servidor manda 'HH:mm:ss'; o app tem de entregar 'HH:mm'.
        final horaBruta = lista[k]['hora'] as String?;
        expect(i.hora, horaBruta?.substring(0, 5));
      }
      expect(itens.any((i) => i.hora != null), isTrue, reason: 'o cenário tem ao menos uma prova com hora');
      expect(itens.any((i) => i.autoria.autorId != sessao.usuario.id), isTrue,
          reason: 'o cenário tem ao menos um evento de outro autor');
    });

    test('materias: cor e sigla juntas, ids UUID', () async {
      materias = await api.materias();
      expect(materias, isNotEmpty);
      for (final m in materias) {
        expect(m.id, matches(RegExp(r'^[0-9a-f-]{36}$')));
        expect(m.sigla, isNotEmpty);
        expect(m.corHex, matches(_corHex));
      }
      final siglas = materias.map((m) => m.sigla).toSet();
      for (final i in await api.home()) {
        expect(siglas, contains(i.materiaSigla));
      }
    });

    test('criarEvento: 201 e Evento completo com autoria do usuário', () async {
      final m = materias.first;
      evento = await api.criarEvento({
        'materiaId': m.id,
        'tipo': 'PROVA',
        'titulo': 'E2E prova ${DateTime.now().millisecondsSinceEpoch}',
        'data': dataIso(_em(2)),
        'hora': '08:30',
        'sala': 'E2E-1',
      }); // o ApiService já exige exatamente 201
      criados.add(evento.id);
      expect(evento.tipo, TipoEvento.prova);
      expect(evento.hora, '08:30');
      expect(evento.sala, 'E2E-1');
      expect(evento.materiaSigla, m.sigla);
      expect(evento.version, 0);
      expect(evento.visivelTurma, isTrue);
      expect(evento.excluidoEm, isNull);
      expect(evento.autoria.autorId, sessao.usuario.id);
      expect(evento.autoria.autorNome, sessao.usuario.nome);
    });

    test('evento(id): formato achatado + materiais só do evento', () async {
      // Material criado e vinculado pelo HTTP cru: o app (por enquanto) não tem rota de material.
      final (sm, mat) = await _cru('POST', '/materiais', sessao.jwt, corpo: {
        'materiaId': evento.materiaId,
        'tipo': 'AULA',
        'titulo': 'E2E slides',
        'url': 'https://exemplo.dev/e2e',
        'dataAula': dataIso(_em(-3)),
      });
      expect(sm, 201);
      final matId = (mat as Map<String, dynamic>)['id'] as String;
      final (sv, _) = await _cru('POST', '/eventos/${evento.id}/materiais/$matId', sessao.jwt);
      expect(sv, 204);

      final d = await api.evento(evento.id);
      expect(d.evento.id, evento.id);
      expect(d.evento.titulo, evento.titulo);
      expect(d.evento.hora, '08:30');
      expect(d.evento.autoria.autorId, sessao.usuario.id);
      expect(d.materiais, hasLength(1));
      expect(d.materiais.single.id, matId);
      expect(d.materiais.single.titulo, 'E2E slides');
      expect(d.materiais.single.url, 'https://exemplo.dev/e2e');
      expect(d.materiais.single.dataAula, _em(-3));
      expect(d.materiais.single.autoria.autorNome, sessao.usuario.nome);

      final (_, bruto) = await _cru('GET', '/eventos/${evento.id}', sessao.jwt);
      final j = bruto as Map<String, dynamic>;
      expect(j.containsKey('evento'), isFalse, reason: '@JsonUnwrapped: sem aninhar o evento');
      expect(j.keys, containsAll(['id', 'tipo', 'titulo', 'data', 'autoria', 'version', 'materiais']));
    });

    test('atualizarEvento: version certa -> 200 e version+1; version velha -> conflito', () async {
      final corpo = {
        'materiaId': evento.materiaId,
        'tipo': 'PROVA',
        'titulo': '${evento.titulo} (editado)',
        'data': dataIso(evento.data),
        'hora': null, // PATCH substitui tudo: null = "sem hora"
        'sala': 'E2E-1',
      };
      final novo = await api.atualizarEvento(evento.id, evento.version, corpo);
      expect(novo.version, evento.version + 1);
      expect(novo.titulo, endsWith('(editado)'));
      expect(novo.hora, isNull);
      expect(novo.autoria.atualizadoEm, isNotNull);

      final e = await _falha(() => api.atualizarEvento(evento.id, evento.version, corpo));
      expect(e.conflito, isTrue);
      expect(e.status, 409);
      expect(e.semConexao, isFalse);
      expect(e.mensagem, isNotEmpty);
      evento = novo;
    });

    test('marcarFeito(true) -> 204 e a próxima home() traz feitoPeloUsuario == true', () async {
      Future<bool?> feitoNaHome() async {
        final item = (await api.home()).where((i) => i.eventoId == evento.id);
        expect(item, isNotEmpty, reason: 'o evento de +2 dias deveria estar na Home');
        return item.single.feitoPeloUsuario;
      }

      expect(await feitoNaHome(), isFalse);
      await api.marcarFeito(evento.id, true); // exige 204
      expect(await feitoNaHome(), isTrue);
      await api.marcarFeito(evento.id, false);
      expect(await feitoNaHome(), isFalse);
      await api.marcarFeito(evento.id, true);
      expect(await feitoNaHome(), isTrue);
    });

    test('autoria alheia: outro membro lê o evento, mas editar/excluir dá 403', () async {
      final colega = apiColega = ApiService(baseUrl: _baseUrl);
      final sessaoColega = await colega.login(_email2!, _senha2!);
      colega.token = sessaoColega.jwt;

      final d = await colega.evento(evento.id);
      expect(d.evento.autoria.autorId, sessao.usuario.id);
      expect(sessaoColega.usuario.id, isNot(sessao.usuario.id));

      final corpo = {
        'materiaId': evento.materiaId,
        'tipo': 'PROVA',
        'titulo': 'sequestro',
        'data': dataIso(evento.data),
      };
      final ep = await _falha(() => colega.atualizarEvento(evento.id, evento.version, corpo));
      expect(ep.status, 403);
      final ed = await _falha(() => colega.excluirEvento(evento.id, evento.version));
      expect(ed.status, 403);
    }, skip: _temColega ? false : 'defina E2E_EMAIL_2 e E2E_SENHA_2');

    test('excluirEvento -> 204; some da Home; autor ainda lê com excluidoEm; outro membro leva 404', () async {
      await api.excluirEvento(evento.id, evento.version); // exige 204

      expect((await api.home()).any((i) => i.eventoId == evento.id), isFalse);

      // ACHADO: para o AUTOR, GET /eventos/{id} de um evento excluído NÃO é 404; é 200 com excluidoEm.
      // (backend Evento.visivelPara: `autorId.equals(usuarioId)`). Para os demais membros é 404.
      final doAutor = await api.evento(evento.id);
      expect(doAutor.evento.excluidoEm, isNotNull);

      if (apiColega != null) {
        final e = await _falha(() => apiColega!.evento(evento.id));
        expect(e.naoEncontrado, isTrue);
        expect(e.status, 404);
      }
      final inexistente = await _falha(() => api.evento('00000000-0000-4000-8000-000000000000'));
      expect(inexistente.naoEncontrado, isTrue);
    });

    test('senha errada -> 401 com a mensagem do app', () async {
      final e = await _falha(() => ApiService(baseUrl: _baseUrl).login(_email!, 'senha-errada-e2e'));
      expect(e.status, 401);
      expect(e.mensagem, 'E-mail ou senha incorretos.');
      expect(e.naoAutorizado, isTrue);
      // O login certo continua funcionando (o teto de tentativas é por e-mail e zera no acerto).
      expect((await ApiService(baseUrl: _baseUrl).login(_email!, _senha!)).jwt, isNotEmpty);
    });

    test('token inválido (ou ausente) -> naoAutorizado', () async {
      final ruim = ApiService(baseUrl: _baseUrl)..token = 'token.invalido.xyz';
      final e = await _falha(ruim.home);
      expect(e.naoAutorizado, isTrue);
      final sem = await _falha(ApiService(baseUrl: _baseUrl).home);
      expect(sem.naoAutorizado, isTrue);
    });

    test('servidor fora do ar -> ApiException.semConexao (SocketException real)', () async {
      final e = await _falha(ApiService(baseUrl: 'http://127.0.0.1:1/api/v1').home);
      expect(e.semConexao, isTrue);
      expect(e.status, isNull);
    });
  });

  group('SyncService real', () {
    test('rascunho -> sincronizar() -> aparece na home(); feito pendente também sobe', () async {
      // ignore: invalid_use_of_visible_for_testing_member
      SharedPreferences.setMockInitialValues({});
      final db = await AppDatabase.abrirEmMemoria();
      final deps = AppDeps.padrao(baseUrl: _baseUrl, abrirDb: () async => db);
      deps.api.token = (await deps.api.login(_email!, _senha!)).jwt;
      final mats = await deps.api.materias();
      final titulo = 'E2E rascunho ${DateTime.now().millisecondsSinceEpoch}';

      final localId = await deps.rascunhos.inserir(RascunhoEvento(
        materiaId: mats.first.id,
        materiaSigla: mats.first.sigla,
        materiaCorHex: mats.first.corHex,
        tipo: TipoEvento.entrega,
        titulo: titulo,
        data: _em(2),
        hora: '10:15',
        criadoEm: DateTime.now().toUtc(),
      ));
      expect(await deps.sync.contarPendentes(), 1);

      final r = await deps.sync.sincronizar();
      expect(r.enviados, 1);
      expect(r.comErro, 0);
      expect(r.pendentes, 0);
      expect(r.semConexao, isFalse);
      expect((await deps.rascunhos.listar()).singleWhere((x) => x.localId == localId).sincronizado, isTrue);
      expect(await deps.sessao.ultimaSincronizacao(), isNotNull);

      final item = (await deps.api.home()).singleWhere((i) => i.titulo == titulo);
      criados.add(item.eventoId);
      expect(item.tipo, TipoEvento.entrega);
      expect(item.hora, '10:15');
      expect(item.autoria.autorNome, sessao.usuario.nome);
      expect(item.feitoPeloUsuario, isFalse);

      // Fila de "feito": marca localmente e deixa o SyncService subir.
      await deps.estado.marcarLocal(item.eventoId, true);
      final r2 = await deps.sync.sincronizar();
      expect(r2.enviados, 1);
      expect(r2.pendentes, 0);
      final depois = (await deps.home.carregar()).itens.singleWhere((i) => i.eventoId == item.eventoId);
      expect(depois.feitoPeloUsuario, isTrue);

      // Sem nada na fila, nada é enviado.
      expect((await deps.sync.sincronizar()).enviados, 0);

      await db.close();
    });
  });
}
