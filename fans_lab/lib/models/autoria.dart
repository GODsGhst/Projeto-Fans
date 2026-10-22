import 'package:fans_lab/models/formatos.dart';

/// Quem postou e quando. Todo evento e material tem autoria: não existe registro anônimo.
class Autoria {
  final String autorId;
  final String autorNome;
  final String? autorSelo;
  final DateTime criadoEm;
  final DateTime? atualizadoEm;
  final String? editadoPorNome;
  final String? editadoPorSelo;

  Autoria({
    required this.autorId,
    required this.autorNome,
    this.autorSelo,
    required this.criadoEm,
    this.atualizadoEm,
    this.editadoPorNome,
    this.editadoPorSelo,
  });

  factory Autoria.fromJson(Map<String, dynamic> json) => Autoria(
    autorId: campo<String>(json, 'autorId'),
    autorNome: campo<String>(json, 'autorNome'),
    autorSelo: campoOpcional<String>(json, 'autorSelo'),
    criadoEm: lerInstante(campo<String>(json, 'criadoEm')),
    atualizadoEm: lerInstanteOpcional(
      campoOpcional<String>(json, 'atualizadoEm'),
    ),
    editadoPorNome: campoOpcional<String>(json, 'editadoPorNome'),
    editadoPorSelo: campoOpcional<String>(json, 'editadoPorSelo'),
  );

  Map<String, dynamic> toJson() => {
    'autorId': autorId,
    'autorNome': autorNome,
    'autorSelo': autorSelo,
    'criadoEm': criadoEm.toUtc().toIso8601String(),
    'atualizadoEm': atualizadoEm?.toUtc().toIso8601String(),
    'editadoPorNome': editadoPorNome,
    'editadoPorSelo': editadoPorSelo,
  };
}
