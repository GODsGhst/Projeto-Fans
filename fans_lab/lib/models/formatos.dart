// Helpers de parsing do JSON da API e das linhas do SQLite.
// Estritos de propósito: campo ausente ou de tipo errado lança FormatException,
// nunca vira valor padrão em silêncio.

/// Lê [chave] como [T]. Ausente, nulo ou de outro tipo lança FormatException.
T campo<T>(Map<String, dynamic> json, String chave) {
  final valor = json[chave];
  if (valor is T) return valor;
  throw FormatException('campo "$chave" ausente ou inválido');
}

/// Como [campo], mas ausente ou nulo devolve null. Tipo errado ainda lança.
T? campoOpcional<T>(Map<String, dynamic> json, String chave) {
  final valor = json[chave];
  if (valor == null) return null;
  if (valor is T) return valor;
  throw FormatException('campo "$chave" ausente ou inválido');
}

/// Data no formato 'yyyy-MM-dd', com zero à esquerda.
String dataIso(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-'
    '${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';

/// Lê 'yyyy-MM-dd' como data local, sem hora.
DateTime lerData(String s) {
  final d = DateTime.parse(s);
  final data = DateTime(d.year, d.month, d.day);
  // DateTime.parse aceita '2026-02-30' e rola para 02/03 sem avisar.
  // Se a data reconstruída não bate com o texto, a entrada era inválida.
  if (!s.startsWith(dataIso(data))) {
    throw FormatException('data inválida: "$s"');
  }
  return data;
}

DateTime? lerDataOpcional(String? s) => s == null ? null : lerData(s);

/// '19:00:00' vira '19:00'. '19:00' e null ficam como estão.
String? horaCurta(String? h) {
  if (h == null) return null;
  return h.length > 5 ? h.substring(0, 5) : h;
}

/// Instante ISO-8601. Com 'Z' no fim, o resultado é UTC.
DateTime lerInstante(String s) => DateTime.parse(s);

DateTime? lerInstanteOpcional(String? s) => s == null ? null : lerInstante(s);
