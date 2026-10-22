import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

/// Quem abre o banco. Os repositórios recebem isto para os testes trocarem por um banco em memória.
typedef AbrirDb = Future<Database> Function();

// Esquema versão 1. Para mudar a estrutura, crie a versão 2 com onUpgrade; não edite isto.
const _esquema = [
  '''CREATE TABLE home_cache (
    evento_id TEXT PRIMARY KEY,
    posicao INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    titulo TEXT NOT NULL,
    data TEXT NOT NULL,
    hora TEXT,
    materia_sigla TEXT NOT NULL,
    materia_cor_hex TEXT NOT NULL,
    autoria_json TEXT NOT NULL)''',
  '''CREATE TABLE materias (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    sigla TEXT NOT NULL,
    cor_hex TEXT NOT NULL,
    sala TEXT,
    professor TEXT)''',
  '''CREATE TABLE rascunhos (
    local_id INTEGER PRIMARY KEY AUTOINCREMENT,
    materia_id TEXT NOT NULL,
    materia_sigla TEXT NOT NULL,
    materia_cor_hex TEXT NOT NULL,
    tipo TEXT NOT NULL,
    titulo TEXT NOT NULL,
    data TEXT NOT NULL,
    hora TEXT,
    sala TEXT,
    criado_em TEXT NOT NULL,
    sincronizado INTEGER NOT NULL,
    ultimo_erro TEXT)''',
  '''CREATE TABLE estado_pessoal (
    evento_id TEXT PRIMARY KEY,
    feito INTEGER NOT NULL,
    sincronizado INTEGER NOT NULL)''',
];

const _tabelas = ['home_cache', 'materias', 'rascunhos', 'estado_pessoal'];

class AppDatabase {
  static Database? _db;

  /// Banco do aparelho (singleton). Arquivo fans_lab.db.
  static Future<Database> abrir() async {
    final existente = _db;
    if (existente != null) return existente;
    final caminho = join(await getDatabasesPath(), 'fans_lab.db');
    return _db = await openDatabase(caminho, version: 1, onCreate: _criar);
  }

  /// Só para testes: cada chamada devolve um banco NOVO, vazio.
  static Future<Database> abrirEmMemoria() => databaseFactory.openDatabase(
    inMemoryDatabasePath,
    options: OpenDatabaseOptions(
      version: 1,
      onCreate: _criar,
      singleInstance: false,
    ),
  );

  /// Logout. Apaga só o cache do aparelho: o histórico (eventos, autoria) mora no servidor.
  static Future<void> limparTudo([AbrirDb? abrir]) async {
    final db = await (abrir ?? AppDatabase.abrir)();
    await db.transaction((txn) async {
      for (final tabela in _tabelas) {
        await txn.delete(tabela);
      }
    });
  }

  static Future<void> _criar(Database db, int versao) async {
    for (final sql in _esquema) {
      await db.execute(sql);
    }
  }
}
