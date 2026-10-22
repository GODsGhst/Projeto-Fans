import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:projetofans/core/api.dart';
import 'package:projetofans/core/armazenamento.dart';
import 'package:projetofans/core/auth.dart';
import 'package:projetofans/data/models.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _base = 'https://api.teste/api/v1';

const _usuario = {'id': 'u1', 'nome': 'Otavio', 'email': 'voce@exemplo.com'};

const _perfilProfessor = {
  'id': 'u1',
  'nome': 'Otavio',
  'email': 'voce@exemplo.com',
  'tipoConta': 'PROFESSOR',
  'docenteStatus': 'APROVADO',
  'adminPlataforma': false,
  'temSenha': true,
};

String _sessao({String? turmaId = 't1'}) => jsonEncode({
      'jwt': 'jwt-123',
      'usuario': _usuario,
      'turmaId': turmaId,
    });

http.Response _json(int status, Object corpo) => http.Response.bytes(
      utf8.encode(jsonEncode(corpo)),
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

/// Monta AuthService com ApiClient real, ligado do jeito que o app liga.
AuthService _montar({
  required http.Client cliente,
  required Armazenamento armazenamento,
  void Function()? aoEsquecer,
}) {
  late final AuthService auth;
  final api = ApiClient(
    client: cliente,
    baseUrl: _base,
    token: () => auth.token,
    ehDocente: () => auth.ehDocente,
    turmaAtiva: () async => null,
    onSessaoExpirada: () => auth.encerrarSessao(),
    onSemTurma: () => auth.registrarTurma(null),
  );
  auth = AuthService(
    api: api,
    armazenamento: armazenamento,
    aoEsquecerLembretes: aoEsquecer,
  );
  return auth;
}

/// Deixa o GET /eu em segundo plano terminar.
Future<void> _esperarSegundoPlano() =>
    Future<void>.delayed(const Duration(milliseconds: 30));

void main() {
  test('sessão restaurada do disco vale antes do GET /eu, e o GET /eu atualiza o tipo', () async {
    SharedPreferences.setMockInitialValues({'pf.sessao': _sessao()});
    final prefs = await SharedPreferences.getInstance();
    final liberar = Completer<void>();
    final cliente = MockClient((req) async {
      // GET /eu só responde quando o teste liberar: restaurar() não pode esperar por ele.
      await liberar.future;
      return _json(200, _perfilProfessor);
    });
    final auth = _montar(cliente: cliente, armazenamento: Armazenamento(prefs));

    await auth.restaurar();

    expect(auth.autenticado, isTrue);
    expect(auth.token, 'jwt-123');
    expect(auth.temTurma, isTrue);
    expect(auth.turmaId, 't1');
    expect(auth.usuario?.nome, 'Otavio');
    expect(auth.ehDocente, isFalse, reason: 'o tipo gravado ainda é aluno');

    liberar.complete();
    await _esperarSegundoPlano();

    expect(auth.ehDocente, isTrue);
    expect(auth.usuario?.tipoConta, TipoConta.professor);
    expect(auth.turmaId, 't1', reason: 'renovar a sessão mantém a turma');
    final gravada = await Armazenamento(prefs).lerSessao();
    expect(gravada?.usuario.tipoConta, TipoConta.professor);
    expect(gravada?.turmaId, 't1');
  });

  test('GET /eu rejeitado mantém o gravado e continua autenticado', () async {
    SharedPreferences.setMockInitialValues({'pf.sessao': _sessao()});
    final prefs = await SharedPreferences.getInstance();
    final cliente = MockClient((_) async => _json(500, {'detail': 'boom'}));
    final auth = _montar(cliente: cliente, armazenamento: Armazenamento(prefs));

    await auth.restaurar();
    await _esperarSegundoPlano();

    expect(auth.autenticado, isTrue);
    expect(auth.usuario?.id, 'u1');
    expect(auth.usuario?.tipoConta, isNull);
  });

  test('registrarTurma(null) zera a turma, cancela lembretes e apaga o snapshot', () async {
    SharedPreferences.setMockInitialValues({
      'pf.sessao': _sessao(),
      'pf.snapshot': jsonEncode({
        'eventos': <Object>[],
        'materias': <Object>[],
        'ultimoSync': '2026-08-30T09:15:00Z',
      }),
    });
    final prefs = await SharedPreferences.getInstance();
    final arm = Armazenamento(prefs);
    var esquecidos = 0;
    final auth = _montar(
      cliente: MockClient((_) async => _json(200, {})),
      armazenamento: arm,
      aoEsquecer: () {
        esquecidos++;
      },
    );
    await auth.restaurar();

    await auth.registrarTurma(null);

    expect(auth.temTurma, isFalse);
    expect(auth.autenticado, isTrue, reason: 'sair da turma não é sair da conta');
    expect(esquecidos, 1);
    expect(prefs.containsKey('pf.snapshot'), isFalse);
    expect((await arm.lerSessao())?.turmaId, isNull);
    expect((await arm.lerSessao())?.jwt, 'jwt-123');

    await auth.registrarTurma('t2');

    expect(auth.turmaId, 't2');
    expect(esquecidos, 1, reason: 'entrar numa turma não cancela lembretes');
  });

  test('sair() zera a sessão, apaga o snapshot e cancela lembretes uma vez', () async {
    SharedPreferences.setMockInitialValues({
      'pf.sessao': _sessao(),
      'pf.snapshot': jsonEncode({
        'eventos': <Object>[],
        'materias': <Object>[],
        'ultimoSync': '2026-08-30T09:15:00Z',
      }),
    });
    final prefs = await SharedPreferences.getInstance();
    var esquecidos = 0;
    final auth = _montar(
      cliente: MockClient((_) async => _json(200, {})),
      armazenamento: Armazenamento(prefs),
      aoEsquecer: () {
        esquecidos++;
      },
    );
    await auth.restaurar();

    await auth.sair();

    expect(auth.autenticado, isFalse);
    expect(esquecidos, 1);
    expect(prefs.containsKey('pf.sessao'), isFalse);
    expect(prefs.containsKey('pf.snapshot'), isFalse);
  });
}
