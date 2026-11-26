import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:fans_lab/services/api_exception.dart';
import 'package:fans_lab/services/api_service.dart';
import 'package:fans_lab/services/upload_service.dart';

/// Servidor falso do Dio: guarda o que chegou e responde o que o teste mandar.
class AdaptadorFalso implements HttpClientAdapter {
  AdaptadorFalso(this.responder);

  final ResponseBody Function(RequestOptions pedido, String corpo) responder;
  RequestOptions? pedido;
  String corpo = '';

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final bytes = <int>[];
    if (requestStream != null) {
      await for (final pedaco in requestStream) {
        bytes.addAll(pedaco);
      }
    }
    pedido = options;
    corpo = latin1.decode(bytes);
    return responder(options, corpo);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody jsonResposta(Object corpo, int status) => ResponseBody.fromString(
  jsonEncode(corpo),
  status,
  headers: {
    Headers.contentTypeHeader: [Headers.jsonContentType],
  },
);

const materialCriado = {
  'id': 'mt9',
  'tipo': 'ADICIONAL',
  'titulo': 'Lista 2',
  'arquivoRef': 'a1',
  'autoria': {
    'autorId': 'u1',
    'autorNome': 'Ana',
    'criadoEm': '2026-11-26T22:00:00Z',
  },
};

final pdf = Uint8List.fromList(utf8.encode('%PDF-1.4 teste'));

void main() {
  late AdaptadorFalso adaptador;

  UploadService servico(ResponseBody Function(RequestOptions, String) responder, {String? token = 'jwt-1'}) {
    adaptador = AdaptadorFalso(responder);
    final api = ApiService(baseUrl: 'http://api/v1')..token = token;
    return UploadService(api, dio: Dio()..httpClientAdapter = adaptador);
  }

  group('validar no aparelho', () {
    test('aceita PDF, PNG e JPG dentro do teto, sem olhar maiúscula', () {
      expect(UploadService.validar('lista.PDF', 1000), isNull);
      expect(UploadService.validar('foto.jpeg', 1000), isNull);
      expect(UploadService.validar('quadro.png', UploadService.tetoBytes), isNull);
    });

    test('recusa extensão fora da lista, arquivo vazio e acima de 5 MB', () {
      expect(UploadService.validar('programa.exe', 10), 'Escolha um PDF, PNG ou JPG.');
      expect(UploadService.validar('sem-extensao', 10), 'Escolha um PDF, PNG ou JPG.');
      expect(UploadService.validar('vazio.pdf', 0), 'O arquivo está vazio.');
      expect(UploadService.validar('grande.pdf', UploadService.tetoBytes + 1), contains('O limite é 5 MB'));
    });

    test('tamanho legível', () {
      expect(tamanhoLegivel(340 * 1024), '340 KB');
      expect(tamanhoLegivel(1258291), '1,2 MB');
    });
  });

  test('envia multipart com token, campos do contrato e progresso; 201 vira o material', () async {
    final envio = servico((_, _) => jsonResposta(materialCriado, 201));
    final progresso = <int>[];

    final material = await envio.enviar(
      eventoId: 'e1',
      nome: 'lista.pdf',
      bytes: pdf,
      descricao: '  Lista 2 ',
      aoEnviar: (enviados, _) => progresso.add(enviados),
    );

    expect(material.id, 'mt9');
    expect(material.arquivoRef, 'a1');
    final pedido = adaptador.pedido!;
    expect(pedido.method, 'POST');
    expect(pedido.uri.toString(), 'http://api/v1/eventos/e1/arquivos');
    expect(pedido.headers['Authorization'], 'Bearer jwt-1');
    expect(pedido.contentType, startsWith('multipart/form-data; boundary='));
    expect(adaptador.corpo, contains('name="arquivo"; filename="lista.pdf"'));
    expect(adaptador.corpo, contains('%PDF-1.4 teste'));
    expect(adaptador.corpo, contains('name="descricao"'));
    expect(adaptador.corpo, contains('Lista 2'));
    expect(progresso, isNotEmpty);
  });

  test('descrição vazia não vai no formulário', () async {
    final envio = servico((_, _) => jsonResposta(materialCriado, 201));
    await envio.enviar(eventoId: 'e1', nome: 'lista.pdf', bytes: pdf, descricao: '   ');
    expect(adaptador.corpo, isNot(contains('name="descricao"')));
  });

  test('sem sessão não manda Authorization', () async {
    final envio = servico((_, _) => jsonResposta({}, 401), token: null);
    await expectLater(
      envio.enviar(eventoId: 'e1', nome: 'lista.pdf', bytes: pdf),
      throwsA(isA<ApiException>().having((e) => e.naoAutorizado, 'naoAutorizado', isTrue)),
    );
    expect(adaptador.pedido!.headers.containsKey('Authorization'), isFalse);
  });

  for (final (status, texto) in [
    (401, 'Sessão expirada. Entre de novo.'),
    (403, 'Você não tem permissão para enviar arquivos aqui.'),
    (413, 'O arquivo passa do limite de 5 MB aceito pelo servidor.'),
    (415, 'O servidor só aceita PDF, PNG ou JPG de verdade.'),
    (500, 'Erro no servidor. Tente de novo em instantes.'),
  ]) {
    test('HTTP $status vira mensagem própria', () async {
      final envio = servico((_, _) => jsonResposta({'detail': 'texto do servidor'}, status));
      await expectLater(
        envio.enviar(eventoId: 'e1', nome: 'lista.pdf', bytes: pdf),
        throwsA(isA<ApiException>()
            .having((e) => e.status, 'status', status)
            .having((e) => e.mensagem, 'mensagem', texto)),
      );
    });
  }

  test('sem rede é "sem conexão", nunca sucesso', () async {
    final envio = servico((_, _) => throw const SocketException('rede caiu'));
    await expectLater(
      envio.enviar(eventoId: 'e1', nome: 'lista.pdf', bytes: pdf),
      throwsA(isA<ApiException>().having((e) => e.semConexao, 'semConexao', isTrue)),
    );
  });
}
