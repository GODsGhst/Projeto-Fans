import 'package:flutter/foundation.dart';

import '../core/api.dart';
import '../core/erro_api.dart';
import 'models.dart';

/// Eventos: o Calendário e a tela de um evento.
///
/// A janela do Calendário vem da tela (`de`/`ate`), e quem decide o que é visível é o servidor.
/// Nada aqui reordena ou filtra o que voltou.
class EventoRepository {
  EventoRepository({required this.api});

  final ApiClient api;

  final ValueNotifier<List<Evento>> eventos =
      ValueNotifier<List<Evento>>(const []);
  final ValueNotifier<bool> carregando = ValueNotifier<bool>(false);
  final ValueNotifier<String?> erro = ValueNotifier<String?>(null);

  /// `GET /eventos?de=&ate=`, datas `AAAA-MM-DD`. Falha guarda a mensagem, mantém a lista e
  /// relança: nunca esvazia a lista por falha.
  Future<void> carregarPeriodo(String de, String ate) async {
    carregando.value = true;
    erro.value = null;
    try {
      final bruto = await api.get<List<dynamic>>(
        '/eventos',
        params: {'de': de, 'ate': ate},
      );
      eventos.value = [
        for (final e in bruto) Evento.fromJson(e as Map<String, dynamic>),
      ];
    } catch (e) {
      erro.value = e is ErroApi ? e.message : 'Não deu para carregar.';
      rethrow;
    } finally {
      carregando.value = false;
    }
  }

  /// Traz SOMENTE os materiais vinculados a este evento, nunca a matéria inteira.
  Future<EventoDetalhe> detalhe(String eventoId) async => EventoDetalhe.fromJson(
        await api.get<Map<String, dynamic>>('/eventos/$eventoId'),
      );

  /// Qualquer membro cria, sem aprovação e sem fila.
  Future<Evento> criar(CriarEventoRequest req) async => Evento.fromJson(
        await api.post<Map<String, dynamic>>(
          '/eventos',
          corpo: req.toJson(),
        ),
      );

  /// Só o autor. `version` vai no If-Match: divergiu, 409.
  Future<Evento> atualizar(
    String eventoId,
    int version,
    AtualizarEventoRequest req,
  ) async =>
      Evento.fromJson(
        await api.patch<Map<String, dynamic>>(
          '/eventos/$eventoId',
          corpo: req.toJson(),
          version: version,
        ),
      );

  /// Exclusão lógica no servidor: a linha continua existindo em "Não listados".
  Future<void> excluir(String eventoId, int version) =>
      api.delete<void>('/eventos/$eventoId', version: version);

  Future<void> vincularMaterial(String eventoId, String materialId) =>
      api.post<void>('/eventos/$eventoId/materiais/$materialId');

  Future<void> desvincularMaterial(String eventoId, String materialId) =>
      api.delete<void>('/eventos/$eventoId/materiais/$materialId');

  void dispose() {
    eventos.dispose();
    carregando.dispose();
    erro.dispose();
  }
}
