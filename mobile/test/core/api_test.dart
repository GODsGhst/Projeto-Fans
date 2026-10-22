import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:projetofans/core/api.dart';
import 'package:projetofans/core/erro_api.dart';

const _base = 'https://api.teste/api/v1';

/// Resposta com corpo em bytes UTF-8, para acentos chegarem certos.
http.Response _resp(int status, [String corpo = '']) => http.Response.bytes(
      utf8.encode(corpo),
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

ApiClient _api(
  http.Client cliente, {
  String? token = 'jwt-123',
  bool docente = false,
  String? turma,
  void Function()? onSessao,
  void Function()? onSemTurma,
  Duration teto = const Duration(seconds: 5),
}) =>
    ApiClient(
      client: cliente,
      baseUrl: _base,
      token: () => token,
      ehDocente: () => docente,
      turmaAtiva: () async => turma,
      onSessaoExpirada: onSessao ?? () {},
      onSemTurma: onSemTurma ?? () {},
      tetoDeEspera: teto,
    );

/// Faz GET /x com o handler dado e devolve o ErroApi lançado.
Future<ErroApi> _erroDe(
  Future<http.Response> Function(http.Request) handler, {
  Duration teto = const Duration(seconds: 5),
}) async {
  final api = _api(MockClient(handler), teto: teto);
  try {
    await api.get<Object?>('/x');
  } on ErroApi catch (e) {
    return e;
  }
  fail('a chamada deveria ter lançado ErroApi');
}

Future<ErroApi> _erroComResposta(http.Response resposta) =>
    _erroDe((_) async => resposta);

void main() {
  group('tradução de status', () {
    test('falha de rede vira OFFLINE com "Sem conexão."', () async {
      final erro = await _erroDe((_) async => throw http.ClientException('sem rede'));
      expect(erro.classe, ClasseErro.offline);
      expect(erro.status, 0);
      expect(erro.message, 'Sem conexão.');
      expect(erro.podeTentarNovamente, isTrue);
    });

    test('teto estourado vira DEMOROU, não TimeoutException crua', () async {
      final erro = await _erroDe(
        (_) => Completer<http.Response>().future,
        teto: const Duration(milliseconds: 50),
      );
      expect(erro.classe, ClasseErro.demorou);
      expect(erro.status, 0);
      expect(erro.message, 'O servidor demorou demais para responder. Tente de novo.');
      expect(erro.podeTentarNovamente, isTrue);
    });

    test('401 usa o detail do servidor e não pede nova tentativa', () async {
      final erro = await _erroComResposta(
        _resp(401, '{"detail":"E-mail ou senha invalidos"}'),
      );
      expect(erro.classe, ClasseErro.auth);
      expect(erro.status, 401);
      expect(erro.message, 'E-mail ou senha invalidos');
      expect(erro.podeTentarNovamente, isFalse);
    });

    test('401 sem corpo usa a frase padrão de sessão expirada', () async {
      final erro = await _erroComResposta(_resp(401));
      expect(erro.classe, ClasseErro.auth);
      expect(erro.message, 'Sua sessão expirou. Entre de novo.');
    });

    test('403 sem corpo usa a frase padrão de autoria', () async {
      final erro = await _erroComResposta(_resp(403));
      expect(erro.classe, ClasseErro.proibido);
      expect(erro.message, 'Só quem criou pode editar.');
    });

    test('404 com corpo HTML não tem detail e usa a frase padrão', () async {
      final erro = await _erroComResposta(_resp(404, '<html>502 Bad Gateway</html>'));
      expect(erro.classe, ClasseErro.naoEncontrado);
      expect(erro.message, 'Isso não existe mais.');
      expect(erro.codigo, isNull);
    });

    test('404 com detail usa o detail do servidor', () async {
      final erro = await _erroComResposta(_resp(404, '{"detail":"Registro nao encontrado"}'));
      expect(erro.classe, ClasseErro.naoEncontrado);
      expect(erro.message, 'Registro nao encontrado');
    });

    test('409 é CONFLITO com recarregarRegistro', () async {
      final erro = await _erroComResposta(_resp(409));
      expect(erro.classe, ClasseErro.conflito);
      expect(erro.status, 409);
      expect(erro.recarregarRegistro, isTrue);
      expect(erro.message, 'Alguém editou isso enquanto você editava.');
    });

    test('428 é PRECONDICAO com a frase padrão', () async {
      final erro = await _erroComResposta(_resp(428));
      expect(erro.classe, ClasseErro.precondicao);
      expect(erro.message, 'Recarregue o registro e tente de novo.');
    });

    test('5xx é sempre a frase fixa, mesmo com detail', () async {
      final erro = await _erroComResposta(
        _resp(500, '{"detail":"connection refused: postgres"}'),
      );
      expect(erro.classe, ClasseErro.servidor);
      expect(erro.message, 'Deu problema no servidor. Tente de novo.');
      expect(erro.podeTentarNovamente, isTrue);
    });

    test('5xx sem corpo também é a frase fixa', () async {
      final erro = await _erroComResposta(_resp(503));
      expect(erro.classe, ClasseErro.servidor);
      expect(erro.message, 'Deu problema no servidor. Tente de novo.');
    });

    test('400 com detail vira DESCONHECIDO com o detail', () async {
      final erro = await _erroComResposta(_resp(400, '{"detail":"Invalid request content."}'));
      expect(erro.classe, ClasseErro.desconhecido);
      expect(erro.message, 'Invalid request content.');
    });

    test('418 sem corpo vira DESCONHECIDO com a frase padrão', () async {
      final erro = await _erroComResposta(_resp(418));
      expect(erro.classe, ClasseErro.desconhecido);
      expect(erro.message, 'Não deu para completar a ação.');
    });

    test('detail vazio conta como ausente e cai no title', () async {
      final erro = await _erroComResposta(_resp(400, '{"detail":"","title":"Bad Request"}'));
      expect(erro.message, 'Bad Request');
    });
  });

  group('interceptores de cabeçalho', () {
    test('Authorization sai em rota comum e não sai em /auth/', () async {
      final log = <http.Request>[];
      final api = _api(MockClient((req) async {
        log.add(req);
        return _resp(200, '{}');
      }));
      await api.post<Object?>('/auth/login', corpo: {'email': 'a', 'senha': 'b'});
      await api.get<Object?>('/eu');
      expect(log[0].headers.containsKey('Authorization'), isFalse);
      expect(log[1].headers['Authorization'], 'Bearer jwt-123');
    });

    test('X-Turma-Id só vai para docente com turma ativa', () async {
      final log = <http.Request>[];
      MockClient capturar() => MockClient((req) async {
            log.add(req);
            return _resp(200, '{}');
          });

      await _api(capturar(), turma: 't9').get<Object?>('/eu');
      expect(log.last.headers.containsKey('X-Turma-Id'), isFalse, reason: 'aluno nunca manda');

      await _api(capturar(), docente: true, turma: 't9').get<Object?>('/eu');
      expect(log.last.headers['X-Turma-Id'], 't9');
      expect(log.last.headers['Authorization'], 'Bearer jwt-123');

      await _api(capturar(), docente: true).get<Object?>('/eu');
      expect(log.last.headers.containsKey('X-Turma-Id'), isFalse, reason: 'sem turma ativa');
    });

    test('If-Match só vai quando version é passada', () async {
      final log = <http.Request>[];
      final api = _api(MockClient((req) async {
        log.add(req);
        return _resp(200, '{}');
      }));
      await api.patch<Object?>('/eventos/e1', corpo: {'titulo': 'x'}, version: 3);
      await api.patch<Object?>('/eu', corpo: {'nome': 'x'});
      await api.delete<Object?>('/eventos/e1', version: 7);
      expect(log[0].headers['If-Match'], '3');
      expect(log[1].headers.containsKey('If-Match'), isFalse);
      expect(log[2].headers['If-Match'], '7');
    });
  });

  group('efeitos colaterais', () {
    test('401 chama onSessaoExpirada e ainda relança o erro', () async {
      var chamadas = 0;
      final api = _api(
        MockClient((_) async => _resp(401, '{"detail":"Sessao"}')),
        onSessao: () => chamadas++,
      );
      await expectLater(api.get<Object?>('/eu'), throwsA(isA<ErroApi>()));
      expect(chamadas, 1);
    });

    test('403 não chama onSessaoExpirada', () async {
      var chamadas = 0;
      final api = _api(MockClient((_) async => _resp(403)), onSessao: () => chamadas++);
      await expectLater(api.get<Object?>('/eu'), throwsA(isA<ErroApi>()));
      expect(chamadas, 0);
    });

    test('404 com codigo SEM_TURMA chama onSemTurma e vira NAO_ENCONTRADO', () async {
      var chamadas = 0;
      final api = _api(
        MockClient((_) async => _resp(404, '{"codigo":"SEM_TURMA","detail":"Sem turma"}')),
        onSemTurma: () => chamadas++,
      );
      try {
        await api.get<Object?>('/home');
        fail('deveria ter lançado');
      } on ErroApi catch (e) {
        expect(e.classe, ClasseErro.naoEncontrado);
        expect(e.codigo, 'SEM_TURMA');
      }
      expect(chamadas, 1);
    });

    test('404 sem codigo (HTML de proxy, detail puro) não chama onSemTurma', () async {
      var chamadas = 0;
      final api = _api(
        MockClient((_) async => _resp(404, '{"detail":"Registro nao encontrado"}')),
        onSemTurma: () => chamadas++,
      );
      await expectLater(api.get<Object?>('/x'), throwsA(isA<ErroApi>()));
      expect(chamadas, 0);
    });

    test('204 sem corpo devolve null sem tentar decodificar', () async {
      final api = _api(MockClient((_) async => _resp(204)));
      await expectLater(
        api.post<void>('/auth/senha/reset', corpo: {'token': 't', 'novaSenha': 'segredo12'}),
        completes,
      );
    });
  });
}
