import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../features/admin/admin_page.dart';
import '../features/ajustes/ajustes_page.dart';
import '../features/auth/cadastro_page.dart';
import '../features/auth/entrar_turma_page.dart';
import '../features/auth/login_page.dart';
import '../features/auth/recuperar_page.dart';
import '../features/auth/redefinir_page.dart';
import '../features/calendario/calendario_page.dart';
import '../features/evento/anexar_material_page.dart';
import '../features/evento/evento_page.dart';
import '../features/evento/novo_evento_page.dart';
import '../features/home/home_page.dart';
import '../features/materias/editar_material_page.dart';
import '../features/materias/materia_page.dart';
import '../features/materias/materias_page.dart';
import '../features/materias/nova_materia_page.dart';
import '../features/materias/novo_material_page.dart';
import '../features/materias/resumo_page.dart';
import '../features/notas/nova_nota_page.dart';
import '../features/painel/painel_page.dart';
import '../features/perfil/perfil_page.dart';
import '../features/quadro/quadro_page.dart';
import '../features/turma/editar_turma_page.dart';
import '../features/turma/transferir_page.dart';
import '../features/turma/turma_page.dart';
import '../shared/estilos.dart';
import 'auth.dart';
import 'servicos.dart';

/// Abas que a guarda e o redirecionamento usam. As demais estão na tabela fixa, em [criarRoteador].
const String rotaHome = '/tabs/home';
const String rotaPainel = '/tabs/painel';
const String rotaQuadro = '/tabs/quadro';

/// Aba de entrada de quem tem sessão e turma: docente vai ao painel, aluno à home.
String rotaInicialDe(AuthService auth) =>
    auth.ehDocente ? rotaPainel : rotaHome;

/// Destino de '/': sem sessão, login; sem turma, entrar na turma; senão, a aba inicial.
String _destinoDeEntrada(AuthService auth) {
  if (!auth.autenticado) return rotaLogin;
  if (!auth.temTurma) return rotaEntrarTurma;
  return rotaInicialDe(auth);
}

/// Guarda de tudo que começa com /tabs. Sem sessão, login. Sem turma, entrar na turma. O tipo
/// da conta decide a aba: aluno não entra no painel; docente não entra na home nem no quadro.
String? _guardaDasAbas(AuthService auth, String caminho) {
  final ehAba = caminho == '/tabs' || caminho.startsWith('/tabs/');
  if (!ehAba) return null;
  if (!auth.autenticado) return rotaLogin;
  if (!auth.temTurma) return rotaEntrarTurma;
  if (caminho == '/tabs') return rotaInicialDe(auth);
  if (auth.ehDocente && (caminho == rotaHome || caminho == rotaQuadro)) {
    return rotaPainel;
  }
  if (!auth.ehDocente && caminho == rotaPainel) return rotaHome;
  return null;
}

/// Avisa o roteador só quando a sessão ganha ou perde token ou turma. Trocar o tipo da conta
/// não redireciona a tela aberta: a guarda das abas roda só na navegação.
class _MudancaDeSessao extends ChangeNotifier {
  _MudancaDeSessao(this._auth)
    : _autenticado = _auth.autenticado,
      _temTurma = _auth.temTurma {
    _auth.addListener(_aoMudar);
  }

  final AuthService _auth;
  bool _autenticado;
  bool _temTurma;

  void _aoMudar() {
    if (_auth.autenticado == _autenticado && _auth.temTurma == _temTurma) {
      return;
    }
    _autenticado = _auth.autenticado;
    _temTurma = _auth.temTurma;
    notifyListeners();
  }

  @override
  void dispose() {
    _auth.removeListener(_aoMudar);
    super.dispose();
  }
}

/// Roteador do app. Rotas da tabela fixa, guardas e a casca das cinco abas. Liga a
/// [PonteNavegacao] de [s] ao próprio roteador, para o 401 e o SEM_TURMA conseguirem navegar.
GoRouter criarRoteador(Servicos s) {
  final raiz = GlobalKey<NavigatorState>(debugLabel: 'raiz');
  final auth = s.auth;

  final roteador = GoRouter(
    navigatorKey: raiz,
    refreshListenable: _MudancaDeSessao(auth),
    redirect: (context, state) => _guardaDasAbas(auth, state.uri.path),
    // Rota desconhecida: o Ionic não tinha coringa. Aqui cai em /tabs, que passa pela guarda.
    onException: (context, state, router) => router.go('/tabs'),
    routes: [
      GoRoute(
        path: '/',
        redirect: (context, state) => _destinoDeEntrada(auth),
      ),
      GoRoute(path: rotaLogin, builder: (context, state) => const LoginPage()),
      GoRoute(
        path: '/cadastro',
        builder: (context, state) => const CadastroPage(),
      ),
      GoRoute(
        path: rotaEntrarTurma,
        builder: (context, state) => const EntrarTurmaPage(),
      ),
      GoRoute(
        path: '/recuperar',
        builder: (context, state) => const RecuperarPage(),
      ),
      GoRoute(
        path: '/senha/reset',
        builder: (context, state) =>
            RedefinirPage(token: state.uri.queryParameters['token']),
      ),
      GoRoute(
        path: '/tabs',
        redirect: (context, state) => rotaInicialDe(auth),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navegacao) =>
            _CascaDasAbas(navegacao: navegacao),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: rotaHome,
                builder: (context, state) => const HomePage(),
              ),
              GoRoute(
                path: rotaPainel,
                builder: (context, state) => const PainelPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/tabs/calendario',
                builder: (context, state) => const CalendarioPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/tabs/materias',
                builder: (context, state) => const MateriasPage(),
                routes: [
                  // Literal antes de parâmetro: 'nova' precisa vir antes de ':id'.
                  GoRoute(
                    path: 'nova',
                    parentNavigatorKey: raiz,
                    builder: (context, state) => const NovaMateriaPage(),
                  ),
                  GoRoute(
                    path: ':id',
                    parentNavigatorKey: raiz,
                    builder: (context, state) => MateriaPage(
                      id: state.pathParameters['id']!,
                    ),
                  ),
                  GoRoute(
                    path: ':id/editar',
                    parentNavigatorKey: raiz,
                    builder: (context, state) => NovaMateriaPage(
                      materiaId: state.pathParameters['id'],
                    ),
                  ),
                  GoRoute(
                    path: ':id/material/novo',
                    parentNavigatorKey: raiz,
                    builder: (context, state) => NovoMaterialPage(
                      materiaId: state.pathParameters['id']!,
                    ),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: rotaQuadro,
                builder: (context, state) => const QuadroPage(),
              ),
              GoRoute(
                path: '/tabs/turma',
                builder: (context, state) => const TurmaPage(),
                routes: [
                  GoRoute(
                    path: 'editar',
                    parentNavigatorKey: raiz,
                    builder: (context, state) => const EditarTurmaPage(),
                  ),
                  GoRoute(
                    path: 'transferir',
                    parentNavigatorKey: raiz,
                    builder: (context, state) => const TransferirPage(),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/tabs/perfil',
                builder: (context, state) => const PerfilPage(),
              ),
            ],
          ),
        ],
      ),
      // Telas empurradas por cima da casca: não começam com o caminho de uma aba.
      GoRoute(
        path: '/tabs/materiais/:id/resumo',
        builder: (context, state) =>
            ResumoPage(materialId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/tabs/materiais/:id/editar',
        builder: (context, state) =>
            EditarMaterialPage(id: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/tabs/eventos/novo',
        builder: (context, state) => NovoEventoPage(
          tipo: state.uri.queryParameters['tipo'],
          materiaId: state.uri.queryParameters['materiaId'],
        ),
      ),
      GoRoute(
        path: '/tabs/eventos/:id',
        builder: (context, state) =>
            EventoPage(id: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/tabs/eventos/:id/editar',
        builder: (context, state) =>
            NovoEventoPage(eventoId: state.pathParameters['id']),
      ),
      GoRoute(
        path: '/tabs/eventos/:id/anexar',
        builder: (context, state) =>
            AnexarMaterialPage(eventoId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/tabs/notas/nova',
        builder: (context, state) =>
            NovaNotaPage(dia: state.uri.queryParameters['dia']),
      ),
      GoRoute(
        path: '/tabs/notas/:id/editar',
        builder: (context, state) =>
            NovaNotaPage(notaId: state.pathParameters['id']),
      ),
      GoRoute(
        path: '/tabs/admin',
        builder: (context, state) => const AdminPage(),
      ),
      GoRoute(
        path: '/tabs/ajustes',
        builder: (context, state) => const AjustesPage(),
      ),
    ],
  );

  s.navegacao.vincular(
    // Idempotente: um 401 no próprio /login (senha errada) mandava ir para /login de novo e
    // recriava a tela, apagando "E-mail ou senha invalidos". Também absorve 401 simultâneos.
    irPara: (rota) {
      if (roteador.routerDelegate.currentConfiguration.uri.path == rota) return;
      roteador.go(rota);
    },
    reiniciar: () {
      s.reiniciarEstado();
      roteador.go(rotaInicialDe(auth));
    },
  );
  return roteador;
}

/// Casca das cinco abas. Barra inferior e corpo da aba visível. Aba 1 e aba 4 dependem do tipo
/// da conta, ao vivo; a ordem é fixa (Home ou Painel, Calendário, Matérias, Quadro ou Turma, Perfil).
class _CascaDasAbas extends StatelessWidget {
  const _CascaDasAbas({required this.navegacao});

  final StatefulNavigationShell navegacao;

  @override
  Widget build(BuildContext context) {
    final s = Servicos.of(context);
    final indice = navegacao.currentIndex;
    // Depois do frame: Abas notifica quem escuta, e não pode notificar durante o build. Cobre
    // também a aba aberta por link direto ou por redirecionamento.
    WidgetsBinding.instance.addPostFrameCallback((_) => s.abas.mostrar(indice));

    return ListenableBuilder(
      listenable: s.auth,
      builder: (context, _) {
        final docente = s.auth.ehDocente;
        return Scaffold(
          body: navegacao,
          bottomNavigationBar: NavigationBar(
            selectedIndex: indice,
            onDestinationSelected: (i) {
              s.abas.mostrar(i);
              // Tocar na aba que já está aberta volta à raiz dela, como no Ionic.
              navegacao.goBranch(i, initialLocation: i == indice);
            },
            destinations: [
              NavigationDestination(
                icon: Icon(
                  docente ? Icons.grid_view_outlined : Icons.list_outlined,
                ),
                label: docente ? 'Painel' : 'Home',
              ),
              const NavigationDestination(
                icon: Icon(Icons.calendar_month_outlined),
                label: 'Calendário',
              ),
              const NavigationDestination(
                icon: Icon(Icons.local_library_outlined),
                label: 'Matérias',
              ),
              NavigationDestination(
                icon: Icon(
                  docente
                      ? Icons.people_outline
                      : Icons.check_box_outlined,
                ),
                label: docente ? 'Turma' : 'Meu quadro',
              ),
              NavigationDestination(
                icon: PfAvatar(nome: s.auth.usuario?.nome ?? ''),
                label: 'Perfil',
              ),
            ],
          ),
        );
      },
    );
  }
}
