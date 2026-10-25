import 'dart:developer' as developer;

import '../core/api.dart';
import 'models.dart';

/// O que o sync pede aos lembretes. O NotificacoesService implementa esta interface.
abstract interface class LembretesSync {
  /// Falso no navegador: nada a agendar, e nem sai o GET /sync.
  bool get suportado;

  /// Sobe quando a conta sai do aparelho. Resposta de época antiga é descartada.
  int get epoca;

  /// Cancela e reagenda tudo a partir desta lista. Inclui lápides, que desagendam.
  Future<void> sincronizar(List<EventoAgendavel> eventos);
}

/// `GET /sync`, o pedaço que os lembretes leem. Nunca lança: falha vira log, e os avisos
/// de antes continuam valendo.
///
/// Usa o /sync e não a Home porque a Home tem teto de 6 e janela de 14 dias, e o /sync é a
/// única rota que devolve oculto e excluído de propósito.
class SyncRepository {
  SyncRepository({
    required this.api,
    required this.lembretes,
    int Function()? agoraMs,
  }) : _agoraMs = agoraMs ?? (() => DateTime.now().millisecondsSinceEpoch);

  final ApiClient api;
  final LembretesSync lembretes;
  final int Function() _agoraMs;

  /// Depois de um /sync bom, não se pergunta de novo dentro desta janela.
  static const Duration janela = Duration(seconds: 60);

  /// Ida em voo: quem chega junto reaproveita a mesma ida ao servidor.
  Future<void>? _emVoo;

  /// Instante do último /sync que chegou E foi entregue aos lembretes. 0 = nunca.
  int _ultimoOkMs = 0;

  /// Número da última ida iniciada. Só a resposta da mais nova é aplicada.
  int _sequencia = 0;

  /// Época dos lembretes que `_emVoo` e `_ultimoOkMs` enxergam.
  int _epocaVista = 0;

  /// `forcar` ignora a janela e a ida em voo. Quem acabou de mudar o que o /sync devolve
  /// usa isso, senão a lista velha deixaria o aviso novo de fora.
  Future<void> reagendarAvisos({bool forcar = false}) async {
    if (!lembretes.suportado) return;
    if (_epocaVista != lembretes.epoca) {
      _epocaVista = lembretes.epoca;
      _emVoo = null;
      _ultimoOkMs = 0;
    }
    if (!forcar) {
      final emVoo = _emVoo;
      if (emVoo != null) return emVoo;
      if (_agoraMs() - _ultimoOkMs < janela.inMilliseconds) return;
    }
    final voo = _buscarEEntregar();
    _emVoo = voo;
    try {
      await voo;
    } finally {
      // Uma ida forçada pode ter tomado o lugar desta: não apagar a dela.
      if (identical(_emVoo, voo)) _emVoo = null;
    }
  }

  Future<void> _buscarEEntregar() async {
    final minha = ++_sequencia;
    final epoca = lembretes.epoca;
    try {
      final resposta = RespostaSync.fromJson(
        await api.get<Map<String, dynamic>>('/sync'),
      );
      if (minha != _sequencia || epoca != lembretes.epoca) {
        // Passada para trás por uma ida mais nova, ou de uma conta que já saiu.
        return;
      }
      await lembretes.sincronizar([
        for (final item in resposta.eventosAlterados) _agendavel(item),
      ]);
      _ultimoOkMs = _agoraMs();
    } catch (e, s) {
      developer.log(
        '[sync] lembretes não reagendados; os de antes continuam',
        name: 'sync',
        error: e,
        stackTrace: s,
        level: 1000,
      );
    }
  }

  /// Lápide (oculto ou excluído de quem não é o autor) chega sem conteúdo. Os campos vazios
  /// são placeholders: o reagendador decide pelas flags antes de ler título, tipo ou data.
  EventoAgendavel _agendavel(ItemSync item) {
    final tipo = _tipo(item.tipo);
    final titulo = item.titulo;
    final data = item.data;
    final sigla = item.materiaSigla;
    if (tipo == null || titulo == null || data == null || sigla == null) {
      return EventoAgendavel(
        eventoId: item.id,
        tipo: TipoEvento.prova,
        titulo: '',
        data: '',
        materiaSigla: '',
        hora: item.hora,
        visivelTurma: item.visivelTurma,
        excluidoEm: item.excluidoEm,
      );
    }
    return EventoAgendavel(
      eventoId: item.id,
      tipo: tipo,
      titulo: titulo,
      data: data,
      materiaSigla: sigla,
      hora: item.hora,
      visivelTurma: item.visivelTurma,
      excluidoEm: item.excluidoEm,
    );
  }

  TipoEvento? _tipo(String? wire) {
    for (final t in TipoEvento.values) {
      if (t.wire == wire) return t;
    }
    return null;
  }
}
