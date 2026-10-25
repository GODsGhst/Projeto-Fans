import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:projetofans/core/api.dart';
import 'package:projetofans/core/armazenamento.dart';
import 'package:projetofans/core/auth.dart';
import 'package:projetofans/data/models.dart';
import 'package:projetofans/data/moderacao_repository.dart';
import 'package:projetofans/data/sync_repository.dart';
import 'package:projetofans/data/turma_repository.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Base dos testes. Os caminhos são os da API real.
const String baseTeste = 'https://api.teste/api/v1';

/// Resposta JSON em UTF-8. Sem corpo quando [corpo] é nulo.
http.Response respostaJson(int status, [Object? corpo]) => corpo == null
    ? http.Response.bytes(const <int>[], status)
    : http.Response.bytes(
        utf8.encode(jsonEncode(corpo)),
        status,
        headers: {'content-type': 'application/json; charset=utf-8'},
      );

/// Corpo que não é JSON, como o HTML de um proxy ou de um portal cativo.
http.Response respostaHtml(int status) => http.Response.bytes(
      utf8.encode('<html>Not Found</html>'),
      status,
      headers: {'content-type': 'text/html; charset=utf-8'},
    );

/// Falha de rede. O ApiClient traduz para OFFLINE.
Future<http.Response> semRede(http.Request pedido) =>
    Future<http.Response>.error(http.ClientException('sem rede'));

/// ApiClient com token e interceptores de produção. Conta de aluno: não envia X-Turma-Id.
ApiClient apiTeste(
  http.Client cliente, {
  String? Function()? token,
  void Function()? onSessao,
  void Function()? onSemTurma,
}) =>
    ApiClient(
      client: cliente,
      baseUrl: baseTeste,
      token: token ?? () => 'jwt-123',
      ehDocente: () => false,
      turmaAtiva: () async => null,
      onSessaoExpirada: onSessao ?? () {},
      onSemTurma: onSemTurma ?? () {},
    );

/// Armazenamento sobre SharedPreferences em memória, com os valores iniciais dados.
Future<Armazenamento> armazenamentoTeste([
  Map<String, Object> inicial = const {},
]) async {
  SharedPreferences.setMockInitialValues(inicial);
  return Armazenamento(await SharedPreferences.getInstance());
}

const Usuario usuarioTeste = Usuario(
  id: 'u1',
  nome: 'Otavio',
  email: 'otavio@teste.com',
);

ItemHome itemTeste(String id, String data, TipoEvento tipo) => ItemHome(
      eventoId: id,
      tipo: tipo,
      titulo: 'evento $id',
      data: data,
      materiaSigla: 'BD',
      materiaCorHex: '#0369A1',
      autoria: const Autoria(
        autorId: 'u1',
        autorNome: 'Otavio',
        criadoEm: '2026-08-30T12:00:00Z',
        atualizadoEm: '2026-08-30T12:00:00Z',
      ),
      feitoPeloUsuario: false,
    );

/// Membro como o GET /turmas/minha devolve.
Map<String, Object?> membroJson(
  String usuarioId,
  String nome,
  String papel, {
  String? selo,
  bool contestado = false,
}) =>
    {
      'usuarioId': usuarioId,
      'nome': nome,
      'papel': papel,
      'entrouEm': '2026-08-01T12:00:00Z',
      'selo': ?selo,
      'contestado': contestado,
    };

/// Turma como o GET /turmas/minha devolve. Sem `meuAlcance` quer dizer NENHUM.
Map<String, Object?> turmaJson({
  String codigo = 'ABC12345',
  List<Map<String, Object?>>? membros,
  Map<String, Object?>? meuAlcance,
}) =>
    {
      'id': 't1',
      'nome': 'Fans 2026',
      'semestre': '2026.2',
      'codigoConvite': codigo,
      'membros': membros ?? [membroJson('u1', 'Otavio', 'LIDER')],
      'meuAlcance': ?meuAlcance,
    };

/// Uma turma do painel como GET /painel devolve.
Map<String, Object?> turmaPainelJson(String id, List<ItemHome> proximos) => {
      'turmaId': id,
      'nome': 'Turma $id',
      'papel': 'PROFESSOR',
      'selo': 'PROFESSOR',
      'contestado': false,
      'lecionadas': <Object?>[],
      'proximos': [for (final i in proximos) i.toJson()],
    };

/// Lembretes falsos. `suportado` diz se há plugin de notificação no aparelho.
class LembretesFalsos implements LembretesSync {
  LembretesFalsos({this.suportado = false});

  @override
  bool suportado;

  @override
  int epoca = 0;

  /// Cada chamada de `sincronizar`, na ordem em que chegou.
  final List<List<EventoAgendavel>> entregues = [];

  @override
  Future<void> sincronizar(List<EventoAgendavel> eventos) async {
    entregues.add(eventos);
  }
}

/// Sessão do usuário [usuarioTeste] na turma t1, ligada como em produção: AuthService, ApiClient
/// e os repositórios de turma. A rota [rota] faz o papel do servidor.
class Sessao {
  Sessao._(this.api, this.auth, this.turmas, this.moderacao);

  final ApiClient api;
  final AuthService auth;
  final TurmaRepository turmas;
  final ModeracaoRepository moderacao;

  static Future<Sessao> montar(
    Future<http.Response> Function(http.Request pedido) rota,
  ) async {
    final armazenamento = await armazenamentoTeste();
    late final AuthService auth;
    final api = apiTeste(
      MockClient(rota),
      token: () => auth.token,
      onSessao: () => auth.encerrarSessao(),
      onSemTurma: () => unawaited(auth.registrarTurma(null)),
    );
    auth = AuthService(api: api, armazenamento: armazenamento);
    auth.definirSessao('jwt', usuarioTeste, turmaId: 't1');
    final turmas = TurmaRepository(api: api, auth: auth);
    final moderacao = ModeracaoRepository(api: api, turmas: turmas);
    return Sessao._(api, auth, turmas, moderacao);
  }
}
