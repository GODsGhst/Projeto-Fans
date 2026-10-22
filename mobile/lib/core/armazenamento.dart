import 'dart:convert';
import 'dart:developer' as developer;

import 'package:shared_preferences/shared_preferences.dart';

import '../data/models.dart';

/// Sessão: {jwt, usuario, turmaId}. Mesma chave e formato do app Ionic.
const String chaveSessao = 'pf.sessao';

/// Snapshot offline: {eventos, materias, ultimoSync}. Um por aparelho.
const String chaveSnapshot = 'pf.snapshot';

/// Turma ativa do docente: {usuarioId, turmaId, nome}.
const String chaveTurmaAtiva = 'pf.turmaAtiva';

/// Disco do aparelho (SharedPreferences). JSON inválido: loga, apaga a chave e devolve null.
/// Nunca derruba o app.
class Armazenamento {
  Armazenamento(this._prefs);

  static Future<Armazenamento> abrir() async =>
      Armazenamento(await SharedPreferences.getInstance());

  final SharedPreferences _prefs;

  // ---- sessão

  Future<SessaoLocal?> lerSessao() =>
      _lerModelo(chaveSessao, SessaoLocal.fromJson);

  /// turmaId vai sempre gravado, null quando não há turma.
  Future<void> gravarSessao(String jwt, Usuario usuario, String? turmaId) =>
      _prefs.setString(
        chaveSessao,
        jsonEncode(SessaoLocal(jwt: jwt, usuario: usuario, turmaId: turmaId).toJson()),
      );

  Future<void> limparSessao() => _prefs.remove(chaveSessao);

  // ---- snapshot

  Future<SnapshotLocal?> lerSnapshot() =>
      _lerModelo(chaveSnapshot, SnapshotLocal.fromJson);

  Future<void> gravarSnapshot(SnapshotLocal s) =>
      _prefs.setString(chaveSnapshot, jsonEncode(s.toJson()));

  Future<void> limparSnapshot() => _prefs.remove(chaveSnapshot);

  /// Home e Matérias gravam partes diferentes do mesmo snapshot. Campo omitido mantém o atual.
  Future<void> mesclarSnapshot({
    List<ItemHome>? eventos,
    List<Materia>? materias,
  }) async {
    final atual = await lerSnapshot();
    await gravarSnapshot(
      SnapshotLocal(
        eventos: eventos ?? atual?.eventos ?? const [],
        materias: materias ?? atual?.materias ?? const [],
        ultimoSync: DateTime.now().toUtc().toIso8601String(),
      ),
    );
  }

  // ---- turma ativa

  /// Campo com tipo errado é ignorado em silêncio, sem apagar a chave.
  Future<TurmaAtiva?> lerTurmaAtiva() async {
    final lido = await lerJson(chaveTurmaAtiva);
    return lido is Map<String, dynamic> ? TurmaAtiva.tryFromJson(lido) : null;
  }

  Future<void> gravarTurmaAtiva(TurmaAtiva t) =>
      _prefs.setString(chaveTurmaAtiva, jsonEncode(t.toJson()));

  Future<void> removerTurmaAtiva() => _prefs.remove(chaveTurmaAtiva);

  // ---- baixo nível (outras áreas, como os lembretes)

  /// JSON inválido: loga, apaga a chave, devolve null.
  Future<Object?> lerJson(String chave) async {
    final texto = _prefs.getString(chave);
    if (texto == null) return null;
    try {
      return jsonDecode(texto);
    } on FormatException catch (e, s) {
      developer.log(
        '[storage] $chave ilegível, descartando',
        name: 'armazenamento',
        error: e,
        stackTrace: s,
        level: 1000,
      );
      await _prefs.remove(chave);
      return null;
    }
  }

  Future<void> gravarJson(String chave, Object valor) =>
      _prefs.setString(chave, jsonEncode(valor));

  Future<void> remover(String chave) => _prefs.remove(chave);

  /// Lê um modelo. Estrutura inválida conta como JSON inválido: loga, apaga e devolve null.
  Future<T?> _lerModelo<T>(
    String chave,
    T Function(Map<String, dynamic>) de,
  ) async {
    final lido = await lerJson(chave);
    if (lido == null) return null;
    if (lido is! Map<String, dynamic>) {
      return _descartar(chave, 'não é um objeto');
    }
    try {
      return de(lido);
    } on Object catch (e, s) {
      developer.log(
        '[storage] $chave com estrutura inválida, descartando',
        name: 'armazenamento',
        error: e,
        stackTrace: s,
        level: 1000,
      );
      await _prefs.remove(chave);
      return null;
    }
  }

  Future<T?> _descartar<T>(String chave, String motivo) async {
    developer.log(
      '[storage] $chave $motivo, descartando',
      name: 'armazenamento',
      level: 1000,
    );
    await _prefs.remove(chave);
    return null;
  }
}
