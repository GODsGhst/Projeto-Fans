import 'package:flutter/material.dart';

/// Esqueleto (fundação). A área troca o corpo e mantém o construtor.
class AjustesPage extends StatelessWidget {
  const AjustesPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(title: const Text('Ajustes')));
  }
}
