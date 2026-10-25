import 'dart:async';
import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';

import '../core/api.dart';
import '../core/armazenamento.dart';
import '../core/erro_api.dart';
import 'models.dart';

/// Matérias da turma. `corHex` vem sempre do servidor. O app nunca inventa cor nem mostra cor
/// sem sigla.
class MateriaRepository {
  MateriaRepository({
    required this.api,
    required this.armazenamento,
  });

  final ApiClient api;
  final Armazenamento armazenamento;

  final ValueNotifier<List<Materia>> materias =
      ValueNotifier<List<Materia>>(const []);
  final ValueNotifier<bool> carregando = ValueNotifier<bool>(false);
  final ValueNotifier<String?> erro = ValueNotifier<String?>(null);

  /// Se o servidor já respondeu nesta carga. Cobre a corrida: turma sem matérias recebe lista
  /// vazia, e sem esta guarda o disco repintaria o que já foi apagado.
  bool _servidorRespondeu = false;

  /// `GET /materias`. Falha guarda a mensagem e relança.
  Future<void> carregar() async {
    carregando.value = true;
    erro.value = null;
    _servidorRespondeu = false;
    final emVoo = api.get<List<dynamic>>('/materias');
    _emSegundoPlano(_aquecerDoDisco());
    try {
      final bruto = await emVoo;
      final doServidor = [
        for (final e in bruto) Materia.fromJson(e as Map<String, dynamic>),
      ];
      _servidorRespondeu = true;
      materias.value = doServidor;
      await armazenamento.mesclarSnapshot(materias: doServidor);
    } catch (e) {
      erro.value = e is ErroApi ? e.message : 'Não deu para carregar as matérias.';
      rethrow;
    } finally {
      carregando.value = false;
    }
  }

  /// Põe na tela as matérias do aparelho antes de perguntar. Mesma regra da Home.
  Future<void> _aquecerDoDisco() async {
    if (materias.value.isNotEmpty) return;
    final snapshot = await armazenamento.lerSnapshot();
    if (!_servidorRespondeu &&
        snapshot != null &&
        snapshot.materias.isNotEmpty) {
      materias.value = snapshot.materias;
    }
  }

  /// Materiais separados por tipo, mais os eventos da matéria.
  Future<MateriaDetalhe> detalhe(String materiaId) async =>
      MateriaDetalhe.fromJson(
        await api.get<Map<String, dynamic>>('/materias/$materiaId'),
      );

  Future<Materia> criar(CriarMateriaRequest req) async => Materia.fromJson(
        await api.post<Map<String, dynamic>>('/materias', corpo: req.toJson()),
      );

  /// Só o líder. `materia` não tem `version`, então não vai If-Match: o PATCH substitui tudo.
  Future<Materia> atualizar(String id, CriarMateriaRequest req) async =>
      Materia.fromJson(
        await api.patch<Map<String, dynamic>>(
          '/materias/$id',
          corpo: req.toJson(),
        ),
      );

  /// Só o líder, e só matéria vazia: com prova ou material o servidor responde 409.
  Future<void> apagar(String id) => api.delete<void>('/materias/$id');

  /// Trabalho de fundo que não pode derrubar a carga: falha vai para o log.
  void _emSegundoPlano(Future<void> trabalho) {
    unawaited(
      trabalho.catchError((Object e, StackTrace s) {
        developer.log(
          '[materias] falha ao ler o disco',
          name: 'materias',
          error: e,
          stackTrace: s,
          level: 1000,
        );
      }),
    );
  }

  void dispose() {
    materias.dispose();
    carregando.dispose();
    erro.dispose();
  }
}
