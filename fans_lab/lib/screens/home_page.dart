import 'dart:async';

import 'package:flutter/material.dart';

import 'package:fans_lab/app_deps.dart';
import 'package:fans_lab/models/materia.dart';
import 'package:fans_lab/screens/configuracoes_page.dart';
import 'package:fans_lab/screens/evento_detalhe_page.dart';
import 'package:fans_lab/screens/evento_form_page.dart';
import 'package:fans_lab/screens/fila_page.dart';
import 'package:fans_lab/services/api_exception.dart';
import 'package:fans_lab/services/home_service.dart';
import 'package:fans_lab/widgets/evento_card.dart';
import 'package:fans_lab/widgets/tempo_relativo.dart';

class HomePage extends StatefulWidget {
  const HomePage({
    super.key,
    required this.deps,
    required this.aoSair,
    required this.aoMudarTema,
    this.aoSessaoExpirar,
  });

  final AppDeps deps;
  final VoidCallback aoSair;
  final ValueChanged<bool> aoMudarTema;
  /// Token recusado (401). Sem ele, usa aoSair; o app passa um que preserva a fila offline.
  final VoidCallback? aoSessaoExpirar;

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  ResultadoHome? _resultado;
  String? _erro;
  bool _carregando = false;
  bool _sincronizando = false;
  int _pendentes = 0;

  @override
  void initState() {
    super.initState();
    _carregar();
  }

  Future<void> _carregar() async {
    setState(() => _carregando = true);
    try {
      final resultado = await widget.deps.home.carregar();
      if (!resultado.offline) {
        // pré-carga para criar evento offline; se falhar, o formulário busca de novo e mostra o erro
        unawaited(widget.deps.home.materias().catchError((Object e) {
          debugPrint('pré-carga de matérias: $e');
          return <Materia>[];
        }));
        final pendentesAntes = await widget.deps.sync.contarPendentes();
        if (pendentesAntes > 0) {
          // sincroniza ao reconectar: a Home recarregou online, então a rede voltou
          try {
            await widget.deps.sync.sincronizar();
          } on ApiException catch (e) {
            if (e.naoAutorizado) {
              if (mounted) _sessaoExpirou();
              return;
            }
            debugPrint('sincronização ao reconectar: $e');
          }
        }
      }
      final pendentes = await widget.deps.sync.contarPendentes();
      if (!mounted) return;
      setState(() {
        _resultado = resultado;
        _pendentes = pendentes;
        _erro = null;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.naoAutorizado) {
        _sessaoExpirou();
        return;
      }
      // Falha nunca vira lista vazia: sem dados, a tela mostra o erro; com dados, mantém a lista e avisa.
      setState(() => _erro = e.mensagem);
    } catch (e) {
      debugPrint('$e');
      if (mounted) {
        setState(() {
          _erro = 'Não foi possível ler os dados salvos no aparelho.';
          _carregando = false;
        });
      }
    } finally {
      if (mounted) setState(() => _carregando = false);
    }
  }

  Future<void> _sincronizar() async {
    setState(() => _sincronizando = true);
    try {
      final r = await widget.deps.sync.sincronizar();
      _snack(
        r.semConexao && r.enviados > 0
            ? 'Enviados: ${r.enviados} · a conexão caiu antes do resto.'
            : r.semConexao
                ? 'Sem conexão — nada foi enviado.'
                : 'Enviados: ${r.enviados} · Com erro: ${r.comErro} · Pendentes: ${r.pendentes}',
      );
    } on ApiException catch (e) {
      if (e.naoAutorizado) {
        _sessaoExpirou();
        return;
      }
      _snack(e.mensagem);
    } finally {
      if (mounted) setState(() => _sincronizando = false);
    }
    if (mounted) await _carregar();
  }

  void _sessaoExpirou() {
    _snack('Sessão expirada. Entre de novo.');
    (widget.aoSessaoExpirar ?? widget.aoSair)();
  }

  void _snack(String texto) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(texto)));
    }
  }

  /// Abre uma tela e recarrega ao voltar: detalhe, formulário, fila e configurações podem ter mudado dados.
  Future<void> _abrirTela(Widget tela) async {
    await Navigator.push<void>(
      context,
      MaterialPageRoute<void>(builder: (_) => tela),
    );
    if (mounted) await _carregar();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(diaExtenso(DateTime.now())),
        actions: [
          IconButton(
            tooltip: _pendentes > 0
                ? 'Sincronizar ($_pendentes aguardando envio)'
                : 'Sincronizar',
            onPressed: _sincronizando ? null : _sincronizar,
            icon: _sincronizando
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Badge(
                    isLabelVisible: _pendentes > 0,
                    label: Text('$_pendentes'),
                    child: const Icon(Icons.sync),
                  ),
          ),
          IconButton(
            tooltip: 'Configurações',
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => _abrirTela(
              ConfiguracoesPage(
                deps: widget.deps,
                aoMudarTema: widget.aoMudarTema,
                aoSair: widget.aoSair,
              ),
            ),
          ),
        ],
      ),
      body: _corpo(context),
    );
  }

  Widget _corpo(BuildContext context) {
    final r = _resultado;
    if (r == null) {
      if (_erro == null || _carregando) {
        return const Center(child: CircularProgressIndicator());
      }
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_erro!, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(onPressed: _carregar, child: const Text('Tentar de novo')),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _carregar,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          if (r.offline)
            _faixa(
              'Sem conexão com o servidor — mostrando o que foi salvo às ${_hora(r.salvoEm)}.',
            ),
          if (_erro != null) _faixa('Não foi possível atualizar: $_erro'),
          if (_pendentes > 0)
            Row(
              children: [
                Expanded(child: Text('$_pendentes aguardando envio')),
                TextButton(
                  onPressed: () => _abrirTela(FilaPage(deps: widget.deps)),
                  child: const Text('Ver fila'),
                ),
              ],
            ),
          Padding(
            padding: const EdgeInsets.only(top: 16, bottom: 8),
            child: Text(
              'o que vem aí',
              style: Theme.of(context).textTheme.titleSmall,
            ),
          ),
          // Ordem, teto e janela de 14 dias vêm prontos do servidor: não reordenar aqui.
          if (r.itens.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Text('Nada nos próximos 14 dias.', textAlign: TextAlign.center),
            ),
          // O EventoCard já tem margem vertical de 6: sem Padding extra, o espaço fica em ~12.
          for (final item in r.itens)
            EventoCard.deItem(
              item,
              onTap: () => _abrirTela(
                EventoDetalhePage(
                  deps: widget.deps,
                  eventoId: item.eventoId,
                  feito: item.feitoPeloUsuario,
                ),
              ),
            ),
          const SizedBox(height: 8),
          OutlinedButton(
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            onPressed: () => _abrirTela(EventoFormPage(deps: widget.deps)),
            child: const Text('+ Adicionar prova ou entrega'),
          ),
        ],
      ),
    );
  }

  Widget _faixa(String texto) => Card(
    margin: const EdgeInsets.only(bottom: 12),
    child: Padding(padding: const EdgeInsets.all(12), child: Text(texto)),
  );

  String _hora(DateTime? d) {
    if (d == null) return '--:--';
    final l = d.toLocal();
    return '${l.hour.toString().padLeft(2, '0')}:${l.minute.toString().padLeft(2, '0')}';
  }
}
