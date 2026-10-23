import 'package:flutter/material.dart';

import 'package:fans_lab/app_deps.dart';
import 'package:fans_lab/models/sessao.dart';
import 'package:fans_lab/services/api_exception.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, required this.deps, required this.aoEntrar});

  final AppDeps deps;
  final void Function(Sessao) aoEntrar;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  // A senha só existe nesta tela. Nunca é salva.
  final _senha = TextEditingController();
  bool _enviando = false;
  String? _erro;

  @override
  void dispose() {
    _email.dispose();
    _senha.dispose();
    super.dispose();
  }

  Future<void> _entrar() async {
    if (_enviando || !_formKey.currentState!.validate()) return;
    setState(() {
      _enviando = true;
      _erro = null;
    });
    try {
      final sessao = await widget.deps.api.login(
        _email.text.trim(),
        _senha.text,
      );
      widget.aoEntrar(sessao);
    } on ApiException catch (e) {
      if (mounted) setState(() => _erro = e.mensagem);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Scaffold(
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
                    // Com fonte grande, o título reduz para caber em vez de quebrar no meio da palavra.
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'projetoFans',
                        style: tema.textTheme.headlineLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'O que cai na semana e o que foi dado em cada aula, mantido pela turma.',
                      style: tema.textTheme.bodyLarge,
                    ),
                    const SizedBox(height: 32),
                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(
                        labelText: 'E-mail',
                        hintText: 'você@exemplo.com',
                      ),
                      validator: (v) =>
                          (v == null || v.trim().isEmpty) ? 'Informe o e-mail.' : null,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _senha,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'Senha',
                        hintText: 'sua senha',
                      ),
                      validator: (v) =>
                          (v == null || v.isEmpty) ? 'Informe a senha.' : null,
                    ),
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: _enviando ? null : _entrar,
                      child: _enviando
                          ? const SizedBox.square(
                              dimension: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Entrar'),
                    ),
                    if (_erro != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        _erro!,
                        style: TextStyle(color: tema.colorScheme.error),
                      ),
                    ],
                    const SizedBox(height: 16),
                    Text(
                      'A primeira entrada pode levar até 1 minuto: o servidor gratuito precisa acordar.',
                      style: tema.textTheme.bodySmall,
                    ),
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
