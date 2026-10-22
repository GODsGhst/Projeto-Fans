import 'package:flutter/material.dart';

/// Esqueleto (fundação). A área troca o corpo e mantém o construtor.
class EntrarTurmaPage extends StatelessWidget {
  const EntrarTurmaPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(title: const Text('Entrar na turma')));
  }
}
