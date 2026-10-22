/// Quanto tempo faz desde [instante]. Compara em UTC; instante futuro (relógio torto) vira 'agora'.
String tempoRelativo(DateTime instante, {DateTime? agora}) {
  final diff = (agora ?? DateTime.now()).toUtc().difference(instante.toUtc());
  if (diff < const Duration(minutes: 1)) return 'agora';
  if (diff < const Duration(hours: 1)) return 'há ${diff.inMinutes} min';
  if (diff < const Duration(hours: 24)) return 'há ${diff.inHours} h';
  final dias = diff.inDays;
  if (dias == 1) return 'há 1 dia';
  if (dias <= 30) return 'há $dias dias';
  return dataCurta(instante.toLocal());
}

const _meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const _mesesMinuscula = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const _dias = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

/// 1..12 -> 'JAN'..'DEZ'.
String mesAbrev(int mes) => _meses[mes - 1];

/// 'dd/mm/aaaa'.
String dataCurta(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')}/'
    '${d.month.toString().padLeft(2, '0')}/'
    '${d.year.toString().padLeft(4, '0')}';

/// 'Quinta, 22 out'.
String diaExtenso(DateTime d) => '${_dias[d.weekday - 1]}, ${d.day} ${_mesesMinuscula[d.month - 1]}';
