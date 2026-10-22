// Port de app/src/app/features/evento-vm.ts. Formatação pura: nada aqui ordena, filtra ou corta
// (não-negociável 5 — a ordem, a janela de 14 dias e o teto de 6 são do servidor).

import '../data/models.dart' as modelos;
import 'tipos.dart';

/// Meses curtos, minúsculos, como o app mostra ("ago", "set").
const meses = <String>[
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

const _diasDaSemana = <String>[
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

/// O que o EventoCard recebe para desenhar uma prova ou entrega.
///
/// O id não entra aqui: quem chama guarda o `eventoId` ao lado (a Home e o Calendário fazem
/// `{id, ...eventoVm}` no Ionic).
class EventoVm {
  const EventoVm({
    required this.tipo,
    required this.dia,
    required this.mes,
    required this.quando,
    required this.titulo,
    required this.materia,
    required this.autoria,
    this.autoriaSelo,
    this.editadoPor,
    this.editadoPorSelo,
    this.sala = '',
  });

  /// Equivale a `eventoVm(item, agora)` do Ionic para um item da Home. Item não traz sala.
  factory EventoVm.deItem(modelos.ItemHome item, DateTime agora) => _montar(
    tipo: item.tipo,
    data: item.data,
    hora: item.hora,
    titulo: item.titulo,
    materiaSigla: item.materiaSigla,
    materiaCorHex: item.materiaCorHex,
    autoria: item.autoria,
    agora: agora,
    sala: '',
  );

  /// Equivale a `eventoVm(evento, agora)` do Ionic para um Evento (Calendário, Matéria, Evento).
  factory EventoVm.deEvento(modelos.Evento evento, DateTime agora) => _montar(
    tipo: evento.tipo,
    data: evento.data,
    hora: evento.hora,
    titulo: evento.titulo,
    materiaSigla: evento.materiaSigla,
    materiaCorHex: evento.materiaCorHex,
    autoria: evento.autoria,
    agora: agora,
    sala: evento.sala ?? '',
  );

  final TipoEvento tipo;

  /// Dia com dois dígitos, como vem do ISO ('02'). Sem DateTime: string cortada.
  final String dia;

  /// Mês curto ('ago'). Se o mês não for legível, cai no número cru.
  final String mes;

  /// 'HH:mm' quando há horário; senão 'prova' ou 'entrega'. Nunca '00:00'.
  final String quando;
  final String titulo;
  final MateriaVisual materia;

  /// 'Nome · há 5 h', ou só o nome quando o timestamp não lê.
  final String autoria;
  final TipoSelo? autoriaSelo;
  final String? editadoPor;
  final TipoSelo? editadoPorSelo;

  /// Sala deste evento quando difere da habitual; vazio = sala da matéria.
  final String sala;
}

/// Converte o Selo do modelo (data/models.dart) no tipo do design system (shared/tipos.dart).
TipoSelo? seloDoModelo(modelos.Selo? selo) => switch (selo) {
  modelos.Selo.professor => TipoSelo.professor,
  modelos.Selo.coordenacao => TipoSelo.coordenacao,
  null => null,
};

EventoVm _montar({
  required modelos.TipoEvento tipo,
  required String data,
  required String? hora,
  required String titulo,
  required String materiaSigla,
  required String materiaCorHex,
  required modelos.Autoria autoria,
  required DateTime agora,
  required String sala,
}) {
  // Partido como string, nunca DateTime.parse: "2026-08-21" lido como UTC mostra o dia anterior
  // num fuso negativo, e a data do evento andaria para trás na tela.
  final partes = data.split('-');
  return EventoVm(
    tipo: switch (tipo) {
      modelos.TipoEvento.prova => TipoEvento.prova,
      modelos.TipoEvento.entrega => TipoEvento.entrega,
    },
    dia: partes.length > 2 ? partes[2] : '',
    mes: _nomeDoMes(partes.length > 1 ? partes[1] : ''),
    quando: _quando(hora, tipo),
    titulo: titulo,
    materia: (sigla: materiaSigla, cor: materiaCorHex),
    autoria: assinatura(autoria, agora),
    autoriaSelo: seloDoModelo(autoria.autorSelo),
    editadoPor: autoria.editadoPorNome,
    editadoPorSelo: seloDoModelo(autoria.editadoPorSelo),
    sala: sala,
  );
}

/// Horário quando existe, cortado em HH:mm (o backend manda LocalTime com segundos). Hora vazia ou
/// ausente cai no rótulo do tipo: horário inventado seria mentir sobre o combinado (decisão 2.6).
String _quando(String? hora, modelos.TipoEvento tipo) {
  if (hora != null && hora.isNotEmpty) {
    return hora.length > 5 ? hora.substring(0, 5) : hora;
  }
  return tipo == modelos.TipoEvento.prova ? 'prova' : 'entrega';
}

String _nomeDoMes(String mes) {
  final n = int.tryParse(mes);
  return n != null && n >= 1 && n <= 12 ? meses[n - 1] : mes;
}

/// "Sexta, 21 ago" — o título da Home. Calculado no fuso do aparelho.
String diaPorExtenso(DateTime agora) =>
    '${_diasDaSemana[agora.weekday % 7]}, ${agora.day} ${meses[agora.month - 1]}';

/// Nome curto do mês de [agora] ('ago'). O nome do Ionic é `mesPorExtenso`; o valor é o curto.
String mesPorExtenso(DateTime agora) => meses[agora.month - 1];

/// Primeiro e último dia do mês de [agora], em ISO 'AAAA-MM-DD', no fuso local.
({String de, String ate}) limitesDoMes(DateTime agora) => (
  de: _iso(DateTime(agora.year, agora.month, 1)),
  ate: _iso(DateTime(agora.year, agora.month + 1, 0)),
);

String _iso(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// 'Otávio · há 5 h'. Autoria é o único mecanismo de confiança do app: se o timestamp não lê,
/// cai para só o nome, nunca 'NaN' e nunca some a linha.
String assinatura(modelos.Autoria a, DateTime agora) {
  final quando = _desde(a.criadoEm, agora);
  return quando == null ? a.autorNome : '${a.autorNome} · $quando';
}

String? _desde(String iso, DateTime agora) {
  final criado = DateTime.tryParse(iso);
  if (criado == null) return null;
  final ms = agora.millisecondsSinceEpoch - criado.millisecondsSinceEpoch;
  final minutos = (ms / 60000).round();
  if (minutos < 1) return 'agora';
  if (minutos < 60) return 'há $minutos min';
  final horas = (minutos / 60).round();
  if (horas < 24) return 'há $horas h';
  final dias = (horas / 24).round();
  return dias == 1 ? 'há 1 dia' : 'há $dias dias';
}
