// Porte de app/src/app/features/material-vm.spec.ts, mais os casos de rótulo de formato e de data da aula.

import 'package:flutter_test/flutter_test.dart';
import 'package:projetofans/data/models.dart' as modelos;
import 'package:projetofans/shared/material_vm.dart';

modelos.Material material(String? url, {String? arquivoRef, String? dataAula, String? resumo}) =>
    modelos.Material(
      id: 'm1',
      tipo: modelos.TipoMaterial.aula,
      titulo: 'Slides aula 3',
      url: url,
      arquivoRef: arquivoRef,
      materiaId: 'bd',
      autoria: const modelos.Autoria(
        autorId: 'u1',
        autorNome: 'Otávio',
        criadoEm: '2026-09-02T09:00:00Z',
        atualizadoEm: '2026-09-02T09:00:00Z',
      ),
      version: 0,
      visivelTurma: true,
      dataAula: dataAula,
      resumo: resumo,
    );

void main() {
  final agora = DateTime.parse('2026-09-03T12:00:00Z');

  test('link http(s) vira endereço para abrir', () {
    expect(materialVm(material('https://ex.dev/a.pdf'), agora).url, 'https://ex.dev/a.pdf');
    expect(materialVm(material('HTTP://ex.dev/a'), agora).url, 'HTTP://ex.dev/a');
  });

  // Achado C1 da auditoria de 05/10/2026: o filtro tem de acontecer antes do href.
  test('qualquer outro esquema, ou sem esquema, não vira link', () {
    for (final url in [
      'javascript:alert(1)',
      'data:text/html,<b>oi</b>',
      'intent://abrir#Intent;scheme=x;end',
      'file:///sdcard/a.pdf',
      'ex.dev/sem-esquema',
    ]) {
      expect(materialVm(material(url), agora).url, isNull, reason: url);
    }
  });

  test('arquivoRef tem prioridade sobre a url para o endereço e para o formato', () {
    final vm = materialVm(
      material('https://ex.dev/antigo', arquivoRef: 'https://ex.dev/novo.jpg'),
      agora,
    );
    expect(vm.url, 'https://ex.dev/novo.jpg');
    expect(vm.tipo, 'JPG');
  });

  test('rótulo de formato sai da extensão; sem extensão, LINK', () {
    expect(materialVm(material('https://ex.dev/a.pdf?x=1'), agora).tipo, 'PDF');
    expect(materialVm(material('https://ex.dev/pasta/'), agora).tipo, 'LINK');
    expect(materialVm(material(null), agora).tipo, 'LINK');
  });

  test('sem endereço nenhum a linha existe, mas não vira link', () {
    final vm = materialVm(material(null), agora);
    expect(vm.url, isNull);
    expect(vm.titulo, 'Slides aula 3');
  });

  test('"aula de 2 set" sai da data, sem DateTime; sem data fica vazio', () {
    expect(materialVm(material('https://ex.dev/a', dataAula: '2026-09-02'), agora).daAula,
        'aula de 2 set');
    expect(materialVm(material('https://ex.dev/a'), agora).daAula, '');
    expect(materialVm(material('https://ex.dev/a', dataAula: 'lixo'), agora).daAula, '');
  });

  test('temResumo é só o booleano', () {
    expect(materialVm(material('https://ex.dev/a', resumo: 'texto longo'), agora).temResumo, isTrue);
    expect(materialVm(material('https://ex.dev/a'), agora).temResumo, isFalse);
  });

  test('autoria e id do autor para a tela decidir quem edita', () {
    final vm = materialVm(material('https://ex.dev/a'), agora);
    expect(vm.autorId, 'u1');
    expect(vm.autoria, 'Otávio · há 1 dia');
  });
}
