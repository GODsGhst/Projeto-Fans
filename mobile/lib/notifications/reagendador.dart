// Port de app/src/app/notifications/reagendador.ts. Funções puras: sem plugin, sem relógio global.
// O agora e o fuso entram por parâmetro. Todo bug de notificação mora aqui (dia, fuso, hora nula),
// e cada um deles é um teste pequeno.

import 'package:timezone/data/latest.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import '../data/models.dart'
    show
        AlarmeExato,
        AlarmePersonalizado,
        AlarmeRelativo,
        Agendamento,
        ConfigLembretes,
        EventoAgendavel,
        TipoEvento,
        TipoLembrete;
import '../shared/evento_vm.dart' show meses;

/// Horário fixo do aviso da véspera. Um lugar só para mudar (decisão 2.6).
const notificacaoHoraVespera = '19:00';

/// Horário do aviso do próprio dia. Também é a base do alarme RELATIVO quando o evento não tem hora:
/// um número só, para "36 horas antes" de prova sem hora não contar de horário que ninguém viu.
const notificacaoHoraNoDia = '07:00';

/// A turma é local. Internacionalizar agora seria custo sem beneficiário.
const timezonePadrao = 'America/Sao_Paulo';

/// Teto de avisos por lote. O Android recusa acima de ~500 pendentes; 400 deixa folga para o teste.
/// O corte é DEPOIS de ordenar e de filtrar o passado: leva embora os mais distantes.
const limiteAgendamentos = 400;

/// Id fixo do aviso de teste, fora da faixa de [idDoAviso] (0 a 1999999999).
const idDoTeste = 2000000001;

const _horaMs = 3600000;

const _diasCurtos = <String>['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

var _fusosCarregados = false;

/// Localização IANA [nome]. A base de fusos é carregada uma vez, na primeira chamada. 'UTC' não é um nome
/// da base do pacote: é o objeto [tz.UTC].
tz.Location localizacao(String nome) {
  if (nome == 'UTC') return tz.UTC;
  if (!_fusosCarregados) {
    tzdata.initializeTimeZones();
    _fusosCarregados = true;
  }
  return tz.getLocation(nome);
}

/// Todos os avisos de todos os eventos visíveis, no fuso [timezone], do mais próximo ao mais distante,
/// no máximo [limiteAgendamentos]. Ignora o que já passou e ignora evento oculto ou excluído,
/// inclusive o alarme personalizado dele.
///
/// - VESPERA: [horaVespera] do dia anterior. A hora do EVENTO não entra: o aviso é às 19h com ou sem
///   hora. Deixar a hora vazar faria prova sem horário avisar à meia-noite.
/// - NO_DIA: 07:00 do dia. Pulado se a prova começa até às 7h, e pulado se UMA_HORA está ligado e
///   cai até às 7h (os dois tocariam juntos).
/// - UMA_HORA: só existe se o evento tem hora. Inventar hora seria mentir sobre o combinado.
/// - PERSONALIZADO: não olha os três liga/desliga. Quem marcou o alarme a mão pediu aquele.
List<Agendamento> calcularAgendamentos(
  List<EventoAgendavel> eventos,
  DateTime agora,
  String horaVespera,
  String timezone,
  ConfigLembretes config,
) {
  final gerados = <Agendamento>[];
  for (final e in eventos) {
    // Oculto ou excluído sai antes de ler qualquer conteúdo: para quem não é o autor, o /sync manda só
    // a lápide, sem título nem data. Item sem data também não agenda, e não derruba o lote.
    if (!_daTurma(e) || !_dataValida(e.data)) continue;

    final hora = _horaDe(e.hora);
    final tipo = e.tipo == TipoEvento.prova ? 'prova' : 'entrega';
    final comHora = hora == null ? e.titulo : '${e.titulo} · $hora';
    final comeca = hora == null ? null : _emParede(e.data, hora, timezone);
    final avisos = <_Aviso>[];

    if (config.noDia) {
      final noDia = _emParede(e.data, notificacaoHoraNoDia, timezone);
      // Evento às 08:00 com UMA_HORA ligado: o aviso de uma hora cai às 07:00, o mesmo instante do NO_DIA.
      // Se cai até as 7h, ele já é o aviso da manhã, e o NO_DIA só repetiria.
      final umaHoraJaAvisa =
          config.umaHora &&
          comeca != null &&
          noDia != null &&
          comeca.millisecondsSinceEpoch - _horaMs <= noDia.millisecondsSinceEpoch;
      if (!umaHoraJaAvisa &&
          (comeca == null || (noDia != null && noDia.isBefore(comeca)))) {
        avisos.add(_Aviso(TipoLembrete.noDia, noDia, 'Hoje: $tipo de ${e.materiaSigla}', comHora));
      }
    }
    if (config.vespera) {
      avisos.add(_Aviso(
        TipoLembrete.vespera,
        _emParede(e.data, horaVespera, timezone, 1),
        '${e.tipo == TipoEvento.prova ? 'Prova' : 'Entrega'} de ${e.materiaSigla} amanhã',
        comHora,
      ));
    }
    if (config.umaHora && comeca != null) {
      avisos.add(_Aviso(
        TipoLembrete.umaHora,
        comeca.subtract(const Duration(hours: 1)),
        'Em 1 hora: $tipo de ${e.materiaSigla} · $hora',
        e.titulo,
      ));
    }
    final alarme = config.personalizados[e.eventoId];
    if (alarme != null) {
      avisos.add(_Aviso(
        TipoLembrete.personalizado,
        instantePersonalizado(alarme, e, timezone),
        'Lembrete: $tipo de ${e.materiaSigla}',
        '${e.titulo} · ${_rotuloDoEvento(e.data, hora)}',
      ));
    }

    for (final a in avisos) {
      final quando = a.dispararEm;
      if (quando != null && quando.isAfter(agora)) {
        gerados.add(Agendamento(
          eventoId: e.eventoId,
          tipo: a.tipo,
          dispararEm: quando.toUtc(),
          titulo: a.titulo,
          corpo: a.corpo,
        ));
      }
    }
  }

  // List.sort do Dart não é estável. Desempata pela ordem de geração, senão o corte de 400 muda entre
  // execuções com instantes iguais.
  final ordem = List<int>.generate(gerados.length, (i) => i)
    ..sort((a, b) {
      final porInstante = gerados[a].dispararEm.compareTo(gerados[b].dispararEm);
      return porInstante != 0 ? porInstante : a.compareTo(b);
    });
  return [for (final i in ordem.take(limiteAgendamentos)) gerados[i]];
}

/// Instante em que o alarme personalizado toca, ou null se a data/hora é ilegível. Exposta porque a tela
/// do evento mostra este instante ANTES de salvar.
///
/// EXATO é hora de parede no fuso. RELATIVO é a base menos [AlarmeRelativo.horasAntes] horas absolutas:
/// 36 h são 36 h, não "dois dias". Sem hora no evento, a base é 07:00 do dia. Horas não positivas (ou
/// não finitas) não agendam: a tela oferece no mínimo 1 h, e isto impede o aviso de cair depois da prova.
DateTime? instantePersonalizado(
  AlarmePersonalizado alarme,
  EventoAgendavel evento,
  String timezone,
) {
  return switch (alarme) {
    AlarmeExato(:final data, :final hora) => _emParede(data, hora, timezone),
    AlarmeRelativo(:final horasAntes) => _relativo(horasAntes, evento, timezone),
  };
}

DateTime? _relativo(double horasAntes, EventoAgendavel evento, String timezone) {
  if (!(horasAntes > 0) || !horasAntes.isFinite) return null;
  final base = _emParede(
    evento.data,
    _horaDe(evento.hora) ?? notificacaoHoraNoDia,
    timezone,
  );
  if (base == null) return null;
  // Trunca o ms como o Date do JS faria, para o instante bater ao milissegundo.
  return DateTime.fromMillisecondsSinceEpoch(
    (base.millisecondsSinceEpoch - horasAntes * _horaMs).truncate(),
    isUtc: true,
  );
}

/// Fica só o alarme personalizado cujo evento existe e é da turma.
///
/// A lista TEM de ser a do /sync, nunca a da Home: a Home tem janela de 14 dias e teto de 6, e podar
/// por ela apagaria, na primeira abertura, o alarme da prova final. O /sync sem `desde` traz a turma
/// inteira, inclusive oculto e excluído, então ali "não veio" quer dizer "não existe".
Map<String, AlarmePersonalizado> podarPersonalizados(
  Map<String, AlarmePersonalizado> personalizados,
  List<EventoAgendavel> eventosDoSync,
) {
  final vivos = {
    for (final e in eventosDoSync)
      if (_daTurma(e)) e.eventoId,
  };
  return {
    for (final e in personalizados.entries)
      if (vivos.contains(e.key)) e.key: e.value,
  };
}

/// Hash djb2 de `eventoId:tipo` em inteiro de 32 bits, módulo 2 000 000 000. É o id que o Android
/// aceita e precisa ser ESTÁVEL entre execuções, senão cancelar não acha o que agendou. Reproduz o
/// algoritmo do Ionic bit a bit: aviso já agendado por ele é cancelado por este id.
int idDoAviso(String eventoId, TipoLembrete tipo) {
  final chave = '$eventoId:${tipo.wire}';
  var h = 5381;
  for (final c in chave.codeUnits) {
    // O (h << 5) + h + c do JS, que termina em `| 0`, é equivalente a truncar para 32 bits com sinal.
    h = ((h << 5) + h + c).toSigned(32);
  }
  return h.abs() % 2000000000;
}

/// "sex, 9 out, 19:00": o instante como o relógio de [timezone] mostra. Montado à mão para não sair
/// com a formatação do ICU ("sex., 9 de out.").
String rotuloInstante(DateTime quando, String timezone) {
  final p = tz.TZDateTime.from(quando, localizacao(timezone));
  final hh = p.hour.toString().padLeft(2, '0');
  final mm = p.minute.toString().padLeft(2, '0');
  return '${_diasCurtos[p.weekday % 7]}, ${p.day} ${_nomeDoMes(p.month)}, $hh:$mm';
}

/// Oculto pelo líder ou excluído pelo autor não gera aviso. `visivelTurma` ausente é visível: só
/// `false` oculta. `excluidoEm` nulo é ativo; string vazia conta como excluído.
bool _daTurma(EventoAgendavel e) => e.visivelTurma != false && e.excluidoEm == null;

/// `HH:mm`, ou null. O LocalTime do backend chega como "19:00:00"; vazio ou ausente é sem horário.
String? _horaDe(String? hora) {
  if (hora == null || hora.isEmpty) return null;
  return hora.length > 5 ? hora.substring(0, 5) : hora;
}

(int, int, int)? _partesDaData(String data) {
  final d = data.split('-');
  if (d.length < 3) return null;
  final ano = int.tryParse(d[0]);
  final mes = int.tryParse(d[1]);
  final dia = int.tryParse(d[2]);
  if (ano == null || mes == null || dia == null) return null;
  return (ano, mes, dia);
}

bool _dataValida(String data) => _partesDaData(data) != null;

/// Instante de [hora] (HH:mm) em [data] (AAAA-MM-DD) menos [diasAntes] dias, no relógio de [timezone].
/// Null se a data ou a hora forem ilegíveis. Não lê como 0: int.tryParse devolve null, e o chamador
/// trata como "sem horário" ou "sem aviso". O dia zero (véspera do dia 1) resolve pelo calendário.
DateTime? _emParede(String data, String hora, String timezone, [int diasAntes = 0]) {
  final partes = _partesDaData(data);
  final h = hora.split(':');
  if (partes == null || h.length < 2) return null;
  final hh = int.tryParse(h[0]);
  final mm = int.tryParse(h[1]);
  if (hh == null || mm == null) return null;
  final (ano, mes, dia) = partes;
  return tz.TZDateTime(
    localizacao(timezone),
    ano,
    mes,
    dia - diasAntes,
    hh,
    mm,
  ).toUtc();
}

/// "sex, 9 out" (mais a hora, se houver) do EVENTO, para o corpo do alarme personalizado: ele pode
/// tocar dias antes, e "Prova 2" sozinho não diz quando.
String _rotuloDoEvento(String data, String? hora) {
  final partes = _partesDaData(data);
  if (partes == null) return data;
  final (ano, mes, dia) = partes;
  final semana = _diasCurtos[DateTime.utc(ano, mes, dia).weekday % 7];
  final quando = '$semana, $dia ${_nomeDoMes(mes)}';
  return hora == null ? quando : '$quando, $hora';
}

String _nomeDoMes(int mes) => mes >= 1 && mes <= 12 ? meses[mes - 1] : '$mes';

class _Aviso {
  const _Aviso(this.tipo, this.dispararEm, this.titulo, this.corpo);

  final TipoLembrete tipo;
  final DateTime? dispararEm;
  final String titulo;
  final String corpo;
}
