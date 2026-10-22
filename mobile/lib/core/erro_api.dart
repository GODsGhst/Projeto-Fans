/// Classe de cada falha de HTTP. Espelha ClasseErro do Ionic.
enum ClasseErro {
  demorou,
  auth,
  proibido,
  naoEncontrado,
  precondicao,
  conflito,
  servidor,
  offline,
  desconhecido,
}

/// Erro de domínio: toda falha de HTTP chega à tela assim, com a frase já pronta.
/// Nenhuma tela lê status cru.
class ErroApi implements Exception {
  const ErroApi({
    required this.classe,
    required this.status,
    required this.message,
    this.podeTentarNovamente = false,
    this.recarregarRegistro = false,
    this.codigo,
  });

  final ClasseErro classe;

  /// 0 em OFFLINE e DEMOROU; status HTTP nos demais.
  final int status;

  /// Texto pronto para a tela. Vem do detail do servidor quando há um.
  final String message;

  /// true em OFFLINE, DEMOROU e SERVIDOR.
  final bool podeTentarNovamente;

  /// true só em CONFLITO (409): a tela relê o registro antes de insistir.
  final bool recarregarRegistro;

  /// ProblemDetail.codigo, só lido em 404. Hoje só 'SEM_TURMA' importa.
  final String? codigo;

  @override
  String toString() => 'ErroApi(${classe.name}, $status): $message';
}

/// Texto para a tela a partir de qualquer erro.
String mensagemDeErro(Object e) => e is ErroApi
    ? e.message
    : 'Não deu para completar a ação. Tente de novo.';
