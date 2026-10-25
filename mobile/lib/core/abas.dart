import 'package:flutter/foundation.dart';

/// Índice da aba visível (0 a 4). Cada página de aba escuta isto e recarrega quando a
/// própria aba fica visível.
class Abas extends ValueNotifier<int> {
  Abas({int inicial = 0}) : super(inicial);

  /// Troca a aba visível. Mesmo índice não notifica.
  void mostrar(int indice) {
    value = indice;
  }
}
