import 'package:flutter_test/flutter_test.dart';
import 'package:projetofans/core/espera.dart';

void main() {
  test('o aviso de servidor acordando é de 4 s', () {
    expect(avisaApos, const Duration(seconds: 4));
  });

  test('não acende antes do prazo e acende depois', () async {
    final espera = Espera();
    espera.comecar(apos: const Duration(milliseconds: 60));

    await Future<void>.delayed(const Duration(milliseconds: 10));
    expect(espera.demorando.value, isFalse);

    await Future<void>.delayed(const Duration(milliseconds: 120));
    expect(espera.demorando.value, isTrue);

    espera.terminar();
    expect(espera.demorando.value, isFalse);
    espera.dispose();
  });

  test('terminar antes do prazo impede o aviso de acender depois', () async {
    final espera = Espera();
    espera.comecar(apos: const Duration(milliseconds: 40));
    espera.terminar();

    await Future<void>.delayed(const Duration(milliseconds: 80));
    expect(espera.demorando.value, isFalse);
    espera.dispose();
  });
}
