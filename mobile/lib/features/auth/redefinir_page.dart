import 'package:flutter/material.dart';

/// Esqueleto (fundação). A área troca o corpo e mantém o construtor.
class RedefinirPage extends StatelessWidget {
  const RedefinirPage({super.key, this.token});

  final String? token;

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(title: const Text('Nova senha')));
  }
}
