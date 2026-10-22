import 'dart:async';
import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';

import '../data/models.dart';
import 'api.dart';
import 'armazenamento.dart';

/// Para onde o 401 devolve o usuário.
const String rotaLogin = '/login';

/// Sessão do usuário. Ter sessão e ter turma são estados distintos.
class AuthService extends ChangeNotifier {
  AuthService({
    required this.api,
    required this.armazenamento,
    this.aoEsquecerLembretes,
  });

  final ApiClient api;
  final Armazenamento armazenamento;

  /// Cancela os lembretes da conta que saiu. Chamado sem await. Falha vai para o log.
  final FutureOr<void> Function()? aoEsquecerLembretes;

  String? _token;
  Usuario? _usuario;
  String? _turmaId;

  String? get token => _token;
  Usuario? get usuario => _usuario;
  String? get turmaId => _turmaId;
  bool get autenticado => _token != null;
  bool get temTurma => _turmaId != null;

  /// Pelo tipo da conta, não pelo status. Professor pendente também é docente.
  bool get ehDocente => ehContaDocente(_usuario);

  /// Lê a sessão do disco. Não espera GET /eu: a atualização do tipo chega depois.
  /// Falha de plataforma (não de JSON) propaga.
  Future<void> restaurar() async {
    final sessao = await armazenamento.lerSessao();
    if (sessao == null) return;
    _definir(sessao.jwt, sessao.usuario, turmaId: sessao.turmaId);
    unawaited(_atualizarTipoDaSessao());
  }

  /// Só atualiza tipoConta e docenteStatus. Falha mantém o gravado. 401 já foi tratado.
  Future<void> _atualizarTipoDaSessao() async {
    final jwt = _token;
    try {
      final eu = Perfil.fromJson(await api.get<Map<String, dynamic>>('/eu'));
      final atual = _usuario;
      // Se a pessoa saiu ou outra entrou durante a ida, descarta.
      if (jwt == null || atual == null || _token != jwt) return;
      if (atual.tipoConta != eu.tipoConta ||
          atual.docenteStatus != eu.docenteStatus) {
        await renovarSessao(
          jwt,
          Usuario(
            id: atual.id,
            nome: atual.nome,
            email: atual.email,
            tipoConta: eu.tipoConta,
            docenteStatus: eu.docenteStatus,
          ),
        );
      }
    } catch (e, s) {
      developer.log(
        '[auth] não atualizei o tipo da conta; fica o gravado',
        name: 'auth',
        error: e,
        stackTrace: s,
        level: 900,
      );
    }
  }

  /// tipoConta só vai no corpo quando não é aluno.
  Future<void> registrar(
    String nome,
    String email,
    String senha, {
    TipoConta tipoConta = TipoConta.aluno,
  }) async {
    final corpo = RegistrarRequest(
      nome: nome,
      email: email,
      senha: senha,
      tipoConta: tipoConta,
    );
    await _aplicar(
      SessaoResponse.fromJson(
        await api.post<Map<String, dynamic>>(
          '/auth/registrar',
          corpo: corpo.toJson(),
        ),
      ),
    );
  }

  Future<void> entrar(String email, String senha) async {
    await _aplicar(
      SessaoResponse.fromJson(
        await api.post<Map<String, dynamic>>(
          '/auth/login',
          corpo: LoginRequest(email: email, senha: senha).toJson(),
        ),
      ),
    );
  }

  Future<void> entrarComGoogle(String idToken) async {
    await _aplicar(
      SessaoResponse.fromJson(
        await api.post<Map<String, dynamic>>(
          '/auth/google',
          corpo: GoogleLoginRequest(idToken: idToken).toJson(),
        ),
      ),
    );
  }

  /// 204 sempre, mesmo para e-mail inexistente. Não toca na sessão.
  Future<void> esqueciSenha(String email) async {
    await api.post<void>(
      '/auth/senha/esqueci',
      corpo: EsqueciSenhaRequest(email: email).toJson(),
    );
  }

  /// 204. Não emite sessão.
  Future<void> resetarSenha(String token, String novaSenha) async {
    await api.post<void>(
      '/auth/senha/reset',
      corpo: ResetSenhaRequest(token: token, novaSenha: novaSenha).toJson(),
    );
  }

  Future<Perfil> obterPerfil() async =>
      Perfil.fromJson(await api.get<Map<String, dynamic>>('/eu'));

  /// O JWT carrega o nome, então o servidor devolve token novo. Só grava se o token
  /// não mudou durante a chamada.
  Future<Perfil> atualizarNome(String nome) async {
    final antes = _token;
    final r = AtualizarNomeResponse.fromJson(
      await api.patch<Map<String, dynamic>>(
        '/eu',
        corpo: AtualizarPerfilRequest(nome: nome).toJson(),
      ),
    );
    if (_token == antes) {
      await renovarSessao(r.jwt, r.perfil.comoUsuario);
    }
    return r.perfil;
  }

  /// Senha atual errada volta 400, não 401: 401 deslogaria quem só errou a senha.
  Future<void> trocarSenha(String senhaAtual, String novaSenha) async {
    final antes = _token;
    final r = TrocarSenhaResponse.fromJson(
      await api.post<Map<String, dynamic>>(
        '/eu/senha',
        corpo: TrocarSenhaRequest(
          senhaAtual: senhaAtual,
          novaSenha: novaSenha,
        ).toJson(),
      ),
    );
    final usuario = _usuario;
    if (_token == antes && usuario != null) {
      await renovarSessao(r.jwt, usuario);
    }
  }

  Future<Membro> entrarNaTurma(String codigoConvite) async {
    final membro = Membro.fromJson(
      await api.post<Map<String, dynamic>>(
        '/turmas/entrar',
        corpo: EntrarNaTurmaRequest(codigoConvite: codigoConvite).toJson(),
      ),
    );
    await registrarTurma(membro.turmaId);
    return membro;
  }

  /// Também usado por quem CRIA turma. Null = a pessoa foi removida: sai o snapshot e os lembretes.
  /// Memória primeiro. Mesmo se gravar a sessão falhar, a limpeza acontece e o erro sobe.
  Future<void> registrarTurma(String? turmaId) async {
    _turmaId = turmaId;
    notifyListeners();
    final usuario = _usuario;
    final jwt = _token;
    try {
      if (jwt != null && usuario != null) {
        await armazenamento.gravarSessao(jwt, usuario, turmaId);
      }
    } finally {
      if (turmaId == null) {
        _esquecerLembretes();
        await armazenamento.limparSnapshot();
      }
    }
  }

  /// Sai de verdade: memória, lembretes, sessão e snapshot. Não chama o servidor.
  /// Não apaga a turma ativa do docente.
  Future<void> sair() async {
    _zerar();
    _esquecerLembretes();
    try {
      await armazenamento.limparSessao();
    } finally {
      await armazenamento.limparSnapshot();
    }
  }

  /// Usado pelo 401. Síncrono: o disco vai atrás, sem await. NÃO apaga o snapshot.
  void encerrarSessao() {
    _zerar();
    _esquecerLembretes();
    unawaited(
      armazenamento.limparSessao().catchError((Object e, StackTrace s) {
        developer.log(
          '[auth] falha ao apagar a sessão local',
          name: 'auth',
          error: e,
          stackTrace: s,
          level: 1000,
        );
      }),
    );
  }

  /// Só memória. turmaId ausente vira null.
  void definirSessao(String jwt, Usuario usuario, {String? turmaId}) =>
      _definir(jwt, usuario, turmaId: turmaId);

  /// Token e usuário novos, mesma turma. Não usar definirSessao: ela zeraria a turma.
  Future<void> renovarSessao(String jwt, Usuario usuario) async {
    _token = jwt;
    _usuario = usuario;
    notifyListeners();
    await armazenamento.gravarSessao(jwt, usuario, _turmaId);
  }

  Future<void> _aplicar(SessaoResponse sessao) async {
    _definir(sessao.jwt, sessao.usuario, turmaId: sessao.turmaId);
    await armazenamento.gravarSessao(sessao.jwt, sessao.usuario, sessao.turmaId);
  }

  void _definir(String jwt, Usuario usuario, {String? turmaId}) {
    _token = jwt;
    _usuario = usuario;
    _turmaId = turmaId;
    notifyListeners();
  }

  void _zerar() {
    _token = null;
    _usuario = null;
    _turmaId = null;
    notifyListeners();
  }

  /// Sem await. Falha vai para o log e não trava a saída.
  void _esquecerLembretes() {
    final cb = aoEsquecerLembretes;
    if (cb == null) return;
    unawaited(
      Future<void>.sync(cb).catchError((Object e, StackTrace s) {
        developer.log(
          '[auth] falha ao cancelar os lembretes',
          name: 'auth',
          error: e,
          stackTrace: s,
          level: 1000,
        );
      }),
    );
  }
}
