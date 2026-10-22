import 'dart:convert';

import 'package:fans_lab/models/autoria.dart';
import 'package:fans_lab/models/formatos.dart';
import 'package:fans_lab/models/tipo_evento.dart';

/// Linha da Home. Ordem e corte (6 itens, 14 dias) vêm prontos do servidor:
/// a lista é exibida na ordem recebida, sem reordenar, agrupar ou filtrar.
class ItemHome {
  final String eventoId;
  final TipoEvento tipo;
  final String titulo;
  final DateTime data;
  final String? hora; // sempre 'HH:mm' ou null
  final String materiaSigla;
  final String materiaCorHex;
  final Autoria autoria;
  final bool feitoPeloUsuario;

  ItemHome({
    required this.eventoId,
    required this.tipo,
    required this.titulo,
    required this.data,
    this.hora,
    required this.materiaSigla,
    required this.materiaCorHex,
    required this.autoria,
    this.feitoPeloUsuario = false,
  });

  factory ItemHome.fromJson(Map<String, dynamic> json) => ItemHome(
    eventoId: campo<String>(json, 'eventoId'),
    tipo: TipoEvento.fromJson(campo<String>(json, 'tipo')),
    titulo: campo<String>(json, 'titulo'),
    data: lerData(campo<String>(json, 'data')),
    hora: horaCurta(campoOpcional<String>(json, 'hora')),
    materiaSigla: campo<String>(json, 'materiaSigla'),
    materiaCorHex: campo<String>(json, 'materiaCorHex'),
    autoria: Autoria.fromJson(campo<Map<String, dynamic>>(json, 'autoria')),
    feitoPeloUsuario: campo<bool>(json, 'feitoPeloUsuario'),
  );

  /// Linha para o SQLite (cache da Home). `feito` NÃO entra aqui: é estado
  /// pessoal e mora na tabela `estado_pessoal`.
  Map<String, dynamic> toMap(int posicao) => {
    'evento_id': eventoId,
    'posicao': posicao,
    'tipo': tipo.toJson(),
    'titulo': titulo,
    'data': dataIso(data),
    'hora': hora,
    'materia_sigla': materiaSigla,
    'materia_cor_hex': materiaCorHex,
    'autoria_json': jsonEncode(autoria.toJson()),
  };

  factory ItemHome.fromMap(Map<String, dynamic> map, {bool feito = false}) {
    final autoriaLida = jsonDecode(campo<String>(map, 'autoria_json'));
    if (autoriaLida is! Map<String, dynamic>) {
      throw FormatException('campo "autoria_json" ausente ou inválido');
    }
    return ItemHome(
      eventoId: campo<String>(map, 'evento_id'),
      tipo: TipoEvento.fromJson(campo<String>(map, 'tipo')),
      titulo: campo<String>(map, 'titulo'),
      data: lerData(campo<String>(map, 'data')),
      hora: campoOpcional<String>(map, 'hora'),
      materiaSigla: campo<String>(map, 'materia_sigla'),
      materiaCorHex: campo<String>(map, 'materia_cor_hex'),
      autoria: Autoria.fromJson(autoriaLida),
      feitoPeloUsuario: feito,
    );
  }

  ItemHome copyWith({bool? feitoPeloUsuario}) => ItemHome(
    eventoId: eventoId,
    tipo: tipo,
    titulo: titulo,
    data: data,
    hora: hora,
    materiaSigla: materiaSigla,
    materiaCorHex: materiaCorHex,
    autoria: autoria,
    feitoPeloUsuario: feitoPeloUsuario ?? this.feitoPeloUsuario,
  );
}
