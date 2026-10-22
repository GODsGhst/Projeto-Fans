import 'package:fans_lab/database/app_database.dart';
import 'package:fans_lab/models/materia.dart';

class MateriaRepository {
  final AbrirDb _abrir;

  MateriaRepository([AbrirDb? abrir]) : _abrir = abrir ?? AppDatabase.abrir;

  /// Troca a lista inteira de matérias, numa transação.
  Future<void> substituirTodas(List<Materia> materias) async {
    final db = await _abrir();
    await db.transaction((txn) async {
      await txn.delete('materias');
      for (final m in materias) {
        await txn.insert('materias', m.toMap());
      }
    });
  }

  Future<List<Materia>> listar() async {
    final db = await _abrir();
    final linhas = await db.query('materias', orderBy: 'sigla');
    return [for (final linha in linhas) Materia.fromMap(linha)];
  }
}
