import 'package:fans_lab/models/autoria.dart';
import 'package:fans_lab/models/formatos.dart';
import 'package:fans_lab/models/tipo_evento.dart';

/// Evento compartilhado pela turma. Não tem campo `feito`: isso é estado pessoal.
class Evento {
  final String id;
  final TipoEvento tipo;
  final String titulo;
  final DateTime data;
  final String? hora;
  final String? sala;
  final String materiaId;
  final String materiaSigla;
  final String materiaCorHex;
  final Autoria autoria;
  final int version;
  final bool visivelTurma;
  final DateTime? excluidoEm;

  Evento({
    required this.id,
    required this.tipo,
    required this.titulo,
    required this.data,
    this.hora,
    this.sala,
    required this.materiaId,
    required this.materiaSigla,
    required this.materiaCorHex,
    required this.autoria,
    required this.version,
    required this.visivelTurma,
    this.excluidoEm,
  });

  factory Evento.fromJson(Map<String, dynamic> json) => Evento(
    id: campo<String>(json, 'id'),
    tipo: TipoEvento.fromJson(campo<String>(json, 'tipo')),
    titulo: campo<String>(json, 'titulo'),
    data: lerData(campo<String>(json, 'data')),
    hora: horaCurta(campoOpcional<String>(json, 'hora')),
    sala: campoOpcional<String>(json, 'sala'),
    materiaId: campo<String>(json, 'materiaId'),
    materiaSigla: campo<String>(json, 'materiaSigla'),
    materiaCorHex: campo<String>(json, 'materiaCorHex'),
    autoria: Autoria.fromJson(campo<Map<String, dynamic>>(json, 'autoria')),
    version: campo<int>(json, 'version'),
    visivelTurma: campo<bool>(json, 'visivelTurma'),
    excluidoEm: lerInstanteOpcional(campoOpcional<String>(json, 'excluidoEm')),
  );
}
