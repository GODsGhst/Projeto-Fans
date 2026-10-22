import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:projetofans/core/erro_api.dart';
import 'package:projetofans/data/models.dart';

import 'montagem.dart';

bool _ehTransferir(http.Request pedido) =>
    pedido.url.path.endsWith('/turmas/lideranca/transferir');

bool _ehMinha(http.Request pedido) => pedido.url.path.endsWith('/turmas/minha');

void main() {
  group('ModeracaoRepository.transferirLideranca', () {
    test('recarrega a turma: o ex-líder deixa de aparecer como líder', () async {
      var lider = 'u1';
      final s = await Sessao.montar((pedido) async {
        if (_ehTransferir(pedido)) {
          lider = 'u2';
          return respostaJson(204);
        }
        if (_ehMinha(pedido)) {
          return respostaJson(200, turmaJson(membros: [
            membroJson('u1', 'Otavio', lider == 'u1' ? 'LIDER' : 'ALUNO'),
            membroJson('u2', 'Ana', lider == 'u2' ? 'LIDER' : 'ALUNO'),
          ]));
        }
        return respostaJson(404);
      });
      await s.turmas.carregar();
      expect(s.turmas.souLider, isTrue);

      await s.moderacao.transferirLideranca('u2');

      expect(s.turmas.souLider, isFalse);
      expect(
        s.turmas.turma.value!.membros
            .where((m) => m.papel == PapelMembro.lider)
            .map((m) => m.usuarioId),
        ['u2'],
      );
    });

    test('releitura falhou: zera a turma em vez de manter o ex-líder na tela', () async {
      var transferiu = false;
      final s = await Sessao.montar((pedido) async {
        if (_ehTransferir(pedido)) {
          transferiu = true;
          return respostaJson(204);
        }
        if (transferiu) return respostaJson(500, {'detail': 'x'});
        return respostaJson(200, turmaJson());
      });
      await s.turmas.carregar();

      // A transferência deu certo: não lança por causa da releitura.
      await s.moderacao.transferirLideranca('u2');

      expect(s.turmas.turma.value, isNull);
      expect(s.turmas.souLider, isFalse);
    });

    test('o POST falhou: a turma carregada fica como está', () async {
      final s = await Sessao.montar((pedido) async {
        if (_ehTransferir(pedido)) return respostaJson(500, {'detail': 'x'});
        return respostaJson(200, turmaJson());
      });
      await s.turmas.carregar();

      await expectLater(
        s.moderacao.transferirLideranca('u2'),
        throwsA(isA<ErroApi>()),
      );
      expect(s.turmas.souLider, isTrue);
    });
  });

  group('ModeracaoRepository.ocultados', () {
    test('lê GET /moderacao/ocultados e devolve a lista como veio', () async {
      final s = await Sessao.montar((pedido) async {
        expect(pedido.method, 'GET');
        expect(pedido.url.path.endsWith('/moderacao/ocultados'), isTrue);
        return respostaJson(200, [
          {
            'registroTipo': 'NOTA',
            'registroId': 'n1',
            'titulo': 'aula cancelada',
            'autorId': 'u2',
            'autorNome': 'Ana',
            'ocultadoEm': null,
          },
        ]);
      });

      final lista = await s.moderacao.ocultados();

      expect(lista.length, 1);
      expect(lista.single.registroTipo, RegistroTipo.nota);
      expect(lista.single.registroId, 'n1');
      expect(lista.single.titulo, 'aula cancelada');
      expect(lista.single.autorNome, 'Ana');
      expect(lista.single.ocultadoEm, isNull);
    });
  });
}
