import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Notificação local: criada pelo próprio app, sem servidor. Uma instância para o
/// app inteiro, montada em [AppDeps].
///
/// Falha aqui nunca derruba a operação que pediu o aviso: notificação é extra, e a
/// tela também avisa dentro do app. Por isso os erros só vão para o log.
class NotificacaoService {
  NotificacaoService([FlutterLocalNotificationsPlugin? plugin])
      : _plugin = plugin ?? FlutterLocalNotificationsPlugin();

  final FlutterLocalNotificationsPlugin _plugin;
  bool _pronto = false;

  static const _detalhes = NotificationDetails(
    android: AndroidNotificationDetails(
      'envios', // id do canal: estável, o usuário controla o canal nas configurações do Android
      'Envios de arquivo',
      channelDescription: 'Avisa quando um arquivo termina de ser enviado',
      importance: Importance.high,
      priority: Priority.high,
    ),
    web: WebNotificationDetails(),
  );

  /// Chamado uma vez no main(). No navegador registra o service worker do plugin.
  Future<void> inicializar() async {
    try {
      _pronto = await _plugin.initialize(
            settings: const InitializationSettings(
              android: AndroidInitializationSettings('@mipmap/ic_launcher'),
              web: WebInitializationSettings(),
            ),
          ) ??
          false;
    } on Exception catch (e) {
      developer.log('notificações indisponíveis: $e', name: 'notificacao');
    }
  }

  /// Pede permissão no momento em que faz sentido (antes do primeiro envio), não na
  /// abertura do app. Negar não impede nada. No navegador, precisa vir de um toque.
  Future<void> pedirPermissao() async {
    if (!_pronto) return;
    try {
      if (kIsWeb) {
        await _plugin
            .resolvePlatformSpecificImplementation<WebFlutterLocalNotificationsPlugin>()
            ?.requestNotificationsPermission();
      } else {
        await _plugin
            .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
            ?.requestNotificationsPermission();
      }
    } on Exception catch (e) {
      developer.log('permissão de notificação: $e', name: 'notificacao');
    }
  }

  /// Mesmo id sempre: um aviso novo substitui o anterior em vez de empilhar.
  Future<void> avisar(String titulo, String corpo) async {
    if (!_pronto) return;
    try {
      await _plugin.show(id: 1, title: titulo, body: corpo, notificationDetails: _detalhes);
    } on Object catch (e) {
      // No navegador, sem permissão, o plugin lança StateError (um Error, não Exception).
      developer.log('aviso não mostrado: $e', name: 'notificacao');
    }
  }
}
