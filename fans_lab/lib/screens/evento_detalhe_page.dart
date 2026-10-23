import 'package:flutter/material.dart';

import 'package:fans_lab/app_deps.dart';
import 'package:fans_lab/models/evento.dart';
import 'package:fans_lab/models/evento_detalhe.dart';
import 'package:fans_lab/models/material_aula.dart';
import 'package:fans_lab/models/tipo_evento.dart';
import 'package:fans_lab/screens/evento_form_page.dart';
import 'package:fans_lab/services/api_exception.dart';
import 'package:fans_lab/widgets/cores.dart';
import 'package:fans_lab/widgets/materia_chip.dart';
import 'package:fans_lab/widgets/tempo_relativo.dart';

/// Detalhe de um evento. Autoria sempre visível; Editar e Excluir só para o autor
/// (o servidor confere de novo). Devolve `true` no pop quando algo mudou.
class EventoDetalhePage extends StatefulWidget {
  const EventoDetalhePage({
    super.key,
    required this.deps,
    required this.eventoId,
    this.feito = false,
  });

  final AppDeps deps;
  final String eventoId;

  /// Estado pessoal de "feito" que a Home já conhece; a API de detalhe não traz esse campo.
  final bool feito;

  @override
  State<EventoDetalhePage> createState() => _EventoDetalhePageState();
}

class _EventoDetalhePageState extends State<EventoDetalhePage> {
  late Future<EventoDetalhe> _futuro;
  String? _usuarioId;
  late bool _feito;
  bool _salvandoFeito = false;
  bool _excluindo = false;
  bool _mudou = false;

  @override
  void initState() {
    super.initState();
    _feito = widget.feito;
    _futuro = widget.deps.api.evento(widget.eventoId);
    _lerUsuario();
  }

  Future<void> _lerUsuario() async {
    final sessao = await widget.deps.sessao.carregar();
    if (mounted) setState(() => _usuarioId = sessao?.usuario.id);
  }

  void _recarregar() {
    if (!mounted) return;
    setState(() {
      _futuro = widget.deps.api.evento(widget.eventoId);
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
        appBar: AppBar(title: const Text('Evento')),
        body: FutureBuilder<EventoDetalhe>(
          future: _futuro,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return _estadoErro(snap.error!);
            }
            return _corpo(snap.requireData);
          },
        ),
      ),
    );
  }

  Widget _corpo(EventoDetalhe detalhe) {
    final e = detalhe.evento;
    final a = e.autoria;
    final tema = Theme.of(context).textTheme;
    final ehAutor = _usuarioId != null && a.autorId == _usuarioId;
    // Excluído: o servidor ainda devolve ao autor. Não há o que editar, excluir nem marcar.
    final excluido = e.excluidoEm != null;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (excluido)
          _faixa(
            'Você excluiu este evento — ele não aparece mais para a turma.',
          ),
        if (!e.visivelTurma)
          _faixa('Oculto pelo líder da turma — só você está vendo.'),
        Row(
          children: [
            MateriaChip(sigla: e.materiaSigla, corHex: e.materiaCorHex),
            const SizedBox(width: 8),
            _tipoBadge(e.tipo),
          ],
        ),
        const SizedBox(height: 12),
        Text(e.titulo, style: tema.headlineSmall),
        const SizedBox(height: 4),
        Text(
          e.hora == null
              ? dataCurta(e.data)
              : '${dataCurta(e.data)} · ${e.hora}',
          style: tema.bodyLarge,
        ),
        if (e.sala != null) Text('Sala ${e.sala}', style: tema.bodyMedium),
        const SizedBox(height: 12),
        Text(_linha('Criado por', a.autorNome, a.autorSelo, a.criadoEm)),
        if (a.editadoPorNome != null && a.atualizadoEm != null)
          Text(
            _linha(
              'Editado por',
              a.editadoPorNome!,
              a.editadoPorSelo,
              a.atualizadoEm!,
            ),
          ),
        const SizedBox(height: 24),
        Text('Materiais vinculados', style: tema.titleSmall),
        const SizedBox(height: 8),
        if (detalhe.materiais.isEmpty) const Text('Nenhum material vinculado.'),
        ...detalhe.materiais.map(_materialCard),
        if (!excluido) ...[
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _salvandoFeito ? null : _alternarFeito,
            child: Text(_feito ? 'Desmarcar feito' : 'Marcar como feito'),
          ),
          if (ehAutor) ...[
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: () => _editar(e),
              child: const Text('Editar'),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: _excluindo ? null : () => _excluir(e),
              child: _excluindo
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Excluir'),
            ),
          ],
        ],
      ],
    );
  }

  /// Prova é bloco sólido; entrega é contorno de 1px. A cor fica com a matéria.
  Widget _tipoBadge(TipoEvento tipo) {
    final cores = Theme.of(context).extension<CoresFans>()!;
    final prova = tipo == TipoEvento.prova;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: prova ? cores.provaBg : null,
        border: prova ? null : Border.all(color: cores.ink3, width: 1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        prova ? 'Prova' : 'Entrega',
        style: TextStyle(
          color: prova ? cores.provaFg : cores.ink,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  /// Aviso no topo (excluído ou oculto). Texto puro: nada depende só de cor.
  Widget _faixa(String texto) {
    final cores = Theme.of(context).extension<CoresFans>()!;
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: cores.rule,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(texto),
    );
  }

  Widget _materialCard(MaterialAula m) => Card(
    child: ListTile(
      title: Text(m.titulo),
      subtitle: Text(
        '${m.url ?? _tipoMaterial(m.tipo)}\n${m.autoria.autorNome} · '
        '${tempoRelativo(m.autoria.criadoEm)}',
      ),
    ),
  );

  Widget _estadoErro(Object erro) {
    // Offline o detalhe não carrega, mas "feito" é local: dá para marcar mesmo assim.
    final offline = erro is ApiException && erro.semConexao;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_mensagem(erro), textAlign: TextAlign.center),
            const SizedBox(height: 12),
            if (offline) ...[
              OutlinedButton(
                onPressed: _salvandoFeito ? null : _alternarFeito,
                child: Text(_feito ? 'Desmarcar feito' : 'Marcar como feito'),
              ),
              const SizedBox(height: 8),
            ],
            FilledButton(
              onPressed: _recarregar,
              child: const Text('Tentar de novo'),
            ),
          ],
        ),
      ),
    );
  }

  /// Offline-first: grava local primeiro, depois tenta enviar.
  Future<void> _alternarFeito() async {
    final messenger = ScaffoldMessenger.of(context);
    final novo = !_feito;
    setState(() => _salvandoFeito = true);
    try {
      await widget.deps.estado.marcarLocal(widget.eventoId, novo);
      if (!mounted) return;
      setState(() {
        _feito = novo;
        _mudou = true;
      });
      final r = await widget.deps.sync.sincronizar();
      final texto = r.semConexao
          ? 'Salvo no aparelho — será enviado quando houver conexão.'
          : r.comErro > 0
          ? 'Salvo no aparelho, mas o servidor recusou. Veja a fila de envio.'
          : 'Feito atualizado.';
      messenger.showSnackBar(SnackBar(content: Text(texto)));
    } on ApiException catch (e) {
      messenger.showSnackBar(
        SnackBar(content: Text('Salvo no aparelho. ${_mensagem(e)}')),
      );
    } finally {
      if (mounted) setState(() => _salvandoFeito = false);
    }
  }

  Future<void> _editar(Evento e) async {
    final mudou = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => EventoFormPage(deps: widget.deps, evento: e),
      ),
    );
    if (mudou == true) {
      _mudou = true;
      _recarregar();
    }
  }

  Future<void> _excluir(Evento e) async {
    final confirmou = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Excluir este evento?'),
        content: const Text('Ele some para a turma inteira.'),
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
    if (confirmou != true || !mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    setState(() => _excluindo = true);
    var excluiu = false;
    try {
      await widget.deps.api.excluirEvento(e.id, e.version);
      excluiu = true;
    } on ApiException catch (ex) {
      if (ex.conflito) {
        messenger.showSnackBar(
          const SnackBar(
            content: Text('Alguém alterou este evento antes. Recarregando…'),
          ),
        );
        _recarregar();
      } else {
        messenger.showSnackBar(
          SnackBar(
            content: Text(
              ex.semConexao ? 'Excluir precisa de internet.' : _mensagem(ex),
            ),
          ),
        );
      }
    } finally {
      // Depois de excluir, o botão fica travado até a página sair.
      if (mounted && !excluiu) setState(() => _excluindo = false);
    }
    if (excluiu && mounted && (ModalRoute.of(context)?.isCurrent ?? false)) {
      navigator.pop(true);
    }
  }

  /// "Criado por Ana (professor) · há 2 dias" e linha equivalente para edição.
  String _linha(String rotulo, String nome, String? selo, DateTime quando) {
    final sufixo = selo == null ? '' : ' (${_seloTexto(selo)})';
    return '$rotulo $nome$sufixo · ${tempoRelativo(quando)}';
  }

  String _seloTexto(String selo) => switch (selo) {
    'PROFESSOR' => 'professor',
    'COORDENACAO' => 'coordenação',
    _ => selo.toLowerCase(),
  };

  String _tipoMaterial(String tipo) => switch (tipo) {
    'AULA' => 'Aula',
    'ADICIONAL' => 'Material adicional',
    _ => tipo,
  };

  String _mensagem(Object erro) => switch (erro) {
    ApiException e when e.naoAutorizado =>
      'Sessão expirada — volte e entre de novo.',
    ApiException e => e.mensagem,
    _ => 'Algo deu errado. Tente de novo.',
  };
}
