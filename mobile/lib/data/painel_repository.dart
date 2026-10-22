import 'package:flutter/foundation.dart';

import '../core/api.dart';
import '../core/erro_api.dart';
import 'models.dart';

/// `GET /painel`. Mesma regra da Home: NÃO reordena, NÃO filtra, NÃO corta. A janela, o teto e
/// o filtro de matéria são do servidor.
///
/// Sem snapshot offline de propósito: o snapshot guarda UMA turma, e o painel mistura todas.
/// Falhou, o painel diz que falhou. Nunca "não há nada".
class PainelRepository {
  PainelRepository({required this.api});

  final ApiClient api;

  /// null = ainda não chegou. Diferente de `turmas: []`, que é "não há turma".
  final ValueNotifier<Painel?> painel = ValueNotifier<Painel?>(null);
  final ValueNotifier<bool> carregando = ValueNotifier<bool>(false);
  final ValueNotifier<String?> erro = ValueNotifier<String?>(null);

  /// Nunca lança. Falha guarda a mensagem e o painel anterior fica na tela.
  Future<void> carregar() async {
    carregando.value = true;
    erro.value = null;
    try {
      painel.value = Painel.fromJson(
        await api.get<Map<String, dynamic>>('/painel'),
      );
    } catch (e) {
      erro.value = e is ErroApi ? e.message : 'Não deu para carregar.';
    } finally {
      carregando.value = false;
    }
  }

  void dispose() {
    painel.dispose();
    carregando.dispose();
    erro.dispose();
  }
}
