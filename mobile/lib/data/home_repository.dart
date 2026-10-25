import 'dart:async';
import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';

import '../core/api.dart';
import '../core/armazenamento.dart';
import '../core/erro_api.dart';
import 'models.dart';
import 'sync_repository.dart';

/// `GET /home`. NÃO reordena, NÃO filtra, NÃO corta: a ordem, a janela de 14 dias e o teto de
/// 6 são do servidor. Replicar qualquer um deles aqui é a violação mais provável desta camada.
class HomeRepository {
  HomeRepository({
    required this.api,
    required this.armazenamento,
    required this.sync,
  });

  final ApiClient api;
  final Armazenamento armazenamento;
  final SyncRepository sync;

  final ValueNotifier<List<ItemHome>> itens =
      ValueNotifier<List<ItemHome>>(const []);
  final ValueNotifier<bool> carregando = ValueNotifier<bool>(false);
  final ValueNotifier<String?> erro = ValueNotifier<String?>(null);

  /// Ligado quando a lista exibida veio do snapshot, não do servidor.
  final ValueNotifier<bool> offline = ValueNotifier<bool>(false);

  /// Hora do snapshot em uso. A tela mostra "dados de HH:MM", nunca dado velho mudo.
  final ValueNotifier<String?> ultimoSync = ValueNotifier<String?>(null);

  /// Se o servidor já respondeu nesta carga. Corrida com `_aquecerDoDisco`.
  bool _servidorRespondeu = false;

  Future<void> carregar() async {
    carregando.value = true;
    erro.value = null;
    _servidorRespondeu = false;
    // A chamada sai PRIMEIRO e o disco é lido em paralelo: o objetivo é encurtar a espera.
    final doServidorEmVoo = api.get<List<dynamic>>('/home');
    _emSegundoPlano(_aquecerDoDisco());
    // Lembretes saem do /sync, não desta lista. Sem `await`: a tela não espera a turma inteira.
    unawaited(sync.reagendarAvisos());
    try {
      final bruto = await doServidorEmVoo;
      final doServidor = [
        for (final e in bruto) ItemHome.fromJson(e as Map<String, dynamic>),
      ];
      _servidorRespondeu = true;
      itens.value = doServidor;
      offline.value = false;
      ultimoSync.value = null;
      await armazenamento.mesclarSnapshot(eventos: doServidor);
    } catch (e) {
      await _degradar(e);
    } finally {
      carregando.value = false;
    }
  }

  /// Põe na tela o que já está no aparelho, ANTES de perguntar ao servidor. Só quando não há
  /// nada em tela e o servidor ainda não respondeu. Não toca em `erro` nem em `offline`.
  Future<void> _aquecerDoDisco() async {
    if (itens.value.isNotEmpty) return;
    final snapshot = await armazenamento.lerSnapshot();
    if (_servidorRespondeu || snapshot == null || snapshot.eventos.isEmpty) {
      return;
    }
    itens.value = snapshot.eventos;
    ultimoSync.value = snapshot.ultimoSync;
  }

  /// Falhou. A única coisa proibida aqui é ficar em silêncio com a lista vazia: "não há
  /// provas" e "falhei ao buscar as provas" não podem se parecer.
  Future<void> _degradar(Object e) async {
    final falha = e is ErroApi ? e : null;

    if (falha?.codigo == codigoSemTurma) {
      // Quem o líder removeu: o ApiClient já esqueceu o vínculo. Sem aviso.
      _servidorRespondeu = true;
      itens.value = const [];
      offline.value = false;
      ultimoSync.value = null;
      return;
    }

    erro.value = falha?.message ?? 'Não deu para carregar.';

    if (falha?.classe != ClasseErro.offline) {
      offline.value = false;
      return;
    }

    offline.value = true;
    final snapshot = await armazenamento.lerSnapshot();
    if (snapshot != null) {
      itens.value = snapshot.eventos;
      ultimoSync.value = snapshot.ultimoSync;
    } else {
      ultimoSync.value = null;
    }
  }

  /// Trabalho de fundo que não pode derrubar a carga: falha vai para o log.
  void _emSegundoPlano(Future<void> trabalho) {
    unawaited(
      trabalho.catchError((Object e, StackTrace s) {
        developer.log(
          '[home] falha ao ler o disco',
          name: 'home',
          error: e,
          stackTrace: s,
          level: 1000,
        );
      }),
    );
  }

  void dispose() {
    itens.dispose();
    carregando.dispose();
    erro.dispose();
    offline.dispose();
    ultimoSync.dispose();
  }
}
