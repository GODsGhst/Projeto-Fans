import 'package:fans_lab/models/formatos.dart';

class Materia {
  final String id;
  final String nome;
  final String sigla;
  final String corHex;
  final String? sala;
  final String? professor;

  Materia({
    required this.id,
    required this.nome,
    required this.sigla,
    required this.corHex,
    this.sala,
    this.professor,
  });

  factory Materia.fromJson(Map<String, dynamic> json) => Materia(
    id: campo<String>(json, 'id'),
    nome: campo<String>(json, 'nome'),
    sigla: campo<String>(json, 'sigla'),
    corHex: campo<String>(json, 'corHex'),
    sala: campoOpcional<String>(json, 'sala'),
    professor: campoOpcional<String>(json, 'professor'),
  );

  Map<String, dynamic> toMap() => {
    'id': id,
    'nome': nome,
    'sigla': sigla,
    'cor_hex': corHex,
    'sala': sala,
    'professor': professor,
  };

  factory Materia.fromMap(Map<String, dynamic> map) => Materia(
    id: campo<String>(map, 'id'),
    nome: campo<String>(map, 'nome'),
    sigla: campo<String>(map, 'sigla'),
    corHex: campo<String>(map, 'cor_hex'),
    sala: campoOpcional<String>(map, 'sala'),
    professor: campoOpcional<String>(map, 'professor'),
  );
}
