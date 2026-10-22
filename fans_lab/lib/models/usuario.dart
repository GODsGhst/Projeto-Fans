import 'package:fans_lab/models/formatos.dart';

class Usuario {
  final String id;
  final String nome;
  final String email;

  Usuario({required this.id, required this.nome, required this.email});

  factory Usuario.fromJson(Map<String, dynamic> json) => Usuario(
    id: campo<String>(json, 'id'),
    nome: campo<String>(json, 'nome'),
    email: campo<String>(json, 'email'),
  );

  Map<String, dynamic> toJson() => {'id': id, 'nome': nome, 'email': email};
}
