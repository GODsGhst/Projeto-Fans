import 'package:flutter/material.dart';

/// Esqueleto (fundação). A área troca o corpo e mantém o construtor.
class NovaNotaPage extends StatelessWidget {
  const NovaNotaPage({super.key, this.notaId, this.dia});

  final String? notaId;
  final String? dia;

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(title: Text(notaId == null ? 'Anotação' : 'Editar anotação')));
  }
}
