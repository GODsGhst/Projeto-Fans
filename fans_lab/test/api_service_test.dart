import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:fans_lab/services/api_exception.dart';
import 'package:fans_lab/services/api_service.dart';

const _base = 'https://api.test/api/v1';

http.Response _resp(Object? corpo, int status) => http.Response.bytes(
      utf8.encode(jsonEncode(corpo)),
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

ApiService _api(Future<http.Response> Function(http.Request) handler,
        {Duration timeout = const Duration(seconds: 90)}) =>
    ApiService(baseUrl: _base, client: MockClient(handler), timeout: timeout);

/// Devolve a ApiException lançada; se a chamada tiver sucesso, o teste falha.
Future<ApiException> _falha(Future<Object?> chamada) async {
  try {
    await chamada;
  } on ApiException catch (e) {
    return e;
  }
  fail('esperava ApiException, mas a chamada teve sucesso');
}

Map<String, dynamic> _autoria() => {
      'autorId': 'u2',
      'autorNome': 'Ana',
      'autorSelo': null,
      'criadoEm': '2026-10-20T13:00:00Z',
      'atualizadoEm': null,
      'editadoPorNome': null,
      'editadoPorSelo': null,
    };

Map<String, dynamic> _item(String id, String data, {bool semTitulo = false}) => {
      'eventoId': id,
      'tipo': 'PROVA',
      if (!semTitulo) 'titulo': 'Prova $id',
      'data': data,
      'hora': '19:00:00',
      'materiaSigla': 'BD',
      'materiaCorHex': '#1D4ED8',
      'autoria': _autoria(),
      'feitoPeloUsuario': false,
    };

Map<String, dynamic> _evento({String id = 'e1', int version = 3}) => {
      'id': id,
      'tipo': 'PROVA',
      'titulo': 'Prova 2',
      'data': '2026-10-25',
      'hora': '19:00:00',
      'sala': null,
      'materiaId': 'm1',
      'materiaSigla': 'BD',
      'materiaCorHex': '#1D4ED8',
      'autoria': _autoria(),
      'version': version,
      'visivelTurma': true,
      'excluidoEm': null,
    };

final _authJson = {
  'jwt': 'abc',
  'usuario': {
    'id': 'u1',
    'nome': 'Otávio',
    'email': 'o@x.com',
    'tipoConta': 'ALUNO',
    'docenteStatus': null,
  },
  'turmaId': 't1',
};

void main() {
  group('login', () {
    test('200 devolve Sessao, envia {email, senha} e não manda Authorization', () async {
      late http.Request enviado;
      final api = _api((req) async {
        enviado = req;
        return _resp(_authJson, 200);
      });

      final sessao = await api.login('o@x.com', '123');

      expect(sessao.jwt, 'abc');
      expect(sessao.usuario.nome, 'Otávio');
      expect(enviado.method, 'POST');
      expect(enviado.url.toString(), '$_base/auth/login');
      expect(jsonDecode(enviado.body), {'email': 'o@x.com', 'senha': '123'});
      expect(enviado.headers.containsKey('Authorization'), isFalse);
    });

    test('401 vira "E-mail ou senha incorretos." mesmo com detail do servidor', () async {
      final api = _api((_) async => _resp({'status': 401, 'detail': 'Credencial inválida'}, 401));

      final e = await _falha(api.login('o@x.com', 'errada'));

      expect(e.naoAutorizado, isTrue);
      expect(e.mensagem, 'E-mail ou senha incorretos.');
    });
  });

  group('home', () {
    test('200 preserva a ordem recebida e envia Bearer quando há token', () async {
      late http.Request enviado;
      final api = _api((req) async {
        enviado = req;
        return _resp([_item('x', '2026-10-25'), _item('y', '2026-10-28'), _item('z', '2026-10-26')], 200);
      });
      api.token = 'abc';

      final itens = await api.home();

      expect(itens.map((i) => i.eventoId).toList(), ['x', 'y', 'z']);
      expect(enviado.headers['Authorization'], 'Bearer abc');
      expect(enviado.url.toString(), '$_base/home');
    });

    test('200 com lista vazia é sucesso vazio, não erro', () async {
      final api = _api((_) async => _resp(<Object>[], 200));

      expect(await api.home(), isEmpty);
    });

    test('401 vira naoAutorizado com a mensagem de sessão expirada', () async {
      final api = _api((_) async => http.Response('', 401));

      final e = await _falha(api.home());

      expect(e.naoAutorizado, isTrue);
      expect(e.status, 401);
      expect(e.mensagem, 'Sessão expirada. Entre de novo.');
    });

    test('401 com detail do servidor usa a mensagem de sessão expirada do app', () async {
      final api = _api((_) async => _resp({'status': 401, 'detail': 'Autenticacao necessaria'}, 401));

      final e = await _falha(api.home());

      expect(e.naoAutorizado, isTrue);
      expect(e.mensagem, 'Sessão expirada. Entre de novo.');
    });

    test('200 com corpo <html> vira respostaInvalida, sem marcar falta de conexão', () async {
      final api = _api((_) async => http.Response('<html>manutenção</html>', 200));

      final e = await _falha(api.home());

      expect(e.status, 200);
      expect(e.semConexao, isFalse);
      expect(e.mensagem, 'O servidor respondeu num formato inesperado.');
    });

    test('200 com item sem titulo vira respostaInvalida', () async {
      final api = _api((_) async => _resp([_item('x', '2026-10-25', semTitulo: true)], 200));

      final e = await _falha(api.home());

      expect(e.status, 200);
      expect(e.semConexao, isFalse);
    });
  });

  group('erros HTTP', () {
    test('404 com ProblemDetail usa a mensagem do app, não o detail', () async {
      final api = _api((_) async => _resp(
            {'type': 'about:blank', 'title': 'Not Found', 'status': 404, 'detail': 'Evento não existe mais'},
            404,
          ));

      final e = await _falha(api.evento('e9'));

      expect(e.naoEncontrado, isTrue);
      expect(e.mensagem, 'Não encontrado — pode ter sido excluído.');
    });

    test('400 sem detail usa "Dados inválidos.", não o title do servidor', () async {
      final api = _api((_) async => _resp({'title': 'Bad Request', 'status': 400}, 400));

      final e = await _falha(api.criarEvento({'titulo': ''}));

      expect(e.mensagem, 'Dados inválidos.');
    });

    test('status fora da tabela sem detail usa o title', () async {
      final api = _api((_) async => _resp({'title': 'Requisição recusada', 'status': 422}, 422));

      final e = await _falha(api.criarEvento({'titulo': ''}));

      expect(e.mensagem, 'Requisição recusada');
    });

    test('500 sem corpo vira mensagem de servidor', () async {
      final api = _api((_) async => http.Response('', 500));

      final e = await _falha(api.materias());

      expect(e.status, 500);
      expect(e.semConexao, isFalse);
      expect(e.mensagem, 'Erro no servidor. Tente de novo em instantes.');
    });

    test('400, 403, 428 e 429 sem corpo usam a tabela de mensagens', () async {
      final esperadas = {
        400: 'Dados inválidos.',
        403: 'Você não tem permissão para isso.',
        428: 'Faltou a versão do registro.',
        429: 'Muitas tentativas. Espere alguns minutos.',
      };
      for (final entrada in esperadas.entries) {
        final api = _api((_) async => http.Response('', entrada.key));

        final e = await _falha(api.materias());

        expect(e.mensagem, entrada.value, reason: 'status ${entrada.key}');
      }
    });
  });

  group('sem conexão', () {
    test('http.ClientException vira semConexao', () async {
      final api = _api((_) async => throw http.ClientException('falhou'));

      final e = await _falha(api.home());

      expect(e.semConexao, isTrue);
      expect(e.status, isNull);
    });

    test('SocketException vira semConexao', () async {
      final api = _api((_) async => throw SocketException('recusado'));

      final e = await _falha(api.home());

      expect(e.semConexao, isTrue);
    });

    test('timeout vira semConexao', () async {
      final api = _api(
        (_) async {
          await Future<void>.delayed(const Duration(seconds: 1));
          return _resp(_authJson, 200);
        },
        timeout: const Duration(milliseconds: 20),
      );

      final e = await _falha(api.home());

      expect(e.semConexao, isTrue);
    });
    test('timeout vira semConexao com mensagem de servidor acordando', () async {
      final api = _api(
        (_) async {
          await Future<void>.delayed(const Duration(seconds: 1));
          return _resp(_authJson, 200);
        },
        timeout: const Duration(milliseconds: 20),
      );

      final e = await _falha(api.home());

      expect(e.semConexao, isTrue);
      expect(e.mensagem, contains('acordando'));
    });

    test('CertificateException (TLS) vira semConexao', () async {
      final api = _api((_) async => throw CertificateException('certificado inválido'));

      final e = await _falha(api.home());

      expect(e.semConexao, isTrue);
    });
  });

  group('leitura', () {
    test('materias faz GET /materias e devolve a lista', () async {
      late http.Request enviado;
      final api = _api((req) async {
        enviado = req;
        return _resp([
          {'id': 'm1', 'nome': 'Banco de Dados', 'sigla': 'BD', 'corHex': '#1D4ED8', 'sala': null, 'professor': null},
        ], 200);
      });

      final materias = await api.materias();

      expect(enviado.method, 'GET');
      expect(enviado.url.toString(), '$_base/materias');
      expect(materias.single.sigla, 'BD');
    });

    test('evento 200 faz GET /eventos/{id} e lê campos achatados mais materiais', () async {
      late http.Request enviado;
      final api = _api((req) async {
        enviado = req;
        return _resp({
          ..._evento(id: 'e1'),
          'materiais': [
            {
              'id': 'a1',
              'tipo': 'LINK',
              'titulo': 'Slides aula 3',
              'url': 'https://x.test/s',
              'dataAula': '2026-10-10',
              'autoria': _autoria(),
            },
          ],
        }, 200);
      });

      final detalhe = await api.evento('e1');

      expect(enviado.method, 'GET');
      expect(enviado.url.toString(), '$_base/eventos/e1');
      expect(detalhe.evento.titulo, 'Prova 2');
      expect(detalhe.materiais.single.titulo, 'Slides aula 3');
    });
  });

  group('timeout', () {
    // O servidor pode demorar a acordar (ver a mensagem de timeout em _enviar): o padrão não pode encurtar.
    test('padrão é 90 s', () {
      final api = ApiService(client: MockClient((_) async => _resp(<Object>[], 200)));
      expect(api.timeout, const Duration(seconds: 90));
    });
  });

  group('baseUrl', () {
    test('com barra no fim não gera //', () async {
      late http.Request enviado;
      final api = ApiService(
        baseUrl: 'http://api/',
        client: MockClient((req) async {
          enviado = req;
          return _resp(<Object>[], 200);
        }),
      );

      await api.home();

      expect(enviado.url.toString(), 'http://api/home');
    });

    test('esquema errado ou ausente falha antes de enviar, como ApiException de conexão', () async {
      for (final url in ['htps://x.test/api/v1', 'x.test/api/v1']) {
        final api = ApiService(
          baseUrl: url,
          client: MockClient((_) async => fail('não deveria enviar')),
        );

        final e = await _falha(api.home());

        expect(e.semConexao, isTrue, reason: url);
        expect(e.mensagem, contains('Endereço do servidor inválido'), reason: url);
      }
    });
  });

  group('escrita', () {
    test('criarEvento faz POST com o corpo recebido e devolve Evento do 201', () async {
      late http.Request enviado;
      final corpo = {
        'materiaId': 'm1',
        'tipo': 'PROVA',
        'titulo': 'Prova 2',
        'data': '2026-10-25',
        'hora': '19:00',
        'sala': null,
      };
      final api = _api((req) async {
        enviado = req;
        return _resp(_evento(), 201);
      });

      final evento = await api.criarEvento(corpo);

      expect(enviado.method, 'POST');
      expect(enviado.url.toString(), '$_base/eventos');
      expect(jsonDecode(enviado.body), corpo);
      expect(evento.id, 'e1');
      expect(evento.version, 3);
    });

    test('atualizarEvento faz PATCH com If-Match: 3, envia o corpo e devolve o Evento', () async {
      late http.Request enviado;
      final corpo = {'titulo': 'Nova'};
      final api = _api((req) async {
        enviado = req;
        return _resp(_evento(version: 4), 200);
      });

      final evento = await api.atualizarEvento('e1', 3, corpo);

      expect(enviado.method, 'PATCH');
      expect(enviado.url.toString(), '$_base/eventos/e1');
      expect(enviado.headers['If-Match'], '3');
      expect(jsonDecode(enviado.body), corpo);
      expect(evento.version, 4);
    });

    test('atualizarEvento com 409 vira conflito', () async {
      final api = _api((_) async => _resp({'status': 409, 'detail': 'version divergente'}, 409));

      final e = await _falha(api.atualizarEvento('e1', 2, {'titulo': 'x'}));

      expect(e.conflito, isTrue);
      expect(e.mensagem, 'Alguém alterou este evento antes de você. Recarregue e tente de novo.');
    });

    test('atualizarEvento com 409 e detail técnico do backend usa a mensagem do app', () async {
      final api = _api((_) async => _resp(
            {
              'status': 409,
              'detail': 'Este registro mudou desde que voce abriu (version 1, voce enviou 0)',
            },
            409,
          ));

      final e = await _falha(api.atualizarEvento('e1', 0, {'titulo': 'x'}));

      expect(e.conflito, isTrue);
      expect(e.mensagem, 'Alguém alterou este evento antes de você. Recarregue e tente de novo.');
    });

    test('excluirEvento faz DELETE com If-Match e aceita 204', () async {
      late http.Request enviado;
      final api = _api((req) async {
        enviado = req;
        return http.Response('', 204);
      });

      await api.excluirEvento('e1', 2);

      expect(enviado.method, 'DELETE');
      expect(enviado.headers['If-Match'], '2');
      expect(enviado.url.toString(), '$_base/eventos/e1');
    });

    test('marcarFeito faz PUT em estado-pessoal com {"feito":true} e aceita 204', () async {
      late http.Request enviado;
      final api = _api((req) async {
        enviado = req;
        return http.Response('', 204);
      });

      await api.marcarFeito('e1', true);

      expect(enviado.method, 'PUT');
      expect(enviado.url.toString(), '$_base/eventos/e1/estado-pessoal');
      expect(jsonDecode(enviado.body), {'feito': true});
    });
  });

  group('UTF-8', () {
    test('detail de ProblemDetail em application/problem+json sem charset é lido em UTF-8', () async {
      final api = _api((_) async => http.Response.bytes(
            utf8.encode(jsonEncode({
              'type': 'about:blank',
              'title': 'Bad Request',
              'status': 400,
              'detail': 'Título não pode ficar em branco',
            })),
            400,
            headers: {'content-type': 'application/problem+json'},
          ));

      final e = await _falha(api.criarEvento({'titulo': ''}));

      expect(e.mensagem, 'Título não pode ficar em branco');
    });
  });
}
