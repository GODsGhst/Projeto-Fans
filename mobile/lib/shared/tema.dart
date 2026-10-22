import 'package:flutter/material.dart';

/// Tokens de cor, espelhando app/src/theme/variables.scss.
///
/// Claro e escuro. O escuro vale pelo brilho do Theme, e ThemeMode.system segue o aparelho,
/// como o @media (prefers-color-scheme) do CSS. Nao ha troca manual de tema.
class Cores {
  const Cores._({
    required this.paper,
    required this.surface,
    required this.surface2,
    required this.ink,
    required this.ink2,
    required this.ink3,
    required this.rule,
    required this.ruleSoft,
    required this.accent,
    required this.accentInk,
    required this.provaBg,
    required this.provaFg,
    required this.provaFg2,
    required this.seloCoordProva,
  });

  /// Fundo da tela.
  final Color paper;

  /// Cartao.
  final Color surface;

  /// Aba selecionada (desktop).
  final Color surface2;

  /// Texto primario.
  final Color ink;

  /// Texto secundario.
  final Color ink2;

  /// Rotulo, autoria, tipo, aviso.
  final Color ink3;

  /// Bordas de 1px.
  final Color rule;

  /// Fundo da nota da turma e dos avisos.
  final Color ruleSoft;

  /// So o interativo, mais o selo da coordenacao, o trilho da aula em andamento e a regua da nota da turma.
  final Color accent;
  final Color accentInk;

  /// Bloco solido da prova (valor oposto ao da pagina).
  final Color provaBg;
  final Color provaFg;
  final Color provaFg2;

  /// Selo da coordenacao dentro do bloco da prova. Hex fixo no CSS, por isso nao e token do tema.
  final Color seloCoordProva;

  static const claro = Cores._(
    paper: Color(0xFFE7EAE5),
    surface: Color(0xFFF7F9F6),
    surface2: Color(0xFFFDFEFC),
    ink: Color(0xFF14181A),
    ink2: Color(0xFF464E50),
    ink3: Color(0xFF626A6C),
    rule: Color(0x1A14181A),
    ruleSoft: Color(0x0D14181A),
    accent: Color(0xFF0F766E),
    accentInk: Color(0xFFFFFFFF),
    provaBg: Color(0xFF14181A),
    provaFg: Color(0xFFEEF0EC),
    provaFg2: Color(0xA3EEF0EC),
    seloCoordProva: Color(0xFF5FD3C7),
  );

  static const escuro = Cores._(
    paper: Color(0xFF0C0F11),
    surface: Color(0xFF171B1D),
    surface2: Color(0xFF202527),
    ink: Color(0xFFE8EBE6),
    ink2: Color(0xFFAEB6B7),
    ink3: Color(0xFF878F91),
    rule: Color(0x1FE8EBE6),
    ruleSoft: Color(0x0FE8EBE6),
    accent: Color(0xFF4DBFB3),
    accentInk: Color(0xFF06201D),
    provaBg: Color(0xFFE8EBE6),
    provaFg: Color(0xFF14181A),
    provaFg2: Color(0x9E14181A),
    seloCoordProva: Color(0xFF0B5F58),
  );

  /// Paleta do brilho atual do Theme.
  static Cores de(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark ? escuro : claro;
}

/// --r-sm, --r-md e --r-pill.
abstract final class Raio {
  static const sm = 8.0;
  static const md = 14.0;
  static const pilula = 999.0;
}

/// --dur-toque e --mola. Recuo do toque: 0,98 em bloco largo, 0,92 em alvo pequeno.
abstract final class Mola {
  static const duracao = Duration(milliseconds: 140);
  static const curva = Cubic(0.22, 1.0, 0.36, 1.0);
  static const press = 0.98;
  static const pressForte = 0.92;
}

/// --ui usa a fonte do sistema. --mono nao e embutida: 'monospace' do aparelho, com alternativas.
/// Sem medir, nao embutir Roboto Mono (armadilha 16 do spec).
abstract final class Fonte {
  static const mono = 'monospace';
  static const monoAlternativas = [
    'Roboto Mono',
    'SF Mono',
    'Menlo',
    'Consolas',
    'Courier New',
  ];
}

/// Texto em --mono. Caixa alta e `letter-spacing` em px saem do chamador, que ja converteu em px.
TextStyle estiloMono({
  double? size,
  FontWeight? peso,
  double? letterSpacing,
  double? height,
  Color? color,
  bool tabular = false,
}) => TextStyle(
  fontFamily: Fonte.mono,
  fontFamilyFallback: Fonte.monoAlternativas,
  fontSize: size,
  fontWeight: peso,
  letterSpacing: letterSpacing,
  height: height,
  color: color,
  fontFeatures: tabular ? [const FontFeature.tabularFigures()] : null,
);

/// ThemeData das duas paletas. O app liga os dois em MaterialApp (theme e darkTheme) com ThemeMode.system.
abstract final class PfTema {
  static ThemeData claro() => _tema(Cores.claro, Brightness.light);

  static ThemeData escuro() => _tema(Cores.escuro, Brightness.dark);

  static ThemeData _tema(Cores c, Brightness brilho) {
    final esquema = brilho == Brightness.dark
        ? ColorScheme.dark(
            primary: c.accent,
            onPrimary: c.accentInk,
            surface: c.surface,
            onSurface: c.ink,
          )
        : ColorScheme.light(
            primary: c.accent,
            onPrimary: c.accentInk,
            surface: c.surface,
            onSurface: c.ink,
          );
    return ThemeData(
      colorScheme: esquema,
      scaffoldBackgroundColor: c.paper,
      // -webkit-tap-highlight-color: transparent. O recuo do toque (Botao) e a confirmacao.
      splashFactory: NoSplash.splashFactory,
      highlightColor: Colors.transparent,
    );
  }
}
