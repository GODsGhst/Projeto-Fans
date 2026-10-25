import 'package:flutter/material.dart';

/// Cor de fallback quando o hex nao e valido (armadilha 10). Cinza-ardosia com 8,7:1 sobre branco,
/// acima de 4,5:1. Nunca transparente: sem preenchimento, a sigla branca cai sobre o papel.
const _corFallback = Color(0xFF464E50);

final _hex = RegExp(r'^#?[0-9a-fA-F]{6}$');

/// `#RRGGBB` (ou `RRGGBB`) vira Color. Qualquer outra coisa vira [_corFallback].
Color corDeHex(String hex) {
  if (!_hex.hasMatch(hex)) return _corFallback;
  final limpo = hex.startsWith('#') ? hex.substring(1) : hex;
  return Color(0xFF000000 | int.parse(limpo, radix: 16));
}

/// Cor + sigla, sempre juntas (nao-negociavel 7). Unico caminho para exibir materia.
/// Texto branco fixo em qualquer tema. A sigla e exibida em caixa alta; o valor recebido nao muda.
class MateriaChip extends StatelessWidget {
  const MateriaChip({super.key, required this.sigla, required this.cor});

  /// Sigla exatamente como recebida (BD, CALC2, ESOFT).
  final String sigla;

  /// Uma das 12 hues da paleta, em hex. O componente nao escolhe cor.
  final String cor;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: corDeHex(cor),
      borderRadius: BorderRadius.circular(4),
    ),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      // Sem quebra de linha. Sigla longa corta com reticencias, em vez de invadir o vizinho.
      child: Text(
        sigla.toUpperCase(),
        maxLines: 1,
        softWrap: false,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.605,
          height: 1,
        ),
      ),
    ),
  );
}
