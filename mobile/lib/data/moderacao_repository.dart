import '../core/api.dart';
import 'models.dart';
import 'turma_repository.dart';

/// Os poderes do líder e a transferência do cargo. Sem estado próprio.
///
/// **Ocultar não apaga.** O registro continua no banco, com autoria, e volta em "não listados"
/// para quem o criou. `reexibir` desfaz.
///
/// **`pedirExclusao` não exclui.** Ele avisa o autor. Quem apaga é sempre quem criou.
class ModeracaoRepository {
  ModeracaoRepository({
    required this.api,
    required this.turmas,
  });

  final ApiClient api;
  final TurmaRepository turmas;

  /// Pedidos de exclusão sobre o que EU criei.
  Future<List<PedidoDeExclusao>> meusPedidos() async {
    final bruto = await api.get<List<dynamic>>('/moderacao/pedidos');
    return [
      for (final e in bruto)
        PedidoDeExclusao.fromJson(e as Map<String, dynamic>),
    ];
  }

  /// Tira da lista da turma. O autor continua vendo em "não listados".
  Future<void> ocultar(RegistroTipo tipo, String id, String? motivo) =>
      api.post<void>(
        '/moderacao/${tipo.rota}/$id/ocultar',
        corpo: {'motivo': motivo},
      );

  Future<void> reexibir(RegistroTipo tipo, String id) =>
      api.post<void>('/moderacao/${tipo.rota}/$id/reexibir');

  /// Tudo que o líder tirou da lista e ainda está oculto. É o "desfazer" que não expira.
  Future<List<Ocultado>> ocultados() async {
    final bruto = await api.get<List<dynamic>>('/moderacao/ocultados');
    return [
      for (final e in bruto) Ocultado.fromJson(e as Map<String, dynamic>),
    ];
  }

  /// Avisa o autor. Não apaga.
  Future<void> pedirExclusao(RegistroTipo tipo, String id, String? motivo) =>
      api.post<void>(
        '/moderacao/${tipo.rota}/$id/pedir-exclusao',
        corpo: {'motivo': motivo},
      );

  /// Passa a liderança e relê a turma, para que o papel mostrado mude na hora.
  ///
  /// Se a releitura falhar, esquece a turma: o dado velho é justamente o que acabou de deixar
  /// de valer, e não deve ficar na tela.
  Future<void> transferirLideranca(String novoLiderUsuarioId) async {
    await api.post<void>(
      '/turmas/lideranca/transferir',
      corpo: TransferirLiderancaRequest(
        novoLiderUsuarioId: novoLiderUsuarioId,
      ).toJson(),
    );
    await turmas.carregar();
    if (turmas.erro.value != null) turmas.limpar();
  }
}
