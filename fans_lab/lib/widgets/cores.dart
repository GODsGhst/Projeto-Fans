import 'package:flutter/material.dart';

/// Paleta do app. Lida pelos widgets com `Theme.of(context).extension<CoresFans>()!`.
class CoresFans extends ThemeExtension<CoresFans> {
  final Color paper;
  final Color surface;
  final Color ink;
  final Color ink2;
  final Color ink3;
  final Color rule;
  final Color accent;
  final Color accentInk;
  final Color provaBg;
  final Color provaFg;
  final Color provaFg2;

  const CoresFans({
    required this.paper,
    required this.surface,
    required this.ink,
    required this.ink2,
    required this.ink3,
    required this.rule,
    required this.accent,
    required this.accentInk,
    required this.provaBg,
    required this.provaFg,
    required this.provaFg2,
  });

  static const CoresFans claro = CoresFans(
    paper: Color(0xFFE7EAE5),
    surface: Color(0xFFF7F9F6),
    ink: Color(0xFF14181A),
    ink2: Color(0xFF464E50),
    ink3: Color(0xFF626A6C),
    rule: Color(0x1A14181A),
    accent: Color(0xFF0F766E),
    accentInk: Color(0xFFFFFFFF),
    provaBg: Color(0xFF14181A),
    provaFg: Color(0xFFEEF0EC),
    provaFg2: Color(0xA3EEF0EC),
  );

  static const CoresFans escuro = CoresFans(
    paper: Color(0xFF0C0F11),
    surface: Color(0xFF171B1D),
    ink: Color(0xFFE8EBE6),
    ink2: Color(0xFFAEB6B7),
    ink3: Color(0xFF878F91),
    rule: Color(0x1FE8EBE6),
    accent: Color(0xFF4DBFB3),
    accentInk: Color(0xFF06201D),
    provaBg: Color(0xFFE8EBE6),
    provaFg: Color(0xFF14181A),
    provaFg2: Color(0x9E14181A),
  );

  @override
  CoresFans copyWith({
    Color? paper,
    Color? surface,
    Color? ink,
    Color? ink2,
    Color? ink3,
    Color? rule,
    Color? accent,
    Color? accentInk,
    Color? provaBg,
    Color? provaFg,
    Color? provaFg2,
  }) {
    return CoresFans(
      paper: paper ?? this.paper,
      surface: surface ?? this.surface,
      ink: ink ?? this.ink,
      ink2: ink2 ?? this.ink2,
      ink3: ink3 ?? this.ink3,
      rule: rule ?? this.rule,
      accent: accent ?? this.accent,
      accentInk: accentInk ?? this.accentInk,
      provaBg: provaBg ?? this.provaBg,
      provaFg: provaFg ?? this.provaFg,
      provaFg2: provaFg2 ?? this.provaFg2,
    );
  }

  @override
  CoresFans lerp(covariant ThemeExtension<CoresFans>? other, double t) {
    if (other is! CoresFans) return this;
    return CoresFans(
      paper: Color.lerp(paper, other.paper, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      ink: Color.lerp(ink, other.ink, t)!,
      ink2: Color.lerp(ink2, other.ink2, t)!,
      ink3: Color.lerp(ink3, other.ink3, t)!,
      rule: Color.lerp(rule, other.rule, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      accentInk: Color.lerp(accentInk, other.accentInk, t)!,
      provaBg: Color.lerp(provaBg, other.provaBg, t)!,
      provaFg: Color.lerp(provaFg, other.provaFg, t)!,
      provaFg2: Color.lerp(provaFg2, other.provaFg2, t)!,
    );
  }
}

ThemeData temaFans(Brightness brilho) {
  final cores = brilho == Brightness.dark ? CoresFans.escuro : CoresFans.claro;
  return ThemeData(
    useMaterial3: true,
    scaffoldBackgroundColor: cores.paper,
    colorScheme: ColorScheme.fromSeed(
      seedColor: cores.accent,
      brightness: brilho,
    ).copyWith(primary: cores.accent, onPrimary: cores.accentInk, surface: cores.surface),
    appBarTheme: AppBarTheme(
      backgroundColor: cores.paper,
      foregroundColor: cores.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      surfaceTintColor: Colors.transparent,
    ),
    extensions: [cores],
  );
}

final _hexValido = RegExp(r'^[0-9a-fA-F]{6}$');

/// Aceita '#RRGGBB' ou 'RRGGBB'. Hex inválido vira cinza, nunca lança.
Color corDaMateria(String hex) {
  final limpo = hex.startsWith('#') ? hex.substring(1) : hex;
  if (!_hexValido.hasMatch(limpo)) return const Color(0xFF626A6C);
  return Color(int.parse('FF$limpo', radix: 16));
}
