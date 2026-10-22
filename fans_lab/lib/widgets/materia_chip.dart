import 'package:flutter/material.dart';

import 'package:fans_lab/widgets/cores.dart';

/// Único jeito de mostrar matéria no app: cor + sigla juntas (nunca só a cor).
class MateriaChip extends StatelessWidget {
  const MateriaChip({super.key, required this.sigla, required this.corHex});

  final String sigla;
  final String corHex;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Matéria $sigla',
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        decoration: BoxDecoration(
          color: corDaMateria(corHex),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(
          sigla,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
