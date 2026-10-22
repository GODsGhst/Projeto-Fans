import 'package:fans_lab/repositories/estado_pessoal_repository.dart';
import 'package:fans_lab/repositories/rascunho_repository.dart';
import 'package:fans_lab/repositories/sessao_store.dart';
import 'package:fans_lab/services/api_exception.dart';
import 'package:fans_lab/services/api_service.dart';

class ResultadoSync {
  final int enviados;
  final int comErro;
  final int pendentes;
  final bool semConexao;

  const ResultadoSync({
    required this.enviados,
    required this.comErro,
    required this.pendentes,
    required this.semConexao,
  });
}

/// Envia a fila offline: rascunhos (POST) e feitos (PUT) pendentes.
class SyncService {
  final ApiService _api;
  final RascunhoRepository _rascunhos;
  final EstadoPessoalRepository _estado;
  final SessaoStore _sessao;
  Future<ResultadoSync>? _emCurso;

  SyncService(this._api, this._rascunhos, this._estado, this._sessao);

  /// Clique repetido não duplica envio: a chamada concorrente recebe a execução em curso.
  Future<ResultadoSync> sincronizar() =>
      _emCurso ??= _executar().whenComplete(() {
        _emCurso = null;
      });

  Future<int> contarPendentes() async =>
      (await _rascunhos.listarPendentes()).length +
      (await _estado.pendentes()).length;

  Future<ResultadoSync> _executar() async {
    var enviados = 0;
    var comErro = 0;
    var semConexao = false;

    for (final r in await _rascunhos.listarPendentes()) {
      try {
        // ponytail: se o POST chegou ao servidor mas a resposta se perdeu (timeout),
        // o rascunho continua pendente e pode duplicar no próximo envio.
        // Correção: chave de idempotência no backend.
        await _api.criarEvento(r.toCriarJson());
        await _rascunhos.marcarSincronizado(r.localId!);
        enviados++;
      } on ApiException catch (e) {
        if (e.naoAutorizado) rethrow;
        if (e.semConexao) {
          semConexao = true;
          break;
        }
        await _rascunhos.registrarErro(r.localId!, e.mensagem);
        comErro++;
      }
    }

    if (!semConexao) {
      for (final p in await _estado.pendentes()) {
        try {
          await _api.marcarFeito(p.eventoId, p.feito);
          await _estado.marcarSincronizado(p.eventoId, p.feito);
          enviados++;
        } on ApiException catch (e) {
          if (e.naoAutorizado) rethrow;
          if (e.semConexao) {
            semConexao = true;
            break;
          }
          // Evento sumiu no servidor: não há o que sincronizar, sai da fila.
          if (e.naoEncontrado) await _estado.descartar(p.eventoId);
          comErro++;
        }
      }
    }

    if (!semConexao) await _sessao.registrarSincronizacao(DateTime.now());

    return ResultadoSync(
      enviados: enviados,
      comErro: comErro,
      pendentes: await contarPendentes(),
      semConexao: semConexao,
    );
  }
}
