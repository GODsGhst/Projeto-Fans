import 'dart:async';
import 'dart:convert';
import 'dart:developer' as developer;

import 'package:http/http.dart' as http;

import '../data/models.dart';
import 'config.dart';
import 'erro_api.dart';

/// Cabeçalho com a turma ativa do docente.
const String cabecalhoTurma = 'X-Turma-Id';

/// Código que o servidor manda em 404 quando a pessoa não tem vínculo nenhum.
const String codigoSemTurma = 'SEM_TURMA';

/// Único ponto que fala com a API. Reproduz os quatro interceptores do Ionic, nesta ordem:
/// Authorization, X-Turma-Id, tradução de erro e teto de espera. Nunca engole erro: relança
/// [ErroApi]. Quem chama decide o que mostrar.
class ApiClient {
  ApiClient({
    required this.token,
    required this.ehDocente,
    required this.turmaAtiva,
    required this.onSessaoExpirada,
    required this.onSemTurma,
    this.baseUrl = apiUrl,
    this.tetoDeEspera = tetoDeEsperaPadrao,
    http.Client? client,
  }) : _client = client ?? http.Client();

  /// Token atual da sessão, ou null.
  final String? Function() token;

  /// true se a conta é docente (tipo presente e diferente de ALUNO).
  final bool Function() ehDocente;

  /// Turma ativa do docente. Deve esperar a leitura do disco antes de responder.
  final Future<String?> Function() turmaAtiva;

  /// Chamado no 401, antes de o erro sair. Encerra a sessão e leva ao login.
  final void Function() onSessaoExpirada;

  /// Chamado no 404 com codigo SEM_TURMA. Esquece o vínculo e leva a entrar numa turma.
  final void Function() onSemTurma;

  /// Base da API, sem barra no fim.
  final String baseUrl;

  /// Teto total por requisição, desde o envio. A espera do disco não entra.
  final Duration tetoDeEspera;

  final http.Client _client;

  Future<T> get<T>(String rota, {Map<String, Object?>? params}) =>
      _executar<T>('GET', rota, params: params);

  /// [cabecalhos] extras vão por cima dos padrões — hoje só o X-IA-Key do resumo.
  Future<T> post<T>(String rota, {Object? corpo, Map<String, String>? cabecalhos}) =>
      _executar<T>(
        'POST',
        rota,
        corpo: corpo ?? const <String, Object?>{},
        extras: cabecalhos,
      );

  Future<T> put<T>(String rota, {Object? corpo}) =>
      _executar<T>('PUT', rota, corpo: corpo ?? const <String, Object?>{});

  /// If-Match só quando [version] vem. Sem ele o servidor responde 428.
  Future<T> patch<T>(String rota, {Object? corpo, int? version}) =>
      _executar<T>('PATCH', rota, corpo: corpo, version: version);

  /// If-Match só quando [version] vem.
  Future<T> delete<T>(String rota, {int? version}) =>
      _executar<T>('DELETE', rota, version: version);

  /// GET /saude no boot: só acorda o servidor. Sem Authorization, sem teto, erro só no log.
  void acordarServidor() {
    unawaited(
      _client.get(Uri.parse('$baseUrl/saude')).then<void>(
        (_) {},
        onError: (Object e, StackTrace s) {
          developer.log(
            '[api] aquecimento do servidor falhou (ignorado)',
            name: 'api',
            error: e,
            stackTrace: s,
          );
        },
      ),
    );
  }

  Future<T> _executar<T>(
    String metodo,
    String rota, {
    Map<String, Object?>? params,
    Object? corpo,
    int? version,
    Map<String, String>? extras,
  }) async {
    final url = '$baseUrl$rota';
    final cabecalhos = await _cabecalhos(
      url,
      comCorpo: corpo != null,
      version: version,
    );
    if (extras != null) cabecalhos.addAll(extras);
    final resposta = await _enviar(
      metodo,
      _uri(url, params),
      cabecalhos,
      corpo,
    );
    final status = resposta.statusCode;
    if (status >= 200 && status < 300) {
      return _decodificar<T>(resposta);
    }
    final erro = _traduzir(resposta);
    if (erro.classe == ClasseErro.auth) onSessaoExpirada();
    if (erro.codigo == codigoSemTurma) onSemTurma();
    throw erro;
  }

  /// Interceptores 1 e 2. Authorization sai sempre que há token, exceto em URL com /auth/.
  /// X-Turma-Id só para docente, só na API e só com turma ativa.
  Future<Map<String, String>> _cabecalhos(
    String url, {
    required bool comCorpo,
    int? version,
  }) async {
    final cabecalhos = <String, String>{};
    final jwt = token();
    if (jwt != null && !url.contains('/auth/')) {
      cabecalhos['Authorization'] = 'Bearer $jwt';
    }
    // "É docente?" é decidido ANTES de esperar a turma, como no Ionic.
    if (ehDocente() && url.startsWith(baseUrl)) {
      final turma = await turmaAtiva();
      if (turma != null) cabecalhos[cabecalhoTurma] = turma;
    }
    if (version != null) cabecalhos['If-Match'] = '$version';
    if (comCorpo) cabecalhos['Content-Type'] = 'application/json';
    return cabecalhos;
  }

  Uri _uri(String url, Map<String, Object?>? params) {
    final uri = Uri.parse(url);
    final query = {
      for (final e in (params ?? const <String, Object?>{}).entries)
        if (e.value != null) e.key: '${e.value}',
    };
    if (query.isEmpty) return uri;
    return uri.replace(queryParameters: {...uri.queryParameters, ...query});
  }

  /// Interceptor 4 (teto de 75 s). Estourar cancela a requisição e vira DEMOROU. Falha de
  /// rede vira OFFLINE. Qualquer outra exceção sobe crua.
  Future<http.Response> _enviar(
    String metodo,
    Uri uri,
    Map<String, String> cabecalhos,
    Object? corpo,
  ) async {
    final cancelar = Completer<void>();
    final req = http.AbortableRequest(metodo, uri, abortTrigger: cancelar.future)
      ..headers.addAll(cabecalhos);
    if (corpo != null) req.body = jsonEncode(corpo);
    try {
      return await _ida(req).timeout(tetoDeEspera);
    } on TimeoutException {
      cancelar.complete();
      throw const ErroApi(
        classe: ClasseErro.demorou,
        status: 0,
        message: 'O servidor demorou demais para responder. Tente de novo.',
        podeTentarNovamente: true,
      );
    } on http.ClientException {
      // SocketException no IO chega aqui embrulhada em ClientException.
      throw const ErroApi(
        classe: ClasseErro.offline,
        status: 0,
        message: 'Sem conexão.',
        podeTentarNovamente: true,
      );
    }
  }

  Future<http.Response> _ida(http.AbortableRequest req) async =>
      http.Response.fromStream(await _client.send(req));

  /// Corpo vazio (204) vira null. Não se faz jsonDecode de corpo vazio.
  T _decodificar<T>(http.Response r) {
    final texto = utf8.decode(r.bodyBytes, allowMalformed: true);
    if (texto.trim().isEmpty) return null as T;
    try {
      return jsonDecode(texto) as T;
    } on FormatException {
      throw ErroApi(
        classe: ClasseErro.desconhecido,
        status: r.statusCode,
        message: 'Não deu para completar a ação.',
      );
    }
  }

  /// Interceptor 3. Tradução de status. A ordem das regras importa.
  ErroApi _traduzir(http.Response r) {
    final s = r.statusCode;
    final problema = _lerProblema(utf8.decode(r.bodyBytes, allowMalformed: true));
    final doServidor = _doServidor(problema);
    if (s == 401) {
      return ErroApi(
        classe: ClasseErro.auth,
        status: s,
        message: doServidor ?? 'Sua sessão expirou. Entre de novo.',
      );
    }
    if (s == 403) {
      return ErroApi(
        classe: ClasseErro.proibido,
        status: s,
        message: doServidor ?? 'Só quem criou pode editar.',
      );
    }
    if (s == 404) {
      return ErroApi(
        classe: ClasseErro.naoEncontrado,
        status: s,
        message: doServidor ?? 'Isso não existe mais.',
        codigo: problema?.codigo,
      );
    }
    if (s == 409) {
      return ErroApi(
        classe: ClasseErro.conflito,
        status: s,
        message: doServidor ?? 'Alguém editou isso enquanto você editava.',
        recarregarRegistro: true,
      );
    }
    if (s == 428) {
      return ErroApi(
        classe: ClasseErro.precondicao,
        status: s,
        message: doServidor ?? 'Recarregue o registro e tente de novo.',
      );
    }
    if (s >= 500) {
      // Sempre a frase fixa. O detail do servidor nunca aparece em 5xx.
      return ErroApi(
        classe: ClasseErro.servidor,
        status: s,
        message: 'Deu problema no servidor. Tente de novo.',
        podeTentarNovamente: true,
      );
    }
    return ErroApi(
      classe: ClasseErro.desconhecido,
      status: s,
      message: doServidor ?? 'Não deu para completar a ação.',
    );
  }

  /// Corpo que não é JSON (HTML de proxy, vazio) não tem detail. Vale a frase padrão.
  ProblemDetail? _lerProblema(String texto) {
    Object? json;
    try {
      json = jsonDecode(texto);
    } on FormatException {
      return null;
    }
    return json is Map<String, dynamic> ? ProblemDetail.fromJson(json) : null;
  }

  /// detail tem prioridade sobre title. Texto vazio conta como ausente.
  String? _doServidor(ProblemDetail? p) {
    for (final candidato in [p?.detail, p?.title]) {
      if (candidato != null && candidato.trim().isNotEmpty) return candidato;
    }
    return null;
  }
}
