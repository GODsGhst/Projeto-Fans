import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';

import '../core/api.dart';
import '../core/erro_api.dart';
import 'models.dart';
import 'moderacao_repository.dart';

/// Meu quadro e Não listados.
///
/// `feito` é estado pessoal: vive em `estado_pessoal`, nunca no fato compartilhado. Marcar feito
/// não altera o evento da turma. Por isso a chamada é `PUT /eventos/{id}/estado-pessoal`.
///
/// Os dois erros são SEPARADOS de propósito. Falhar em "não listados", seção que quase ninguém vê,
/// não pode derrubar o quadro inteiro.
class QuadroRepository {
  QuadroRepository({
    required this.api,
    required this.moderacao,
  });

  final ApiClient api;
  final ModeracaoRepository moderacao;

  final ValueNotifier<List<ItemHome>> aFazer =
      ValueNotifier<List<ItemHome>>(const []);
  final ValueNotifier<List<ItemHome>> feito =
      ValueNotifier<List<ItemHome>>(const []);

  /// Ocultos ou excluídos DO PRÓPRIO autor. Vazio para quase todo mundo.
  final ValueNotifier<NaoListados?> naoListados =
      ValueNotifier<NaoListados?>(null);
  final ValueNotifier<bool> carregando = ValueNotifier<bool>(false);
  final ValueNotifier<String?> erro = ValueNotifier<String?>(null);
  final ValueNotifier<String?> erroNaoListados = ValueNotifier<String?>(null);

  /// Pedidos do líder para eu apagar algo meu. Vazio para quase todo mundo.
  final ValueNotifier<List<PedidoDeExclusao>> pedidos =
      ValueNotifier<List<PedidoDeExclusao>>(const []);

  /// Não relança: ler o `erro` é o tratamento. As listas ficam como estavam.
  Future<void> carregar() async {
    carregando.value = true;
    erro.value = null;
    try {
      final quadro = MeuQuadro.fromJson(
        await api.get<Map<String, dynamic>>('/meu-quadro'),
      );
      aFazer.value = quadro.aFazer;
      feito.value = quadro.feito;
    } catch (e) {
      erro.value = e is ErroApi ? e.message : 'Não deu para carregar o quadro.';
    } finally {
      carregando.value = false;
    }
  }

  /// Falha não vira aviso: pedido é raro, e um erro sobre algo que quase nunca existe assusta
  /// mais do que informa. A lista anterior fica como está.
  Future<void> carregarPedidos() async {
    try {
      pedidos.value = await moderacao.meusPedidos();
    } catch (e, s) {
      developer.log(
        '[quadro] pedidos de exclusão não carregados',
        name: 'quadro',
        error: e,
        stackTrace: s,
        level: 900,
      );
    }
  }

  Future<void> carregarNaoListados() async {
    erroNaoListados.value = null;
    try {
      naoListados.value = NaoListados.fromJson(
        await api.get<Map<String, dynamic>>('/nao-listados'),
      );
    } catch (e) {
      erroNaoListados.value =
          e is ErroApi ? e.message : 'Não deu para carregar os não listados.';
    }
  }

  /// Marca e relê o quadro: o servidor é quem diz em qual coluna o item cai.
  /// Se o PUT falhar, lança e não recarrega.
  Future<void> marcar(String eventoId, bool marcado) async {
    await api.put<void>(
      '/eventos/$eventoId/estado-pessoal',
      corpo: EstadoPessoalRequest(feito: marcado).toJson(),
    );
    await carregar();
  }

  void dispose() {
    aFazer.dispose();
    feito.dispose();
    naoListados.dispose();
    carregando.dispose();
    erro.dispose();
    erroNaoListados.dispose();
    pedidos.dispose();
  }
}
