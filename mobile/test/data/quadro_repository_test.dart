import 'package:flutter_test/flutter_test.dart';
import 'package:projetofans/data/models.dart';
import 'package:projetofans/data/quadro_repository.dart';

import 'montagem.dart';

void main() {
  test('carregar preenche aFazer e feito a partir do GET /meu-quadro', () async {
    final s = await Sessao.montar((_) async => respostaJson(200, {
          'aFazer': [itemTeste('p1', '2026-09-01', TipoEvento.prova).toJson()],
          'feito': [itemTeste('e1', '2026-08-31', TipoEvento.entrega).toJson()],
        }));
    final repo = QuadroRepository(api: s.api, moderacao: s.moderacao);

    await repo.carregar();

    expect(repo.aFazer.value.map((i) => i.eventoId), ['p1']);
    expect(repo.feito.value.map((i) => i.eventoId), ['e1']);
    expect(repo.erro.value, isNull);
  });

  test('falha do quadro guarda o erro e MANTÉM as listas, sem relançar', () async {
    var falha = false;
    final s = await Sessao.montar((_) async {
      if (falha) return respostaJson(500, {'detail': 'x'});
      return respostaJson(200, {
        'aFazer': [itemTeste('p1', '2026-09-01', TipoEvento.prova).toJson()],
        'feito': <Object?>[],
      });
    });
    final repo = QuadroRepository(api: s.api, moderacao: s.moderacao);
    await repo.carregar();

    falha = true;
    await repo.carregar();

    expect(repo.erro.value, isNotNull);
    expect(repo.aFazer.value.map((i) => i.eventoId), ['p1']);
  });

  test('falha de "não listados" não apaga o erro do quadro: são canais separados', () async {
    final s = await Sessao.montar((pedido) async {
      if (pedido.url.path.endsWith('/nao-listados')) {
        return respostaHtml(500);
      }
      return respostaJson(200, {'aFazer': <Object?>[], 'feito': <Object?>[]});
    });
    final repo = QuadroRepository(api: s.api, moderacao: s.moderacao);

    await repo.carregarNaoListados();
    await repo.carregar();

    expect(repo.erroNaoListados.value, isNotNull);
    expect(repo.erro.value, isNull);
    expect(repo.naoListados.value, isNull);
  });
}
