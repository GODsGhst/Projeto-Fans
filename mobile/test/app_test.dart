import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:projetofans/app.dart';
import 'package:projetofans/core/armazenamento.dart';
import 'package:projetofans/core/rotas.dart';
import 'package:projetofans/core/servicos.dart';
import 'package:projetofans/data/models.dart';
import 'package:projetofans/features/auth/entrar_turma_page.dart';
import 'package:projetofans/features/auth/login_page.dart';
import 'package:projetofans/features/home/home_page.dart';
import 'package:projetofans/features/painel/painel_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _aluno = Usuario(
  id: 'u1',
  nome: 'Ana',
  email: 'ana@exemplo.com',
  tipoConta: TipoConta.aluno,
);

const _docente = Usuario(
  id: 'u2',
  nome: 'Beto',
  email: 'beto@exemplo.com',
  tipoConta: TipoConta.professor,
  docenteStatus: DocenteStatus.aprovado,
);

/// Serviços com o disco de [sessao] (ou vazio). O http falso responde 500 a tudo: o app nunca
/// deve depender de rede para escolher a primeira tela.
Future<Servicos> _montar({SessaoLocal? sessao}) async {
  SharedPreferences.setMockInitialValues({
    if (sessao != null) chaveSessao: jsonEncode(sessao.toJson()),
  });
  final armazenamento = await Armazenamento.abrir();
  final s = Servicos.montar(
    armazenamento: armazenamento,
    client: MockClient((_) async => http.Response('', 500)),
  );
  await s.auth.restaurar();
  return s;
}

Future<void> _abrir(WidgetTester tester, Servicos s) async {
  await tester.pumpWidget(PfApp(servicos: s, roteador: criarRoteador(s)));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('sem sessão o app abre em /login', (tester) async {
    final s = await _montar();
    await _abrir(tester, s);

    expect(find.byType(LoginPage), findsOneWidget);
  });

  testWidgets('com sessão sem turma abre em /entrar-turma, nunca nas abas', (
    tester,
  ) async {
    final s = await _montar(
      sessao: const SessaoLocal(jwt: 'jwt', usuario: _aluno),
    );
    await _abrir(tester, s);

    expect(find.byType(EntrarTurmaPage), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
  });

  testWidgets('aluno com turma abre em /tabs/home, com a casca das abas', (
    tester,
  ) async {
    final s = await _montar(
      sessao: const SessaoLocal(jwt: 'jwt', usuario: _aluno, turmaId: 't1'),
    );
    await _abrir(tester, s);

    expect(find.byType(HomePage), findsOneWidget);
    expect(find.byType(NavigationBar), findsOneWidget);
  });

  testWidgets('docente com turma abre em /tabs/painel, não na home', (
    tester,
  ) async {
    final s = await _montar(
      sessao: const SessaoLocal(jwt: 'jwt', usuario: _docente, turmaId: 't1'),
    );
    await _abrir(tester, s);

    expect(find.byType(PainelPage), findsOneWidget);
    expect(find.byType(HomePage), findsNothing);
  });
}
