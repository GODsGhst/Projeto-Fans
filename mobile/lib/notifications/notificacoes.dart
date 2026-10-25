// Port de app/src/app/notifications/notificacoes.service.ts. Agenda no aparelho os lembretes de cada
// prova e entrega (os três padrão e o alarme que a pessoa marcou no evento).
//
// Local, não empurrado pelo servidor: o host gratuito hiberna, e um aviso das 19h não sai de um
// servidor dormindo. Cancela tudo e reagenda tudo a cada sync e a cada mudança, de propósito: é
// idempotente e não guarda estado que possa divergir do servidor.
//
// A permissão só é pedida quando há o que avisar, nunca na abertura do app.

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/timezone.dart' as tz;

import '../core/armazenamento.dart';
import '../data/models.dart'
    show
        AlarmePersonalizado,
        ConfigLembretes,
        EstadoAviso,
        EstadoExato,
        EventoAgendavel,
        PreferenciasLembrete,
        ResultadoTeste,
        TipoLembrete;
import '../data/sync_repository.dart' show LembretesSync;
import 'reagendador.dart';

/// Chave do JSON de lembretes no Armazenamento. Por aparelho, não por turma.
const chaveLembretes = 'pf.lembretes';

/// Canal dedicado, separado do padrão do plugin: importância alta (4), para o aviso descer por cima
/// da tela, e a pessoa pode desligar só os lembretes nos ajustes do Android. Sem som próprio: toca o
/// som padrão do aparelho.
const canalLembretes = CanalLembretes(
  id: 'lembretes',
  nome: 'Lembretes',
  descricao: 'Provas e entregas da turma',
  importancia: 4,
  vibracao: true,
);

/// Canal de notificação. A importância é fixada na primeira criação no aparelho.
class CanalLembretes {
  const CanalLembretes({
    required this.id,
    required this.nome,
    required this.descricao,
    required this.importancia,
    required this.vibracao,
  });

  final String id;
  final String nome;
  final String descricao;

  /// 4 = alta (IMPORTANCE_HIGH). Adaptador usa Importance.high.
  final int importancia;
  final bool vibracao;
}

/// Um aviso como o serviço o manda ao plugin. [tipo] é nulo no aviso de teste.
class NotificacaoAgendada {
  const NotificacaoAgendada({
    required this.id,
    required this.titulo,
    required this.corpo,
    required this.quando,
    required this.exato,
    this.tipo,
  });

  final int id;
  final String titulo;
  final String corpo;

  /// Instante absoluto.
  final DateTime quando;

  /// Alarme exato só quando a permissão já foi concedida. Sem ela, o aviso sai no modo inexato
  /// (allowWhileIdle, ainda acorda o aparelho) e nunca abre a tela de alarmes do Android no lote.
  final bool exato;

  /// Vai como payload no aviso, e é por ele que [NotificacoesService] cancela por tipo.
  final TipoLembrete? tipo;
}

/// Um pendente do plugin. O tipo vem do payload: null em aviso sem payload (teste, ou de versão antiga).
class PendenteNativo {
  const PendenteNativo(this.id, this.payload);

  final int id;
  final String? payload;
}

/// O pedaço do flutter_local_notifications que este serviço usa. Interface própria: o teste troca
/// por um fake destes oito métodos, sem simular o plugin inteiro.
abstract interface class PluginNotificacoes {
  /// Notificações deste app ligadas e com permissão (areNotificationsEnabled).
  Future<bool> notificacoesHabilitadas();

  /// Pede a permissão de notificação do Android 13+. Verdadeiro se concedida.
  Future<bool> pedirPermissao();

  /// Alarme exato liberado (canScheduleExactNotifications). Abaixo do Android 12, sempre verdadeiro.
  Future<bool> exatoConcedido();

  /// Abre a tela "Alarmes e lembretes" do Android. Verdadeiro se liberado ao voltar.
  Future<bool> pedirExato();

  Future<void> criarCanal(CanalLembretes canal);

  Future<List<PendenteNativo>> pendentes();

  Future<void> cancelar(int id);

  Future<void> agendar(List<NotificacaoAgendada> lote);
}

/// Adaptador de produção sobre o flutter_local_notifications 22. Só existe no Android.
class PluginFlutterLocalNotifications implements PluginNotificacoes {
  PluginFlutterLocalNotifications({FlutterLocalNotificationsPlugin? plugin})
    : _plugin = plugin ?? FlutterLocalNotificationsPlugin();

  final FlutterLocalNotificationsPlugin _plugin;
  Future<bool?>? _iniciado;

  /// Inicializa o plugin uma vez e devolve a implementação do Android.
  Future<AndroidFlutterLocalNotificationsPlugin> _android() async {
    await (_iniciado ??= _plugin.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      ),
    ));
    final android = _plugin
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    if (android == null) {
      throw StateError('Lembretes só existem no Android.');
    }
    return android;
  }

  @override
  Future<bool> notificacoesHabilitadas() async =>
      (await (await _android()).areNotificationsEnabled()) ?? false;

  @override
  Future<bool> pedirPermissao() async =>
      (await (await _android()).requestNotificationsPermission()) ?? false;

  @override
  Future<bool> exatoConcedido() async =>
      (await (await _android()).canScheduleExactNotifications()) ?? false;

  @override
  Future<bool> pedirExato() async =>
      (await (await _android()).requestExactAlarmsPermission()) ?? false;

  @override
  Future<void> criarCanal(CanalLembretes canal) async {
    await (await _android()).createNotificationChannel(
      AndroidNotificationChannel(
        canal.id,
        canal.nome,
        description: canal.descricao,
        importance: Importance.high,
        enableVibration: canal.vibracao,
      ),
    );
  }

  @override
  Future<List<PendenteNativo>> pendentes() async {
    await _android();
    final lista = await _plugin.pendingNotificationRequests();
    return [for (final r in lista) PendenteNativo(r.id, r.payload)];
  }

  @override
  Future<void> cancelar(int id) async {
    await _android();
    await _plugin.cancel(id: id);
  }

  @override
  Future<void> agendar(List<NotificacaoAgendada> lote) async {
    await _android();
    for (final n in lote) {
      await _plugin.zonedSchedule(
        id: n.id,
        title: n.titulo,
        body: n.corpo,
        scheduledDate: tz.TZDateTime.from(n.quando, localizacao(timezonePadrao)),
        notificationDetails: NotificationDetails(
          android: AndroidNotificationDetails(
            canalLembretes.id,
            canalLembretes.nome,
            channelDescription: canalLembretes.descricao,
            importance: Importance.high,
            priority: Priority.high,
            enableVibration: canalLembretes.vibracao,
          ),
        ),
        // Sempre com allowWhileIdle: sem ele o Doze adia o aviso das 19h por horas.
        androidScheduleMode: n.exato
            ? AndroidScheduleMode.exactAllowWhileIdle
            : AndroidScheduleMode.inexactAllowWhileIdle,
        payload: n.tipo?.wire,
      );
    }
  }
}

/// Plugin de produção no Android, e null fora dele. Quem monta o [NotificacoesService] passa este valor.
PluginNotificacoes? criarPluginNotificacoes() {
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return null;
  return PluginFlutterLocalNotifications();
}

/// Agenda e cancela os lembretes no aparelho.
///
/// `NotificacoesService(plugin, armazenamento, relogio: ...)`. [plugin] null = fora do Android: nada é
/// agendado e [suportado] é falso. [relogio] existe para o teste; o padrão é o relógio do aparelho.
class NotificacoesService implements LembretesSync {
  NotificacoesService(
    this._plugin,
    this._armazenamento, {
    DateTime Function()? relogio,
  }) : _relogio = relogio ?? DateTime.now;

  final PluginNotificacoes? _plugin;
  final Armazenamento _armazenamento;
  final DateTime Function() _relogio;

  /// Falso fora do Android. As telas usam para dizer que lembrete é coisa do app.
  @override
  bool get suportado => _plugin != null;

  int _epoca = 0;

  /// Sobe a cada [esquecer] no aparelho. Quem busca uma lista anota a época ao sair e descarta a
  /// resposta se ela mudou: sair da conta no meio de um /sync não pode reagendar avisos da conta velha.
  @override
  int get epoca => _epoca;

  /// Última lista do /sync nesta execução. Null até o primeiro [sincronizar]. Só em memória.
  List<EventoAgendavel>? _ultimaLista;

  /// Um trabalho por vez. Sem fila, o cancelar de um passa antes do agendar do outro e um aviso que a
  /// pessoa acabou de desligar volta a tocar.
  Future<void> _fila = Future<void>.value();

  /// Um pedido automático de permissão por execução. Recusa anterior também bloqueia o automático.
  bool _jaPediu = false;
  bool _recusou = false;

  /// Recebe a turma INTEIRA (o /sync, com oculto e excluído) e reagenda. É também onde o alarme
  /// personalizado de evento que sumiu sai do armazenamento: só esta lista sabe o que deixou de existir.
  @override
  Future<void> sincronizar(List<EventoAgendavel> eventos) async {
    final p = _plugin;
    if (p == null) return;
    await _emFila(() async {
      _ultimaLista = eventos;
      final config = await _lerConfig();
      final ficam = podarPersonalizados(config.personalizados, eventos);
      if (ficam.length != config.personalizados.length) {
        await _gravar(_com(config, personalizados: ficam));
      }
      await _reagendarAgora(p);
    });
  }

  /// O que está gravado neste aparelho, completado com o padrão. Roda na fila: a leitura pode apagar
  /// um JSON ilegível, e isso não pode cruzar uma escrita concorrente.
  Future<ConfigLembretes> config() => _emFila(_lerConfig);

  /// Os três liga/desliga. Reagenda na hora com a última lista conhecida.
  ///
  /// Sem lista ainda, desligar vale mesmo assim: o que o aparelho já agendou daquele tipo é cancelado.
  /// Ligar não cria aviso, porque criar precisa dos eventos, e o próximo sync os cria.
  Future<void> salvarPreferencias(PreferenciasLembrete p) => _emFila(() async {
    final plugin = _plugin;
    final atual = await _lerConfig();
    await _gravar(
      _com(atual, noDia: p.noDia, vespera: p.vespera, umaHora: p.umaHora),
    );
    if (plugin != null && _ultimaLista == null) {
      await _cancelarTipos(plugin, {
        if (!p.noDia) TipoLembrete.noDia,
        if (!p.vespera) TipoLembrete.vespera,
        if (!p.umaHora) TipoLembrete.umaHora,
      });
    }
    if (plugin != null) await _reagendarAgora(plugin);
  });

  /// O alarme deste evento. Null remove. Reagenda na hora.
  ///
  /// Sem lista, tira do aparelho o aviso antigo deste evento: o id é estável, então não precisa de
  /// mais nada. O aviso novo nasce quando o próximo /sync o incluir.
  Future<void> salvarAlarme(String eventoId, AlarmePersonalizado? alarme) =>
      _emFila(() async {
        final plugin = _plugin;
        final atual = await _lerConfig();
        final personalizados = Map<String, AlarmePersonalizado>.of(
          atual.personalizados,
        );
        if (alarme == null) {
          personalizados.remove(eventoId);
        } else {
          personalizados[eventoId] = alarme;
        }
        await _gravar(_com(atual, personalizados: personalizados));
        if (plugin != null && _ultimaLista == null) {
          await _cancelarIds(plugin, [
            idDoAviso(eventoId, TipoLembrete.personalizado),
          ]);
        }
        if (plugin != null) await _reagendarAgora(plugin);
      });

  /// Sair da conta, 401 ou remoção da turma: nada que era dela pode tocar depois.
  ///
  /// Cancela os pendentes, apaga os alarmes personalizados e esquece a lista. Os três liga/desliga
  /// ficam: são do aparelho. A época sobe SÍNCRONO, antes da fila, para descartar um /sync em voo.
  Future<void> esquecer() async {
    final plugin = _plugin;
    if (plugin == null) return;
    _epoca++;
    await _emFila(() async {
      _ultimaLista = null;
      try {
        await _limparPendentes(plugin);
      } finally {
        // Mesmo se o cancelar falhar, os alarmes da conta velha saem do armazenamento: senão o próximo
        // sync os reagendaria para a conta nova.
        await _gravar(_com(await _lerConfig(), personalizados: const {}));
      }
    });
  }

  /// O que o sistema responde sobre avisos, neste aparelho, agora. Existe porque sem isto o app não
  /// tem lugar que diga "o Android está bloqueando os seus avisos".
  ///
  /// O plugin não separa "nunca perguntou" de "recusou": o estado recusado só existe nesta execução
  /// (depois de um pedido que voltou negado). Fora disso, é "prompt".
  Future<EstadoAviso> estado() async {
    final p = _plugin;
    if (p == null) return EstadoAviso.semSuporte;
    if (await p.notificacoesHabilitadas()) return EstadoAviso.granted;
    return _recusou ? EstadoAviso.denied : EstadoAviso.prompt;
  }

  /// Se o Android deixa este app usar alarme no horário exato.
  Future<EstadoExato> estadoExato() async {
    final p = _plugin;
    if (p == null) return EstadoExato.semSuporte;
    return await p.exatoConcedido() ? EstadoExato.granted : EstadoExato.denied;
  }

  /// Abre a tela "Alarmes e lembretes" do Android e devolve o que a pessoa escolheu. Reagenda depois:
  /// o que já estava agendado continua inexato até ser agendado de novo.
  Future<EstadoExato> permitirExato() async {
    final p = _plugin;
    if (p == null) return EstadoExato.semSuporte;
    final concedido = await p.pedirExato();
    await _emFila(() => _reagendarAgora(p));
    return concedido ? EstadoExato.granted : EstadoExato.denied;
  }

  /// Um aviso daqui a dez segundos, no mesmo canal e com as mesmas flags do aviso real. Fica fora da
  /// fila de propósito: é um teste de ponta a ponta do AlarmManager, não uma reconciliação.
  Future<ResultadoTeste> testar() async {
    final p = _plugin;
    if (p == null) return ResultadoTeste.semSuporte;
    // forcar: "Testar agora" é gesto explícito, então pede de novo mesmo depois de recusa. Sem isso o
    // botão ficaria sem saída para quem fechou o primeiro diálogo sem responder.
    if (!await _permitido(p, forcar: true)) return ResultadoTeste.negado;
    await p.criarCanal(canalLembretes);
    final exato = (await estadoExato()) == EstadoExato.granted;
    await p.agendar([
      NotificacaoAgendada(
        id: idDoTeste,
        titulo: 'Teste de lembrete',
        corpo: 'Se voce esta lendo isto, os lembretes vao chegar.',
        quando: _relogio().add(const Duration(seconds: 10)),
        exato: exato,
      ),
    ]);
    return ResultadoTeste.agendado;
  }

  /// Roda [trabalho] depois do anterior. Um erro volta a quem chamou, mas não trava a fila.
  Future<T> _emFila<T>(Future<T> Function() trabalho) {
    final vez = _fila.then((_) => trabalho());
    _fila = vez.then<void>((_) {}, onError: (_) {});
    return vez;
  }

  /// Lê o JSON de lembretes. Ausente vira o padrão; ilegível é apagado pelo Armazenamento e vira o
  /// padrão. Campo a campo, a leitura completa o padrão (ConfigLembretes.fromJson).
  Future<ConfigLembretes> _lerConfig() async {
    final bruto = await _armazenamento.lerJson(chaveLembretes);
    if (bruto == null) return ConfigLembretes.padrao;
    if (bruto is! Map<String, dynamic>) {
      debugPrint('[lembretes] preferencias ilegiveis, descartando');
      await _armazenamento.remover(chaveLembretes);
      return ConfigLembretes.padrao;
    }
    return ConfigLembretes.fromJson(bruto);
  }

  Future<void> _gravar(ConfigLembretes config) =>
      _armazenamento.gravarJson(chaveLembretes, config.toJson());

  /// Reagenda com a última lista. Sem lista, não faz nada. Sem nada a agendar, cancela e não pede
  /// permissão. Sem permissão, não cancela nada.
  Future<void> _reagendarAgora(PluginNotificacoes p) async {
    final lista = _ultimaLista;
    if (lista == null) return;
    final agendamentos = calcularAgendamentos(
      lista,
      _relogio(),
      notificacaoHoraVespera,
      timezonePadrao,
      await _lerConfig(),
    );
    if (agendamentos.isEmpty) {
      await _limparPendentes(p);
      return;
    }
    if (!await _permitido(p)) return;
    // Antes do primeiro agendar: notificação em canal inexistente cai no canal padrão do plugin, sem som
    // e sem aparecer por cima da tela. Criar de novo é inofensivo.
    await p.criarCanal(canalLembretes);
    // Lido uma vez por lote: são até 400 avisos, e cada leitura é uma ida e volta pelo canal de plataforma.
    final exato = (await estadoExato()) == EstadoExato.granted;
    await _limparPendentes(p);
    // O pedido de permissão pode ter esperado o usuário no diálogo. Um aviso que venceu nessa espera
    // dispararia na hora, então o corte do passado é refeito aqui, no instante de agendar.
    final agoraAgendar = _relogio();
    await p.agendar([
      for (final a in agendamentos)
        if (a.dispararEm.isAfter(agoraAgendar))
          NotificacaoAgendada(
            id: idDoAviso(a.eventoId, a.tipo),
            titulo: a.titulo,
            corpo: a.corpo,
            quando: a.dispararEm,
            exato: exato,
            tipo: a.tipo,
          ),
    ]);
  }

  /// Pedido de permissão. [forcar] é o gesto explícito ("Testar agora"): pede mesmo depois de recusa.
  /// O automático pede no máximo uma vez por execução e nunca depois de recusa.
  Future<bool> _permitido(PluginNotificacoes p, {bool forcar = false}) async {
    if (await p.notificacoesHabilitadas()) {
      _recusou = false;
      return true;
    }
    if (!forcar && (_jaPediu || _recusou)) return false;
    _jaPediu = true;
    final concedeu = await p.pedirPermissao();
    _recusou = !concedeu;
    return concedeu;
  }

  /// Cancela os avisos de lembrete, TODOS menos o de teste: o teste vive dez segundos no AlarmManager e
  /// a pessoa pode sair da tela de ajustes nesse meio tempo.
  Future<void> _limparPendentes(PluginNotificacoes p) async {
    final pendentes = await p.pendentes();
    await _cancelarIds(p, [
      for (final x in pendentes)
        if (x.id != idDoTeste) x.id,
    ]);
  }

  /// Cancela os pendentes cujo tipo está em [tipos], exceto o teste. Aviso sem tipo não é tocado.
  Future<void> _cancelarTipos(
    PluginNotificacoes p,
    Set<TipoLembrete> tipos,
  ) async {
    if (tipos.isEmpty) return;
    final pendentes = await p.pendentes();
    final ids = <int>[];
    for (final x in pendentes) {
      final tipo = _tipoDoPayload(x.payload);
      if (x.id != idDoTeste && tipo != null && tipos.contains(tipo)) {
        ids.add(x.id);
      }
    }
    await _cancelarIds(p, ids);
  }

  /// Cancelar id que não está pendente é inofensivo no plugin, então dá para cancelar um id estável
  /// sem consultar a lista.
  Future<void> _cancelarIds(PluginNotificacoes p, List<int> ids) async {
    for (final id in ids) {
      await p.cancelar(id);
    }
  }
}

TipoLembrete? _tipoDoPayload(String? payload) {
  for (final t in TipoLembrete.values) {
    if (t.wire == payload) return t;
  }
  return null;
}

ConfigLembretes _com(
  ConfigLembretes c, {
  bool? noDia,
  bool? vespera,
  bool? umaHora,
  Map<String, AlarmePersonalizado>? personalizados,
}) => ConfigLembretes(
  noDia: noDia ?? c.noDia,
  vespera: vespera ?? c.vespera,
  umaHora: umaHora ?? c.umaHora,
  personalizados: personalizados ?? c.personalizados,
);
