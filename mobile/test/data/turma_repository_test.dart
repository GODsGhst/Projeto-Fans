import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:projetofans/core/erro_api.dart';
import 'package:projetofans/data/models.dart';
import 'package:projetofans/data/turma_repository.dart';

import 'montagem.dart';

/// Turma com o `meuAlcance` dado, carregada para um repositório pronto para perguntar.
Future<TurmaRepository> comAlcance(Map<String, Object?> alcance) async {
  final s = await Sessao.montar(
    (_) async => respostaJson(200, turmaJson(meuAlcance: alcance)),
  );
  await s.turmas.carregar();
  return s.turmas;
}

void main() {
  group('TurmaRepository: quem sou eu na turma', () {
    test('sair da conta zera a turma: a próxima conta não herda o papel da anterior', () async {
      final s = await Sessao.montar((_) async => respostaJson(200, turmaJson()));
      await s.turmas.carregar();
      expect(s.turmas.turma.value, isNotNull);
      expect(s.turmas.souLider, isTrue);

      await s.auth.sair();

      expect(s.turmas.turma.value, isNull);
    });

    test('sessão encerrada pelo 401 zera a turma e o aviso de erro', () async {
      var falha = true;
      final s = await Sessao.montar((_) async {
        if (falha) return respostaJson(500, {'detail': 'x'});
        return respostaJson(200, turmaJson());
      });
      await s.turmas.carregar();
      expect(s.turmas.erro.value, isNotNull);

      falha = false;
      await s.turmas.carregar();
      expect(s.turmas.turma.value, isNotNull);

      s.auth.encerrarSessao();

      expect(s.turmas.turma.value, isNull);
      expect(s.turmas.erro.value, isNull);
    });

    test('depois de zerada, a próxima tela busca a turma de novo', () async {
      var pedidos = 0;
      final s = await Sessao.montar((_) async {
        pedidos++;
        return respostaJson(200, turmaJson());
      });
      await s.turmas.carregar();
      await s.auth.sair();
      s.auth.definirSessao(
        'jwt-2',
        const Usuario(id: 'u9', nome: 'Bia', email: 'bia@teste.com'),
        turmaId: 't1',
      );

      await s.turmas.garantirCarregada();

      expect(pedidos, 2);
      expect(s.turmas.turma.value!.id, 't1');
      expect(s.turmas.souLider, isFalse);
    });

    test('GET /turmas/minha 404 SEM_TURMA: esquece a turma, sem aviso, e perde o vínculo', () async {
      var removida = false;
      final s = await Sessao.montar((_) async {
        if (removida) {
          return respostaJson(404, {
            'detail': 'Registro nao encontrado',
            'codigo': 'SEM_TURMA',
          });
        }
        return respostaJson(200, turmaJson());
      });
      await s.turmas.carregar();
      expect(s.turmas.souLider, isTrue);

      removida = true;
      await s.turmas.carregar();

      expect(s.turmas.turma.value, isNull);
      expect(s.turmas.erro.value, isNull);
      expect(s.turmas.souLider, isFalse);
      expect(s.auth.temTurma, isFalse);
      expect(s.auth.autenticado, isTrue);
    });

    test('404 SEM código (proxy) NÃO derruba o vínculo: vira aviso comum', () async {
      var comTurma = true;
      final s = await Sessao.montar((_) async {
        if (comTurma) return respostaJson(200, turmaJson());
        return respostaHtml(404);
      });
      await s.turmas.carregar();
      comTurma = false;

      await s.turmas.carregar();

      expect(s.auth.temTurma, isTrue);
      expect(s.turmas.erro.value, isNotNull);
      expect(s.turmas.turma.value, isNotNull);
    });

    test('perder o vínculo por OUTRA rota também esquece a turma em memória', () async {
      final s = await Sessao.montar((_) async => respostaJson(200, turmaJson()));
      await s.turmas.carregar();
      expect(s.turmas.souLider, isTrue);

      await s.auth.registrarTurma(null);

      expect(s.turmas.turma.value, isNull);
      expect(s.turmas.souLider, isFalse);
    });

    test('meuMembro: o vínculo desta pessoa NESTA turma', () async {
      final s = await Sessao.montar((_) async => respostaJson(200, turmaJson()));
      expect(s.turmas.meuMembro, isNull);

      await s.turmas.carregar();

      expect(s.turmas.meuMembro?.papel, PapelMembro.lider);
    });
  });

  group('TurmaRepository: ferramentas do líder', () {
    final comAna = [
      membroJson('u1', 'Otavio', 'LIDER'),
      membroJson('u2', 'Ana', 'ALUNO'),
    ];

    test('removerMembro: DELETE na rota certa, tira da lista e relê a turma', () async {
      var removida = false;
      String? rotaDelete;
      final s = await Sessao.montar((pedido) async {
        if (pedido.method == 'DELETE') {
          rotaDelete = pedido.url.path;
          removida = true;
          return respostaJson(204);
        }
        return respostaJson(200, turmaJson(
          membros: removida ? [comAna.first] : comAna,
        ));
      });
      await s.turmas.carregar();

      await s.turmas.removerMembro('u2');

      expect(rotaDelete, endsWith('/turmas/minha/membros/u2'));
      expect(s.turmas.turma.value!.membros.map((m) => m.usuarioId), ['u1']);
    });

    test('removerMembro: se a releitura falhar, a Ana continua fora da lista', () async {
      var removida = false;
      final s = await Sessao.montar((pedido) async {
        if (pedido.method == 'DELETE') {
          removida = true;
          return respostaJson(204);
        }
        if (removida) return respostaJson(500, {'detail': 'x'});
        return respostaJson(200, turmaJson(membros: comAna));
      });
      await s.turmas.carregar();

      await s.turmas.removerMembro('u2');

      expect(s.turmas.erro.value, isNotNull);
      expect(s.turmas.turma.value!.membros.map((m) => m.usuarioId), ['u1']);
    });

    test('removerMembro: 409 sobe para a tela e a lista não muda', () async {
      final s = await Sessao.montar((pedido) async {
        if (pedido.method == 'DELETE') {
          return respostaJson(409, {'detail': 'Transfira a liderança antes de sair'});
        }
        return respostaJson(200, turmaJson(membros: comAna));
      });
      await s.turmas.carregar();

      await expectLater(
        s.turmas.removerMembro('u1'),
        throwsA(isA<ErroApi>().having(
          (e) => e.message,
          'mensagem',
          contains('Transfira a liderança'),
        )),
      );
      expect(s.turmas.turma.value!.membros.length, 2);
    });

    test('gerarNovoCodigo: POST e a turma devolvida substitui a de antes', () async {
      final s = await Sessao.montar((pedido) async {
        if (pedido.method == 'POST') {
          return respostaJson(200, turmaJson(codigo: 'NOVO0001', membros: comAna));
        }
        return respostaJson(200, turmaJson(membros: comAna));
      });
      await s.turmas.carregar();

      await s.turmas.gerarNovoCodigo();

      expect(s.turmas.turma.value!.codigoConvite, 'NOVO0001');
      expect(s.turmas.turma.value!.membros.length, 2);
    });
  });

  group('TurmaRepository: alcance e docentes', () {
    test('alcança: sem turma carregada não alcança nada; NENHUM não alcança', () async {
      final sem = await Sessao.montar((_) async => respostaJson(200, turmaJson()));
      expect(sem.turmas.alcanca('m1'), isFalse);
      expect(sem.turmas.alcanca(null), isFalse);

      final nenhum = await comAlcance({'tipo': 'NENHUM', 'materiaIds': <String>[]});
      expect(nenhum.alcanca('m1'), isFalse);
      expect(nenhum.alcanca(null), isFalse);
    });

    test('MATERIAS: só as suas, e nota (sem matéria) não', () async {
      final repo = await comAlcance({'tipo': 'MATERIAS', 'materiaIds': ['m1', 'm2']});

      expect(repo.alcanca('m1'), isTrue);
      expect(repo.alcanca('m3'), isFalse);
      expect(repo.alcanca(null), isFalse);
    });

    test('TURMA: qualquer matéria, e nota também', () async {
      final repo = await comAlcance({'tipo': 'TURMA', 'materiaIds': <String>[]});

      expect(repo.alcanca('qualquer'), isTrue);
      expect(repo.alcanca(null), isTrue);
    });

    test('seloNa: coordenação na turma toda, professor na matéria dele, nenhum no resto', () async {
      final coordenacao = await comAlcance({'tipo': 'TURMA', 'materiaIds': <String>[]});
      expect(coordenacao.seloNa('m1'), Selo.coordenacao);

      final professor = await comAlcance({'tipo': 'MATERIAS', 'materiaIds': ['m1']});
      expect(professor.seloNa('m1'), Selo.professor);
      expect(professor.seloNa('m2'), isNull);
    });

    test('declararLecionadas: PUT com o conjunto inteiro, e relê a turma', () async {
      Object? corpoPut;
      var declarou = false;
      final s = await Sessao.montar((pedido) async {
        if (pedido.method == 'PUT') {
          corpoPut = jsonDecode(pedido.body);
          declarou = true;
          return respostaJson(204);
        }
        return respostaJson(200, turmaJson(meuAlcance: declarou
            ? {'tipo': 'MATERIAS', 'materiaIds': ['m1', 'm2']}
            : {'tipo': 'NENHUM', 'materiaIds': <String>[]}));
      });
      await s.turmas.carregar();

      await s.turmas.declararLecionadas(['m1', 'm2']);

      expect(corpoPut, {'materiaIds': ['m1', 'm2']});
      expect(s.turmas.alcanca('m2'), isTrue);
    });

    test('contestar: a marca entra, e fica mesmo se a releitura falhar', () async {
      var contestou = false;
      final s = await Sessao.montar((pedido) async {
        if (pedido.method == 'POST') {
          contestou = true;
          return respostaJson(204);
        }
        if (contestou) return respostaJson(500, {'detail': 'x'});
        return respostaJson(200, turmaJson(membros: [
          membroJson('u1', 'Otavio', 'LIDER'),
          membroJson('u7', 'Marcos', 'PROFESSOR', selo: 'PROFESSOR'),
        ]));
      });
      await s.turmas.carregar();

      await s.turmas.contestar('u7');

      final marcado =
          s.turmas.turma.value!.membros.firstWhere((m) => m.usuarioId == 'u7');
      expect(marcado.contestado, isTrue);
      expect(marcado.selo, isNull);
      expect(s.turmas.erro.value, isNotNull);
    });

    test('restaurar: tira a marca e relê, e o selo volta com a releitura', () async {
      var restaurou = false;
      final s = await Sessao.montar((pedido) async {
        if (pedido.method == 'POST') {
          restaurou = true;
          return respostaJson(204);
        }
        final marcos = restaurou
            ? membroJson('u7', 'Marcos', 'PROFESSOR', selo: 'PROFESSOR')
            : membroJson('u7', 'Marcos', 'PROFESSOR', contestado: true);
        return respostaJson(200, turmaJson(membros: [
          membroJson('u1', 'Otavio', 'LIDER'),
          marcos,
        ]));
      });
      await s.turmas.carregar();

      await s.turmas.restaurar('u7');

      final marcos =
          s.turmas.turma.value!.membros.firstWhere((m) => m.usuarioId == 'u7');
      expect(marcos.contestado, isFalse);
      expect(marcos.selo, Selo.professor);
    });
  });
}
