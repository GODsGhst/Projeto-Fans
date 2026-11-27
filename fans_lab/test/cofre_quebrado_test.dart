import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:fans_lab/app_deps.dart';
import 'package:fans_lab/database/app_database.dart';
import 'package:fans_lab/main.dart';
import 'package:fans_lab/models/sessao.dart';
import 'package:fans_lab/models/usuario.dart';
import 'package:fans_lab/repositories/sessao_store.dart';
import 'package:fans_lab/screens/home_page.dart';

/// Cofre que não abre: chave do navegador apagada ou Keystore corrompido.
/// Lança Error, não Exception, como o DOMException do WebCrypto no navegador.
class CofreQuebrado extends FlutterSecureStorage {
  const CofreQuebrado();

  @override
  Future<String?> read({
    required String key,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) =>
      Future.error(StateError('cofre quebrado'));

  @override
  Future<void> write({
    required String key,
    required String? value,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) =>
      Future.error(StateError('cofre quebrado'));

  @override
  Future<void> delete({
    required String key,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) =>
      Future.error(StateError('cofre quebrado'));
}

final _sessao = Sessao(
  jwt: 'jwt-de-teste',
  usuario: Usuario(id: 'u1', nome: 'Otávio', email: 'o@x.com'),
  turmaId: 't1',
);

http.Response _json(Object corpo) => http.Response(
  jsonEncode(corpo),
  200,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

void main() {
  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfiNoIsolate;
  });

  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('cofre que não abre vira "sem sessão", não derruba a abertura do app', () async {
    expect(await SessaoStore(const CofreQuebrado()).carregar(), isNull);
  });

  test('sessão antiga migra mesmo com o cofre quebrado, e a cópia em texto puro sai', () async {
    SharedPreferences.setMockInitialValues({'sessao': jsonEncode(_sessao.toJson())});

    final lida = await SessaoStore(const CofreQuebrado()).carregar();

    expect(lida?.jwt, 'jwt-de-teste');
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.containsKey('sessao'), isFalse);
  });

  test('sair funciona com o cofre quebrado', () async {
    final store = SessaoStore(const CofreQuebrado());
    await store.registrarSincronizacao(DateTime.now());

    await store.limpar();

    expect(await store.ultimaSincronizacao(), isNull);
  });

  testWidgets('login entra mesmo sem conseguir gravar no cofre, e avisa', (tester) async {
    final db = (await tester.runAsync(() => AppDatabase.abrirEmMemoria()))!;
    final deps = AppDeps.padrao(
      client: MockClient((req) async {
        if (req.method == 'POST' && req.url.path == '/auth/login') {
          return _json({
            'jwt': 'jwt-otavio',
            'usuario': {'id': 'u1', 'nome': 'Otávio', 'email': 'o@x.com', 'tipoConta': 'ALUNO'},
            'turmaId': 't1',
          });
        }
        return _json([]);
      }),
      abrirDb: () async => db,
      baseUrl: 'http://api',
      cofre: const CofreQuebrado(),
    );
    await tester.pumpWidget(FansLabApp(deps: deps));

    await tester.enterText(find.byType(TextFormField).at(0), 'o@x.com');
    await tester.enterText(find.byType(TextFormField).at(1), 'senha-certa');
    await tester.tap(find.text('Entrar'));

    const aviso =
        'Não deu para guardar o login neste aparelho. Na próxima vez que abrir o app, entre de novo.';
    for (var i = 0; i < 60 && find.text(aviso).evaluate().isEmpty; i++) {
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
      await tester.pump();
    }

    expect(find.text(aviso), findsOneWidget);
    expect(find.byType(HomePage), findsOneWidget);
    expect(deps.api.token, 'jwt-otavio');
  });
}
