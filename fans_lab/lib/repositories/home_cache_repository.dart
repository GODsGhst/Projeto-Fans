import 'package:fans_lab/database/app_database.dart';
import 'package:fans_lab/models/item_home.dart';

/// Último snapshot da Home que veio do servidor. A ordem é a do servidor (coluna `posicao`).
class HomeCacheRepository {
  final AbrirDb _abrir;

  HomeCacheRepository([AbrirDb? abrir]) : _abrir = abrir ?? AppDatabase.abrir;

  /// Troca o snapshot inteiro, numa transação.
  Future<void> substituir(List<ItemHome> itens) async {
    final db = await _abrir();
    await db.transaction((txn) async {
      await txn.delete('home_cache');
      for (var i = 0; i < itens.length; i++) {
        await txn.insert('home_cache', itens[i].toMap(i));
      }
    });
  }

  /// `feito` vem do LEFT JOIN com estado_pessoal; sem linha lá, é false.
  Future<List<ItemHome>> listar() async {
    final db = await _abrir();
    final linhas = await db.rawQuery(
      'SELECT h.*, e.feito AS feito FROM home_cache h '
      'LEFT JOIN estado_pessoal e ON e.evento_id = h.evento_id '
      'ORDER BY h.posicao',
    );
    return [
      for (final linha in linhas)
        ItemHome.fromMap(linha, feito: linha['feito'] == 1),
    ];
  }
}
