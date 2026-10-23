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
  bool _repetir = false;

  SyncService(this._api, this._rascunhos, this._estado, this._sessao);

  /// Clique repetido não duplica envio: a chamada concorrente recebe a execução em curso.
  /// Chamada concorrente também marca `_repetir`: uma rodada extra roda antes de o Future
  /// completar, para pegar rascunho inserido durante o envio. Sem item novo, não envia nada.
  Future<ResultadoSync> sincronizar() {
    final atual = _emCurso;
    if (atual != null) {
      _repetir = true;
      return atual;
    }
    return _emCurso = _rodar();
  }

  Future<ResultadoSync> _rodar() async {
    var enviados = 0;
    try {
      late ResultadoSync r;
      do {
        _repetir = false;
        r = await _executar();
        enviados += r.enviados;
      } while (_repetir && !r.semConexao);
      // enviados é soma (itens enviados são distintos). comErro e pendentes são da última
      // rodada: a rodada extra reenvia o rascunho que já falhou, e somar contaria o mesmo erro duas vezes.
      // Nada de `await` depois do último teste de `_repetir`: quem chegar agora começa do zero.
      return ResultadoSync(
        enviados: enviados,
        comErro: r.comErro,
        pendentes: r.pendentes,
        semConexao: r.semConexao,
      );
    } finally {
      _emCurso = null;
    }
  }

  Future<int> contarPendentes() async =>
      (await _rascunhos.listarPendentes()).length +
      (await _estado.pendentes()).length;

  Future<ResultadoSync> _executar() async {
    var enviados = 0;
    var comErro = 0;
    var semConexao = false;

    for (final r in await _rascunhos.listarPendentes()) {
      try {
        // ponytail: o POST pode ter chegado ao servidor e a resposta ter se perdido
        // (queda de rede ou timeout). O rascunho continua pendente e o reenvio duplica.
        // Mitigação atual: timeout de 90 s no ApiService. Correção real: chave de
        // idempotência no backend.
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

    // "Última sincronização" só avança quando a rodada toda foi limpa.
    if (!semConexao && comErro == 0) await _sessao.registrarSincronizacao(DateTime.now());

    return ResultadoSync(
      enviados: enviados,
      comErro: comErro,
      pendentes: await contarPendentes(),
      semConexao: semConexao,
    );
  }
}
