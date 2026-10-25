import 'package:flutter/material.dart';

import 'package:fans_lab/app_deps.dart';
import 'package:fans_lab/models/evento.dart';
import 'package:fans_lab/models/materia.dart';
import 'package:fans_lab/models/rascunho_evento.dart';
import 'package:fans_lab/models/tipo_evento.dart';
import 'package:fans_lab/services/api_exception.dart';
import 'package:fans_lab/widgets/cores.dart';
import 'package:fans_lab/widgets/materia_chip.dart';
import 'package:fans_lab/widgets/tempo_relativo.dart';

/// Formulário em três modos: novo (sem argumentos), editar rascunho local
/// (`rascunho`) e editar evento do servidor (`evento`, PATCH online).
/// Devolve `true` no pop quando algo foi salvo.
class EventoFormPage extends StatefulWidget {
  const EventoFormPage({
    super.key,
    required this.deps,
    this.rascunho,
    this.evento,
  });

  final AppDeps deps;
  final RascunhoEvento? rascunho;
  final Evento? evento;

  @override
  State<EventoFormPage> createState() => _EventoFormPageState();
}

class _EventoFormPageState extends State<EventoFormPage> {
  final _formKey = GlobalKey<FormState>();
  final _titulo = TextEditingController();
  final _sala = TextEditingController();
  late Future<List<Materia>> _materiasFuturo;
  List<Materia> _materias = const [];
  String? _materiaId;
  late TipoEvento _tipo;
  late DateTime _data;
  String? _hora; // 'HH:mm'
  bool _salvando = false;

  bool get _editando => widget.rascunho != null || widget.evento != null;

  @override
  void initState() {
    super.initState();
    final r = widget.rascunho;
    final e = widget.evento;
    _titulo.text = r?.titulo ?? e?.titulo ?? '';
    _sala.text = r?.sala ?? e?.sala ?? '';
    _materiaId = r?.materiaId ?? e?.materiaId;
    _tipo = r?.tipo ?? e?.tipo ?? TipoEvento.prova;
    _data = r?.data ?? e?.data ?? _hoje();
    _hora = r?.hora ?? e?.hora;
    _carregarMaterias();
  }

  @override
  void dispose() {
    _titulo.dispose();
    _sala.dispose();
    super.dispose();
  }

  /// Sem matéria não há evento: a falha vira tela de erro com "Tentar de novo".
  void _carregarMaterias() {
    _materiasFuturo = widget.deps.home.materias().then((lista) {
      _materias = lista;
      return lista;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_editando ? 'Editar' : 'O que vai cair')),
      body: FutureBuilder<List<Materia>>(
        future: _materiasFuturo,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) return _estadoErro(snap.error!);
          return _formulario();
        },
      ),
    );
  }

  Widget _formulario() {
    final materia = _materiaEscolhida();
    final cores = Theme.of(context).extension<CoresFans>()!;
    // Evento ou rascunho cuja matéria não está mais na lista: o aviso usa a sigla guardada.
    final siglaOriginal =
        widget.evento?.materiaSigla ?? widget.rascunho?.materiaSigla;
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Tipo'),
          const SizedBox(height: 8),
          SegmentedButton<TipoEvento>(
            segments: const [
              ButtonSegment(value: TipoEvento.prova, label: Text('Prova')),
              ButtonSegment(value: TipoEvento.entrega, label: Text('Entrega')),
            ],
            selected: {_tipo},
            onSelectionChanged: (novo) => setState(() => _tipo = novo.first),
          ),
          const SizedBox(height: 16),
          if (siglaOriginal != null && materia == null) ...[
            Text(
              'A matéria original ($siglaOriginal) não está mais disponível — escolha outra.',
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
            const SizedBox(height: 8),
          ],
          DropdownButtonFormField<String>(
            initialValue: materia?.id,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Matéria'),
            items: [
              for (final m in _materias)
                DropdownMenuItem(
                  value: m.id,
                  child: Row(
                    children: [
                      MateriaChip(sigla: m.sigla, corHex: m.corHex),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(m.nome, overflow: TextOverflow.ellipsis),
                      ),
                    ],
                  ),
                ),
            ],
            onChanged: (id) => setState(() => _materiaId = id),
            validator: (_) =>
                _materiaEscolhida() == null ? 'Escolha a matéria' : null,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _titulo,
            maxLength: 120,
            decoration: const InputDecoration(labelText: 'O que é'),
            validator: (v) =>
                (v ?? '').trim().isEmpty ? 'Informe o título' : null,
          ),
          const SizedBox(height: 8),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Quando'),
            subtitle: Text(dataCurta(_data)),
            trailing: const Icon(Icons.calendar_today),
            onTap: _escolherData,
          ),
          Row(
            children: [
              Expanded(
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Hora (opcional)'),
                  subtitle: Text(_hora ?? 'Sem horário'),
                  trailing: const Icon(Icons.schedule),
                  onTap: _escolherHora,
                ),
              ),
              if (_hora != null)
                IconButton(
                  tooltip: 'Tirar a hora',
                  icon: const Icon(Icons.clear),
                  onPressed: () => setState(() => _hora = null),
                ),
            ],
          ),
          const SizedBox(height: 8),
          TextFormField(
            controller: _sala,
            maxLength: 40,
            decoration: const InputDecoration(labelText: 'Sala (opcional)'),
          ),
          const SizedBox(height: 24),
          // Autoria é o mecanismo de confiança: o criador precisa saber que o nome vai junto.
          if (!_editando) ...[
            Text(
              'Vai aparecer para a turma toda com o seu nome. Só você pode editar ou apagar depois.',
              style: TextStyle(color: cores.ink2),
            ),
            const SizedBox(height: 12),
          ],
          FilledButton(
            onPressed: _salvando ? null : _salvar,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_salvando) ...[
                  const SizedBox.square(
                    dimension: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  const SizedBox(width: 8),
                ],
                const Text('Salvar'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _estadoErro(Object erro) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            erro is ApiException
                ? _mensagem(erro)
                : 'Não foi possível carregar as matérias.',
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: () => setState(_carregarMaterias),
            child: const Text('Tentar de novo'),
          ),
        ],
      ),
    ),
  );

  Future<void> _escolherData() async {
    final hoje = DateUtils.dateOnly(DateTime.now());
    final escolhida = await showDatePicker(
      context: context,
      initialDate: _data,
      // Prova ou entrega é do futuro. Editando um evento que já passou, a data dele continua valendo.
      firstDate: _data.isBefore(hoje) ? _data : hoje,
      lastDate: DateTime(2100),
    );
    if (escolhida != null && mounted) setState(() => _data = escolhida);
  }

  Future<void> _escolherHora() async {
    final partes = _hora?.split(':');
    final inicial = partes == null
        ? TimeOfDay.now()
        : TimeOfDay(hour: int.parse(partes[0]), minute: int.parse(partes[1]));
    final escolhida = await showTimePicker(
      context: context,
      initialTime: inicial,
    );
    if (escolhida != null && mounted) setState(() => _hora = _hm(escolhida));
  }

  /// Salva primeiro no aparelho (offline-first) e só depois tenta a rede.
  /// PATCH de evento é online: erro fica na tela para o usuário tentar de novo.
  Future<void> _salvar() async {
    if (_salvando) return;
    if (!_formKey.currentState!.validate()) return;
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    final dados = _montarRascunho();
    final ev = widget.evento;
    setState(() => _salvando = true);
    try {
      if (ev != null) {
        await widget.deps.api.atualizarEvento(
          ev.id,
          ev.version,
          dados.toCriarJson(),
        );
        messenger.showSnackBar(
          const SnackBar(content: Text('Evento atualizado.')),
        );
      } else {
        if (widget.rascunho == null) {
          await widget.deps.rascunhos.inserir(dados);
        } else {
          await widget.deps.rascunhos.atualizar(dados);
        }
        messenger.showSnackBar(SnackBar(content: Text(await _sincronizar(dados.data))));
      }
      // Pode ter voltado enquanto salvava: só fecha se esta ainda é a rota do topo.
      if (mounted && (ModalRoute.of(context)?.isCurrent ?? false)) {
        navigator.pop(true);
      }
    } on ApiException catch (e) {
      // Só o PATCH chega aqui: _sincronizar trata os erros da fila.
      messenger.showSnackBar(SnackBar(content: Text(_msgEditar(e))));
    } finally {
      if (mounted) setState(() => _salvando = false);
    }
  }

  Future<String> _sincronizar(DateTime data) async {
    try {
      final r = await widget.deps.sync.sincronizar();
      if (r.semConexao) {
        return 'Salvo no aparelho — será enviado quando houver conexão.';
      }
      if (r.comErro > 0) {
        return 'Salvo no aparelho, mas o servidor recusou. Veja a fila de envio.';
      }
      // A Home do servidor mostra de hoje até hoje+14: sem este aviso, o evento parece ter sumido.
      final janela = DateUtils.dateOnly(DateTime.now()).add(const Duration(days: 14));
      if (data.isAfter(janela)) {
        final aparece = data.subtract(const Duration(days: 14));
        return 'Enviado para a turma. A Home mostra os próximos 14 dias: '
            'ele aparece lá a partir de ${dataCurta(aparece)}.';
      }
      return 'Enviado para a turma.';
    } on ApiException catch (e) {
      return e.naoAutorizado
          ? 'Sessão expirada — o evento ficou salvo no aparelho.'
          : 'Salvo no aparelho. ${e.mensagem}';
    }
  }

  RascunhoEvento _montarRascunho() {
    final m = _materiaEscolhida()!; // o validador garante que existe
    final sala = _sala.text.trim();
    final r = widget.rascunho;
    return RascunhoEvento(
      localId: r?.localId,
      materiaId: m.id,
      materiaSigla: m.sigla,
      materiaCorHex: m.corHex,
      tipo: _tipo,
      titulo: _titulo.text.trim(),
      data: _data,
      hora: _hora,
      sala: sala.isEmpty ? null : sala,
      criadoEm: r?.criadoEm ?? DateTime.now(),
    );
  }

  Materia? _materiaEscolhida() {
    for (final m in _materias) {
      if (m.id == _materiaId) return m;
    }
    return null;
  }

  String _msgEditar(ApiException e) {
    if (e.semConexao) return 'Editar precisa de internet.';
    if (e.conflito) {
      return 'Alguém alterou este evento antes de você. Volte e abra de novo.';
    }
    return _mensagem(e);
  }

  String _mensagem(Object erro) => switch (erro) {
    ApiException e when e.naoAutorizado =>
      'Sessão expirada — volte e entre de novo.',
    ApiException e => e.mensagem,
    _ => 'Algo deu errado. Tente de novo.',
  };

  DateTime _hoje() {
    final agora = DateTime.now();
    return DateTime(agora.year, agora.month, agora.day);
  }

  String _hm(TimeOfDay t) =>
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
}
