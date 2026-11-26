import 'dart:convert';

import 'package:fans_lab/models/sessao.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Sessão, tema e datas de sincronização. A senha nunca passa por aqui.
///
/// A sessão carrega o JWT, que é credencial: fica no cofre do sistema
/// (Keystore no Android, WebCrypto no navegador). O resto não é segredo e fica
/// em SharedPreferences.
class SessaoStore {
  SessaoStore([this._cofre = const FlutterSecureStorage()]);

  final FlutterSecureStorage _cofre;

  static const _sessao = 'sessao';
  static const _temaEscuro = 'temaEscuro';
  static const _ultimaSincronizacao = 'ultimaSincronizacao';
  static const _homeSalvaEm = 'homeSalvaEm';
  // Dono da última sessão. Sobrevive a limpar(): serve para não enviar a fila de uma conta com a autoria de outra.
  static const _ultimoUsuarioId = 'ultimoUsuarioId';

  Future<void> salvar(Sessao s) async {
    await _cofre.write(key: _sessao, value: jsonEncode(s.toJson()));
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_sessao); // cópia de antes do cofre, se ainda houver
    await prefs.setString(_ultimoUsuarioId, s.usuario.id);
  }

  /// Id de quem entrou por último, ou null se nunca houve sessão neste aparelho.
  Future<String?> ultimoUsuarioId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_ultimoUsuarioId);
  }

  /// Sessão ilegível é apagada e vira null, o que força novo login. Não é falha
  /// de rede escondida: a rede não entra aqui. Falha de plataforma do cofre propaga.
  Future<Sessao?> carregar() async {
    final noCofre = await _cofre.read(key: _sessao);
    if (noCofre != null) {
      final s = _ler(noCofre);
      if (s == null) await _cofre.delete(key: _sessao);
      return s;
    }
    // Instalação de antes do cofre: a sessão estava em SharedPreferences.
    // Migra na primeira leitura, sem deslogar ninguém, e apaga a cópia em texto puro.
    final prefs = await SharedPreferences.getInstance();
    final antiga = prefs.getString(_sessao);
    if (antiga == null) return null;
    final s = _ler(antiga);
    if (s != null) await _cofre.write(key: _sessao, value: antiga);
    await prefs.remove(_sessao);
    return s;
  }

  static Sessao? _ler(String bruto) {
    try {
      final mapa = jsonDecode(bruto);
      return mapa is Map<String, dynamic> ? Sessao.fromJson(mapa) : null;
    } on FormatException {
      return null;
    }
  }

  /// Logout ou sessão expirada. Mantém o tema (preferência do aparelho) e o dono da última sessão.
  Future<void> limpar() async {
    await _cofre.delete(key: _sessao);
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
