import 'package:flutter_test/flutter_test.dart';
import 'package:projetofans/data/chave_ia_service.dart';

import 'montagem.dart';

void main() {
  test('sem chave gravada, ler devolve vazio (não há chave, não é erro)', () async {
    final arm = await armazenamentoTeste();
    final servico = ChaveIaService(armazenamento: arm);

    expect(await servico.ler(), '');
    expect(await servico.mascarada(), '');
  });

  test('gravar faz trim e persiste no disco do aparelho', () async {
    final arm = await armazenamentoTeste();
    final servico = ChaveIaService(armazenamento: arm);

    await servico.gravar('  sk-abcdefghijklmnop  ');

    expect(await servico.ler(), 'sk-abcdefghijklmnop');
    expect(await arm.lerJson(chaveIa), 'sk-abcdefghijklmnop');
    // Outra instância, mesmo disco: a chave continua lá.
    expect(await ChaveIaService(armazenamento: arm).ler(), 'sk-abcdefghijklmnop');
  });

  test('gravar vazio remove a chave do disco', () async {
    final arm = await armazenamentoTeste({chaveIa: '"sk-antiga"'});
    final servico = ChaveIaService(armazenamento: arm);

    await servico.gravar('   ');

    expect(await servico.ler(), '');
    expect(await arm.lerJson(chaveIa), isNull);
  });

  test('mascarada: chave curta vira bolinhas; longa mostra começo e fim', () async {
    final arm = await armazenamentoTeste();
    final servico = ChaveIaService(armazenamento: arm);

    await servico.gravar('curta');
    expect(await servico.mascarada(), '••••');

    await servico.gravar('sk-abcdefghijklmnopqrstuvwxyz');
    expect(await servico.mascarada(), 'sk-abcde…wxyz');
  });
}
