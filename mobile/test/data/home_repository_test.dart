import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:projetofans/core/armazenamento.dart';
import 'package:projetofans/data/home_repository.dart';
import 'package:projetofans/data/models.dart';
import 'package:projetofans/data/sync_repository.dart';

import 'montagem.dart';

void main() {
  late Armazenamento armazenamento;

  setUp(() async {
    armazenamento = await armazenamentoTeste();
  });

  HomeRepository montar(
    http.Client cliente, {
    LembretesFalsos? lembretes,
    void Function()? onSemTurma,
  }) {
    final api = apiTeste(cliente, onSemTurma: onSemTurma);
    final sync = SyncRepository(
      api: api,
      lembretes: lembretes ?? LembretesFalsos(),
    );
    return HomeRepository(api: api, armazenamento: armazenamento, sync: sync);
  }

  group('HomeRepository', () {
    test('preserva a ordem que o servidor devolveu: prova não sobe ao topo', () async {
      // Uma entrega amanhã antes de uma prova daqui a dez dias. Ordem é urgência, nunca tipo.
      final doServidor = [
        itemTeste('entrega-amanha', '2026-08-31', TipoEvento.entrega),
        itemTeste('prova-em-dez', '2026-09-09', TipoEvento.prova),
        itemTeste('entrega-depois', '2026-09-10', TipoEvento.entrega),
      ];
      final repo = montar(MockClient(
        (_) async => respostaJson(200, [for (final i in doServidor) i.toJson()]),
      ));

      await repo.carregar();

      expect(
        repo.itens.value.map((i) => i.eventoId),
        ['entrega-amanha', 'prova-em-dez', 'entrega-depois'],
      );
      expect(repo.erro.value, isNull);
    });

    test('não corta nem reordena: sete itens fora de ordem chegam todos', () async {
      final doServidor = [
        itemTeste('a', '2026-09-05', TipoEvento.entrega),
        itemTeste('b', '2026-09-01', TipoEvento.prova),
        itemTeste('c', '2026-09-03', TipoEvento.entrega),
        itemTeste('d', '2026-09-02', TipoEvento.prova),
        itemTeste('e', '2026-09-07', TipoEvento.entrega),
        itemTeste('f', '2026-09-04', TipoEvento.prova),
        itemTeste('g', '2026-09-06', TipoEvento.entrega),
      ];
      final repo = montar(MockClient(
        (_) async => respostaJson(200, [for (final i in doServidor) i.toJson()]),
      ));

      await repo.carregar();

      expect(
        repo.itens.value.map((i) => i.eventoId),
        ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      );
    });

    test('erro de rede NÃO devolve lista vazia como sucesso', () async {
      final repo = montar(MockClient(semRede));

      await repo.carregar();

      expect(repo.itens.value, isEmpty);
      expect(repo.erro.value, isNotNull);
      expect(repo.offline.value, isTrue);
    });

    test('offline com snapshot serve o cache com a hora do último sync', () async {
      await armazenamento.gravarSnapshot(SnapshotLocal(
        eventos: [itemTeste('do-cache', '2026-09-01', TipoEvento.prova)],
        materias: const [],
        ultimoSync: '2026-08-30T09:15:00Z',
      ));
      final repo = montar(MockClient(semRede));

      await repo.carregar();

      expect(repo.itens.value.map((i) => i.eventoId), ['do-cache']);
      expect(repo.offline.value, isTrue);
      expect(repo.ultimoSync.value, '2026-08-30T09:15:00Z');
      expect(repo.erro.value, isNotNull);
    });

    test('estado vazio: resposta [] é "não há nada", sem erro', () async {
      final repo = montar(MockClient((_) async => respostaJson(200, <Object?>[])));

      await repo.carregar();

      expect(repo.itens.value, isEmpty);
      expect(repo.erro.value, isNull);
      expect(repo.offline.value, isFalse);
    });
  });

  group('HomeRepository: quem o líder removeu', () {
    final velho = itemTeste('velho', '2026-09-01', TipoEvento.prova);

    test('/home 404 SEM_TURMA: esquece a lista, sem aviso, e avisa quem chama', () async {
      // "Registro não encontrado" num aviso só confunde quem está sendo levado para outra turma.
      var semTurma = false;
      final repo = montar(
        MockClient((_) async => respostaJson(404, {
              'detail': 'Registro nao encontrado',
              'codigo': 'SEM_TURMA',
            })),
        onSemTurma: () {
          semTurma = true;
        },
      );
      repo.itens.value = [velho];

      await repo.carregar();

      expect(repo.itens.value, isEmpty);
      expect(repo.erro.value, isNull);
      expect(repo.offline.value, isFalse);
      expect(semTurma, isTrue);
    });

    test('/home 404 SEM o código (proxy) é aviso comum: nada é apagado', () async {
      var semTurma = false;
      final repo = montar(
        MockClient((_) async => respostaHtml(404)),
        onSemTurma: () {
          semTurma = true;
        },
      );
      repo.itens.value = [velho];

      await repo.carregar();

      expect(repo.erro.value, isNotNull);
      expect(repo.itens.value.map((i) => i.eventoId), ['velho']);
      expect(semTurma, isFalse);
    });
  });

  group('HomeRepository e os lembretes', () {
    test('o /sync sai junto com o /home, e a falha dele não quebra a Home', () async {
      final lembretes = LembretesFalsos(suportado: true);
      final repo = montar(
        MockClient((pedido) async {
          if (pedido.url.path.endsWith('/sync')) {
            throw http.ClientException('sem rede');
          }
          return respostaJson(200, [
            itemTeste('a', '2026-09-01', TipoEvento.prova).toJson(),
          ]);
        }),
        lembretes: lembretes,
      );

      await repo.carregar();

      expect(repo.itens.value.map((i) => i.eventoId), ['a']);
      expect(repo.erro.value, isNull);
      expect(repo.offline.value, isFalse);
      // Falhou o /sync: nada entregue aos lembretes, nada cancelado.
      expect(lembretes.entregues, isEmpty);
    });

    test('voltar para a Home em seguida não baixa a turma inteira de novo', () async {
      final lembretes = LembretesFalsos(suportado: true);
      var pedidosDeSync = 0;
      final repo = montar(
        MockClient((pedido) async {
          if (pedido.url.path.endsWith('/sync')) {
            pedidosDeSync++;
            return respostaJson(200, {
              'eventosAlterados': <Object?>[],
              'materias': <Object?>[],
              'servidorEm': 'x',
            });
          }
          return respostaJson(200, <Object?>[]);
        }),
        lembretes: lembretes,
      );

      await repo.carregar();
      await repo.carregar();
      await Future<void>.delayed(const Duration(milliseconds: 20));

      expect(pedidosDeSync, 1);
    });
  });
}
