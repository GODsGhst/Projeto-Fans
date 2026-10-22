import 'package:fans_lab/database/app_database.dart';
import 'package:fans_lab/models/autoria.dart';
import 'package:fans_lab/models/formatos.dart';
import 'package:fans_lab/models/item_home.dart';
import 'package:fans_lab/models/materia.dart';
import 'package:fans_lab/models/rascunho_evento.dart';
import 'package:fans_lab/models/tipo_evento.dart';
import 'package:fans_lab/repositories/estado_pessoal_repository.dart';
import 'package:fans_lab/repositories/home_cache_repository.dart';
import 'package:fans_lab/repositories/materia_repository.dart';
import 'package:fans_lab/repositories/rascunho_repository.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

final _autoria = Autoria(
  autorId: 'a0000000-0000-4000-8000-000000000001',
  autorNome: 'Ana',
  criadoEm: DateTime.utc(2026, 10, 20, 13),
);

ItemHome _item(String id, String data, {TipoEvento tipo = TipoEvento.prova}) =>
    ItemHome(
      eventoId: id,
      tipo: tipo,
      titulo: 'Titulo $id',
      data: lerData(data),
      hora: '19:00',
      materiaSigla: 'BD',
      materiaCorHex: '#1D4ED8',
      autoria: _autoria,
    );

RascunhoEvento _rascunho(
  String titulo, {
  int? localId,
  String? hora = '19:00',
}) => RascunhoEvento(
  localId: localId,
  materiaId: 'm1',
  materiaSigla: 'BD',
  materiaCorHex: '#1D4ED8',
  tipo: TipoEvento.prova,
  titulo: titulo,
  data: lerData('2026-10-25'),
  hora: hora,
  criadoEm: DateTime.utc(2026, 10, 22, 12),
);

Future<Map<String, Object?>?> _linhaEstado(Database db, String id) async {
  final linhas = await db.query(
    'estado_pessoal',
    where: 'evento_id = ?',
    whereArgs: [id],
  );
  return linhas.isEmpty ? null : linhas.single;
}

void main() {
  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
  });

  group('home_cache', () {
    test(
      'listar devolve a ordem do servidor, sem reordenar por data',
      () async {
        final db = await AppDatabase.abrirEmMemoria();
        final repo = HomeCacheRepository(() async => db);

        // Fora de ordem de data de propósito: a ordem é a que veio do servidor.
        await repo.substituir([
          _item('e1', '2026-10-25'),
          _item('e2', '2026-10-20', tipo: TipoEvento.entrega),
          _item('e3', '2026-10-22'),
        ]);

        final lista = await repo.listar();
        expect(lista.map((i) => i.eventoId), ['e1', 'e2', 'e3']);
        expect(lista[1].tipo, TipoEvento.entrega);
        expect(lista[0].autoria.autorNome, 'Ana');
      },
    );

    test('substituir troca o snapshot inteiro', () async {
      final db = await AppDatabase.abrirEmMemoria();
      final repo = HomeCacheRepository(() async => db);

      await repo.substituir([
        _item('e1', '2026-10-25'),
        _item('e2', '2026-10-26'),
      ]);
      await repo.substituir([_item('e9', '2026-10-27')]);

      final lista = await repo.listar();
      expect(lista.map((i) => i.eventoId), ['e9']);
    });

    test('feito vem do estado_pessoal e não fica no cache', () async {
      final db = await AppDatabase.abrirEmMemoria();
      final home = HomeCacheRepository(() async => db);
      final estado = EstadoPessoalRepository(() async => db);

      await home.substituir([_item('e1', '2026-10-25')]);
      expect((await home.listar()).single.feitoPeloUsuario, isFalse);

      await estado.marcarLocal('e1', true);
      expect((await home.listar()).single.feitoPeloUsuario, isTrue);

      final linhaCache = (await db.query('home_cache')).single;
      expect(linhaCache.containsKey('feito'), isFalse);
    });
  });

  group('estado_pessoal', () {
    test('aplicarDoServidor não sobrescreve pendente local', () async {
      final db = await AppDatabase.abrirEmMemoria();
      final estado = EstadoPessoalRepository(() async => db);

      await estado.marcarLocal('e1', true);
      await estado.aplicarDoServidor({'e1': false});

      final pendentes = await estado.pendentes();
      expect(pendentes.single.eventoId, 'e1');
      expect(pendentes.single.feito, isTrue);
    });

    test(
      'aplicarDoServidor sobrescreve o que já estava sincronizado',
      () async {
        final db = await AppDatabase.abrirEmMemoria();
        final estado = EstadoPessoalRepository(() async => db);

        await estado.aplicarDoServidor({'e2': false});
        await estado.aplicarDoServidor({'e2': true});

        final linha = await _linhaEstado(db, 'e2');
        expect(linha!['feito'], 1);
        expect(linha['sincronizado'], 1);
        expect(await estado.pendentes(), isEmpty);
      },
    );

    test('marcarSincronizado com feito diferente mantém pendente', () async {
      final db = await AppDatabase.abrirEmMemoria();
      final estado = EstadoPessoalRepository(() async => db);

      await estado.marcarLocal('e3', true);
      // A pessoa desmarcou durante o envio: o envio de "true" não conta mais.
      await estado.marcarSincronizado('e3', false);
      expect((await estado.pendentes()).single.feito, isTrue);

      await estado.marcarSincronizado('e3', true);
      expect(await estado.pendentes(), isEmpty);
    });

    test('descartar remove a linha', () async {
      final db = await AppDatabase.abrirEmMemoria();
      final home = HomeCacheRepository(() async => db);
      final estado = EstadoPessoalRepository(() async => db);

      await home.substituir([_item('e4', '2026-10-25')]);
      await estado.marcarLocal('e4', true);
      await estado.descartar('e4');

      expect(await estado.pendentes(), isEmpty);
      expect(await _linhaEstado(db, 'e4'), isNull);
      expect((await home.listar()).single.feitoPeloUsuario, isFalse);
    });
  });

  group('rascunhos', () {
    test('inserir, listar, atualizar e excluir', () async {
      final db = await AppDatabase.abrirEmMemoria();
      final repo = RascunhoRepository(() async => db);

      final id1 = await repo.inserir(_rascunho('Prova 2'));
      final id2 = await repo.inserir(_rascunho('Prova 3'));
      expect(id2, greaterThan(id1));

      // local_id DESC: o mais recente primeiro.
      var lista = await repo.listar();
      expect(lista.map((r) => r.titulo), ['Prova 3', 'Prova 2']);

      await repo.atualizar(
        _rascunho('Prova 2 (corrigida)', localId: id1, hora: '20:00'),
      );
      lista = await repo.listar();
      final editado = lista.firstWhere((r) => r.localId == id1);
      expect(editado.titulo, 'Prova 2 (corrigida)');
      expect(editado.hora, '20:00');

      await repo.excluir(id2);
      lista = await repo.listar();
      expect(lista.map((r) => r.localId), [id1]);
    });

    test('atualizar sem localId falha em vez de ignorar', () async {
      final db = await AppDatabase.abrirEmMemoria();
      final repo = RascunhoRepository(() async => db);

      await expectLater(
        repo.atualizar(_rascunho('sem id')),
        throwsArgumentError,
      );
    });

    test(
      'listarPendentes traz só os não sincronizados, em ordem de criação',
      () async {
        final db = await AppDatabase.abrirEmMemoria();
        final repo = RascunhoRepository(() async => db);

        final id1 = await repo.inserir(_rascunho('A'));
        final id2 = await repo.inserir(_rascunho('B'));

        var pendentes = await repo.listarPendentes();
        expect(pendentes.map((r) => r.localId), [id1, id2]);

        await repo.marcarSincronizado(id1);
        pendentes = await repo.listarPendentes();
        expect(pendentes.map((r) => r.localId), [id2]);
      },
    );

    test(
      'registrarErro mantém pendente com erro; marcarSincronizado limpa o erro',
      () async {
        final db = await AppDatabase.abrirEmMemoria();
        final repo = RascunhoRepository(() async => db);

        final id = await repo.inserir(_rascunho('C'));
        await repo.registrarErro(id, 'Sem conexão com o servidor.');

        final pendente = (await repo.listarPendentes()).single;
        expect(pendente.localId, id);
        expect(pendente.sincronizado, isFalse);
        expect(pendente.ultimoErro, 'Sem conexão com o servidor.');

        await repo.marcarSincronizado(id);
        expect(await repo.listarPendentes(), isEmpty);
        final enviado = (await repo.listar()).single;
        expect(enviado.sincronizado, isTrue);
        expect(enviado.ultimoErro, isNull);
      },
    );
  });

  group('materias', () {
    test('substituirTodas e listar ordenam por sigla', () async {
      final db = await AppDatabase.abrirEmMemoria();
      final repo = MateriaRepository(() async => db);

      await repo.substituirTodas([
        Materia(id: 'm1', nome: 'Programação', sigla: 'PD', corHex: '#111111'),
        Materia(
          id: 'm2',
          nome: 'Banco de Dados',
          sigla: 'BD',
          corHex: '#1D4ED8',
          sala: 'B-204',
          professor: 'Marcos',
        ),
        Materia(id: 'm3', nome: 'Algoritmos', sigla: 'AM', corHex: '#222222'),
      ]);

      final lista = await repo.listar();
      expect(lista.map((m) => m.sigla), ['AM', 'BD', 'PD']);
      expect(lista[1].sala, 'B-204');
      expect(lista[1].professor, 'Marcos');
      expect(lista[0].sala, isNull);

      await repo.substituirTodas([
        Materia(id: 'm9', nome: 'Redes', sigla: 'RD', corHex: '#333333'),
      ]);
      expect((await repo.listar()).map((m) => m.sigla), ['RD']);
    });
  });

  group('limparTudo', () {
    test('esvazia as 4 tabelas', () async {
      final db = await AppDatabase.abrirEmMemoria();

      await HomeCacheRepository(() async => db)
          .substituir([_item('e1', '2026-10-25')]);
      await MateriaRepository(() async => db).substituirTodas([
        Materia(
          id: 'm1',
          nome: 'Banco de Dados',
          sigla: 'BD',
          corHex: '#1D4ED8',
        ),
      ]);
      await RascunhoRepository(() async => db).inserir(_rascunho('X'));
      await EstadoPessoalRepository(() async => db).marcarLocal('e1', true);

      await AppDatabase.limparTudo(() async => db);

      for (final tabela in [
        'home_cache',
        'materias',
        'rascunhos',
        'estado_pessoal',
      ]) {
        expect(await db.query(tabela), isEmpty, reason: tabela);
      }
    });
  });
}
