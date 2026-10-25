import 'dart:async';

import 'package:flutter/foundation.dart';

/// Quanto tempo o "Desfazer" fica na tela depois de uma ação reversível.
const janelaDesfazerPadrao = Duration(milliseconds: 8000);

/// Janela de "Desfazer" que abre por um tempo e fecha sozinha. Port de core/janela-desfazer.ts.
///
/// Abrir de novo reinicia o relógio. Quem cria chama [dispose] — o equivalente ao DestroyRef do
/// Angular —, senão o timer dispara num notifier já descartado.
class JanelaDesfazer {
  JanelaDesfazer({this.duracao = janelaDesfazerPadrao});

  final Duration duracao;
  final ValueNotifier<bool> aberta = ValueNotifier<bool>(false);
  Timer? _temporizador;

  void abrir() {
    fechar();
    aberta.value = true;
    _temporizador = Timer(duracao, fechar);
  }

  void fechar() {
    _temporizador?.cancel();
    _temporizador = null;
    aberta.value = false;
  }

  void dispose() {
    _temporizador?.cancel();
    aberta.dispose();
  }
}
