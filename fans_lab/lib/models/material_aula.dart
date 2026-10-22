import 'package:fans_lab/models/autoria.dart';
import 'package:fans_lab/models/formatos.dart';

/// Material vinculado a um evento. Não chamar de `Material`: colide com o widget do Flutter.
class MaterialAula {
  final String id;
  final String tipo;
  final String titulo;
  final String? url;
  final DateTime? dataAula;
  final Autoria autoria;

  MaterialAula({
    required this.id,
    required this.tipo,
    required this.titulo,
    this.url,
    this.dataAula,
    required this.autoria,
  });

  factory MaterialAula.fromJson(Map<String, dynamic> json) => MaterialAula(
    id: campo<String>(json, 'id'),
    tipo: campo<String>(json, 'tipo'),
    titulo: campo<String>(json, 'titulo'),
    url: campoOpcional<String>(json, 'url'),
    dataAula: lerDataOpcional(campoOpcional<String>(json, 'dataAula')),
    autoria: Autoria.fromJson(campo<Map<String, dynamic>>(json, 'autoria')),
  );
}
