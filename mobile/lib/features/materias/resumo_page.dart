import 'package:flutter/material.dart';

/// Esqueleto (fundação). A área troca o corpo e mantém o construtor.
class ResumoPage extends StatelessWidget {
  const ResumoPage({super.key, required this.materialId});

  final String materialId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(title: const Text('Resumo')));
  }
}
