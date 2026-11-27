import 'dart:async';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import 'package:fans_lab/app_deps.dart';
import 'package:fans_lab/models/evento.dart';
import 'package:fans_lab/services/api_exception.dart';
import 'package:fans_lab/services/upload_service.dart';

/// Anexa um PDF, PNG ou JPG a uma prova ou entrega. O arquivo vira material da
/// turma, com o nome de quem enviou. Devolve `true` no pop quando enviou.
///
/// Selecionar não é enviar: escolher só guarda o arquivo na tela; os bytes saem
/// quando a pessoa toca em Enviar.
class EnviarArquivoPage extends StatefulWidget {
  const EnviarArquivoPage({
    super.key,
    required this.deps,
    required this.evento,
  });

  final AppDeps deps;
  final Evento evento;

  @override
  State<EnviarArquivoPage> createState() => _EnviarArquivoPageState();
}

class _EnviarArquivoPageState extends State<EnviarArquivoPage> {
  final _descricao = TextEditingController();
  PlatformFile? _arquivo;
  int _tamanho = 0;
  String? _problema;
  String _mensagem = '';
  bool _enviando = false;
  double? _progresso;

  @override
  void dispose() {
    _descricao.dispose();
    super.dispose();
  }

  Future<void> _escolher() async {
    PlatformFile? escolhido;
    try {
      escolhido = await FilePicker.pickFile(
        type: FileType.custom,
        allowedExtensions: UploadService.extensoes,
      );
    } on Object {
      // Ex.: arquivo do Drive sem internet, que o Android não consegue copiar.
      if (mounted) {
        setState(
          () => _mensagem = 'Não foi possível abrir este arquivo. Escolha outro.',
        );
      }
      return;
    }
    // Local final e já inicializado: o Dart mantém a checagem de nulo dentro do setState.
    final arquivo = escolhido;
    if (!mounted) return;
    // Cancelar o seletor é fluxo normal: sem erro, e a escolha anterior fica.
    if (arquivo == null) {
      setState(() => _mensagem = 'Seleção cancelada.');
      return;
    }
    final tamanho = arquivo.lengthSync() ?? await arquivo.length() ?? 0;
    if (!mounted) return;
    setState(() {
      _arquivo = arquivo;
      _tamanho = tamanho;
      _problema = UploadService.validar(arquivo.name, tamanho);
      _mensagem = '';
      _progresso = null;
    });
  }

  Future<void> _enviar() async {
    final arquivo = _arquivo;
    if (arquivo == null || _problema != null || _enviando) return;
    // Trava já no toque: o pedido de permissão e a leitura do arquivo esperam, e um
    // segundo toque nesse meio-tempo mandava o mesmo arquivo duas vezes.
    setState(() {
      _enviando = true;
      _progresso = null;
      _mensagem = '';
    });
    // Chamado ainda dentro do toque (o navegador só mostra o pedido assim) e sem esperar:
    // no navegador o pedido só termina quando a pessoa responde, e o envio não depende disso.
    unawaited(widget.deps.notificacoes.pedirPermissao());
    final Uint8List bytes;
    try {
      bytes = await arquivo.readAsBytes();
    } on Object {
      // O arquivo sumiu ou perdeu a permissão entre escolher e enviar. No navegador o erro
      // de leitura é um objeto JS, não uma Exception.
      if (mounted) {
        setState(() {
          _enviando = false;
          _mensagem = 'Não foi possível ler o arquivo. Escolha de novo.';
        });
      }
      return;
    }
    if (!mounted) return;
    try {
      final material = await widget.deps.upload.enviar(
        eventoId: widget.evento.id,
        nome: arquivo.name,
        bytes: bytes,
        descricao: _descricao.text,
        aoEnviar: (enviados, total) {
          // Total desconhecido: a barra fica indeterminada em vez de dividir por zero.
          if (!mounted || total <= 0) return;
          setState(() => _progresso = enviados / total);
        },
      );
      await widget.deps.notificacoes.avisar(
        'Arquivo enviado',
        '"${material.titulo}" foi anexado a ${widget.evento.titulo}.',
      );
      if (mounted) Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _mensagem = e.mensagem);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final arquivo = _arquivo;
    final tema = Theme.of(context);
    final podeEnviar = arquivo != null && _problema == null && !_enviando;
    // Sair no meio do envio deixava o pedido correndo sem ninguém saber o resultado,
    // e a pessoa mandava de novo. Volta só depois da resposta.
    return PopScope(
      canPop: !_enviando,
      onPopInvokedWithResult: (saiu, _) {
        if (!saiu) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Espere o envio terminar.')),
          );
        }
      },
      child: Scaffold(
        appBar: AppBar(title: const Text('Anexar arquivo')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'O arquivo fica em "${widget.evento.titulo}" e aparece para a turma com o seu nome.',
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: _enviando ? null : _escolher,
              icon: const Icon(Icons.attach_file),
              label: Text(
                arquivo == null ? 'Selecionar documento' : 'Trocar documento',
              ),
            ),
            const SizedBox(height: 4),
            Text('PDF, PNG ou JPG, até 5 MB.', style: tema.textTheme.bodySmall),
            if (arquivo != null)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.description_outlined),
                title: Text(arquivo.name),
                subtitle: Text(tamanhoLegivel(_tamanho)),
              ),
            if (_problema != null)
              Text(_problema!, style: TextStyle(color: tema.colorScheme.error)),
            const SizedBox(height: 12),
            TextField(
              controller: _descricao,
              enabled: !_enviando,
              maxLength: 120,
              decoration: const InputDecoration(
                labelText: 'Descrição (opcional)',
                helperText:
                    'Vira o título do material. Vazia, usa o nome do arquivo.',
                // Em celular de 360 dp a frase não cabe numa linha e sumia em "…".
                helperMaxLines: 2,
              ),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: podeEnviar ? _enviar : null,
              child: const Text('Enviar'),
            ),
            if (_enviando) ...[
              const SizedBox(height: 16),
              LinearProgressIndicator(value: _progresso),
              const SizedBox(height: 4),
              Text(
                _progresso == null
                    ? 'Enviando…'
                    : 'Enviando… ${(_progresso! * 100).toStringAsFixed(0)}%',
              ),
            ],
            if (_mensagem.isNotEmpty) ...[
              const SizedBox(height: 16),
              Semantics(liveRegion: true, child: Text(_mensagem)),
            ],
          ],
        ),
      ),
    );
  }
}
