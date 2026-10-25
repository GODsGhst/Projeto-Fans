import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show MaxLengthEnforcement;

import 'package:fans_lab/app_deps.dart';
import 'package:fans_lab/models/sessao.dart';
import 'package:fans_lab/screens/login_page.dart';
import 'package:fans_lab/services/api_exception.dart';

/// Cria conta de aluno (POST /auth/registrar). Os limites são os mesmos do servidor.
/// A conta nasce sem turma: o app segue para a tela de código de convite.
class CadastroPage extends StatefulWidget {
  const CadastroPage({super.key, required this.deps, required this.aoEntrar});

  final AppDeps deps;
  final void Function(Sessao) aoEntrar;

  @override
  State<CadastroPage> createState() => _CadastroPageState();
}

class _CadastroPageState extends State<CadastroPage> {
  final _formKey = GlobalKey<FormState>();
  final _nome = TextEditingController();
  final _email = TextEditingController();
  // A senha só existe nesta tela. Nunca é salva.
  final _senha = TextEditingController();
  final _confirmacao = TextEditingController();
  bool _enviando = false;
  String? _erro;

  @override
  void dispose() {
    _nome.dispose();
    _email.dispose();
    _senha.dispose();
    _confirmacao.dispose();
    super.dispose();
  }

  Future<void> _criar() async {
    if (_enviando || !_formKey.currentState!.validate()) return;
    setState(() {
      _enviando = true;
      _erro = null;
    });
    try {
      final sessao = await widget.deps.api.registrar(
        _nome.text.trim(),
        _email.text.trim(),
        _senha.text,
      );
      if (!mounted) return;
      // Sai do cadastro antes: a raiz do app troca o login pela tela da turma.
      Navigator.of(context).pop();
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
      appBar: AppBar(title: const Text('Criar conta')),
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
                    TextFormField(
                      controller: _nome,
                      maxLength: 120,
                      textCapitalization: TextCapitalization.words,
                      decoration: const InputDecoration(
                        labelText: 'Nome',
                        helperText: 'Aparece para a turma em tudo o que você publicar.',
                        helperMaxLines: 2,
                      ),
                      validator: (v) =>
                          (v ?? '').trim().isEmpty ? 'Informe o nome.' : null,
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      maxLength: 254,
                      decoration: const InputDecoration(labelText: 'E-mail'),
                      validator: validarEmail,
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _senha,
                      obscureText: true,
                      // Contador sem cortar: senha colada mais longa não pode virar outra senha.
                      maxLength: 100,
                      maxLengthEnforcement: MaxLengthEnforcement.none,
                      decoration: const InputDecoration(labelText: 'Senha'),
                      validator: (v) {
                        final n = (v ?? '').length;
                        if (n < 8) return 'A senha precisa de pelo menos 8 caracteres.';
                        if (n > 100) return 'A senha pode ter até 100 caracteres.';
                        return null;
                      },
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _confirmacao,
                      obscureText: true,
                      decoration: const InputDecoration(labelText: 'Repita a senha'),
                      validator: (v) =>
                          v != _senha.text ? 'As senhas não são iguais.' : null,
                    ),
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: _enviando ? null : _criar,
                      child: _enviando
                          ? const SizedBox.square(
                              dimension: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Criar conta'),
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
                      'Depois você entra na turma com o código de convite.',
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
