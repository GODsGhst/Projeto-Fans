import 'package:flutter/material.dart';

import 'package:fans_lab/app_deps.dart';
import 'package:fans_lab/database/app_database.dart';
import 'package:fans_lab/models/sessao.dart';
import 'package:fans_lab/screens/home_page.dart';
import 'package:fans_lab/screens/login_page.dart';
import 'package:fans_lab/widgets/cores.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final deps = AppDeps.padrao();
  final sessao = await deps.sessao.carregar();
  final tema = await deps.sessao.temaEscuro();
  deps.api.token = sessao?.jwt;
  runApp(FansLabApp(deps: deps, sessaoInicial: sessao, temaEscuro: tema));
}

class FansLabApp extends StatefulWidget {
  const FansLabApp({
    super.key,
    required this.deps,
    this.sessaoInicial,
    this.temaEscuro = false,
  });

  final AppDeps deps;
  final Sessao? sessaoInicial;
  final bool temaEscuro;

  @override
  State<FansLabApp> createState() => _FansLabAppState();
}

class _FansLabAppState extends State<FansLabApp> {
  Sessao? _sessao;
  bool _temaEscuro = false;

  @override
  void initState() {
    super.initState();
    _sessao = widget.sessaoInicial;
    _temaEscuro = widget.temaEscuro;
  }

  Future<void> _aoEntrar(Sessao s) async {
    widget.deps.api.token = s.jwt;
    await widget.deps.sessao.salvar(s);
    setState(() => _sessao = s);
  }

  Future<void> _aoSair() async {
    widget.deps.api.token = null;
    await widget.deps.sessao.limpar();
    // Apaga também rascunhos e marcações não enviadas: o aviso da tela de configurações diz isso.
    await AppDatabase.limparTudo(widget.deps.abrirDb);
    setState(() => _sessao = null);
  }

  Future<void> _aoMudarTema(bool v) async {
    await widget.deps.sessao.definirTemaEscuro(v);
    setState(() => _temaEscuro = v);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Fans Lab',
      debugShowCheckedModeBanner: false,
      theme: temaFans(Brightness.light),
      darkTheme: temaFans(Brightness.dark),
      themeMode: _temaEscuro ? ThemeMode.dark : ThemeMode.light,
      home: _sessao == null
          ? LoginPage(deps: widget.deps, aoEntrar: _aoEntrar)
          : HomePage(
              deps: widget.deps,
              aoSair: _aoSair,
              aoMudarTema: _aoMudarTema,
            ),
    );
  }
}
