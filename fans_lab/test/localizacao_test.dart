import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:fans_lab/app_deps.dart';
import 'package:fans_lab/main.dart' as fans;
import 'package:fans_lab/screens/login_page.dart';

void main() {
  testWidgets('seletor de data sai em português, pelo FansLabApp de verdade', (tester) async {
    // Sem sessão o app abre no login: não toca em banco nem em rede.
    await tester.pumpWidget(fans.FansLabApp(deps: AppDeps.padrao()));

    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(app.locale, fans.localeApp);
    expect(app.supportedLocales, fans.localesSuportados);
    expect(app.localizationsDelegates, fans.delegatesLocalizacao);

    showDatePicker(
      context: tester.element(find.byType(LoginPage)),
      initialDate: DateTime(2026, 10, 23),
      firstDate: DateTime(2026),
      lastDate: DateTime(2027),
    );
    await tester.pumpAndSettle();

    expect(find.text('Cancelar'), findsOneWidget);
    expect(find.text('Selecione a data'), findsOneWidget);
  });
}
