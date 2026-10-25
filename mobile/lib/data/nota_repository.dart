import 'package:flutter/foundation.dart';

import '../core/api.dart';
import '../core/erro_api.dart';
import 'models.dart';

/// Anotações do período.
///
/// Não existe `GET /notas/{id}`, e a ausência é a regra do servidor: com ele, adivinhar um UUID
/// seria o caminho de ler o rascunho pessoal de outra pessoa. A leitura é sempre por janela de
/// dias. O repositório é compartilhado entre o Calendário e a tela de escrever.
class NotaRepository {
  NotaRepository({required this.api});

  final ApiClient api;

  final ValueNotifier<List<Nota>> notas = ValueNotifier<List<Nota>>(const []);
  final ValueNotifier<bool> carregando = ValueNotifier<bool>(false);
  final ValueNotifier<String?> erro = ValueNotifier<String?>(null);

  /// `GET /notas?de=&ate=`. Falha guarda a mensagem e MANTÉM a lista: não relança.
  Future<void> carregar(String de, String ate) async {
    carregando.value = true;
    erro.value = null;
    try {
      final bruto = await api.get<List<dynamic>>(
        '/notas',
        params: {'de': de, 'ate': ate},
      );
      notas.value = [
        for (final e in bruto) Nota.fromJson(e as Map<String, dynamic>),
      ];
    } catch (e) {
      erro.value = e is ErroApi ? e.message : 'Não deu para carregar as anotações.';
    } finally {
      carregando.value = false;
    }
  }

  /// Não atualiza a lista `notas`: quem chama decide o que fazer com o retorno.
  Future<Nota> criar(SalvarNota req) async => Nota.fromJson(
        await api.post<Map<String, dynamic>>('/notas', corpo: req.toJson()),
      );

  /// Só o autor. `version` no If-Match. PATCH substitui o objeto inteiro.
  Future<Nota> atualizar(String id, int version, SalvarNota req) async =>
      Nota.fromJson(
        await api.patch<Map<String, dynamic>>(
          '/notas/$id',
          corpo: req.toJson(),
          version: version,
        ),
      );

  Future<void> excluir(String id, int version) =>
      api.delete<void>('/notas/$id', version: version);

  void dispose() {
    notas.dispose();
    carregando.dispose();
    erro.dispose();
  }
}
