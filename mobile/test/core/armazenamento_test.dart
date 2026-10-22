import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:projetofans/core/armazenamento.dart';
import 'package:projetofans/data/models.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('JSON inválido no disco não derruba: vira null e a chave é apagada', () async {
    SharedPreferences.setMockInitialValues({
      'pf.sessao': '{nao-e-json',
      'pf.snapshot': '[[[',
      'pf.turmaAtiva': '}}',
    });
    final prefs = await SharedPreferences.getInstance();
    final arm = Armazenamento(prefs);

    expect(await arm.lerSessao(), isNull);
    expect(prefs.containsKey('pf.sessao'), isFalse);
    expect(await arm.lerSnapshot(), isNull);
    expect(prefs.containsKey('pf.snapshot'), isFalse);
    expect(await arm.lerTurmaAtiva(), isNull);
    expect(prefs.containsKey('pf.turmaAtiva'), isFalse);
  });

  test('estrutura inválida (JSON válido, campo obrigatório faltando) também vira null', () async {
    SharedPreferences.setMockInitialValues({'pf.sessao': jsonEncode({'turmaId': 't1'})});
    final prefs = await SharedPreferences.getInstance();

    expect(await Armazenamento(prefs).lerSessao(), isNull);
    expect(prefs.containsKey('pf.sessao'), isFalse);
  });

  test('turma ativa com campo de tipo errado é ignorada sem apagar a chave', () async {
    SharedPreferences.setMockInitialValues({
      'pf.turmaAtiva': jsonEncode({'usuarioId': 'u1', 'turmaId': 42, 'nome': 'ADS'}),
    });
    final prefs = await SharedPreferences.getInstance();

    expect(await Armazenamento(prefs).lerTurmaAtiva(), isNull);
    expect(prefs.containsKey('pf.turmaAtiva'), isTrue);
  });

  test('sessão grava e lê de volta, com turmaId null explícito', () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final arm = Armazenamento(prefs);
    const usuario = Usuario(id: 'u1', nome: 'Otavio', email: 'voce@exemplo.com');

    await arm.gravarSessao('jwt-123', usuario, null);
    final lida = await arm.lerSessao();

    expect(lida?.jwt, 'jwt-123');
    expect(lida?.usuario.nome, 'Otavio');
    expect(lida?.turmaId, isNull);
  });

  test('snapshot começa null, round-trip devolve igual e limpar volta a null', () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final arm = Armazenamento(prefs);
    expect(await arm.lerSnapshot(), isNull);

    const materia = Materia(id: 'm1', nome: 'Banco de Dados', sigla: 'BD', corHex: '#0369A1');
    await arm.gravarSnapshot(
      const SnapshotLocal(eventos: [], materias: [materia], ultimoSync: '2026-08-30T09:15:00Z'),
    );
    final lido = await arm.lerSnapshot();
    expect(lido?.materias.single.sigla, 'BD');
    expect(lido?.ultimoSync, '2026-08-30T09:15:00Z');

    await arm.limparSnapshot();
    expect(await arm.lerSnapshot(), isNull);
  });

  test('mesclar preserva a outra metade do snapshot', () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final arm = Armazenamento(prefs);
    const materia = Materia(id: 'm1', nome: 'Banco de Dados', sigla: 'BD', corHex: '#0369A1');

    await arm.mesclarSnapshot(materias: [materia]);
    await arm.mesclarSnapshot(eventos: const []);
    final lido = await arm.lerSnapshot();

    expect(lido?.materias.single.sigla, 'BD', reason: 'a segunda gravação não apagou as matérias');
    expect(lido?.eventos, isEmpty);
  });
}
