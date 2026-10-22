import 'package:flutter/material.dart';

/// Esqueleto (fundação). A área troca o corpo e mantém o construtor.
class NovaMateriaPage extends StatelessWidget {
  const NovaMateriaPage({super.key, this.materiaId});

  final String? materiaId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(title: Text(materiaId == null ? 'Nova matéria' : 'Editar matéria')));
  }
}
