import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';

import '../data/models.dart';
import 'armazenamento.dart';
import 'auth.dart';

/// Turma ativa do DOCENTE. É o que vai em X-Turma-Id. Aluno nunca passa por aqui.
///
/// A turma só vale se o dono gravado for o usuário logado. Assim, outro docente no mesmo
/// aparelho não herda o id.
///
/// Trocar de turma recarrega o estado em memória (recarregarApp): dado de uma turma nunca
/// pode aparecer sob o nome de outra.
class TurmaAtivaService extends ChangeNotifier {
  TurmaAtivaService({
    required this.auth,
    required this.armazenamento,
    required this.recarregarApp,
  }) {
    pronto = _lerDoDisco();
  }

  final AuthService auth;
  final Armazenamento armazenamento;

  /// Reinicia o estado em memória de todos os serviços com dado de turma.
  final void Function() recarregarApp;

  /// Leitura do disco, iniciada na construção. Quem precisa do valor certo espera esta
  /// future antes de mandar X-Turma-Id. Nunca rejeita.
  late final Future<void> pronto;

  TurmaAtiva? _ativa;

  String? get turmaId => _daSessao()?.turmaId;
  String? get nome => _daSessao()?.nome;

  /// Docente escolheu uma turma. Igual à atual: nada acontece. Primeira escolha: sem recarga.
  Future<void> escolher(TurmaRef turma) async {
    await pronto;
    if (turmaId == turma.turmaId) return;
    final havia = turmaId != null;
    await _gravar(turma);
    if (havia) recarregarApp();
  }

  /// O painel chegou: confere a turma ativa contra as que a pessoa tem. Não recarrega.
  /// Só chamar com painel que chegou. Falha de rede não é "zero turmas".
  Future<void> conciliar(List<TurmaRef> turmas) async {
    await pronto;
    final atual = turmaId;
    TurmaRef? nova;
    for (final t in turmas) {
      if (t.turmaId == atual) {
        nova = t;
        break;
      }
    }
    nova ??= turmas.isEmpty ? null : turmas.first;
    if (nova == null) {
      _ativa = null;
      notifyListeners();
      await _apagarDoDisco();
    } else if (nova.turmaId != atual || nova.nome != nome) {
      await _gravar(nova);
    }
  }

  TurmaAtiva? _daSessao() {
    final ativa = _ativa;
    return ativa != null && ativa.usuarioId == auth.usuario?.id ? ativa : null;
  }

  /// Ordem fixa: memória, depois snapshot (só na troca de verdade), depois disco.
  Future<void> _gravar(TurmaRef turma) async {
    final usuarioId = auth.usuario?.id;
    if (usuarioId == null) return;
    final trocou = turmaId != turma.turmaId;
    final ativa = TurmaAtiva(
      usuarioId: usuarioId,
      turmaId: turma.turmaId,
      nome: turma.nome,
    );
    _ativa = ativa;
    notifyListeners();
    if (trocou) {
      try {
        await armazenamento.limparSnapshot();
      } catch (e, s) {
        _logar('falha ao apagar o snapshot da turma antiga', e, s);
      }
    }
    try {
      await armazenamento.gravarTurmaAtiva(ativa);
    } catch (e, s) {
      _logar('falha ao gravar a turma ativa', e, s);
    }
  }

  Future<void> _lerDoDisco() async {
    try {
      final lida = await armazenamento.lerTurmaAtiva();
      if (lida != null) {
        _ativa = lida;
        notifyListeners();
      }
    } catch (e, s) {
      _logar('falha ao ler a turma ativa', e, s);
    }
  }

  Future<void> _apagarDoDisco() async {
    try {
      await armazenamento.removerTurmaAtiva();
    } catch (e, s) {
      _logar('falha ao apagar a turma ativa', e, s);
    }
  }

  void _logar(String mensagem, Object e, StackTrace s) {
    developer.log(
      '[turma-ativa] $mensagem',
      name: 'turma-ativa',
      error: e,
      stackTrace: s,
      level: 1000,
    );
  }
}
