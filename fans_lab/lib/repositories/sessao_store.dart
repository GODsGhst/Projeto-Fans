import 'dart:convert';

import 'package:fans_lab/models/sessao.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Sessão, tema e datas de sincronização. A senha nunca passa por aqui.
class SessaoStore {
  static const _sessao = 'sessao';
  static const _temaEscuro = 'temaEscuro';
  static const _ultimaSincronizacao = 'ultimaSincronizacao';
  static const _homeSalvaEm = 'homeSalvaEm';

  Future<void> salvar(Sessao s) async {
    final prefs = await SharedPreferences.getInstance();
    // ponytail: JWT em SharedPreferences é texto puro; trocar por flutter_secure_storage (docs/ENTREGA-FLUTTER.md §9).
    await prefs.setString(_sessao, jsonEncode(s.toJson()));
  }

  Future<Sessao?> carregar() async {
    final prefs = await SharedPreferences.getInstance();
    final bruto = prefs.getString(_sessao);
    if (bruto == null) return null;
    try {
      final mapa = jsonDecode(bruto);
      if (mapa is! Map<String, dynamic>) {
        throw const FormatException('sessão salva não é um objeto');
      }
      return Sessao.fromJson(mapa);
    } on FormatException {
      // Sessão ilegível: apaga e devolve null, o que força novo login.
      // Não é falha de rede escondida; a rede não entra aqui.
      await prefs.remove(_sessao);
      return null;
    }
  }

  /// Logout. Mantém o tema, que é preferência do aparelho.
  Future<void> limpar() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_sessao);
    await prefs.remove(_ultimaSincronizacao);
    await prefs.remove(_homeSalvaEm);
  }

  Future<bool> temaEscuro() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_temaEscuro) ?? false;
  }

  Future<void> definirTemaEscuro(bool v) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_temaEscuro, v);
  }

  Future<DateTime?> ultimaSincronizacao() => _lerInstante(_ultimaSincronizacao);

  Future<void> registrarSincronizacao(DateTime t) =>
      _gravarInstante(_ultimaSincronizacao, t);

  Future<DateTime?> homeSalvaEm() => _lerInstante(_homeSalvaEm);

  Future<void> registrarHomeSalva(DateTime t) =>
      _gravarInstante(_homeSalvaEm, t);

  // Grava em UTC e devolve em hora local, que é o que a tela mostra.
  Future<DateTime?> _lerInstante(String chave) async {
    final prefs = await SharedPreferences.getInstance();
    final texto = prefs.getString(chave);
    return texto == null ? null : DateTime.parse(texto).toLocal();
  }

  Future<void> _gravarInstante(String chave, DateTime t) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(chave, t.toUtc().toIso8601String());
  }
}
