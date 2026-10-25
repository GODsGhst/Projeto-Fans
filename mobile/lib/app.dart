import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'core/servicos.dart';
import 'shared/tema.dart';

/// Raiz do app. Entrega [Servicos] à árvore e monta o MaterialApp com o roteador e os dois temas
/// (claro e escuro, pelo sistema).
class PfApp extends StatefulWidget {
  const PfApp({super.key, required this.servicos, required this.roteador});

  final Servicos servicos;
  final GoRouter roteador;

  @override
  State<PfApp> createState() => _PfAppState();
}

class _PfAppState extends State<PfApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// Ao voltar do fundo, reagenda os lembretes (o resume do AppComponent do Ionic). Sem forçar e
  /// sem esperar: a janela de 60 s do SyncRepository decide, e reagendarAvisos nunca lança.
  @override
  void didChangeAppLifecycleState(AppLifecycleState estado) {
    if (estado != AppLifecycleState.resumed) return;
    final s = widget.servicos;
    if (!s.auth.temTurma) return;
    unawaited(s.sync.reagendarAvisos());
  }

  @override
  Widget build(BuildContext context) {
    return ServicosScope(
      servicos: widget.servicos,
      child: MaterialApp.router(
        title: 'projetoFans',
        debugShowCheckedModeBanner: false,
        theme: PfTema.claro(),
        darkTheme: PfTema.escuro(),
        themeMode: ThemeMode.system,
        routerConfig: widget.roteador,
      ),
    );
  }
}
