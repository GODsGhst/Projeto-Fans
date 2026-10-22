import 'dart:async';
import 'dart:developer' as developer;

import 'package:flutter/widgets.dart';
import 'package:http/http.dart' as http;

import '../data/chave_ia_service.dart';
import '../data/docente_admin_repository.dart';
import '../data/evento_repository.dart';
import '../data/home_repository.dart';
import '../data/material_repository.dart';
import '../data/materia_repository.dart';
import '../data/models.dart' show TurmaRef;
import '../data/moderacao_repository.dart';
import '../data/nota_repository.dart';
import '../data/painel_repository.dart';
import '../data/quadro_repository.dart';
import '../data/sync_repository.dart';
import '../data/turma_repository.dart';
import '../notifications/notificacoes.dart';
import 'abas.dart';
import 'api.dart';
import 'armazenamento.dart';
import 'auth.dart';
import 'config.dart';
import 'turma_ativa.dart';

/// Para onde o SEM_TURMA e a entrada sem turma levam. Está na tabela de rotas fixas.
const String rotaEntrarTurma = '/entrar-turma';

/// Navegação que os serviços disparam sem contexto (401, SEM_TURMA, troca de turma).
///
/// O roteador nasce depois dos serviços; [criarRoteador] liga a ponte. Antes disso, não há tela:
/// a chamada vira no-op, e nenhum caminho de produção chega aqui sem roteador.
class PonteNavegacao {
  void Function(String rota)? _irPara;
  void Function()? _reiniciar;

  void vincular({
    required void Function(String rota) irPara,
    required void Function() reiniciar,
  }) {
    _irPara = irPara;
    _reiniciar = reiniciar;
  }

  void irPara(String rota) => _irPara?.call(rota);

  void reiniciar() => _reiniciar?.call();
}

/// Todos os serviços e repositories, criados uma vez por execução. Sem singleton global: os
/// testes montam outro com um http.Client falso.
class Servicos {
  Servicos._({
    required this.armazenamento,
    required this.api,
    required this.auth,
    required this.turmaAtiva,
    required this.abas,
    required this.notificacoes,
    required this.chaveIa,
    required this.sync,
    required this.home,
    required this.eventos,
    required this.materias,
    required this.materiais,
    required this.notas,
    required this.moderacao,
    required this.turma,
    required this.quadro,
    required this.painel,
    required this.docenteAdmin,
    required this.navegacao,
  });

  final Armazenamento armazenamento;
  final ApiClient api;
  final AuthService auth;
  final TurmaAtivaService turmaAtiva;
  final Abas abas;
  final NotificacoesService notificacoes;
  final ChaveIaService chaveIa;
  final SyncRepository sync;
  final HomeRepository home;
  final EventoRepository eventos;
  final MateriaRepository materias;
  final MaterialRepository materiais;
  final NotaRepository notas;
  final ModeracaoRepository moderacao;
  final TurmaRepository turma;
  final QuadroRepository quadro;
  final PainelRepository painel;
  final DocenteAdminRepository docenteAdmin;
  final PonteNavegacao navegacao;

  /// Monta tudo na ordem de dependência. Os callbacks do ApiClient e do TurmaAtivaService
  /// referenciam `auth` e `turmaAtiva` (ainda não criados) através de `late`: só são chamados
  /// depois que a montagem termina.
  static Servicos montar({
    required Armazenamento armazenamento,
    PluginNotificacoes? plugin,
    http.Client? client,
    String baseUrl = apiUrl,
    Duration tetoDeEspera = tetoDeEsperaPadrao,
  }) {
    final navegacao = PonteNavegacao();
    late final AuthService auth;
    late final TurmaAtivaService turmaAtiva;

    final api = ApiClient(
      token: () => auth.token,
      ehDocente: () => auth.ehDocente,
      turmaAtiva: () async {
        await turmaAtiva.pronto;
        return turmaAtiva.turmaId;
      },
      onSessaoExpirada: () {
        auth.encerrarSessao();
        navegacao.irPara(rotaLogin);
      },
      onSemTurma: () {
        // registrarTurma(null) zera a memória antes do primeiro await. A turma ativa do docente
        // também sai: senão X-Turma-Id continua apontando para a turma de que ele foi removido.
        _emSegundoPlano(auth.registrarTurma(null), 'falha ao esquecer a turma');
        _emSegundoPlano(
          turmaAtiva.conciliar(const <TurmaRef>[]),
          'falha ao apagar a turma ativa',
        );
        navegacao.irPara(rotaEntrarTurma);
      },
      baseUrl: baseUrl,
      tetoDeEspera: tetoDeEspera,
      client: client,
    );

    final notificacoes = NotificacoesService(plugin, armazenamento);
    auth = AuthService(
      api: api,
      armazenamento: armazenamento,
      aoEsquecerLembretes: () => notificacoes.esquecer(),
    );
    turmaAtiva = TurmaAtivaService(
      auth: auth,
      armazenamento: armazenamento,
      recarregarApp: () => navegacao.reiniciar(),
    );
    final turma = TurmaRepository(api: api, auth: auth);
    final moderacao = ModeracaoRepository(api: api, turmas: turma);
    final quadro = QuadroRepository(api: api, moderacao: moderacao);
    final sync = SyncRepository(api: api, lembretes: notificacoes);
    final home = HomeRepository(
      api: api,
      armazenamento: armazenamento,
      sync: sync,
    );

    return Servicos._(
      armazenamento: armazenamento,
      api: api,
      auth: auth,
      turmaAtiva: turmaAtiva,
      abas: Abas(),
      notificacoes: notificacoes,
      chaveIa: ChaveIaService(armazenamento: armazenamento),
      sync: sync,
      home: home,
      eventos: EventoRepository(api: api),
      materias: MateriaRepository(api: api, armazenamento: armazenamento),
      materiais: MaterialRepository(api: api),
      notas: NotaRepository(api: api),
      moderacao: moderacao,
      turma: turma,
      quadro: quadro,
      painel: PainelRepository(api: api),
      docenteAdmin: DocenteAdminRepository(api: api),
      navegacao: navegacao,
    );
  }

  /// Os serviços a partir de qualquer tela. Sem ServicosScope acima, falha alto.
  static Servicos of(BuildContext context) {
    final escopo = context.dependOnInheritedWidgetOfExactType<ServicosScope>();
    if (escopo == null) {
      throw StateError('ServicosScope ausente acima desta tela.');
    }
    return escopo.servicos;
  }

  /// Esvazia o que é de uma turma. Trocar de turma não pode mostrar dado de outra: o Ionic
  /// recarregava a página inteira, aqui cada notifier volta ao vazio. Sem I/O: o snapshot em disco
  /// sai no próprio TurmaAtivaService.
  void reiniciarEstado() {
    home.itens.value = const [];
    home.erro.value = null;
    home.offline.value = false;
    home.ultimoSync.value = null;
    eventos.eventos.value = const [];
    eventos.erro.value = null;
    materias.materias.value = const [];
    materias.erro.value = null;
    notas.notas.value = const [];
    notas.erro.value = null;
    quadro.aFazer.value = const [];
    quadro.feito.value = const [];
    quadro.naoListados.value = null;
    quadro.erro.value = null;
    quadro.erroNaoListados.value = null;
    quadro.pedidos.value = const [];
    painel.painel.value = null;
    painel.erro.value = null;
    turma.limpar();
  }
}

/// Leva [Servicos] a toda a árvore do app.
class ServicosScope extends InheritedWidget {
  const ServicosScope({
    super.key,
    required this.servicos,
    required super.child,
  });

  final Servicos servicos;

  @override
  bool updateShouldNotify(ServicosScope antigo) =>
      servicos != antigo.servicos;
}

/// Trabalho sem await que não pode engolir erro: a falha vai para o log e não trava nada.
void _emSegundoPlano(Future<void> trabalho, String falha) {
  unawaited(
    trabalho.catchError((Object e, StackTrace s) {
      developer.log(
        '[servicos] $falha',
        name: 'servicos',
        error: e,
        stackTrace: s,
        level: 1000,
      );
    }),
  );
}
