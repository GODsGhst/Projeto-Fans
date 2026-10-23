import 'package:flutter/material.dart';

import 'package:fans_lab/app_deps.dart';
import 'package:fans_lab/screens/fila_page.dart';
import 'package:fans_lab/widgets/tempo_relativo.dart';

class ConfiguracoesPage extends StatefulWidget {
  const ConfiguracoesPage({
    super.key,
    required this.deps,
    required this.aoMudarTema,
    required this.aoSair,
  });

  final AppDeps deps;
  final ValueChanged<bool> aoMudarTema;
  final VoidCallback aoSair;

  @override
  State<ConfiguracoesPage> createState() => _ConfiguracoesPageState();
}

class _ConfiguracoesPageState extends State<ConfiguracoesPage> {
  bool _escuro = false;
  DateTime? _ultimaSync;

  @override
  void initState() {
    super.initState();
    _carregarPreferencias();
  }

  Future<void> _carregarPreferencias() async {
    final escuro = await widget.deps.sessao.temaEscuro();
    final ultima = await widget.deps.sessao.ultimaSincronizacao();
    if (!mounted) return;
    setState(() {
      _escuro = escuro;
      _ultimaSync = ultima;
    });
  }

  Future<void> _confirmarSair() async {
    final confirmou = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sair do app?'),
        content: const Text(
          'Rascunhos e marcações ainda não enviados serão apagados deste aparelho.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sair'),
          ),
        ],
      ),
    );
    if (confirmou != true || !mounted) return;
    Navigator.of(context).popUntil((r) => r.isFirst);
    widget.aoSair();
  }

  @override
  Widget build(BuildContext context) {
    final ultima = _ultimaSync;
    return Scaffold(
      appBar: AppBar(title: const Text('Configurações')),
      body: ListView(
        children: [
          SwitchListTile(
            title: const Text('Tema escuro'),
            value: _escuro,
            onChanged: (v) {
              setState(() => _escuro = v);
              widget.aoMudarTema(v);
            },
          ),
          ListTile(
            title: const Text('Última sincronização'),
            subtitle: Text(
              ultima == null
                  ? 'nunca'
                  : '${dataCurta(ultima.toLocal())} ${_hora(ultima)}',
            ),
          ),
          ListTile(
            title: const Text('Fila de envio'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => FilaPage(deps: widget.deps)),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.logout),
            title: const Text('Sair'),
            onTap: _confirmarSair,
          ),
        ],
      ),
    );
  }

  String _hora(DateTime d) {
    final l = d.toLocal();
    return '${l.hour.toString().padLeft(2, '0')}:${l.minute.toString().padLeft(2, '0')}';
  }
}
