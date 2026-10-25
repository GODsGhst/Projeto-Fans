import '../core/api.dart';
import 'models.dart';

/// Aprovar, recusar e vincular conta docente. Só o admin da plataforma: para os outros o
/// servidor responde 404. Todos os métodos relançam `ErroApi`. Sem estado.
///
/// `recusar` serve também para revogar: não existe rota de revogação. O efeito é imediato,
/// porque o status é lido do banco a cada requisição.
class DocenteAdminRepository {
  DocenteAdminRepository({required this.api});

  final ApiClient api;

  Future<List<DocenteAdmin>> listar(DocenteStatus status) async {
    final bruto = await api.get<List<dynamic>>(
      '/admin/docentes',
      params: {'status': status.wire},
    );
    return [
      for (final e in bruto) DocenteAdmin.fromJson(e as Map<String, dynamic>),
    ];
  }

  Future<void> aprovar(String usuarioId) =>
      api.post<void>('/admin/docentes/$usuarioId/aprovar');

  Future<void> recusar(String usuarioId) =>
      api.post<void>('/admin/docentes/$usuarioId/recusar');

  /// Turmas que batem com o texto (nome ou código). O servidor exige 2+ letras.
  Future<List<TurmaAdmin>> buscarTurmas(String busca) async {
    final bruto = await api.get<List<dynamic>>(
      '/admin/turmas',
      params: {'busca': busca},
    );
    return [
      for (final e in bruto) TurmaAdmin.fromJson(e as Map<String, dynamic>),
    ];
  }

  /// Em que turmas esta conta já tem vínculo, e o que ela leciona em cada uma.
  Future<List<VinculoAdmin>> vinculos(String usuarioId) async {
    final bruto = await api.get<List<dynamic>>(
      '/admin/docentes/$usuarioId/turmas',
    );
    return [
      for (final e in bruto) VinculoAdmin.fromJson(e as Map<String, dynamic>),
    ];
  }

  /// Cria o vínculo se não existir e SUBSTITUI as matérias lecionadas nesta turma.
  /// Lista vazia quer dizer nenhuma.
  Future<VinculoAdmin> vincular(
    String usuarioId,
    String turmaId,
    List<String> materiaIds,
  ) async =>
      VinculoAdmin.fromJson(
        await api.put<Map<String, dynamic>>(
          '/admin/docentes/$usuarioId/turmas/$turmaId',
          corpo: LecionadasRequest(materiaIds: materiaIds).toJson(),
        ),
      );

  /// Tira a conta desta turma e apaga as matérias que ela marcou lá. A contestação do líder
  /// não é apagada.
  Future<void> desvincular(String usuarioId, String turmaId) =>
      api.delete<void>('/admin/docentes/$usuarioId/turmas/$turmaId');
}
