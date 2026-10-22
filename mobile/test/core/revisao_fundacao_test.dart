import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:projetofans/core/janela_desfazer.dart';
import 'package:projetofans/data/material_repository.dart';

import '../data/montagem.dart';

/// Correções feitas na revisão da fundação, antes das áreas.
void main() {
  group('resumo do material', () {
    test('manda X-IA-Key sem perder o Authorization, e refazer vira query', () async {
      late Map<String, String> enviados;
      late Uri chamada;
      final api = apiTeste(MockClient((pedido) async {
        enviados = pedido.headers;
        chamada = pedido.url;
        return respostaJson(200, {
          'id': 'm1',
          'tipo': 'AULA',
          'titulo': 'Slides',
          'materiaId': 'ma1',
          'autoria': {
            'autorId': 'u1',
            'autorNome': 'Otavio',
            'criadoEm': '2026-08-30T12:00:00Z',
            'atualizadoEm': '2026-08-30T12:00:00Z',
          },
          'version': 3,
          'visivelTurma': true,
          'resumo': 'Normalização até a 3FN.',
        });
      }));

      final m = await MaterialRepository(api: api).resumir('m1', 'sk-chave', refazer: true);

      expect(chamada.path, '/api/v1/materiais/m1/resumo');
      expect(chamada.queryParameters['refazer'], 'true');
      expect(enviados['X-IA-Key'], 'sk-chave');
      expect(enviados['Authorization'], 'Bearer jwt-123');
      expect(m.resumo, 'Normalização até a 3FN.');
    });

    test('sem refazer, nenhuma query', () async {
      late Uri chamada;
      final api = apiTeste(MockClient((pedido) async {
        chamada = pedido.url;
        return respostaJson(500);
      }));
      await expectLater(MaterialRepository(api: api).resumir('m1', 'k'), throwsA(anything));
      expect(chamada.hasQuery, isFalse);
    });
  });

  group('JanelaDesfazer', () {
    testWidgets('abre e fecha sozinha depois do prazo', (tester) async {
      final j = JanelaDesfazer(duracao: const Duration(seconds: 8));
      addTearDown(j.dispose);

      j.abrir();
      expect(j.aberta.value, isTrue);
      await tester.pump(const Duration(seconds: 7));
      expect(j.aberta.value, isTrue);
      await tester.pump(const Duration(seconds: 1));
      expect(j.aberta.value, isFalse);
    });

    testWidgets('abrir de novo reinicia o relógio', (tester) async {
      final j = JanelaDesfazer(duracao: const Duration(seconds: 8));
      addTearDown(j.dispose);

      j.abrir();
      await tester.pump(const Duration(seconds: 6));
      j.abrir();
      await tester.pump(const Duration(seconds: 6));
      expect(j.aberta.value, isTrue, reason: 'o segundo abrir zerou a contagem');
      await tester.pump(const Duration(seconds: 2));
      expect(j.aberta.value, isFalse);
    });
  });
}
