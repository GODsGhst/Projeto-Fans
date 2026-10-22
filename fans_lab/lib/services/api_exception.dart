/// Qualquer falha da camada HTTP. A mensagem já vem em português, pronta para a tela.
class ApiException implements Exception {
  /// Código HTTP; `null` quando a requisição nem chegou ao servidor.
  final int? status;

  /// Texto para o usuário.
  final String mensagem;

  /// `true` quando não houve resposta (sem rede, timeout, TLS).
  final bool semConexao;

  const ApiException.http(int this.status, this.mensagem) : semConexao = false;

  const ApiException.semConexao([this.mensagem = 'Sem conexão com o servidor.'])
      : status = null,
        semConexao = true;

  const ApiException.respostaInvalida(int this.status)
      : mensagem = 'O servidor respondeu num formato inesperado.',
        semConexao = false;

  bool get naoAutorizado => status == 401;

  bool get conflito => status == 409;

  bool get naoEncontrado => status == 404;

  @override
  String toString() => mensagem;
}
