import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:projetofans/data/models.dart';
import 'package:projetofans/data/painel_repository.dart';

import 'montagem.dart';

void main() {
  group('PainelRepository', () {
    test('entrega turmas e próximos exatamente como o servidor mandou', () async {
      // Fora de ordem de data e com 7 itens (o teto é 6): ordem, janela e teto são do servidor.
      final repo = PainelRepository(
        api: apiTeste(MockClient((_) async => respostaJson(200, {
              'turmas': [
                turmaPainelJson('b', [
                  itemTeste('z', '2026-10-09', TipoEvento.prova),
                  itemTeste('y', '2026-10-07', TipoEvento.prova),
                ]),
                turmaPainelJson('a', [
                  for (final n in ['1', '2', '3', '4', '5', '6', '7'])
                    itemTeste(n, '2026-10-08', TipoEvento.prova),
                ]),
              ],
            }))),
      );

      await repo.carregar();

      final painel = repo.painel.value!;
      expect(painel.turmas.map((t) => t.turmaId), ['b', 'a']);
      expect(painel.turmas[0].proximos.map((i) => i.eventoId), ['z', 'y']);
      expect(painel.turmas[1].proximos.length, 7);
      expect(repo.erro.value, isNull);
      expect(repo.carregando.value, isFalse);
    });

    test('falha NÃO vira "nenhuma turma": o painel fica nulo e o erro aparece', () async {
      final repo = PainelRepository(api: apiTeste(MockClient(semRede)));

      await repo.carregar();

      expect(repo.painel.value, isNull);
      expect(repo.erro.value, isNotNull);
    });

    test('falhar numa segunda carga mantém o painel que já estava na tela', () async {
      var chamadas = 0;
      final repo = PainelRepository(
        api: apiTeste(MockClient((_) async {
          chamadas++;
          if (chamadas == 1) {
            return respostaJson(200, {
              'turmas': [turmaPainelJson('a', [])],
            });
          }
          return respostaJson(500, {'detail': 'x'});
        })),
      );

      await repo.carregar();
      await repo.carregar();

      expect(repo.painel.value!.turmas.map((t) => t.turmaId), ['a']);
      expect(repo.erro.value, isNotNull);
    });

    test('conta de aluno (403) mostra a mensagem do servidor, sem painel', () async {
      final repo = PainelRepository(
        api: apiTeste(MockClient(
          (_) async => respostaJson(403, {'detail': 'Só docente tem painel.'}),
        )),
      );

      await repo.carregar();

      expect(repo.painel.value, isNull);
      expect(repo.erro.value, 'Só docente tem painel.');
    });
  });
}
