import 'package:fans_lab/models/evento.dart';
import 'package:fans_lab/models/formatos.dart';
import 'package:fans_lab/models/material_aula.dart';

/// Detalhe de um evento. O servidor achata os campos de Evento no mesmo nível do
/// JSON (@JsonUnwrapped) e acrescenta `materiais`, só os vinculados a este evento.
class EventoDetalhe {
  final Evento evento;
  final List<MaterialAula> materiais;

  EventoDetalhe({required this.evento, required this.materiais});

  factory EventoDetalhe.fromJson(Map<String, dynamic> json) {
    final itens = campo<List<dynamic>>(json, 'materiais');
    final materiais = <MaterialAula>[];
    for (final item in itens) {
      if (item is! Map<String, dynamic>) {
        throw FormatException('campo "materiais" tem item inválido');
      }
      materiais.add(MaterialAula.fromJson(item));
    }
    return EventoDetalhe(evento: Evento.fromJson(json), materiais: materiais);
  }
}
