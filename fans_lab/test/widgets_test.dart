import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:fans_lab/models/autoria.dart';
import 'package:fans_lab/models/item_home.dart';
import 'package:fans_lab/models/tipo_evento.dart';
import 'package:fans_lab/widgets/cores.dart';
import 'package:fans_lab/widgets/evento_card.dart';
import 'package:fans_lab/widgets/materia_chip.dart';
import 'package:fans_lab/widgets/tempo_relativo.dart';

Widget envolver(Widget child, {Brightness brilho = Brightness.light}) =>
    MaterialApp(theme: temaFans(brilho), home: Scaffold(body: child));

Autoria _autoria(DateTime criadoEm, {String nome = 'Ana'}) => Autoria(
  autorId: 'u1',
  autorNome: nome,
  criadoEm: criadoEm,
);

void main() {
  group('MateriaChip', () {
    testWidgets('mostra a sigla', (tester) async {
      await tester.pumpWidget(envolver(const MateriaChip(sigla: 'BD', corHex: '#1D4ED8')));
      expect(find.text('BD'), findsOneWidget);
    });

    testWidgets('cor inválida não lança e ainda mostra a sigla', (tester) async {
      await tester.pumpWidget(envolver(const MateriaChip(sigla: 'BD', corHex: 'xyz')));
      expect(tester.takeException(), isNull);
      expect(find.text('BD'), findsOneWidget);
    });

    testWidgets('cor e sigla juntas: fundo é a cor da matéria e o texto é a sigla', (tester) async {
      await tester.pumpWidget(envolver(const MateriaChip(sigla: 'BD', corHex: '#1D4ED8')));
      final chip = find.byType(MateriaChip);
      final caixa = tester.widget<Container>(
        find.descendant(of: chip, matching: find.byType(Container)),
      );
      final decoracao = caixa.decoration as BoxDecoration;
      expect(decoracao.color, const Color(0xFF1D4ED8));
      expect(find.descendant(of: chip, matching: find.text('BD')), findsOneWidget);
    });
  });

  group('corDaMateria', () {
    test('aceita com e sem #', () {
      expect(corDaMateria('#1D4ED8'), const Color(0xFF1D4ED8));
      expect(corDaMateria('1D4ED8'), const Color(0xFF1D4ED8));
    });

    test('inválido vira cinza e nunca lança', () {
      expect(corDaMateria('xyz'), const Color(0xFF626A6C));
      expect(corDaMateria(''), const Color(0xFF626A6C));
      expect(corDaMateria('-1D4E'), const Color(0xFF626A6C));
    });
  });

  group('EventoCard', () {
    testWidgets('prova: bloco sólido com provaBg', (tester) async {
      await tester.pumpWidget(envolver(EventoCard(
        tipo: TipoEvento.prova,
        titulo: 'Prova 2',
        data: DateTime(2026, 10, 25),
        hora: '19:00',
        materiaSigla: 'BD',
        materiaCorHex: '#1D4ED8',
        autoriaTexto: 'Ana · há 2 dias',
      )));
      final container = tester.widget<Container>(find.byKey(const ValueKey('evento-card-prova')));
      final decoracao = container.decoration as BoxDecoration;
      expect(decoracao.color, CoresFans.claro.provaBg);
    });

    testWidgets('entrega: contorno 1px sobre surface', (tester) async {
      await tester.pumpWidget(envolver(EventoCard(
        tipo: TipoEvento.entrega,
        titulo: 'Lista 4',
        data: DateTime(2026, 10, 21),
        materiaSigla: 'BD',
        materiaCorHex: '#1D4ED8',
        autoriaTexto: 'Otávio · há 5 h',
      )));
      final container = tester.widget<Container>(find.byKey(const ValueKey('evento-card-entrega')));
      final decoracao = container.decoration as BoxDecoration;
      expect(decoracao.color, CoresFans.claro.surface);
      expect((decoracao.border as Border).top.width, 1);
      expect((decoracao.border as Border).top.color, CoresFans.claro.rule);
    });

    test('regra §6.4: prova e entrega distinguíveis em escala de cinza nos dois temas', () {
      for (final cores in [CoresFans.claro, CoresFans.escuro]) {
        expect(
          (cores.provaBg.computeLuminance() - cores.surface.computeLuminance()).abs(),
          greaterThan(0.5),
        );
      }
    });

    testWidgets('mostra título, autoria e um MateriaChip', (tester) async {
      await tester.pumpWidget(envolver(EventoCard(
        tipo: TipoEvento.entrega,
        titulo: 'Diagrama de casos de uso',
        data: DateTime(2026, 10, 27),
        materiaSigla: 'ESOFT',
        materiaCorHex: '#0F766E',
        autoriaTexto: 'Marina · há 3 dias',
      )));
      expect(find.text('Diagrama de casos de uso'), findsOneWidget);
      expect(find.text('Marina · há 3 dias'), findsOneWidget);
      expect(find.byType(MateriaChip), findsOneWidget);
    });

    testWidgets('deItem monta a autoria "Nome · há ..." e marca feito', (tester) async {
      final item = ItemHome(
        eventoId: 'e1',
        tipo: TipoEvento.prova,
        titulo: 'Prova 2 — integrais',
        data: DateTime(2026, 10, 25),
        hora: '19:00',
        materiaSigla: 'CALC2',
        materiaCorHex: '#1D4ED8',
        autoria: _autoria(DateTime.now().toUtc().subtract(const Duration(hours: 2))),
        feitoPeloUsuario: true,
      );
      await tester.pumpWidget(envolver(EventoCard.deItem(item)));
      expect(find.text('Ana · há 2 h'), findsOneWidget);
      expect(find.byIcon(Icons.check_circle), findsOneWidget);
    });

    testWidgets('prova com sigla longa, feito e fonte 2x não estoura em 360 dp', (tester) async {
      await tester.pumpWidget(envolver(MediaQuery(
        data: const MediaQueryData(textScaler: TextScaler.linear(2.0)),
        child: SizedBox(
          width: 360,
          child: EventoCard(
            tipo: TipoEvento.prova,
            titulo: 'Prova 2',
            data: DateTime(2026, 10, 25),
            hora: '19:00',
            materiaSigla: 'ABCDEFGHIJKL',
            materiaCorHex: '#1D4ED8',
            autoriaTexto: 'Ana · há 2 dias',
            feito: true,
          ),
        ),
      )));
      expect(tester.takeException(), isNull);
    });
  });

  group('tempoRelativo', () {
    final agora = DateTime.utc(2026, 10, 22, 12);

    test('faixas de tempo', () {
      expect(tempoRelativo(agora.subtract(const Duration(seconds: 30)), agora: agora), 'agora');
      expect(tempoRelativo(agora.subtract(const Duration(minutes: 5)), agora: agora), 'há 5 min');
      expect(tempoRelativo(agora.subtract(const Duration(hours: 2)), agora: agora), 'há 2 h');
      expect(tempoRelativo(agora.subtract(const Duration(days: 1)), agora: agora), 'há 1 dia');
      expect(tempoRelativo(agora.subtract(const Duration(days: 3)), agora: agora), 'há 3 dias');
    });

    test('acima de 30 dias vira data curta', () {
      final antigo = agora.subtract(const Duration(days: 40));
      expect(tempoRelativo(antigo, agora: agora), dataCurta(antigo.toLocal()));
    });

    test('instante futuro (relógio torto) vira agora', () {
      expect(tempoRelativo(agora.add(const Duration(minutes: 5)), agora: agora), 'agora');
    });

    test('mesAbrev', () {
      expect(mesAbrev(10), 'OUT');
      expect(mesAbrev(1), 'JAN');
      expect(mesAbrev(12), 'DEZ');
    });

    test('dataCurta', () {
      expect(dataCurta(DateTime(2026, 9, 5)), '05/09/2026');
    });

    test('diaExtenso', () {
      expect(diaExtenso(DateTime(2026, 10, 22)), 'Quinta, 22 out');
    });
  });

  test('temaFans(dark) inclui a extensão CoresFans', () {
    expect(temaFans(Brightness.dark).extension<CoresFans>(), isNotNull);
  });

  test('contorno do tema claro não some: rule com alfa de pelo menos 0x24', () {
    expect(CoresFans.claro.rule.a, greaterThanOrEqualTo(0x24 / 255));
  });

  test('contorno do tema escuro não some: rule com alfa de pelo menos 0x29', () {
    expect(CoresFans.escuro.rule.a, greaterThanOrEqualTo(0x29 / 255));
  });
}
