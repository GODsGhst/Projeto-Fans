import 'dart:async';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

/// Vale para todo arquivo de teste: cada teste começa com o cofre falso e vazio.
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  await testMain();
}
