import 'package:fans_lab/models/sessao.dart';
import 'package:fans_lab/models/usuario.dart';
import 'package:fans_lab/repositories/sessao_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

final _sessao = Sessao(
  jwt: 'jwt-de-teste',
  usuario: Usuario(id: 'u1', nome: 'Otávio', email: 'o@x.com'),
  turmaId: 't1',
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('salvar e carregar devolvem a mesma sessão', () async {
    final store = SessaoStore();
    await store.salvar(_sessao);

    final lida = await store.carregar();
    expect(lida, isNotNull);
    expect(lida!.jwt, 'jwt-de-teste');
    expect(lida.usuario.id, 'u1');
    expect(lida.usuario.email, 'o@x.com');
    expect(lida.turmaId, 't1');
  });

  test('sem sessão salva, carregar devolve null', () async {
    expect(await SessaoStore().carregar(), isNull);
  });

  test('JSON corrompido devolve null e remove a chave', () async {
    SharedPreferences.setMockInitialValues({'sessao': '{isto nao e json'});

    expect(await SessaoStore().carregar(), isNull);

    final prefs = await SharedPreferences.getInstance();
    expect(prefs.containsKey('sessao'), isFalse);
  });

  test(
    'JSON válido com formato errado também devolve null e remove a chave',
    () async {
      SharedPreferences.setMockInitialValues({'sessao': '{"jwt": 123}'});

      expect(await SessaoStore().carregar(), isNull);

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.containsKey('sessao'), isFalse);
    },
  );

  test('limpar mantém o tema', () async {
    final store = SessaoStore();
    await store.salvar(_sessao);
    await store.definirTemaEscuro(true);
    await store.registrarSincronizacao(DateTime.now());
    await store.registrarHomeSalva(DateTime.now());

    await store.limpar();

    expect(await store.carregar(), isNull);
    expect(await store.temaEscuro(), isTrue);
    expect(await store.ultimaSincronizacao(), isNull);
    expect(await store.homeSalvaEm(), isNull);
  });

  test('limpar mantém o dono da última sessão (fila não pode trocar de autor)', () async {
    final store = SessaoStore();
    expect(await store.ultimoUsuarioId(), isNull);

    await store.salvar(_sessao);
    await store.limpar();

    expect(await store.carregar(), isNull);
    expect(await store.ultimoUsuarioId(), 'u1');
  });

  test('tema e datas voltam iguais', () async {
    final store = SessaoStore();
    final sincronizado = DateTime(2026, 10, 22, 19, 5, 30, 123, 456);
    final salvaEm = DateTime(2026, 10, 22, 18, 40);

    expect(await store.temaEscuro(), isFalse);
    expect(await store.ultimaSincronizacao(), isNull);

    await store.definirTemaEscuro(true);
    await store.registrarSincronizacao(sincronizado);
    await store.registrarHomeSalva(salvaEm);

    expect(await store.temaEscuro(), isTrue);
    expect(
      (await store.ultimaSincronizacao())!.isAtSameMomentAs(sincronizado),
      isTrue,
    );
    expect((await store.homeSalvaEm())!.isAtSameMomentAs(salvaEm), isTrue);
  });
}
