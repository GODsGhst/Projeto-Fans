import 'package:flutter/material.dart';

import 'package:fans_lab/app_deps.dart';
import 'package:fans_lab/models/sessao.dart';
import 'package:fans_lab/services/api_exception.dart';

/// Conta sem turma: pede o código de convite (POST /turmas/entrar). Sem turma a Home não tem o
/// que mostrar, então esta tela é o caminho único até lá.
class EntrarTurmaPage extends StatefulWidget {
  const EntrarTurmaPage({
    super.key,
    required this.deps,
    required this.sessao,
    required this.aoEntrar,
    required this.aoSair,
  });

  final AppDeps deps;
  final Sessao sessao;
  final void Function(Sessao) aoEntrar;
  final VoidCallback aoSair;

  @override
  State<EntrarTurmaPage> createState() => _EntrarTurmaPageState();
}

class _EntrarTurmaPageState extends State<EntrarTurmaPage> {
  final _formKey = GlobalKey<FormState>();
  final _codigo = TextEditingController();
  bool _enviando = false;
  String? _erro;

  @override
  void dispose() {
    _codigo.dispose();
    super.dispose();
  }

  Future<void> _entrar() async {
    if (_enviando || !_formKey.currentState!.validate()) return;
    setState(() {
      _enviando = true;
      _erro = null;
    });
    try {
      // Todo código de convite é maiúsculo; no navegador o teclado não força isso.
      final turmaId =
          await widget.deps.api.entrarNaTurma(_codigo.text.trim().toUpperCase());
      final s = widget.sessao;
      widget.aoEntrar(Sessao(jwt: s.jwt, usuario: s.usuario, turmaId: turmaId));
    } on ApiException catch (e) {
      if (e.naoAutorizado) {
        widget.aoSair();
        return;
      }
      if (mounted) setState(() => _erro = e.mensagem);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Entrar na turma'),
        actions: [
          TextButton(
            onPressed: _enviando ? null : widget.aoSair,
            child: const Text('Sair'),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Olá, ${widget.sessao.usuario.nome}. Peça o código de convite a quem '
                      'criou a turma e digite abaixo.',
                      style: tema.textTheme.bodyLarge,
                    ),
                    const SizedBox(height: 24),
                    TextFormField(
                      controller: _codigo,
                      maxLength: 40,
                      textCapitalization: TextCapitalization.characters,
                      decoration: const InputDecoration(labelText: 'Código da turma'),
                      validator: (v) =>
                          (v ?? '').trim().isEmpty ? 'Informe o código.' : null,
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: _enviando ? null : _entrar,
                      child: _enviando
                          ? const SizedBox.square(
                              dimension: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Entrar na turma'),
                    ),
                    if (_erro != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        _erro!,
                        style: TextStyle(color: tema.colorScheme.error),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
