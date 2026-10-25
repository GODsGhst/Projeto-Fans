import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'package:fans_lab/app_deps.dart';
import 'package:fans_lab/database/app_database.dart';
import 'package:fans_lab/models/sessao.dart';
import 'package:fans_lab/screens/entrar_turma_page.dart';
import 'package:fans_lab/screens/home_page.dart';
import 'package:fans_lab/screens/login_page.dart';
import 'package:fans_lab/widgets/cores.dart';

// Apresentação no Brasil: seletores de data/hora e textos padrão do Material saem em português.
// Públicas para o teste de localização usar estas mesmas; se saírem do MaterialApp, o teste quebra.
const localeApp = Locale('pt', 'BR');
const localesSuportados = [Locale('pt', 'BR')];
const delegatesLocalizacao = GlobalMaterialLocalizations.delegates;

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
    final anterior = await widget.deps.sessao.ultimoUsuarioId();
    // Rascunhos de outra conta nunca são enviados com a autoria de quem entrou agora (regra §6.1).
    // Sem dono gravado também limpa: falha fechado (numa instalação nova o banco já está vazio).
    if (anterior != s.usuario.id) {
      await AppDatabase.limparTudo(widget.deps.abrirDb);
    }
    widget.deps.api.token = s.jwt;
    await widget.deps.sessao.salvar(s);
    setState(() => _sessao = s);
  }

  /// Token recusado (401): sai da conta, mas NÃO apaga a fila. Ela fica no aparelho até a mesma conta
  /// entrar de novo; se outra conta entrar, _aoEntrar a apaga.
  Future<void> _sessaoExpirou() async {
    widget.deps.api.token = null;
    await widget.deps.sessao.limpar();
    setState(() => _sessao = null);
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
      title: 'projetoFans',
      debugShowCheckedModeBanner: false,
      theme: temaFans(Brightness.light),
      darkTheme: temaFans(Brightness.dark),
      themeMode: _temaEscuro ? ThemeMode.dark : ThemeMode.light,
      locale: localeApp,
      supportedLocales: localesSuportados,
      localizationsDelegates: delegatesLocalizacao,
      home: switch (_sessao) {
        null => LoginPage(deps: widget.deps, aoEntrar: _aoEntrar),
        // Conta recém-criada (ou que saiu da turma): sem turma, a Home não tem o que mostrar.
        // Sair daqui não apaga o banco local: se outra conta entrar, _aoEntrar apaga.
        final s when s.turmaId == null => EntrarTurmaPage(
          deps: widget.deps,
          sessao: s,
          aoEntrar: _aoEntrar,
          aoSair: _sessaoExpirou,
        ),
        _ => HomePage(
          deps: widget.deps,
          aoSair: _aoSair,
          aoSessaoExpirar: _sessaoExpirou,
          aoMudarTema: _aoMudarTema,
        ),
      },
    );
  }
}
