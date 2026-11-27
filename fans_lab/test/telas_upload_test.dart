import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:fans_lab/app_deps.dart';
import 'package:fans_lab/database/app_database.dart';
import 'package:fans_lab/models/autoria.dart';
import 'package:fans_lab/models/evento.dart';
import 'package:fans_lab/models/tipo_evento.dart';
import 'package:fans_lab/screens/enviar_arquivo_page.dart';

import 'upload_service_test.dart' show AdaptadorFalso, jsonResposta, materialCriado;

/// Arquivo em memória, no lugar do que o seletor do sistema devolveria.
final class ArquivoFalso extends PlatformFile {
  ArquivoFalso(this.name, this.bytes);

  @override
  final String name;
  final Uint8List bytes;

  @override
  Uri get uri => Uri.parse('memoria:///$name');

  @override
  get xFile => throw UnimplementedError();

  @override
  int? lengthSync() => bytes.length;

  @override
  Future<int?> length() async => bytes.length;

  @override
  Future<Uint8List> readAsBytes() async => bytes;

  @override
  Stream<Uint8List> readAsByteStream() => Stream.value(bytes);
}

/// Seletor do sistema falso: devolve [proximo] (null = a pessoa cancelou).
class SeletorFalso extends FilePickerPlatform {
  PlatformFile? proximo;

  @override
  Future<PlatformFile?> pickFile({
    String? dialogTitle,
    String? initialDirectory,
    FileType type = FileType.any,
    List<String>? allowedExtensions,
    Function(FilePickerStatus)? onFileLoading,
    int compressionQuality = 0,
    AndroidOptions androidOptions = const AndroidOptions(),
    DarwinOptions darwinOptions = const DarwinOptions(),
    WindowsOptions windowsOptions = const WindowsOptions(),
    LinuxOptions linuxOptions = const LinuxOptions(),
    WebOptions webOptions = const WebOptions(),
  }) async => proximo;
}

final _evento = Evento(
  id: 'e1',
  tipo: TipoEvento.prova,
  titulo: 'Prova 2',
  data: DateTime(2026, 12, 3),
  materiaId: 'm1',
  materiaSigla: 'BD',
  materiaCorHex: '#1D4ED8',
  autoria: Autoria(autorId: 'u1', autorNome: 'Ana', criadoEm: DateTime.utc(2026, 11, 20)),
  version: 1,
  visivelTurma: true,
);

Uint8List _pdf(int tamanho) {
  final b = Uint8List(tamanho);
  b.setAll(0, utf8.encode('%PDF-'));
  return b;
}

void main() {
  late SeletorFalso seletor;
  late AdaptadorFalso servidor;

  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfiNoIsolate;
  });

  setUp(() {
    seletor = SeletorFalso();
    FilePickerPlatform.instance = seletor;
  });

  /// Abre a tela por cima de uma página e devolve onde o resultado do pop cai.
  Future<List<bool?>> abrir(WidgetTester tester, ResponseBody Function() resposta) async {
    SharedPreferences.setMockInitialValues({});
    final db = (await tester.runAsync(() => AppDatabase.abrirEmMemoria()))!;
    servidor = AdaptadorFalso((_, _) => resposta());
    final deps = AppDeps.padrao(
      client: MockClient((_) async => http.Response('', 404)),
      abrirDb: () async => db,
      baseUrl: 'http://api',
      dio: Dio()..httpClientAdapter = servidor,
    );
    final resultados = <bool?>[];
    await tester.pumpWidget(MaterialApp(
      home: Builder(
        builder: (context) => TextButton(
          onPressed: () async => resultados.add(await Navigator.push<bool>(
            context,
            MaterialPageRoute(builder: (_) => EnviarArquivoPage(deps: deps, evento: _evento)),
          )),
          child: const Text('abrir'),
        ),
      ),
    ));
    await tester.tap(find.text('abrir'));
    await tester.pumpAndSettle();
    return resultados;
  }

  Future<void> deixarRodar(WidgetTester tester) async {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 200)));
    await tester.pumpAndSettle();
  }

  FilledButton botaoEnviar(WidgetTester tester) =>
      tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Enviar'));

  testWidgets('Enviar só habilita com arquivo válido; cancelar o seletor não perde a escolha', (tester) async {
    await abrir(tester, () => jsonResposta(materialCriado, 201));
    expect(botaoEnviar(tester).onPressed, isNull);

    seletor.proximo = ArquivoFalso('grande.pdf', _pdf(6 * 1024 * 1024));
    await tester.tap(find.text('Selecionar documento'));
    await deixarRodar(tester);
    expect(find.text('O arquivo tem 6,0 MB. O limite é 5 MB.'), findsOneWidget);
    expect(botaoEnviar(tester).onPressed, isNull);

    seletor.proximo = ArquivoFalso('lista.pdf', _pdf(2048));
    await tester.tap(find.text('Trocar documento'));
    await deixarRodar(tester);
    expect(find.text('lista.pdf'), findsOneWidget);
    expect(find.text('2 KB'), findsOneWidget);
    expect(botaoEnviar(tester).onPressed, isNotNull);

    seletor.proximo = null;
    await tester.tap(find.text('Trocar documento'));
    await deixarRodar(tester);
    expect(find.text('Seleção cancelada.'), findsOneWidget);
    expect(find.text('lista.pdf'), findsOneWidget);
    expect(servidor.pedido, isNull, reason: 'selecionar não é enviar');
  });

  testWidgets('envia o arquivo e volta para o evento com true', (tester) async {
    final resultados = await abrir(tester, () => jsonResposta(materialCriado, 201));
    seletor.proximo = ArquivoFalso('lista.pdf', _pdf(2048));
    await tester.tap(find.text('Selecionar documento'));
    await deixarRodar(tester);
    await tester.enterText(find.byType(TextField), 'Lista 2');

    await tester.tap(find.text('Enviar'));
    await deixarRodar(tester);

    expect(servidor.corpo, contains('filename="lista.pdf"'));
    expect(servidor.corpo, contains('Lista 2'));
    expect(resultados, [true]);
    expect(find.byType(EnviarArquivoPage), findsNothing);
  });

  testWidgets('dois toques seguidos em Enviar mandam o arquivo uma vez só', (tester) async {
    final resultados = await abrir(tester, () => jsonResposta(materialCriado, 201));
    seletor.proximo = ArquivoFalso('lista.pdf', _pdf(2048));
    await tester.tap(find.text('Selecionar documento'));
    await deixarRodar(tester);

    await tester.tap(find.text('Enviar'));
    await tester.tap(find.text('Enviar'), warnIfMissed: false);
    await deixarRodar(tester);

    expect(servidor.chamadas, 1);
    expect(resultados, [true]);
  });

  testWidgets('recusa do servidor aparece na tela e dá para tentar de novo', (tester) async {
    final resultados = await abrir(tester, () => jsonResposta({'detail': 'grande'}, 413));
    seletor.proximo = ArquivoFalso('lista.pdf', _pdf(2048));
    await tester.tap(find.text('Selecionar documento'));
    await deixarRodar(tester);

    await tester.tap(find.text('Enviar'));
    await deixarRodar(tester);

    expect(find.text('O arquivo passa do limite de 5 MB aceito pelo servidor.'), findsOneWidget);
    expect(botaoEnviar(tester).onPressed, isNotNull);
    expect(resultados, isEmpty);
  });
}
