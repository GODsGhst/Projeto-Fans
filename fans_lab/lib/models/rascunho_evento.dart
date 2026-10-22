import 'package:fans_lab/models/formatos.dart';
import 'package:fans_lab/models/tipo_evento.dart';

/// Evento criado no aparelho que pode ainda não ter ido para o servidor (fila offline).
class RascunhoEvento {
  final int? localId;
  final String materiaId;
  final String materiaSigla;
  final String materiaCorHex;
  final TipoEvento tipo;
  final String titulo;
  final DateTime data;
  final String? hora; // 'HH:mm' ou null
  final String? sala;
  final DateTime criadoEm;
  final bool sincronizado;
  final String? ultimoErro;

  RascunhoEvento({
    this.localId,
    required this.materiaId,
    required this.materiaSigla,
    required this.materiaCorHex,
    required this.tipo,
    required this.titulo,
    required this.data,
    this.hora,
    this.sala,
    required this.criadoEm,
    this.sincronizado = false,
    this.ultimoErro,
  });

  /// Linha do SQLite. `local_id` só existe depois do INSERT, então some quando null.
  Map<String, dynamic> toMap() => {
    if (localId != null) 'local_id': localId,
    'materia_id': materiaId,
    'materia_sigla': materiaSigla,
    'materia_cor_hex': materiaCorHex,
    'tipo': tipo.toJson(),
    'titulo': titulo,
    'data': dataIso(data),
    'hora': hora,
    'sala': sala,
    'criado_em': criadoEm.toUtc().toIso8601String(),
    'sincronizado': sincronizado ? 1 : 0,
    'ultimo_erro': ultimoErro,
  };

  factory RascunhoEvento.fromMap(Map<String, dynamic> map) => RascunhoEvento(
    localId: campoOpcional<int>(map, 'local_id'),
    materiaId: campo<String>(map, 'materia_id'),
    materiaSigla: campo<String>(map, 'materia_sigla'),
    materiaCorHex: campo<String>(map, 'materia_cor_hex'),
    tipo: TipoEvento.fromJson(campo<String>(map, 'tipo')),
    titulo: campo<String>(map, 'titulo'),
    data: lerData(campo<String>(map, 'data')),
    hora: campoOpcional<String>(map, 'hora'),
    sala: campoOpcional<String>(map, 'sala'),
    criadoEm: lerInstante(campo<String>(map, 'criado_em')),
    sincronizado: campo<int>(map, 'sincronizado') == 1,
    ultimoErro: campoOpcional<String>(map, 'ultimo_erro'),
  );

  /// Corpo do POST /eventos (e do PATCH, que exige o objeto inteiro).
  Map<String, dynamic> toCriarJson() => {
    'materiaId': materiaId,
    'tipo': tipo.toJson(),
    'titulo': titulo,
    'data': dataIso(data),
    'hora': hora,
    'sala': sala,
  };

  /// `limparErro: true` zera `ultimoErro`. Passar só `ultimoErro: null` não basta,
  /// porque null aqui significa "manter o valor atual".
  RascunhoEvento copyWith({
    int? localId,
    bool? sincronizado,
    String? ultimoErro,
    bool limparErro = false,
  }) => RascunhoEvento(
    localId: localId ?? this.localId,
    materiaId: materiaId,
    materiaSigla: materiaSigla,
    materiaCorHex: materiaCorHex,
    tipo: tipo,
    titulo: titulo,
    data: data,
    hora: hora,
    sala: sala,
    criadoEm: criadoEm,
    sincronizado: sincronizado ?? this.sincronizado,
    ultimoErro: limparErro ? null : (ultimoErro ?? this.ultimoErro),
  );
}
