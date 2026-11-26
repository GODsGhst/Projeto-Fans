import 'dart:typed_data';

import 'package:dio/dio.dart';

import 'package:fans_lab/models/material_aula.dart';
import 'package:fans_lab/services/api_exception.dart';
import 'package:fans_lab/services/api_service.dart';

/// Envio de arquivo em `multipart/form-data`, com Dio por causa do progresso
/// (`onSendProgress`), que funciona também no navegador. O resto do app fala
/// HTTP pelo [ApiService]; daqui saem só o endereço e o token.
///
/// Contrato do servidor: `POST /eventos/{id}/arquivos`, campo `arquivo` e campo
/// opcional `descricao`; responde 201 com o material criado, já vinculado ao evento.
class UploadService {
  UploadService(this._api, {Dio? dio})
      : _dio = dio ??
            Dio(BaseOptions(
              connectTimeout: const Duration(seconds: 15),
              sendTimeout: const Duration(minutes: 2),
              // Mesmo teto do ApiService: o Render gratuito leva ~50 s para acordar.
              receiveTimeout: const Duration(seconds: 90),
            ));

  final ApiService _api;
  final Dio _dio;

  /// Mesmo teto do servidor.
  static const tetoBytes = 5 * 1024 * 1024;
  static const extensoes = ['pdf', 'png', 'jpg', 'jpeg'];

  /// Confere no aparelho para orientar antes de gastar rede. Não protege nada: o
  /// servidor confere de novo, e lá olha os primeiros bytes, não só o nome.
  static String? validar(String nome, int tamanho) {
    final ponto = nome.lastIndexOf('.');
    final extensao = ponto < 0 ? '' : nome.substring(ponto + 1).toLowerCase();
    if (!extensoes.contains(extensao)) return 'Escolha um PDF, PNG ou JPG.';
    if (tamanho == 0) return 'O arquivo está vazio.';
    if (tamanho > tetoBytes) {
      return 'O arquivo tem ${tamanhoLegivel(tamanho)}. O limite é 5 MB.';
    }
    return null;
  }

  Future<MaterialAula> enviar({
    required String eventoId,
    required String nome,
    required Uint8List bytes,
    String? descricao,
    void Function(int enviados, int total)? aoEnviar,
  }) async {
    final token = _api.token;
    final texto = descricao?.trim() ?? '';
    final formulario = FormData.fromMap({
      'arquivo': MultipartFile.fromBytes(bytes, filename: nome),
      if (texto.isNotEmpty) 'descricao': texto,
    });
    final Response<Object?> r;
    try {
      // Sem Content-Type à mão: o Dio põe multipart/form-data com o boundary certo.
      r = await _dio.post<Object?>(
        '${_api.baseUrl}/eventos/${Uri.encodeComponent(eventoId)}/arquivos',
        data: formulario,
        options: Options(headers: {if (token != null) 'Authorization': 'Bearer $token'}),
        onSendProgress: aoEnviar,
      );
    } on DioException catch (e) {
      throw _traduzir(e);
    }
    final json = r.data;
    if (r.statusCode != 201 || json is! Map<String, dynamic>) {
      throw ApiException.respostaInvalida(r.statusCode ?? 0);
    }
    try {
      return MaterialAula.fromJson(json);
    } on FormatException {
      throw ApiException.respostaInvalida(201);
    }
  }

  ApiException _traduzir(DioException e) {
    final status = e.response?.statusCode;
    return switch (e.type) {
      DioExceptionType.connectionTimeout ||
      DioExceptionType.sendTimeout ||
      DioExceptionType.receiveTimeout =>
        const ApiException.semConexao(
            'O servidor demorou para responder — ele pode estar acordando. Tente de novo em instantes.'),
      DioExceptionType.badResponse when status != null => ApiException.http(status, _mensagem(status)),
      // Sem rede, DNS, TLS; no navegador, também a origem recusada (CORS).
      _ => const ApiException.semConexao(),
    };
  }

  String _mensagem(int status) => switch (status) {
        401 => 'Sessão expirada. Entre de novo.',
        403 => 'Você não tem permissão para enviar arquivos aqui.',
        404 => 'Evento não encontrado — pode ter sido excluído.',
        413 => 'O arquivo passa do limite de 5 MB aceito pelo servidor.',
        415 => 'O servidor só aceita PDF, PNG ou JPG de verdade.',
        >= 500 => 'Erro no servidor. Tente de novo em instantes.',
        _ => 'O servidor recusou o envio (HTTP $status).',
      };
}

/// "340 KB", "1,2 MB".
String tamanhoLegivel(int bytes) {
  if (bytes < 1024 * 1024) return '${(bytes / 1024).ceil()} KB';
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1).replaceAll('.', ',')} MB';
}
