import 'package:flutter/material.dart';

/// Esqueleto (fundação). A área troca o corpo e mantém o construtor.
class NovoEventoPage extends StatelessWidget {
  const NovoEventoPage({super.key, this.eventoId, this.tipo, this.materiaId});

  final String? eventoId;
  final String? tipo;
  final String? materiaId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(title: Text(eventoId == null ? 'O que vai cair' : 'Editar')));
  }
}
