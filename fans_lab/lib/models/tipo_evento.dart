/// Tipo de evento. JSON e SQLite usam as siglas em maiúsculas.
enum TipoEvento {
  prova,
  entrega;

  static TipoEvento fromJson(String s) => switch (s) {
    'PROVA' => TipoEvento.prova,
    'ENTREGA' => TipoEvento.entrega,
    _ => throw FormatException('tipo de evento desconhecido: "$s"'),
  };

  String toJson() => switch (this) {
    TipoEvento.prova => 'PROVA',
    TipoEvento.entrega => 'ENTREGA',
  };
}
