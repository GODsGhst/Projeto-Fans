import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:projetofans/shared/aula_card.dart';
import 'package:projetofans/shared/estilos.dart';
import 'package:projetofans/shared/material_linha.dart';
import 'package:projetofans/shared/mini_card.dart';
import 'package:projetofans/shared/selo.dart';
import 'package:projetofans/shared/tema.dart';
import 'package:projetofans/shared/tipos.dart';

Widget envolve(Widget filho, {bool escuro = false}) => MaterialApp(
  theme: escuro ? PfTema.escuro() : PfTema.claro(),
  home: Scaffold(
    body: Center(child: SizedBox(width: 360, child: filho)),
  ),
);

const _bd = (sigla: 'BD', cor: '#0369A1');

/// Regua tracejada: o Tracejado e um CustomPainter, entao procura-se o CustomPaint que o carrega.
Finder tracejado() => find.byWidgetPredicate(
  (w) => w is CustomPaint && w.painter is Tracejado,
);

BoxDecoration decoracaoRaiz<T extends Widget>(WidgetTester tester) {
  final container = tester.widget<Container>(
    find.descendant(of: find.byType(T), matching: find.byType(Container)).first,
  );
  return container.decoration! as BoxDecoration;
}

void main() {
  group('aula', () {
    testWidgets('mostra a sala junto do vetor de sala de aula', (tester) async {
      await tester.pumpWidget(
        envolve(
          const AulaCard(
            materia: _bd,
            nome: 'Banco de Dados',
            hora: '19:00–20:40',
            sala: 'B-204',
          ),
        ),
      );

      expect(find.text('B-204'), findsOneWidget);
      expect(
        find.byWidgetPredicate((w) => w is Icone && w.tipo == TipoIcone.sala),
        findsOneWidget,
      );
      expect(find.text('19:00–20:40'), findsOneWidget);
    });

    testWidgets('so a aula em andamento ganha o trilho de accent', (tester) async {
      await tester.pumpWidget(
        envolve(
          const AulaCard(
            materia: _bd,
            nome: 'Banco de Dados',
            hora: '19:00',
            sala: 'B-204',
          ),
        ),
      );
      expect(find.byKey(const ValueKey('trilho-agora')), findsNothing);

      await tester.pumpWidget(
        envolve(
          const AulaCard(
            materia: _bd,
            nome: 'Banco de Dados',
            hora: '19:00',
            sala: 'B-204',
            agora: true,
          ),
        ),
      );
      expect(find.byKey(const ValueKey('trilho-agora')), findsOneWidget);
    });

    testWidgets('detalhe vazio some; atividade vira caixa alta', (tester) async {
      await tester.pumpWidget(
        envolve(
          const AulaCard(
            materia: _bd,
            nome: 'Banco de Dados',
            hora: '19:00',
            sala: 'B-204',
            detalhe: '',
            atividade: 'entregar hoje · Lista 4',
          ),
        ),
      );

      expect(find.text(''), findsNothing);
      expect(find.text('ENTREGAR HOJE · LISTA 4'), findsOneWidget);
    });
  });

  group('mini card do Meu quadro', () {
    testWidgets('prova e bloco solido; entrega e contorno', (tester) async {
      await tester.pumpWidget(
        envolve(
          const MiniCard(materia: _bd, titulo: 'Prova 2', tipo: TipoEvento.prova),
        ),
      );
      expect(decoracaoRaiz<MiniCard>(tester).color, Cores.claro.provaBg);

      await tester.pumpWidget(
        envolve(
          const MiniCard(materia: _bd, titulo: 'Lista 4', tipo: TipoEvento.entrega),
        ),
      );
      expect(decoracaoRaiz<MiniCard>(tester).color, isNull);
    });

    testWidgets('feito esmaece o cartao todo e risca o titulo', (tester) async {
      await tester.pumpWidget(
        envolve(
          const MiniCard(
            materia: _bd,
            titulo: 'Lista 4',
            tipo: TipoEvento.entrega,
            feito: true,
          ),
        ),
      );

      expect(
        find.byWidgetPredicate((w) => w is Opacity && w.opacity == 0.55),
        findsOneWidget,
      );
      expect(
        tester.widget<Text>(find.text('Lista 4')).style!.decoration,
        TextDecoration.lineThrough,
      );
    });

    testWidgets('aviso aparece so quando ha texto', (tester) async {
      await tester.pumpWidget(
        envolve(
          const MiniCard(
            materia: _bd,
            titulo: 'Prova 2',
            tipo: TipoEvento.prova,
            aviso: 'oculto pelo líder · só você vê',
          ),
        ),
      );
      expect(find.text('oculto pelo líder · só você vê'), findsOneWidget);

      await tester.pumpWidget(
        envolve(
          const MiniCard(materia: _bd, titulo: 'Prova 2', tipo: TipoEvento.prova),
        ),
      );
      expect(find.textContaining('só você'), findsNothing);
    });
  });

  group('linha de material', () {
    testWidgets('mostra tipo, titulo e autoria com prefixo e selo', (tester) async {
      await tester.pumpWidget(
        envolve(
          const MaterialLinha(
            tipo: 'PDF',
            titulo: 'Slides da aula 2',
            autoria: 'Ana Beatriz · há 1 dia',
            autoriaSelo: TipoSelo.professor,
          ),
        ),
      );

      expect(find.text('PDF'), findsOneWidget);
      expect(find.text('Slides da aula 2'), findsOneWidget);
      expect(find.text('Prof. Ana Beatriz · há 1 dia'), findsOneWidget);
      expect(find.text('Professor'), findsOneWidget);
    });

    testWidgets('autoria vazia nao quebra e editado por aparece', (tester) async {
      await tester.pumpWidget(
        envolve(
          const MaterialLinha(
            tipo: 'LINK',
            titulo: 'Playlist',
            autoria: '',
            editadoPor: 'Lia',
          ),
        ),
      );

      expect(find.byType(MaterialLinha), findsOneWidget);
      expect(find.text('editado por Lia'), findsOneWidget);
    });
  });

  group('selo de autoria', () {
    test('prefixo sai do selo, com espaco final, e nulo nao tem prefixo', () {
      expect(prefixoDoSelo(null), '');
      expect(prefixoDoSelo(TipoSelo.professor), 'Prof. ');
      expect(prefixoDoSelo(TipoSelo.coordenacao), 'Coord. ');
    });

    testWidgets('mostra o rotulo e nada quando nulo', (tester) async {
      await tester.pumpWidget(envolve(const Selo(selo: TipoSelo.coordenacao)));
      expect(find.text('Coordenação'), findsOneWidget);

      await tester.pumpWidget(envolve(const Selo(selo: null)));
      expect(find.byType(Text), findsNothing);
    });
  });

  group('botao', () {
    testWidgets('toque dispara a acao; desabilitado fica visivel e nao dispara', (
      tester,
    ) async {
      var toques = 0;
      await tester.pumpWidget(
        envolve(
          Botao(
            rotulo: 'Entrar',
            onPressed: () {
              toques++;
            },
          ),
        ),
      );
      await tester.tap(find.text('Entrar'));
      expect(toques, 1);

      await tester.pumpWidget(
        envolve(const Botao(rotulo: 'Entrando…', onPressed: null)),
      );
      expect(find.text('Entrando…'), findsOneWidget);
      expect(
        find.byWidgetPredicate((w) => w is Opacity && w.opacity == 0.45),
        findsOneWidget,
      );
      await tester.tap(find.text('Entrando…'));
      expect(toques, 1);
    });

    testWidgets('fio com pilula tem raio de pilula', (tester) async {
      await tester.pumpWidget(
        envolve(
          Botao(
            rotulo: 'Desfazer',
            onPressed: () {},
            estilo: EstiloBotao.fio,
            pilula: true,
          ),
        ),
      );

      expect(
        find.byWidgetPredicate(
          (w) =>
              w is DecoratedBox &&
              w.decoration is BoxDecoration &&
              (w.decoration as BoxDecoration).borderRadius ==
                  BorderRadius.circular(999),
        ),
        findsOneWidget,
      );
    });
  });

  group('classes globais de pagina', () {
    testWidgets('rotulo de grupo em caixa alta', (tester) async {
      await tester.pumpWidget(envolve(const PfRotulo(texto: 'próximas aulas')));
      expect(find.text('PRÓXIMAS AULAS'), findsOneWidget);
    });

    testWidgets('vazio tem duas linhas de texto e nada mais', (tester) async {
      await tester.pumpWidget(
        envolve(
          const PfVazio(
            titulo: 'Nada nos próximos 14 dias.',
            detalhe:
                'Se você sabe de alguma prova ou entrega que não está aqui, adicione — qualquer pessoa da turma pode.',
          ),
        ),
      );
      expect(find.text('Nada nos próximos 14 dias.'), findsOneWidget);
      expect(find.byType(Botao), findsNothing);
    });

    testWidgets('aviso de estado e tracejado; erro de acao e solido', (tester) async {
      await tester.pumpWidget(envolve(const PfAviso(texto: 'Carregando…')));
      expect(tracejado(), findsOneWidget);

      await tester.pumpWidget(envolve(const PfErro(texto: 'Não deu certo.')));
      expect(tracejado(), findsNothing);
      expect(find.text('Não deu certo.'), findsOneWidget);
    });

    testWidgets('alerta com acao mostra o aviso e o botao na mesma linha', (
      tester,
    ) async {
      await tester.pumpWidget(
        envolve(
          Alerta(
            texto: 'Ocultado.',
            acao: Botao(
              rotulo: 'Desfazer',
              onPressed: () {},
              estilo: EstiloBotao.fio,
              pilula: true,
            ),
          ),
        ),
      );
      expect(find.text('Ocultado.'), findsOneWidget);
      expect(find.text('Desfazer'), findsOneWidget);
    });
  });

  group('avatar', () {
    test('inicial e o primeiro code point em maiusculas; sem nome, ?', () {
      expect(PfAvatar.inicial('ana'), 'A');
      expect(PfAvatar.inicial('  ótavio'), 'Ó');
      expect(PfAvatar.inicial(''), '?');
      expect(PfAvatar.inicial('   '), '?');
      expect(PfAvatar.inicial('😀 Ana'), '😀');
    });
  });

  group('tema', () {
    testWidgets('a paleta segue o brilho do Theme', (tester) async {
      Cores? capturada;
      await tester.pumpWidget(
        MaterialApp(
          theme: PfTema.claro(),
          darkTheme: PfTema.escuro(),
          themeMode: ThemeMode.dark,
          home: Builder(
            builder: (context) {
              capturada = Cores.de(context);
              return const SizedBox();
            },
          ),
        ),
      );
      expect(capturada!.paper, Cores.escuro.paper);
    });

    test('tokens de cor batem com theme/variables.scss', () {
      expect(Cores.claro.paper, const Color(0xFFE7EAE5));
      expect(Cores.claro.accent, const Color(0xFF0F766E));
      expect(Cores.escuro.accent, const Color(0xFF4DBFB3));
      expect(PfTema.escuro().brightness, Brightness.dark);
      expect(PfTema.claro().brightness, Brightness.light);
    });
  });
}
