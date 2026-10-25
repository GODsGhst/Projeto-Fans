import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:projetofans/shared/estilos.dart';
import 'package:projetofans/shared/evento_card.dart';
import 'package:projetofans/shared/materia_chip.dart';
import 'package:projetofans/shared/nota_card.dart';
import 'package:projetofans/shared/tema.dart';
import 'package:projetofans/shared/tipos.dart';

/// Os nao-negociaveis visuais de app/src/app/shared/design-system.spec.ts, como widget tests.
Widget envolve(Widget filho, {bool escuro = false}) => MaterialApp(
  theme: escuro ? PfTema.escuro() : PfTema.claro(),
  home: Scaffold(
    body: Center(child: SizedBox(width: 360, child: filho)),
  ),
);

/// Decoracao do Container raiz de um cartao (o primeiro Container dentro de T).
BoxDecoration decoracaoRaiz<T extends Widget>(WidgetTester tester) {
  final container = tester.widget<Container>(
    find.descendant(of: find.byType(T), matching: find.byType(Container)).first,
  );
  return container.decoration! as BoxDecoration;
}

EventoCard prova({
  String titulo = 'Prova 2 — normalização',
  String quando = '19:00',
  MateriaVisual? materia = (sigla: 'BD', cor: '#0369A1'),
  String? autoria,
  TipoSelo? autoriaSelo,
  String? editadoPor,
  TipoSelo? editadoPorSelo,
}) => EventoCard(
  tipo: TipoEvento.prova,
  dia: '12',
  mes: 'ago',
  titulo: titulo,
  quando: quando,
  materia: materia,
  autoria: autoria,
  autoriaSelo: autoriaSelo,
  editadoPor: editadoPor,
  editadoPorSelo: editadoPorSelo,
);

EventoCard entrega({
  String titulo = 'Lista 4',
  String quando = 'entrega',
  MateriaVisual? materia = (sigla: 'BD', cor: '#0369A1'),
}) => EventoCard(
  tipo: TipoEvento.entrega,
  dia: '14',
  mes: 'set',
  titulo: titulo,
  quando: quando,
  materia: materia,
);

/// Regua tracejada: o Tracejado e um CustomPainter, entao procura-se o CustomPaint que o carrega.
Finder tracejado() => find.byWidgetPredicate(
  (w) => w is CustomPaint && w.painter is Tracejado,
);

void main() {
  group('cor e sigla sempre juntas (nao-negociavel 7)', () {
    testWidgets('chip mostra a sigla em caixa alta e preenche com a cor da materia', (
      tester,
    ) async {
      await tester.pumpWidget(
        envolve(const MateriaChip(sigla: 'bd', cor: '#0369A1')),
      );

      expect(find.text('BD'), findsOneWidget);
      expect(
        find.byWidgetPredicate(
          (w) =>
              w is DecoratedBox &&
              w.decoration is BoxDecoration &&
              (w.decoration as BoxDecoration).color ==
                  const Color(0xFF0369A1),
        ),
        findsOneWidget,
      );
    });

    testWidgets('texto do chip e branco nos dois temas', (tester) async {
      for (final escuro in [false, true]) {
        await tester.pumpWidget(
          envolve(const MateriaChip(sigla: 'BD', cor: '#0369A1'), escuro: escuro),
        );
        final texto = tester.widget<Text>(find.text('BD'));
        expect(texto.style!.color, Colors.white);
      }
    });

    test('hex fora do padrao cai em cinza, nunca em transparente', () {
      expect(corDeHex('#0369A1'), const Color(0xFF0369A1));
      expect(corDeHex('0369a1'), const Color(0xFF0369A1));
      expect(corDeHex('nada'), const Color(0xFF464E50));
      expect(corDeHex('#zzzzzz'), const Color(0xFF464E50));
      expect(corDeHex(''), const Color(0xFF464E50));
    });
  });

  group('prova pesa mais que entrega, por tinta (nao-negociavel 8)', () {
    testWidgets('prova e bloco solido; entrega e contorno sem fundo', (
      tester,
    ) async {
      await tester.pumpWidget(envolve(prova()));
      final decoracaoProva = decoracaoRaiz<EventoCard>(tester);
      expect(decoracaoProva.color, Cores.claro.provaBg);

      await tester.pumpWidget(envolve(entrega()));
      final decoracaoEntrega = decoracaoRaiz<EventoCard>(tester);
      expect(decoracaoEntrega.color, Colors.transparent);
      expect(decoracaoEntrega.border!.top.color, Cores.claro.rule);
      expect(decoracaoEntrega.border!.top.width, 1);
    });

    testWidgets('a cor e da materia, nao do tipo: mesma materia, mesma cor do chip', (
      tester,
    ) async {
      Finder chipDaMateria() => find.byWidgetPredicate(
        (w) =>
            w is DecoratedBox &&
            w.decoration is BoxDecoration &&
            (w.decoration as BoxDecoration).color == const Color(0xFF0369A1),
      );

      await tester.pumpWidget(envolve(prova()));
      expect(chipDaMateria(), findsOneWidget);

      await tester.pumpWidget(envolve(entrega()));
      expect(chipDaMateria(), findsOneWidget);
    });

    testWidgets('titulo da prova pesa mais que o da entrega', (tester) async {
      await tester.pumpWidget(envolve(prova()));
      final pesoProva = tester
          .widget<Text>(find.text('Prova 2 — normalização'))
          .style!
          .fontWeight!;

      await tester.pumpWidget(envolve(entrega(titulo: 'Relatório')));
      final pesoEntrega = tester
          .widget<Text>(find.text('Relatório'))
          .style!
          .fontWeight!;

      expect(pesoProva.value, greaterThan(pesoEntrega.value));
    });

    testWidgets('glifo: prova cheio, entrega vazado e redondo', (tester) async {
      Container glifo() => tester.widget<Container>(
        find.descendant(of: find.byType(Glifo), matching: find.byType(Container)),
      );

      await tester.pumpWidget(envolve(prova()));
      final dProva = glifo().decoration! as BoxDecoration;
      expect(dProva.color, Cores.claro.provaFg2);
      expect(dProva.shape, BoxShape.rectangle);

      await tester.pumpWidget(envolve(entrega()));
      final dEntrega = glifo().decoration! as BoxDecoration;
      expect(dEntrega.color, isNull);
      expect(dEntrega.shape, BoxShape.circle);
    });

    testWidgets('tipo e anunciado em texto oculto, sem repetir quando sem hora', (
      tester,
    ) async {
      final semantica = tester.ensureSemantics();

      await tester.pumpWidget(envolve(prova()));
      expect(find.bySemanticsLabel('Prova — 19:00'), findsOneWidget);

      await tester.pumpWidget(envolve(prova(quando: 'prova')));
      expect(find.bySemanticsLabel(RegExp(r'^Prova$')), findsOneWidget);
      expect(find.bySemanticsLabel('Prova — prova'), findsNothing);

      await tester.pumpWidget(envolve(entrega()));
      expect(find.bySemanticsLabel(RegExp(r'^Entrega$')), findsOneWidget);

      await tester.pumpWidget(envolve(entrega(quando: '08:00')));
      expect(find.bySemanticsLabel('Entrega — 08:00'), findsOneWidget);

      semantica.dispose();
    });

    testWidgets('sem materia nao mostra chip e o cartao continua legivel', (
      tester,
    ) async {
      await tester.pumpWidget(envolve(prova(materia: null)));

      expect(find.byType(MateriaChip), findsNothing);
      expect(find.text('Prova 2 — normalização'), findsOneWidget);
    });

    testWidgets('palavra de 60 caracteres sem espaco quebra dentro do cartao', (
      tester,
    ) async {
      final longo = 'a' * 60;
      await tester.pumpWidget(envolve(prova(titulo: longo)));

      expect(tester.takeException(), isNull);
      expect(tester.getSize(find.text(longo)).height, greaterThan(30));
    });
  });

  group('autoria visivel em todo registro (nao-negociavel 1)', () {
    testWidgets('autoria com selo de professor leva o prefixo e o selo', (
      tester,
    ) async {
      await tester.pumpWidget(
        envolve(
          prova(
            autoria: 'Ana Beatriz · há 2 dias',
            autoriaSelo: TipoSelo.professor,
          ),
        ),
      );

      expect(find.text('Prof. Ana Beatriz · há 2 dias'), findsOneWidget);
      expect(find.text('Professor'), findsOneWidget);
    });

    testWidgets('editado por mostra quem corrigiu, com prefixo e selo', (
      tester,
    ) async {
      await tester.pumpWidget(
        envolve(
          prova(
            autoria: 'Ana Beatriz · há 2 dias',
            editadoPor: 'Otávio',
            editadoPorSelo: TipoSelo.coordenacao,
          ),
        ),
      );

      expect(find.text('editado por Coord. Otávio'), findsOneWidget);
      expect(find.text('Coordenação'), findsOneWidget);
    });

    testWidgets('autoria vazia some a linha; selo sem nome nao aparece', (
      tester,
    ) async {
      await tester.pumpWidget(
        envolve(prova(autoria: '', autoriaSelo: TipoSelo.professor)),
      );
      expect(find.textContaining('Prof.'), findsNothing);
      expect(find.text('Professor'), findsNothing);

      await tester.pumpWidget(
        envolve(prova(autoria: null, autoriaSelo: TipoSelo.professor)),
      );
      expect(find.text('Professor'), findsNothing);
    });

    testWidgets('editado por vazio some a linha', (tester) async {
      await tester.pumpWidget(envolve(prova(editadoPor: '')));
      expect(find.textContaining('editado'), findsNothing);
    });
  });

  group('nota da turma e nota pessoal nunca se parecem', () {
    testWidgets('cada uma diz em palavras quem vai ver', (tester) async {
      await tester.pumpWidget(
        envolve(
          const NotaCard(alcance: AlcanceNota.turma, texto: 'cobra até a aula de junção'),
        ),
      );
      expect(find.text('DA TURMA · TODOS VEEM'), findsOneWidget);

      await tester.pumpWidget(
        envolve(
          const NotaCard(alcance: AlcanceNota.pessoal, texto: 'cobra até a aula de junção'),
        ),
      );
      expect(find.text('PESSOAL · SÓ VOCÊ'), findsOneWidget);
    });

    testWidgets('a regua e solida na turma e tracejada na pessoal', (tester) async {
      await tester.pumpWidget(
        envolve(const NotaCard(alcance: AlcanceNota.turma, texto: 'x')),
      );
      expect(tracejado(), findsNothing);

      await tester.pumpWidget(
        envolve(const NotaCard(alcance: AlcanceNota.pessoal, texto: 'x')),
      );
      expect(tracejado(), findsOneWidget);
    });

    test('autoria so na turma e selo so de coordenacao (guarda no construtor)', () {
      expect(
        () => NotaCard(
          alcance: AlcanceNota.pessoal,
          texto: 'x',
          autoria: 'Ana',
        ),
        throwsA(isA<AssertionError>()),
      );
      expect(
        () => NotaCard(
          alcance: AlcanceNota.turma,
          texto: 'x',
          autoria: 'Ana',
          autoriaSelo: TipoSelo.professor,
        ),
        throwsA(isA<AssertionError>()),
      );
    });
  });
}
