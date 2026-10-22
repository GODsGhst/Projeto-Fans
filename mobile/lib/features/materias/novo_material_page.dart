import 'package:flutter/material.dart';

/// Esqueleto (fundação). A área troca o corpo e mantém o construtor.
class NovoMaterialPage extends StatelessWidget {
  const NovoMaterialPage({super.key, required this.materiaId});

  final String materiaId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(title: const Text('Adicionar material')));
  }
}
