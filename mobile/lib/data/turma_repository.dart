import 'package:flutter/foundation.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/erro_api.dart';
import 'models.dart';

/// A turma e quem sou eu dentro dela. Ponto ÚNICO de `GET /turmas/minha`: as outras áreas
/// leem `souLider`, `alcanca` e `seloNa` daqui.
///
/// O papel é LIDO da turma, nunca guardado na sessão: a liderança se transfere, e uma sessão
/// antiga mostraria botões de líder para quem já não é.
class TurmaRepository {
  TurmaRepository({required this.api, required this.auth}) {
    auth.addListener(_aoMudarSessao);
    _aoMudarSessao();
  }

  final ApiClient api;
  final AuthService auth;

  final ValueNotifier<MinhaTurma?> turma = ValueNotifier<MinhaTurma?>(null);
  final ValueNotifier<bool> carregando = ValueNotifier<bool>(false);
  final ValueNotifier<String?> erro = ValueNotifier<String?>(null);

  /// Sem usuário ou sem turma na sessão, esquece a turma. O repositório vive até fechar o app,
  /// mas a sessão não.
  void _aoMudarSessao() {
    if (auth.usuario == null || auth.turmaId == null) limpar();
  }

  void dispose() {
    auth.removeListener(_aoMudarSessao);
    turma.dispose();
    carregando.dispose();
    erro.dispose();
  }

  /// `false` enquanto não se sabe. Na dúvida, não oferecer é melhor que oferecer e falhar.
  bool get souLider {
    final eu = auth.usuario;
    final t = turma.value;
    if (eu == null || t == null) return false;
    return t.membros.any(
      (m) => m.usuarioId == eu.id && m.papel == PapelMembro.lider,
    );
  }

  /// Esta pessoa pode corrigir e ocultar o registro dessa matéria (`null` = nota, que não tem
  /// matéria)? Só esconde botão. Quem decide é o servidor.
  bool alcanca(String? materiaId) {
    final alcance = turma.value?.meuAlcance;
    if (alcance == null) return false;
    switch (alcance.tipo) {
      case TipoAlcance.turma:
        return true;
      case TipoAlcance.materias:
        return materiaId != null && alcance.materiaIds.contains(materiaId);
      case TipoAlcance.nenhum:
        return false;
    }
  }

  /// O selo que o registro vai levar se esta pessoa o postar ou corrigir. Serve para AVISAR
  /// antes de salvar. O selo de verdade é carimbado pelo servidor.
  Selo? seloNa(String? materiaId) {
    if (!alcanca(materiaId)) return null;
    return turma.value?.meuAlcance?.tipo == TipoAlcance.turma
        ? Selo.coordenacao
        : Selo.professor;
  }

  /// O vínculo desta pessoa NESTA turma, ou `null` enquanto não se sabe.
  MembroDaTurma? get meuMembro {
    final eu = auth.usuario;
    final t = turma.value;
    if (eu == null || t == null) return null;
    for (final m in t.membros) {
      if (m.usuarioId == eu.id) return m;
    }
    return null;
  }

  /// Substitui o conjunto de matérias que o professor leciona. Relê em seguida, porque o selo e
  /// o alcance dependem do que ficou gravado. Lança se o PUT falhar.
  Future<void> declararLecionadas(List<String> materiaIds) async {
    await api.put<void>(
      '/turmas/minha/lecionadas',
      corpo: LecionadasRequest(materiaIds: materiaIds).toJson(),
    );
    await carregar();
  }

  /// O líder contesta a declaração de um docente. A marca entra na lista ANTES da releitura: o
  /// POST já deu certo, e é isso que a tela mostra mesmo se `carregar` falhar.
  Future<void> contestar(String usuarioId) async {
    await api.post<void>('/turmas/minha/docentes/$usuarioId/contestar');
    _marcarContestado(usuarioId, true);
    await carregar();
  }

  Future<void> restaurar(String usuarioId) async {
    await api.post<void>('/turmas/minha/docentes/$usuarioId/restaurar');
    _marcarContestado(usuarioId, false);
    await carregar();
  }

  /// Renomear a turma e acertar o período. Só o líder. O código de convite NÃO muda.
  Future<void> renomear(String nome, String? semestre) async {
    turma.value = MinhaTurma.fromJson(
      await api.patch<Map<String, dynamic>>(
        '/turmas/minha',
        corpo: AtualizarTurmaRequest(nome: nome, semestre: semestre).toJson(),
      ),
    );
  }

  /// Remove um membro. Só o líder. O membro sai da lista antes da releitura, pelo mesmo motivo
  /// de `contestar`.
  Future<void> removerMembro(String usuarioId) async {
    await api.delete<void>('/turmas/minha/membros/$usuarioId');
    final t = turma.value;
    if (t != null) {
      turma.value = _comMembros(t, [
        for (final m in t.membros)
          if (m.usuarioId != usuarioId) m,
      ]);
    }
    await carregar();
  }

  /// Troca o código de convite. A resposta é a turma inteira e substitui a que está em tela.
  Future<void> gerarNovoCodigo() async {
    turma.value = MinhaTurma.fromJson(
      await api.post<Map<String, dynamic>>('/turmas/minha/codigo'),
    );
  }

  /// Nunca lança. SEM_TURMA esquece a turma sem aviso. Falha guarda a mensagem e mantém a turma
  /// antiga, porque "não consegui atualizar" não é "a turma sumiu".
  Future<void> carregar() async {
    carregando.value = true;
    erro.value = null;
    try {
      turma.value = MinhaTurma.fromJson(
        await api.get<Map<String, dynamic>>('/turmas/minha'),
      );
    } catch (e) {
      if (e is ErroApi && e.codigo == codigoSemTurma) {
        limpar();
        return;
      }
      erro.value = e is ErroApi ? e.message : 'Não deu para carregar a turma.';
    } finally {
      carregando.value = false;
    }
  }

  /// Esquece a turma e o aviso de erro. A próxima tela que precisar busca de novo.
  void limpar() {
    turma.value = null;
    erro.value = null;
  }

  /// Carrega só se ainda não houver nada. Para quem precisa do papel, não da tela.
  Future<void> garantirCarregada() async {
    if (turma.value == null && !carregando.value) await carregar();
  }

  void _marcarContestado(String usuarioId, bool contestado) {
    final t = turma.value;
    if (t == null) return;
    turma.value = _comMembros(t, [
      for (final m in t.membros)
        if (m.usuarioId == usuarioId)
          MembroDaTurma(
            usuarioId: m.usuarioId,
            nome: m.nome,
            papel: m.papel,
            entrouEm: m.entrouEm,
            // Contestado não tem selo. Restaurado só volta a ter com a releitura.
            selo: contestado ? null : m.selo,
            contestado: contestado,
            lecionadas: m.lecionadas,
          )
        else
          m,
    ]);
  }

  MinhaTurma _comMembros(MinhaTurma t, List<MembroDaTurma> membros) =>
      MinhaTurma(
        id: t.id,
        nome: t.nome,
        semestre: t.semestre,
        codigoConvite: t.codigoConvite,
        membros: membros,
        meuAlcance: t.meuAlcance,
      );
}
