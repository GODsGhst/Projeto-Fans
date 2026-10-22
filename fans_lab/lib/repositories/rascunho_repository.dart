import 'package:fans_lab/database/app_database.dart';
import 'package:fans_lab/models/rascunho_evento.dart';

/// Eventos criados no aparelho, esperando ir para o servidor (fila offline).
class RascunhoRepository {
  final AbrirDb _abrir;

  RascunhoRepository([AbrirDb? abrir]) : _abrir = abrir ?? AppDatabase.abrir;

  /// Insere sempre uma linha nova e devolve o local_id gerado.
  Future<int> inserir(RascunhoEvento r) async {
    final db = await _abrir();
    final mapa = r.toMap()..remove('local_id');
    return db.insert('rascunhos', mapa);
  }

  Future<List<RascunhoEvento>> listar() async {
    final db = await _abrir();
    final linhas = await db.query('rascunhos', orderBy: 'local_id DESC');
    return [for (final linha in linhas) RascunhoEvento.fromMap(linha)];
  }

  /// Os que ainda precisam ir ao servidor, na ordem em que foram criados.
  Future<List<RascunhoEvento>> listarPendentes() async {
    final db = await _abrir();
    final linhas = await db.query(
      'rascunhos',
      where: 'sincronizado = ?',
      whereArgs: [0],
      orderBy: 'local_id ASC',
    );
    return [for (final linha in linhas) RascunhoEvento.fromMap(linha)];
  }

  Future<void> atualizar(RascunhoEvento r) async {
    final id = r.localId;
    if (id == null) throw ArgumentError('atualizar exige localId');
    final db = await _abrir();
    final mapa = r.toMap()..remove('local_id');
    await db.update('rascunhos', mapa, where: 'local_id = ?', whereArgs: [id]);
  }

  Future<void> excluir(int localId) async {
    final db = await _abrir();
    await db.delete('rascunhos', where: 'local_id = ?', whereArgs: [localId]);
  }

  Future<void> marcarSincronizado(int localId) async {
    final db = await _abrir();
    await db.update(
      'rascunhos',
      {'sincronizado': 1, 'ultimo_erro': null},
      where: 'local_id = ?',
      whereArgs: [localId],
    );
  }

  /// Mantém sincronizado = 0: o rascunho continua na fila e será tentado de novo.
  Future<void> registrarErro(int localId, String erro) async {
    final db = await _abrir();
    await db.update(
      'rascunhos',
      {'ultimo_erro': erro},
      where: 'local_id = ?',
      whereArgs: [localId],
    );
  }
}
