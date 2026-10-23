import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

// Por que este teste existe: a permissão de Internet já esteve só no manifest de debug. Um APK de
// release sem ela compila, passa em todo teste Dart e não fala com a API. Lemos o XML como texto,
// que é o que o build empacota; é aqui que essa regressão aparece.
void main() {
  final manifestoMain = File('android/app/src/main/AndroidManifest.xml')
      .readAsStringSync();
  final manifestoDebug = File('android/app/src/debug/AndroidManifest.xml')
      .readAsStringSync();

  group('AndroidManifest', () {
    test('main (release) tem permissão de Internet', () {
      expect(manifestoMain, contains('android.permission.INTERNET'));
    });

    test('main (release) tem backup do app desligado', () {
      expect(manifestoMain, contains('android:allowBackup="false"'));
    });

    test('main (release) não libera HTTP em claro', () {
      expect(manifestoMain, isNot(contains('usesCleartextTraffic')));
    });

    test('debug libera HTTP em claro para o backend local', () {
      expect(manifestoDebug, contains('android:usesCleartextTraffic="true"'));
    });
  });
}
