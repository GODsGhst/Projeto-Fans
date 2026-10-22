import 'package:fans_lab/models/formatos.dart';
import 'package:fans_lab/models/usuario.dart';

/// Sessão guardada no SharedPreferences. Mesmo formato do AuthResponse da API,
/// então `toJson` e `fromJson` são ida e volta.
class Sessao {
  final String jwt;
  final Usuario usuario;
  final String? turmaId;

  Sessao({required this.jwt, required this.usuario, this.turmaId});

  factory Sessao.fromJson(Map<String, dynamic> json) => Sessao(
    jwt: campo<String>(json, 'jwt'),
    usuario: Usuario.fromJson(campo<Map<String, dynamic>>(json, 'usuario')),
    turmaId: campoOpcional<String>(json, 'turmaId'),
  );

  Map<String, dynamic> toJson() => {
    'jwt': jwt,
    'usuario': usuario.toJson(),
    'turmaId': turmaId,
  };
}
