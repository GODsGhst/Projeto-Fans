import '../core/api.dart';
import 'models.dart';

/// Materiais. Sem estado próprio.
///
/// Não existe listagem por matéria de propósito: material chega pela tela da matéria
/// (`MateriaRepository.detalhe`) ou pelos vínculos de um evento. Um `GET /materiais?materia=`
/// daria o caminho de despejar a matéria inteira na tela de uma prova.
///
/// `resumir` NÃO está aqui: o resumo por IA depende de decisão do dono (ver evento.json) e de
/// cabeçalho `X-IA-Key`, que o ApiClient ainda não aceita. Ver pendências.
class MaterialRepository {
  MaterialRepository({required this.api});

  final ApiClient api;

  /// Um material, para a tela de editar.
  Future<Material> detalhe(String materialId) async => Material.fromJson(
        await api.get<Map<String, dynamic>>('/materiais/$materialId'),
      );

  Future<Material> criar(CriarMaterialRequest req) async => Material.fromJson(
        await api.post<Map<String, dynamic>>(
          '/materiais',
          corpo: req.toJson(),
        ),
      );

  /// Só o autor. `version` no If-Match.
  Future<Material> atualizar(
    String materialId,
    int version,
    AtualizarMaterialRequest req,
  ) async =>
      Material.fromJson(
        await api.patch<Map<String, dynamic>>(
          '/materiais/$materialId',
          corpo: req.toJson(),
          version: version,
        ),
      );

  /// Resumo do material com a chave de IA da própria pessoa. Com resumo já gerado o servidor
  /// devolve o que tem; [refazer] pede um novo (e cobra de novo na conta dela).
  Future<Material> resumir(String materialId, String chave, {bool refazer = false}) async =>
      Material.fromJson(
        await api.post<Map<String, dynamic>>(
          '/materiais/$materialId/resumo${refazer ? '?refazer=true' : ''}',
          cabecalhos: {'X-IA-Key': chave},
        ),
      );

  Future<void> excluir(String materialId, int version) =>
      api.delete<void>('/materiais/$materialId', version: version);
}
