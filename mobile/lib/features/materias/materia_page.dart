import 'package:flutter/material.dart';

/// Esqueleto (fundação). A área troca o corpo e mantém o construtor.
class MateriaPage extends StatelessWidget {
  const MateriaPage({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(title: const Text('Matéria')));
  }
}
