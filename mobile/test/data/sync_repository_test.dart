import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:projetofans/data/models.dart';
import 'package:projetofans/data/sync_repository.dart';

import 'montagem.dart';

/// Servidor de teste: cada `GET /sync` fica pendente até o teste responder.
class Servidor {
  final List<Completer<http.Response>> pedidos = [];

  late final http.Client cliente = MockClient((_) {
    final resposta = Completer<http.Response>();
    pedidos.add(resposta);
    return resposta.future;
  });

  /// Espera até chegarem [n] pedidos.
  Future<void> aguardar(int n) async {
    while (pedidos.length < n) {
      await Future<void>.delayed(Duration.zero);
    }
  }
}

/// Evento como o backend manda no /sync: hora com segundos, e campo nulo AUSENTE.
Map<String, Object?> eventoDoSync(
  String id, {
  Map<String, Object?> extra = const {},
}) =>
    {
      'id': id,
      'tipo': 'PROVA',
      'titulo': 'Prova $id',
      'data': '2026-11-01',
      'hora': '14:00:00',
      'materiaId': 'm1',
      'materiaSigla': 'BD',
      'materiaCorHex': '#0369A1',
      'version': 1,
      'visivelTurma': true,
      ...extra,
    };

Map<String, Object?> corpoSync(List<Map<String, Object?>> itens) => {
      'eventosAlterados': itens,
      'materias': <Object?>[],
      'servidorEm': 'x',
    };

/// Resposta do /sync com estes ids de evento.
Map<String, Object?> corpo(List<String> ids) =>
    corpoSync([for (final id in ids) eventoDoSync(id)]);

List<String> idsDe(List<EventoAgendavel> lista) =>
    [for (final e in lista) e.eventoId];

void main() {
  late Servidor servidor;
  late LembretesFalsos lembretes;
  late int agora;

  setUp(() {
    servidor = Servidor();
    lembretes = LembretesFalsos(suportado: true);
    agora = 1760000000000;
  });

  SyncRepository montar(http.Client cliente) => SyncRepository(
        api: apiTeste(cliente),
        lembretes: lembretes,
        agoraMs: () => agora,
      );

  group('SyncRepository', () {
    test('SEM_TURMA: não entrega nada e não lança (quem esquece é o ApiClient)', () async {
      final repo = montar(MockClient(
        (_) async => respostaJson(404, {
          'detail': 'Registro nao encontrado',
          'codigo': 'SEM_TURMA',
        }),
      ));

      await repo.reagendarAvisos();

      expect(lembretes.entregues, isEmpty);
    });

    test('404 do /sync SEM o código não entrega nada: os avisos de antes continuam', () async {
      final repo = montar(MockClient((_) async => respostaHtml(404)));

      await repo.reagendarAvisos();

      expect(lembretes.entregues, isEmpty);
    });

    test('pede a turma INTEIRA (sem `desde`) e entrega aos lembretes', () async {
      // A sétima prova da semana: a Home corta em 6, o /sync não corta.
      final sete = corpo(['e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6']);
      Uri? pedido;
      final repo = montar(MockClient((req) async {
        pedido = req.url;
        return respostaJson(200, sete);
      }));

      await repo.reagendarAvisos();

      expect(pedido!.queryParameters, isEmpty);
      final lista = lembretes.entregues.single;
      expect(lista.length, 7);
      expect(lista.first.eventoId, 'e0');
      expect(lista.first.hora, '14:00:00');
      expect(lista.first.excluidoEm, isNull);
    });

    test('a lápide do oculto chega como item — e é assim que o aparelho desagenda', () async {
      final repo = montar(MockClient((_) async => respostaJson(200, corpoSync([
            eventoDoSync('vivo'),
            {'id': 'oculto', 'version': 2, 'visivelTurma': false},
            {
              'id': 'excluido',
              'version': 3,
              'visivelTurma': true,
              'excluidoEm': '2026-10-01T10:00:00Z',
            },
          ]))));

      await repo.reagendarAvisos();

      final lista = lembretes.entregues.single;
      expect(
        [for (final e in lista) (e.eventoId, e.visivelTurma, e.excluidoEm)],
        [
          ('vivo', true, null),
          ('oculto', false, null),
          ('excluido', true, '2026-10-01T10:00:00Z'),
        ],
      );
    });

    test('falha do /sync não lança e não mexe no que já estava agendado', () async {
      final repo = montar(MockClient(semRede));

      await expectLater(repo.reagendarAvisos(), completes);

      expect(lembretes.entregues, isEmpty);
    });

    test('no navegador nem chama o /sync', () async {
      lembretes.suportado = false;
      final repo = montar(servidor.cliente);

      await repo.reagendarAvisos();

      expect(servidor.pedidos, isEmpty);
      expect(lembretes.entregues, isEmpty);
    });

    group('sem repetir trabalho', () {
      test('duas chamadas juntas dividem a mesma ida ao servidor', () async {
        final repo = montar(servidor.cliente);

        final a = repo.reagendarAvisos();
        final b = repo.reagendarAvisos();
        await servidor.aguardar(1);
        expect(servidor.pedidos.length, 1);
        servidor.pedidos.single.complete(respostaJson(200, corpo(['e0'])));
        await Future.wait([a, b]);

        expect(lembretes.entregues.length, 1);
      });

      test('menos de 60 s depois de um /sync bom, não sai de novo; passando disso, sai', () async {
        final repo = montar(servidor.cliente);
        final primeiro = repo.reagendarAvisos();
        await servidor.aguardar(1);
        servidor.pedidos[0].complete(respostaJson(200, corpo(['e0'])));
        await primeiro;

        agora += 59000;
        await repo.reagendarAvisos();
        expect(servidor.pedidos.length, 1);

        agora += 2000;
        final depois = repo.reagendarAvisos();
        await servidor.aguardar(2);
        servidor.pedidos[1].complete(respostaJson(200, corpo(['e0'])));
        await depois;

        expect(lembretes.entregues.length, 2);
      });

      test('um /sync que falhou não abre a janela: a próxima chamada tenta de novo', () async {
        var chamadas = 0;
        final repo = montar(MockClient((_) async {
          chamadas++;
          if (chamadas == 1) throw http.ClientException('sem rede');
          return respostaJson(200, corpo(['e0']));
        }));

        await repo.reagendarAvisos();
        await repo.reagendarAvisos();

        expect(chamadas, 2);
        expect(idsDe(lembretes.entregues.single), ['e0']);
      });

      test('`forcar` ignora a janela de 60 s e a ida em voo', () async {
        // Quem acabou de criar um evento ou salvar um alarme mudou o que o /sync devolve.
        final repo = montar(servidor.cliente);
        final primeiro = repo.reagendarAvisos();
        await servidor.aguardar(1);
        servidor.pedidos[0].complete(respostaJson(200, corpo(['e0'])));
        await primeiro;

        agora += 5000;
        final forcada = repo.reagendarAvisos(forcar: true);
        await servidor.aguardar(2);
        servidor.pedidos[1].complete(respostaJson(200, corpo(['e0', 'novo'])));
        await forcada;
        expect(idsDe(lembretes.entregues[1]), ['e0', 'novo']);

        // Com outra ida ainda no ar, a forçada também sai, e não espera.
        final emVoo = repo.reagendarAvisos(forcar: true);
        final outra = repo.reagendarAvisos(forcar: true);
        await servidor.aguardar(4);
        expect(servidor.pedidos.length, 4);
        // Só a ÚLTIMA das duas simultâneas vale: responde a 4ª primeiro, a 3ª depois.
        servidor.pedidos[3].complete(respostaJson(200, corpo(['e0', 'novo'])));
        servidor.pedidos[2].complete(respostaJson(200, corpo(['e0'])));
        await Future.wait([emVoo, outra]);

        expect(lembretes.entregues.length, 3);
      });

      test('resposta atrasada não vira a lista: só a ida mais nova vale', () async {
        // A velha, se aplicada, traria a turma SEM o evento criado depois dela.
        final repo = montar(servidor.cliente);
        final velha = repo.reagendarAvisos();
        final nova = repo.reagendarAvisos(forcar: true);
        await servidor.aguardar(2);

        // Fora de ordem: a nova responde primeiro, a velha chega depois.
        servidor.pedidos[1].complete(respostaJson(200, corpo(['e0', 'novo'])));
        await nova;
        servidor.pedidos[0].complete(respostaJson(200, corpo(['e0'])));
        await velha;

        expect(lembretes.entregues.length, 1);
        expect(idsDe(lembretes.entregues.single), ['e0', 'novo']);
      });

      test('a velha que chega ANTES da nova também é descartada', () async {
        final repo = montar(servidor.cliente);
        final velha = repo.reagendarAvisos();
        final nova = repo.reagendarAvisos(forcar: true);
        await servidor.aguardar(2);

        servidor.pedidos[0].complete(respostaJson(200, corpo(['e0'])));
        await velha;
        expect(lembretes.entregues, isEmpty);

        servidor.pedidos[1].complete(respostaJson(200, corpo(['e0', 'novo'])));
        await nova;
        expect(lembretes.entregues.length, 1);
        expect(idsDe(lembretes.entregues.single), ['e0', 'novo']);
      });

      test('sair da conta com o /sync no ar descarta a resposta e zera a janela', () async {
        // Dava tempo de sair da conta no meio, e a lista da conta velha reagendava os avisos dela.
        final repo = montar(servidor.cliente);
        final antiga = repo.reagendarAvisos();
        await servidor.aguardar(1);
        lembretes.epoca++; // saiu da conta
        servidor.pedidos[0].complete(respostaJson(200, corpo(['da-conta-velha'])));
        await antiga;
        expect(lembretes.entregues, isEmpty);

        final nova = repo.reagendarAvisos();
        await servidor.aguardar(2);
        servidor.pedidos[1].complete(respostaJson(200, corpo(['da-conta-nova'])));
        await nova;
        expect(idsDe(lembretes.entregues.single), ['da-conta-nova']);

        // A janela de uma conta não vale para a seguinte.
        agora += 1000;
        lembretes.epoca++;
        final outra = repo.reagendarAvisos();
        await servidor.aguardar(3);
        servidor.pedidos[2].complete(respostaJson(200, corpo(['terceira'])));
        await outra;
        expect(lembretes.entregues.length, 2);
      });
    });
  });
}
