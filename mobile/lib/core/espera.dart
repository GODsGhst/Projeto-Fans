import 'dart:async';

import 'package:flutter/foundation.dart';

/// Depois de quanto tempo a espera deixa de parecer normal e passa a parecer travamento.
const Duration avisaApos = Duration(seconds: 4);

/// Marca a passagem do tempo numa espera (login, cadastro, redefinir). Quem decide o
/// texto é a tela: "Acordando o servidor…" quando [demorando] vira true.
class Espera {
  /// true quando a espera já passou do ponto em que parece travamento.
  final ValueNotifier<bool> demorando = ValueNotifier<bool>(false);

  Timer? _temporizador;

  /// Reinicia a contagem: nunca soma timers.
  void comecar({Duration apos = avisaApos}) {
    terminar();
    _temporizador = Timer(apos, () {
      _temporizador = null;
      demorando.value = true;
    });
  }

  /// Chamado no finally de quem espera, inclusive no erro. Cancela o timer e apaga o aviso.
  void terminar() {
    _temporizador?.cancel();
    _temporizador = null;
    demorando.value = false;
  }

  void dispose() {
    terminar();
    demorando.dispose();
  }
}
