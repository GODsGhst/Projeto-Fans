import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'package:fans_lab/config.dart';
import 'package:fans_lab/models/evento.dart';
import 'package:fans_lab/models/evento_detalhe.dart';
import 'package:fans_lab/models/item_home.dart';
import 'package:fans_lab/models/materia.dart';
import 'package:fans_lab/models/sessao.dart';
import 'package:fans_lab/services/api_exception.dart';

/// Único ponto de HTTP do app. Toda falha sai como [ApiException].
class ApiService {
  ApiService({
    http.Client? client,
    String baseUrl = apiUrl,
    this.timeout = const Duration(seconds: 90),
  })  : baseUrl = baseUrl.replaceAll(RegExp(r'/+$'), ''),
        _client = client ?? http.Client();

  /// Sem `/` no fim: cada rota já começa com `/`.
  final String baseUrl;
  final Duration timeout;
  final http.Client _client;

  /// JWT da sessão. Quando não-nulo, vai em `Authorization: Bearer`.
  String? token;

  Future<Sessao> login(String email, String senha) async {
    final r = await _enviar('POST', '/auth/login',
        esperado: 200, corpo: {'email': email, 'senha': senha}, login: true);
    return _ler(r, Sessao.fromJson);
  }

  /// Devolve a lista exatamente na ordem recebida: ordem e teto são regra do servidor.
  Future<List<ItemHome>> home() async {
    final r = await _enviar('GET', '/home', esperado: 200);
    return _lerLista(r, ItemHome.fromJson);
  }

  Future<List<Materia>> materias() async {
    final r = await _enviar('GET', '/materias', esperado: 200);
    return _lerLista(r, Materia.fromJson);
  }

  Future<EventoDetalhe> evento(String id) async {
    final r = await _enviar('GET', '/eventos/${Uri.encodeComponent(id)}', esperado: 200);
    return _ler(r, EventoDetalhe.fromJson);
  }

  Future<Evento> criarEvento(Map<String, dynamic> corpo) async {
    final r = await _enviar('POST', '/eventos', esperado: 201, corpo: corpo);
    return _ler(r, Evento.fromJson);
  }

  Future<Evento> atualizarEvento(String id, int version, Map<String, dynamic> corpo) async {
    final r = await _enviar('PATCH', '/eventos/${Uri.encodeComponent(id)}',
        esperado: 200, corpo: corpo, versao: version);
    return _ler(r, Evento.fromJson);
  }

  Future<void> excluirEvento(String id, int version) async {
    await _enviar('DELETE', '/eventos/${Uri.encodeComponent(id)}', esperado: 204, versao: version);
  }

  Future<void> marcarFeito(String eventoId, bool feito) async {
    await _enviar('PUT', '/eventos/${Uri.encodeComponent(eventoId)}/estado-pessoal',
        esperado: 204, corpo: {'feito': feito});
  }

  /// Faz a chamada, aplica timeout e traduz falha de rede e status inesperado.
  Future<http.Response> _enviar(
    String metodo,
    String caminho, {
    required int esperado,
    Object? corpo,
    int? versao,
    bool login = false,
  }) async {
    final uri = Uri.parse('$baseUrl$caminho');
    final cabecalhos = <String, String>{
      'Content-Type': 'application/json; charset=UTF-8',
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
      if (versao != null) 'If-Match': '$versao',
    };
    final body = corpo == null ? null : jsonEncode(corpo);
    final envio = switch (metodo) {
      'GET' => _client.get(uri, headers: cabecalhos),
      'POST' => _client.post(uri, headers: cabecalhos, body: body),
      'PUT' => _client.put(uri, headers: cabecalhos, body: body),
      'PATCH' => _client.patch(uri, headers: cabecalhos, body: body),
      'DELETE' => _client.delete(uri, headers: cabecalhos),
      _ => throw ArgumentError.value(metodo, 'metodo'),
    };

    final http.Response r;
    try {
      r = await envio.timeout(timeout);
    } on SocketException {
      throw const ApiException.semConexao();
    } on http.ClientException {
      throw const ApiException.semConexao();
    } on TimeoutException {
      throw const ApiException.semConexao(
          'O servidor demorou para responder — ele pode estar acordando. Tente de novo em instantes.');
    } on TlsException {
      throw const ApiException.semConexao();
    }

    if (r.statusCode != esperado) throw _erroHttp(r, login: login);
    return r;
  }

  /// Status que o app conhece sai com o texto do app: o do servidor é técnico e às vezes sem acento.
  /// O ProblemDetail (`detail`, depois `title`) só entra em 400, que diz qual campo está errado,
  /// e em status fora da tabela. Em 400 o `title` ("Bad Request") não entra.
  ApiException _erroHttp(http.Response r, {required bool login}) {
    final status = r.statusCode;
    // No login, 401 é sempre credencial errada; a mensagem genérica do servidor não serve.
    if (login && status == 401) {
      return const ApiException.http(401, 'E-mail ou senha incorretos.');
    }
    if (_statusConhecido(status)) return ApiException.http(status, _mensagemPadrao(status));
    final json = _decodificar(r);
    if (json is Map<String, dynamic>) {
      final detalhe = _textoPreenchido(json['detail']) ??
          (status == 400 ? null : _textoPreenchido(json['title']));
      if (detalhe != null) return ApiException.http(status, detalhe);
    }
    return ApiException.http(status, _mensagemPadrao(status));
  }

  /// Status com linha própria em [_mensagemPadrao], exceto 400, que tem regra à parte.
  bool _statusConhecido(int status) =>
      status >= 500 || const {401, 403, 404, 409, 428, 429}.contains(status);

  T _ler<T>(http.Response r, T Function(Map<String, dynamic>) fromJson) {
    return _converter(r, _decodificar(r), fromJson);
  }

  List<T> _lerLista<T>(http.Response r, T Function(Map<String, dynamic>) fromJson) {
    final json = _decodificar(r);
    if (json is! List) throw ApiException.respostaInvalida(r.statusCode);
    return [for (final item in json) _converter(r, item, fromJson)];
  }

  /// Só `FormatException` vira "resposta inválida": é o que os models lançam para dado ruim.
  T _converter<T>(http.Response r, Object? json, T Function(Map<String, dynamic>) fromJson) {
    if (json is! Map<String, dynamic>) throw ApiException.respostaInvalida(r.statusCode);
    try {
      return fromJson(json);
    } on FormatException {
      throw ApiException.respostaInvalida(r.statusCode);
    }
  }

  /// JSON do corpo em UTF-8, ou `null` se não for JSON válido. Quem chama decide o que `null` significa.
  Object? _decodificar(http.Response r) {
    try {
      return jsonDecode(utf8.decode(r.bodyBytes));
    } on FormatException {
      return null;
    }
  }

  String? _textoPreenchido(Object? valor) {
    if (valor is! String) return null;
    final texto = valor.trim();
    return texto.isEmpty ? null : texto;
  }

  String _mensagemPadrao(int status) => switch (status) {
        400 => 'Dados inválidos.',
        401 => 'Sessão expirada. Entre de novo.',
        403 => 'Você não tem permissão para isso.',
        404 => 'Não encontrado — pode ter sido excluído.',
        409 => 'Alguém alterou este evento antes de você. Recarregue e tente de novo.',
        428 => 'Faltou a versão do registro.',
        429 => 'Muitas tentativas. Espere alguns minutos.',
        >= 500 => 'Erro no servidor. Tente de novo em instantes.',
        _ => 'Erro HTTP $status.',
      };
}
