import 'dart:developer' as developer;

import 'package:flutter/widgets.dart';

import 'app.dart';
import 'core/armazenamento.dart';
import 'core/rotas.dart';
import 'core/servicos.dart';
import 'notifications/notificacoes.dart';

/// Boot: monta os serviços, lê a sessão do disco antes de qualquer tela, acorda o servidor sem
/// esperar e espera a turma ativa. Depois disso, o app abre.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final armazenamento = await Armazenamento.abrir();
  // Os lembretes sobem sob demanda: o plugin só se inicializa na primeira agenda, e só no Android.
  final servicos = Servicos.montar(
    armazenamento: armazenamento,
    plugin: criarPluginNotificacoes(),
  );

  try {
    await servicos.auth.restaurar();
  } catch (e, s) {
    // Falha de plataforma ao ler a sessão (JSON inválido o Armazenamento já trata). Segue sem
    // sessão: o app abre na entrada, e não em branco.
    developer.log(
      '[boot] não li a sessão do disco; sigo sem ela',
      name: 'boot',
      error: e,
      stackTrace: s,
      level: 1000,
    );
  }

  // Só acorda o servidor gratuito. Sem await e sem tratar erro, de propósito.
  servicos.api.acordarServidor();
  await servicos.turmaAtiva.pronto;

  runApp(PfApp(servicos: servicos, roteador: criarRoteador(servicos)));
}
