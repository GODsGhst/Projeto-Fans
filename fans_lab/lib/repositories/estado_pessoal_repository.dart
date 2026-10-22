import 'package:fans_lab/database/app_database.dart';
import 'package:sqflite/sqflite.dart';

/// `feito` é do usuário, não do evento: fica nesta tabela e nunca no cache da Home.
class EstadoPessoalRepository {
  final AbrirDb _abrir;

  EstadoPessoalRepository([AbrirDb? abrir])
    : _abrir = abrir ?? AppDatabase.abrir;

  /// Marca local: vai para a fila de envio (sincronizado = 0).
  Future<void> marcarLocal(String eventoId, bool feito) async {
    final db = await _abrir();
    await db.insert('estado_pessoal', {
      'evento_id': eventoId,
      'feito': feito ? 1 : 0,
      'sincronizado': 0,
    }, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<List<({String eventoId, bool feito})>> pendentes() async {
    final db = await _abrir();
    final linhas = await db.query(
      'estado_pessoal',
      where: 'sincronizado = ?',
      whereArgs: [0],
    );
    return [
      for (final l in linhas)
        (eventoId: l['evento_id'] as String, feito: l['feito'] == 1),
    ];
  }

  /// Só vira sincronizado se o valor enviado ainda é o atual. Se a pessoa mudou de novo
  /// durante o envio, a linha continua pendente.
  Future<void> marcarSincronizado(String eventoId, bool feito) async {
    final db = await _abrir();
    await db.update(
      'estado_pessoal',
      {'sincronizado': 1},
      where: 'evento_id = ? AND feito = ?',
      whereArgs: [eventoId, feito ? 1 : 0],
    );
  }

  Future<void> descartar(String eventoId) async {
    final db = await _abrir();
    await db.delete(
      'estado_pessoal',
      where: 'evento_id = ?',
      whereArgs: [eventoId],
    );
  }

  /// Grava o que veio do servidor, sem mexer nos ids que ainda têm mudança local pendente.
  Future<void> aplicarDoServidor(Map<String, bool> feitos) async {
    final db = await _abrir();
    await db.transaction((txn) async {
      final pendentes = await txn.query(
        'estado_pessoal',
        columns: ['evento_id'],
        where: 'sincronizado = ?',
        whereArgs: [0],
      );
      final idsPendentes = {
        for (final l in pendentes) l['evento_id'] as String,
      };
      for (final entrada in feitos.entries) {
        if (idsPendentes.contains(entrada.key)) continue;
        await txn.insert(
          'estado_pessoal',
          {
            'evento_id': entrada.key,
            'feito': entrada.value ? 1 : 0,
            'sincronizado': 1,
          },
          // replace em vez de UPSERT: SQLite antigo do Android não tem ON CONFLICT DO UPDATE.
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
    });
  }
}
