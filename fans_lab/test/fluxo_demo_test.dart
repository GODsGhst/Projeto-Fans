import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:fans_lab/app_deps.dart';
import 'package:fans_lab/database/app_database.dart';
import 'package:fans_lab/main.dart' as fans;
import 'package:fans_lab/models/formatos.dart';
import 'package:fans_lab/screens/home_page.dart';
import 'package:fans_lab/widgets/cores.dart';

/// Servidor da turma simulado em memória, no formato da §5 do ENTREGA-FLUTTER.md.
/// Com `online = false`, cada chamada falha como queda de rede (modo avião).
class ServidorFalso {
  ServidorFalso() {
    final hoje = DateTime.now();
    DateTime noDia(int dias) => DateTime(hoje.year, hoje.month, hoje.day + dias);

    final ana = _autoria('u2', 'Ana', hoje.subtract(const Duration(days: 3)));
    final bia = _autoria('u3', 'Bia', hoje.subtract(const Duration(days: 2)));
    // Já vêm em ordem de data, como o servidor manda.
    _eventos.addAll([
      _semNulos({
        'id': 'e1',
        'tipo': 'PROVA',
        'titulo': 'Prova 2',
        'data': dataIso(noDia(3)),
        'hora': '19:00:00',
        'materiaId': 'm1',
        'materiaSigla': 'BD',
        'materiaCorHex': '#1D4ED8',
        'autoria': ana,
        'version': 1,
        'visivelTurma': true,
      }),
      _semNulos({
        'id': 'e2',
        'tipo': 'ENTREGA',
        'titulo': 'Lista 4',
        'data': dataIso(noDia(5)),
        'materiaId': 'm2',
        'materiaSigla': 'CA',
        'materiaCorHex': '#B45309',
        'autoria': bia,
        'version': 1,
        'visivelTurma': true,
      }),
    ]);
    // O evento S da turma: o único com material vinculado.
    _materiais['e1'] = [
      {
        'id': 'mt1',
        'tipo': 'AULA',
        'titulo': 'Slides aula 3',
        'url': 'https://exemplo.com/slides',
        'dataAula': dataIso(noDia(-10)),
        'autoria': ana,
      },
    ];
  }

  static const _materias = {
    'm1': {'id': 'm1', 'nome': 'Banco de Dados', 'sigla': 'BD', 'corHex': '#1D4ED8'},
    'm2': {'id': 'm2', 'nome': 'Cálculo', 'sigla': 'CA', 'corHex': '#B45309'},
  };

  bool online = true;

  /// Só o que chegou de verdade ao servidor. Chamada sem rede não entra aqui.
  final List<Map<String, dynamic>> posts = [];
  final List<Map<String, dynamic>> puts = [];

  final List<Map<String, dynamic>> _eventos = [];
  final Map<String, List<Map<String, dynamic>>> _materiais = {};
  final Map<String, bool> _feitos = {};

  Future<http.Response> responder(http.Request req) async {
    if (!online) throw http.ClientException('sem rede', req.url);
    final caminho = req.url.path;
    final metodo = req.method;
    if (metodo == 'POST' && caminho == '/auth/login') return _login(req);
    if (metodo == 'GET' && caminho == '/home') {
      return _json([for (final e in _eventos) _itemHome(e)], 200);
    }
    if (metodo == 'GET' && caminho == '/materias') {
      return _json(_materias.values.toList(), 200);
    }
    if (metodo == 'POST' && caminho == '/eventos') return _criar(req);
    final detalhe = RegExp(r'^/eventos/([^/]+)$').firstMatch(caminho);
    if (metodo == 'GET' && detalhe != null) return _detalhe(detalhe.group(1)!);
    final feito = RegExp(r'^/eventos/([^/]+)/estado-pessoal$').firstMatch(caminho);
    if (metodo == 'PUT' && feito != null) {
      return _marcarFeito(feito.group(1)!, req);
    }
    return _json({'status': 404, 'title': 'Não encontrado'}, 404);
  }

  http.Response _login(http.Request req) {
    final corpo = jsonDecode(req.body) as Map<String, dynamic>;
    if (corpo['senha'] != 'senha-certa') {
      return _json({
        'type': 'about:blank',
        'title': 'Não autorizado',
        'status': 401,
        'detail': 'Credencial inválida.',
      }, 401);
    }
    return _json({
      'jwt': 'jwt-otavio',
      'usuario': _semNulos({
        'id': 'u1',
        'nome': 'Otávio',
        'email': corpo['email'],
        'tipoConta': 'ALUNO',
      }),
      'turmaId': 't1',
    }, 200);
  }

  Map<String, dynamic> _itemHome(Map<String, dynamic> e) => _semNulos({
    'eventoId': e['id'],
    'tipo': e['tipo'],
    'titulo': e['titulo'],
    'data': e['data'],
    'hora': e['hora'],
    'materiaSigla': e['materiaSigla'],
    'materiaCorHex': e['materiaCorHex'],
    'autoria': e['autoria'],
    'feitoPeloUsuario': _feitos[e['id']] ?? false,
  });

  http.Response _criar(http.Request req) {
    final corpo = jsonDecode(req.body) as Map<String, dynamic>;
    posts.add(corpo);
    final materia = _materias[corpo['materiaId']]!;
    final evento = _semNulos({
      'id': 'e${_eventos.length + 1}',
      'tipo': corpo['tipo'],
      'titulo': corpo['titulo'],
      'data': corpo['data'],
      'hora': corpo['hora'],
      'sala': corpo['sala'],
      'materiaId': corpo['materiaId'],
      'materiaSigla': materia['sigla'],
      'materiaCorHex': materia['corHex'],
      'autoria': _autoria('u1', 'Otávio', DateTime.now()),
      'version': 1,
      'visivelTurma': true,
    });
    _eventos.add(evento);
    // O servidor ordena por data; o handler faz o mesmo para a Home ficar real.
    _eventos.sort(_porData);
    return _json(evento, 201);
  }

  http.Response _detalhe(String id) {
    for (final e in _eventos) {
      if (e['id'] == id) {
        return _json({...e, 'materiais': _materiais[id] ?? []}, 200);
      }
    }
    return _json({
      'type': 'about:blank',
      'title': 'Não encontrado',
      'status': 404,
      'detail': 'Evento não encontrado.',
    }, 404);
  }

  http.Response _marcarFeito(String id, http.Request req) {
    final corpo = jsonDecode(req.body) as Map<String, dynamic>;
    puts.add(corpo);
    _feitos[id] = corpo['feito'] as bool;
    return http.Response('', 204);
  }
}

// ---------------------------------------------------------------------------
// Ajudantes do servidor simulado

http.Response _json(Object corpo, int status) => http.Response(
  jsonEncode(corpo),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

/// O servidor omite chaves nulas (Jackson non_null). O cliente aceita os dois casos.
Map<String, dynamic> _semNulos(Map<String, dynamic> m) =>
    {for (final e in m.entries) if (e.value != null) e.key: e.value};

Map<String, dynamic> _autoria(String autorId, String nome, DateTime criadoEm) {
  final instante = criadoEm.toUtc().toIso8601String();
  return _semNulos({
    'autorId': autorId,
    'autorNome': nome,
    'criadoEm': instante,
    'atualizadoEm': instante,
  });
}

int _porData(Map<String, dynamic> a, Map<String, dynamic> b) =>
    '${a['data']} ${a['hora'] ?? '99:99'}'.compareTo('${b['data']} ${b['hora'] ?? '99:99'}');

// ---------------------------------------------------------------------------
// Ajudantes do teste

/// Banco e HTTP são I/O real: criados fora da zona falsa do testWidgets.
Future<AppDeps> montarDeps(WidgetTester tester, ServidorFalso servidor) async {
  SharedPreferences.setMockInitialValues({});
  final db = (await tester.runAsync(AppDatabase.abrirEmMemoria))!;
  return AppDeps.padrao(
    client: MockClient(servidor.responder),
    abrirDb: () async => db,
    baseUrl: 'http://api',
  );
}

/// SQLite e SharedPreferences rodam de verdade: o tempo real precisa correr até a condição valer.
Future<void> esperarQue(WidgetTester tester, bool Function() condicao, String oQue) async {
  for (var i = 0; i < 400 && !condicao(); i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 10)));
    await tester.pump(const Duration(milliseconds: 10));
  }
  if (!condicao()) fail('Não apareceu a tempo: $oQue.');
}

Future<void> esperarVer(WidgetTester tester, Finder alvo, String oQue) =>
    esperarQue(tester, () => alvo.evaluate().isNotEmpty, oQue);

/// Deixa a animação de uma rota acabar (transição de 300 ms, com folga).
/// Um pump único não basta: a animação começa no frame seguinte e a rota de baixo fica na árvore.
Future<void> _assentar(WidgetTester tester) async {
  for (var i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

/// Rola até o alvo, toca e espera a rota nova abrir.
Future<void> _tocar(WidgetTester tester, Finder alvo) async {
  await tester.ensureVisible(alvo);
  await tester.tap(alvo);
  await _assentar(tester);
}

/// Seta de voltar do AppBar. Espera a rota sair para a Home ficar sozinha na tela.
Future<void> _voltar(WidgetTester tester) async {
  await tester.tap(find.byType(BackButton));
  await _assentar(tester);
}

Future<void> _escolherMateria(WidgetTester tester, String nome) async {
  await _tocar(tester, find.byType(DropdownButtonFormField<String>));
  await tester.tap(find.text(nome).last);
  await _assentar(tester);
}

double _dy(WidgetTester tester, String texto) =>
    tester.getTopLeft(find.text(texto)).dy;

/// Decoração do cartão da Home. A chave `evento-card-<tipo>` vem do EventoCard.
BoxDecoration _cartao(WidgetTester tester, String tipo) =>
    tester.widget<Container>(find.byKey(ValueKey('evento-card-$tipo'))).decoration!
        as BoxDecoration;

/// A faixa "Sem conexão com o servidor — mostrando o que foi salvo às HH:mm.".
Finder _faixaOffline() => find.byWidgetPredicate(
  (w) => w is Text && (w.data ?? '').startsWith('Sem conexão com o servidor'),
);

void main() {
  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfiNoIsolate;
  });

  group('Fans Lab, apresentação para a banca', () {
    testWidgets('roteiro da apresentação: online, offline e sincronização', (tester) async {
      // Tela de celular (412 x 915 dp, a 2x). O padrão do teste é 800 x 600.
      tester.view.physicalSize = const Size(824, 1830);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final servidor = ServidorFalso();
      final deps = await montarDeps(tester, servidor);
      await tester.pumpWidget(fans.FansLabApp(deps: deps));

      // PASSO 1, login (0:00).
      // Critérios: POST /auth/login; 401 vira texto pronto na tela (Tratamento de erros);
      // GET /home 200 com a lista na ordem recebida (Operações REST, JSON ↔ objeto).
      expect(
        find.textContaining('A primeira entrada pode levar até 1 minuto'),
        findsOneWidget,
      );
      await tester.enterText(find.byType(TextFormField).at(0), 'otavio@x.com');
      await tester.enterText(find.byType(TextFormField).at(1), 'senha-errada');
      await _tocar(tester, find.text('Entrar'));
      await esperarVer(tester, find.text('E-mail ou senha incorretos.'), 'o erro 401 no login');

      await tester.enterText(find.byType(TextFormField).at(1), 'senha-certa');
      await _tocar(tester, find.text('Entrar'));
      await esperarVer(tester, find.byType(HomePage), 'a Home depois do login');
      await esperarVer(tester, find.text('Prova 2'), 'os eventos do servidor na Home');

      expect(find.text('Lista 4'), findsOneWidget);
      // Ordem do servidor, sem a Home reordenar (ordem é urgência, nunca tipo).
      expect(_dy(tester, 'Prova 2'), lessThan(_dy(tester, 'Lista 4')));
      // Autoria em todo cartão (autoria é o único mecanismo de confiança).
      expect(find.text('Ana · há 3 dias'), findsOneWidget);
      expect(find.text('Bia · há 2 dias'), findsOneWidget);
      // Prova é bloco sólido; entrega é contorno de 1 px. A distinção é de tinta, não de cor.
      final cores = CoresFans.claro;
      expect(_cartao(tester, 'prova').border, isNull);
      expect(_cartao(tester, 'prova').color, cores.provaBg);
      expect((_cartao(tester, 'entrega').border! as Border).top.width, 1);

      // PASSO 2, criar evento online (1:40).
      // Critérios: POST /eventos com 201 (Operações REST); o rascunho passa pelo SQLite antes
      // da rede (CRUD local); envio imediato e aviso de sucesso (Sincronização).
      await _tocar(tester, find.text('+ Adicionar prova ou entrega'));
      await esperarVer(tester, find.byType(DropdownButtonFormField<String>), 'o formulário com as matérias');
      await _tocar(tester, find.text('Entrega'));
      await _escolherMateria(tester, 'Banco de Dados');
      await tester.enterText(find.widgetWithText(TextFormField, 'O que é'), 'Teste A — apresentação');
      await _tocar(tester, find.text('Salvar'));
      await esperarVer(tester, find.text('Enviado para a turma.'), 'o aviso de envio');
      await esperarVer(tester, find.text('Teste A — apresentação'), 'o evento novo na Home');
      await _assentar(tester);
      expect(servidor.posts, hasLength(1));
      expect(servidor.posts.single['tipo'], 'ENTREGA');
      expect(servidor.posts.single['titulo'], 'Teste A — apresentação');
      // Autoria de quem postou, com "agora" (menos de 1 minuto).
      expect(find.text('Otávio · agora'), findsOneWidget);
      // O evento de hoje cai antes da Prova 2: quem manda a ordem é o servidor.
      expect(_dy(tester, 'Teste A — apresentação'), lessThan(_dy(tester, 'Prova 2')));

      // PASSO 3, abrir evento e marcar feito (2:30).
      // Critérios: GET /eventos/{id} com materiais vinculados (Operações REST); PUT
      // estado-pessoal com 204 (o feito é do usuário, não do evento); o feito grava no
      // aparelho antes da rede (CRUD local).
      await _tocar(tester, find.text('Prova 2'));
      await esperarVer(tester, find.text('Materiais vinculados'), 'o detalhe do evento');
      expect(find.text('Slides aula 3'), findsOneWidget);
      await _tocar(tester, find.text('Marcar como feito'));
      await esperarVer(tester, find.text('Feito atualizado.'), 'o aviso de feito atualizado');
      expect(find.text('Desmarcar feito'), findsOneWidget);
      expect(servidor.puts, equals([{'feito': true}]));

      // PASSO 4, modo avião e voltar à Home (3:50 a 4:20).
      // Critérios: cache da Home em SQLite (home_cache) com aviso (Offline, Tratamento de erros);
      // o feito vem de estado_pessoal (LEFT JOIN), não do cache.
      servidor.online = false;
      await _voltar(tester);
      await esperarVer(tester, _faixaOffline(), 'a faixa de sem conexão na Home');
      expect(find.text('Teste A — apresentação'), findsOneWidget);
      expect(find.text('Prova 2'), findsOneWidget);
      expect(find.text('Lista 4'), findsOneWidget);
      expect(find.byIcon(Icons.check_circle), findsOneWidget);
      expect(_dy(tester, 'Teste A — apresentação'), lessThan(_dy(tester, 'Prova 2')));
      expect(_dy(tester, 'Prova 2'), lessThan(_dy(tester, 'Lista 4')));

      // PASSO 5, criar evento sem rede (4:20 a 5:50, item 6.4).
      // Critérios: CRUD local (INSERT em rascunhos); nada chega ao servidor; a Home mostra a
      // fila com "1 aguardando envio" e o botão "Ver fila" (offline-first).
      await _tocar(tester, find.text('+ Adicionar prova ou entrega'));
      await esperarVer(tester, find.byType(DropdownButtonFormField<String>), 'o formulário, com as matérias do cache');
      await _escolherMateria(tester, 'Banco de Dados');
      await tester.enterText(find.widgetWithText(TextFormField, 'O que é'), 'Teste offline — apresentação');
      await _tocar(tester, find.text('Salvar'));
      await esperarVer(
        tester,
        find.text('Salvo no aparelho — será enviado quando houver conexão.'),
        'o aviso de salvo no aparelho',
      );
      await esperarVer(tester, find.text('1 aguardando envio'), 'o contador da fila na Home');
      await _assentar(tester);
      expect(find.text('Ver fila'), findsOneWidget);
      expect(servidor.posts, hasLength(1));
      final pendentes = await tester.runAsync(() => deps.rascunhos.listarPendentes());
      expect(pendentes!.map((r) => r.titulo).toList(), ['Teste offline — apresentação']);

      await _tocar(tester, find.text('Ver fila'));
      await esperarVer(tester, find.text('você · aguardando envio'), 'o rascunho na fila');
      // A marcação de "feito" do passo 3 já foi enviada: a fila mostra zero pendentes.
      expect(find.text('Nenhuma marcação de feito pendente.'), findsOneWidget);
      expect(find.text('Teste offline — apresentação'), findsOneWidget);

      // PASSO 6, religar e sincronizar (5:50 a 6:30).
      // Critérios: Sincronização (fila → API): POST 201 do rascunho; estado de envio por item
      // ("enviado ✓"); a Home volta a vir da API.
      servidor.online = true;
      await _tocar(tester, find.text('Sincronizar agora'));
      await esperarVer(tester, find.text('Enviados: 1 · Com erro: 0 · Pendentes: 0'), 'o resumo do envio');
      // Dois "enviado ✓": o do passo 2 e o deste passo.
      await esperarQue(
        tester,
        () => find.text('você · enviado ✓').evaluate().length == 2,
        'o rascunho marcado como enviado ✓',
      );
      expect(find.text('você · aguardando envio'), findsNothing);
      expect(servidor.posts, hasLength(2));
      expect(servidor.posts.last['titulo'], 'Teste offline — apresentação');

      await _voltar(tester);
      await esperarVer(tester, find.text('Teste offline — apresentação'), 'o evento enviado, vindo da API, na Home');
      expect(_faixaOffline(), findsNothing);
      expect(find.text('1 aguardando envio'), findsNothing);

      // Fim do roteiro: desmonta a tela e deixa os timers do SnackBar acabarem.
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 5));
    });
  });
}
