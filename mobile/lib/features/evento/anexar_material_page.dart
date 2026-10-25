import 'package:flutter/material.dart';

/// Esqueleto (fundação). A área troca o corpo e mantém o construtor.
class AnexarMaterialPage extends StatelessWidget {
  const AnexarMaterialPage({super.key, required this.eventoId});

  final String eventoId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(title: const Text('Anexar material')));
  }
}
