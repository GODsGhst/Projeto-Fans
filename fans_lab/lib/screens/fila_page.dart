import 'package:flutter/material.dart';

import 'package:fans_lab/app_deps.dart';
import 'package:fans_lab/models/rascunho_evento.dart';
import 'package:fans_lab/screens/evento_form_page.dart';
import 'package:fans_lab/services/api_exception.dart';
import 'package:fans_lab/widgets/evento_card.dart';

typedef _Fila = ({List<RascunhoEvento> rascunhos, int marcacoes});

/// Fila offline: o que está só no aparelho e o estado de envio de cada item.
/// Devolve `true` no pop quando algo mudou.
class FilaPage extends StatefulWidget {
  const FilaPage({super.key, required this.deps});

  final AppDeps deps;

  @override
  State<FilaPage> createState() => _FilaPageState();
}

class _FilaPageState extends State<FilaPage> {
  late Future<_Fila> _futuro;
  bool _sincronizando = false;
  bool _mudou = false;

  @override
  void initState() {
    super.initState();
    _futuro = _ler();
  }

  Future<_Fila> _ler() async {
    final rascunhos = await widget.deps.rascunhos.listar();
    final marcacoes = await widget.deps.estado.pendentes();
    return (rascunhos: rascunhos, marcacoes: marcacoes.length);
  }

  void _recarregar() {
    if (!mounted) return;
    setState(() {
      _futuro = _ler();
    });
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Navigator.pop(context, _mudou);
      },
      child: Scaffold(
        appBar: AppBar(title: const Text('Fila de envio')),
        body: FutureBuilder<_Fila>(
          future: _futuro,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) return _estadoErro();
            return _conteudo(snap.requireData);
          },
        ),
      ),
    );
  }

  Widget _estadoErro() => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('Não foi possível ler a fila.'),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _recarregar,
            child: const Text('Tentar de novo'),
          ),
        ],
      ),
    ),
  );

  Widget _conteudo(_Fila fila) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          fila.marcacoes == 0
              ? 'Nenhuma marcação de feito pendente.'
              : 'Marcações de feito pendentes: ${fila.marcacoes}',
        ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: _sincronizando ? null : _sincronizar,
          child: const Text('Sincronizar agora'),
        ),
        const SizedBox(height: 16),
        if (fila.rascunhos.isEmpty) const Text('Nada na fila.'),
        for (final r in fila.rascunhos) _item(r),
      ],
    );
  }

  Widget _item(RascunhoEvento r) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          EventoCard(
            tipo: r.tipo,
            titulo: r.titulo,
            data: r.data,
            hora: r.hora,
            materiaSigla: r.materiaSigla,
            materiaCorHex: r.materiaCorHex,
            autoriaTexto: _status(r),
          ),
          // Enviado não se edita nem se apaga daqui: já é fato da turma.
          if (!r.sincronizado)
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: () => _editar(r),
                  child: const Text('Editar'),
                ),
                TextButton(
                  onPressed: () => _excluir(r),
                  child: const Text('Excluir'),
                ),
              ],
            ),
        ],
      ),
    );
  }

  String _status(RascunhoEvento r) {
    if (r.sincronizado) return 'você · enviado ✓';
    final erro = r.ultimoErro;
    return erro == null ? 'você · aguardando envio' : 'você · erro: $erro';
  }

  Future<void> _editar(RascunhoEvento r) async {
    final mudou = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => EventoFormPage(deps: widget.deps, rascunho: r),
      ),
    );
    if (mudou == true) {
      _mudou = true;
      _recarregar();
    }
  }

  Future<void> _excluir(RascunhoEvento r) async {
    final confirmou = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Excluir este rascunho?'),
        content: const Text(
          'Ele ainda não foi enviado. Some só deste aparelho.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Excluir'),
          ),
        ],
      ),
    );
    if (confirmou != true) return;
    await widget.deps.rascunhos.excluir(r.localId!);
    _mudou = true;
    _recarregar();
  }

  Future<void> _sincronizar() async {
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _sincronizando = true);
    try {
      final r = await widget.deps.sync.sincronizar();
      if (r.enviados > 0) _mudou = true;
      final texto = r.semConexao && r.enviados > 0
          ? 'Enviados: ${r.enviados} · a conexão caiu antes do resto.'
          : r.semConexao
              ? 'Sem conexão — nada foi enviado.'
              : 'Enviados: ${r.enviados} · Com erro: ${r.comErro} · Pendentes: ${r.pendentes}';
      messenger.showSnackBar(SnackBar(content: Text(texto)));
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(_mensagem(e))));
    } finally {
      if (mounted) {
        setState(() {
          _sincronizando = false;
          _futuro = _ler();
        });
      }
    }
  }

  String _mensagem(ApiException e) =>
      e.naoAutorizado ? 'Sessão expirada — volte e entre de novo.' : e.mensagem;
}
