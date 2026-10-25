import 'package:flutter/material.dart';

/// Esqueleto (fundação). A área troca o corpo e mantém o construtor.
class EventoPage extends StatelessWidget {
  const EventoPage({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(title: const Text('Evento')));
  }
}
