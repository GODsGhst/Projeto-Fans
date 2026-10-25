// Modelos de todas as áreas (docs/spec/*.json, campo "modelos").
//
// Regras de leitura, em todo fromJson:
// - Campo opcional ausente ou nulo vira null. O backend omite campo nulo (Jackson non_null).
// - Campo obrigatório ausente ou de tipo errado lança FormatException.
// - Enum desconhecido vira null em campo opcional e lança em campo obrigatório.
// - Datas e horas ficam como String, como o servidor manda. Exibição corta, nunca DateTime.parse.
//
// toJson existe só onde o app grava (snapshot, sessão, lembretes) ou envia (requests).
//
// Atenção: Material tem o mesmo nome do widget Material do Flutter. Quem importa os dois usa prefixo.

/// Enum que se escreve no fio (JSON) com um texto próprio.
abstract interface class Wire {
  String get wire;
}

T? _enumOpc<T extends Wire>(List<T> valores, Object? v) {
  if (v is! String) return null;
  for (final e in valores) {
    if (e.wire == v) return e;
  }
  return null;
}

T _enumObrig<T extends Wire>(
  Map<String, dynamic> j,
  String campo,
  List<T> valores,
) =>
    _enumOpc(valores, j[campo]) ??
    (throw FormatException('"$campo" ausente ou inválido', j));

String? _texto(Object? v) => v is String ? v : null;

bool? _bool(Object? v) => v is bool ? v : null;

int? _int(Object? v) => v is int ? v : null;

String _reqStr(Map<String, dynamic> j, String campo) {
  final v = j[campo];
  if (v is String) return v;
  throw FormatException('"$campo" ausente ou inválido', j);
}

bool _reqBool(Map<String, dynamic> j, String campo) {
  final v = j[campo];
  if (v is bool) return v;
  throw FormatException('"$campo" ausente ou inválido', j);
}

int _reqInt(Map<String, dynamic> j, String campo) {
  final v = j[campo];
  if (v is int) return v;
  throw FormatException('"$campo" ausente ou inválido', j);
}

Map<String, dynamic> _reqMap(Map<String, dynamic> j, String campo) {
  final v = j[campo];
  if (v is Map<String, dynamic>) return v;
  throw FormatException('"$campo" ausente ou inválido', j);
}

List<T> _reqLista<T>(
  Map<String, dynamic> j,
  String campo,
  T Function(Map<String, dynamic>) de,
) {
  final v = j[campo];
  if (v is! List) throw FormatException('"$campo" ausente ou inválido', j);
  return [for (final e in v) de(e as Map<String, dynamic>)];
}

List<String> _strings(Object? v) =>
    v is List ? [for (final e in v) e as String] : <String>[];

// ---------------------------------------------------------------- enums

enum TipoConta implements Wire {
  aluno,
  professor,
  coordenador;

  @override
  String get wire => name.toUpperCase();
}

enum DocenteStatus implements Wire {
  pendente,
  aprovado,
  recusado;

  @override
  String get wire => name.toUpperCase();
}

enum PapelMembro implements Wire {
  aluno,
  lider,
  professor,
  coordenador;

  @override
  String get wire => name.toUpperCase();
}

/// Docente nunca é líder. Só PROFESSOR e COORDENADOR.
enum PapelDocente implements Wire {
  professor,
  coordenador;

  @override
  String get wire => name.toUpperCase();
}

/// Quem tem poder na autoria. COORDENACAO, não COORDENADOR: o selo nomeia a função.
enum Selo implements Wire {
  professor,
  coordenacao;

  @override
  String get wire => name.toUpperCase();
}

enum TipoEvento implements Wire {
  prova,
  entrega;

  @override
  String get wire => name.toUpperCase();
}

enum TipoMaterial implements Wire {
  aula,
  adicional;

  @override
  String get wire => name.toUpperCase();
}

enum AlcanceNota implements Wire {
  turma,
  pessoal;

  @override
  String get wire => name.toUpperCase();
}

/// Alcance de moderação do líder (MeuAlcance.tipo).
enum TipoAlcance implements Wire {
  nenhum,
  materias,
  turma;

  @override
  String get wire => name.toUpperCase();
}

/// Tipo de registro moderável. A rota usa o nome em minúsculas (evento, material, nota).
enum RegistroTipo implements Wire {
  evento,
  material,
  nota;

  @override
  String get wire => name.toUpperCase();

  /// Segmento de rota (TipoModeravel).
  String get rota => name;
}

enum TipoLembrete implements Wire {
  noDia('NO_DIA'),
  vespera('VESPERA'),
  umaHora('UMA_HORA'),
  personalizado('PERSONALIZADO');

  const TipoLembrete(this.wire);

  @override
  final String wire;
}

enum EstadoAviso implements Wire {
  semSuporte('sem-suporte'),
  granted('granted'),
  denied('denied'),
  prompt('prompt');

  const EstadoAviso(this.wire);

  @override
  final String wire;
}

enum EstadoExato implements Wire {
  semSuporte('sem-suporte'),
  granted('granted'),
  denied('denied');

  const EstadoExato(this.wire);

  @override
  final String wire;
}

enum ResultadoTeste implements Wire {
  agendado('agendado'),
  negado('negado'),
  semSuporte('sem-suporte');

  const ResultadoTeste(this.wire);

  @override
  final String wire;
}

// ---------------------------------------------------------------- erro do servidor

/// Corpo de erro do backend (RFC 7807). O app usa detail, depois title, depois codigo.
class ProblemDetail {
  const ProblemDetail({
    this.type,
    this.title,
    this.status,
    this.detail,
    this.instance,
    this.codigo,
  });

  factory ProblemDetail.fromJson(Map<String, dynamic> j) => ProblemDetail(
        type: _texto(j['type']),
        title: _texto(j['title']),
        status: _int(j['status']),
        detail: _texto(j['detail']),
        instance: _texto(j['instance']),
        codigo: _texto(j['codigo']),
      );

  final String? type;
  final String? title;
  final int? status;
  final String? detail;
  final String? instance;

  /// Propriedade raiz do JSON. Só 'SEM_TURMA' é tratado pelo app.
  final String? codigo;
}

// ---------------------------------------------------------------- conta e sessão

class Usuario {
  const Usuario({
    required this.id,
    required this.nome,
    required this.email,
    this.tipoConta,
    this.docenteStatus,
  });

  factory Usuario.fromJson(Map<String, dynamic> j) => Usuario(
        id: _reqStr(j, 'id'),
        nome: _reqStr(j, 'nome'),
        email: _reqStr(j, 'email'),
        tipoConta: _enumOpc(TipoConta.values, j['tipoConta']),
        docenteStatus: _enumOpc(DocenteStatus.values, j['docenteStatus']),
      );

  final String id;
  final String nome;
  final String email;

  /// Ausente = aluno. Sessão gravada antes da onda docente não tem o campo.
  final TipoConta? tipoConta;

  /// Só docente tem status. Aluno: null.
  final DocenteStatus? docenteStatus;

  Map<String, dynamic> toJson() => {
        'id': id,
        'nome': nome,
        'email': email,
        'tipoConta': tipoConta?.wire,
        'docenteStatus': docenteStatus?.wire,
      };
}

/// GET /eu. A conta, mais o que só a tela de perfil precisa.
class Perfil extends Usuario {
  const Perfil({
    required super.id,
    required super.nome,
    required super.email,
    super.tipoConta,
    super.docenteStatus,
    required this.adminPlataforma,
    required this.temSenha,
  });

  factory Perfil.fromJson(Map<String, dynamic> j) {
    final u = Usuario.fromJson(j);
    return Perfil(
      id: u.id,
      nome: u.nome,
      email: u.email,
      tipoConta: u.tipoConta,
      docenteStatus: u.docenteStatus,
      adminPlataforma: _reqBool(j, 'adminPlataforma'),
      temSenha: _reqBool(j, 'temSenha'),
    );
  }

  final bool adminPlataforma;

  /// false = conta só Google, sem senha.
  final bool temSenha;

  /// Só o que mora na sessão. adminPlataforma e temSenha não são gravados.
  Usuario get comoUsuario => Usuario(
        id: id,
        nome: nome,
        email: email,
        tipoConta: tipoConta,
        docenteStatus: docenteStatus,
      );
}

class SessaoResponse {
  const SessaoResponse({required this.jwt, required this.usuario, this.turmaId});

  factory SessaoResponse.fromJson(Map<String, dynamic> j) => SessaoResponse(
        jwt: _reqStr(j, 'jwt'),
        usuario: Usuario.fromJson(_reqMap(j, 'usuario')),
        turmaId: _texto(j['turmaId']),
      );

  final String jwt;
  final Usuario usuario;

  /// Null ou ausente = sem turma. Estado normal de quem acabou de se cadastrar.
  final String? turmaId;

  Map<String, dynamic> toJson() => {
        'jwt': jwt,
        'usuario': usuario.toJson(),
        'turmaId': turmaId,
      };
}

/// Sessão no disco (chave pf.sessao). Mesmo formato de SessaoResponse.
typedef SessaoLocal = SessaoResponse;

class AtualizarNomeResponse {
  const AtualizarNomeResponse({required this.jwt, required this.perfil});

  factory AtualizarNomeResponse.fromJson(Map<String, dynamic> j) =>
      AtualizarNomeResponse(
        jwt: _reqStr(j, 'jwt'),
        perfil: Perfil.fromJson(_reqMap(j, 'perfil')),
      );

  final String jwt;
  final Perfil perfil;
}

class TrocarSenhaResponse {
  const TrocarSenhaResponse({required this.jwt});

  factory TrocarSenhaResponse.fromJson(Map<String, dynamic> j) =>
      TrocarSenhaResponse(jwt: _reqStr(j, 'jwt'));

  final String jwt;
}

// ---------------------------------------------------------------- requests de auth

class LoginRequest {
  const LoginRequest({required this.email, required this.senha});

  final String email;
  final String senha;

  Map<String, dynamic> toJson() => {'email': email, 'senha': senha};
}

class RegistrarRequest {
  const RegistrarRequest({
    required this.nome,
    required this.email,
    required this.senha,
    this.tipoConta = TipoConta.aluno,
  });

  final String nome;
  final String email;
  final String senha;

  /// Aluno não manda o campo: a chave tipoConta fica fora do corpo.
  final TipoConta tipoConta;

  Map<String, dynamic> toJson() => {
        'nome': nome,
        'email': email,
        'senha': senha,
        if (tipoConta != TipoConta.aluno) 'tipoConta': tipoConta.wire,
      };
}

class GoogleLoginRequest {
  const GoogleLoginRequest({required this.idToken});

  final String idToken;

  Map<String, dynamic> toJson() => {'idToken': idToken};
}

class EsqueciSenhaRequest {
  const EsqueciSenhaRequest({required this.email});

  final String email;

  Map<String, dynamic> toJson() => {'email': email};
}

class ResetSenhaRequest {
  const ResetSenhaRequest({required this.token, required this.novaSenha});

  final String token;
  final String novaSenha;

  Map<String, dynamic> toJson() => {'token': token, 'novaSenha': novaSenha};
}

class EntrarNaTurmaRequest {
  const EntrarNaTurmaRequest({required this.codigoConvite});

  final String codigoConvite;

  Map<String, dynamic> toJson() => {'codigoConvite': codigoConvite};
}

/// semestre vai como null explícito quando vazio.
class CriarTurmaRequest {
  const CriarTurmaRequest({required this.nome, this.semestre});

  final String nome;
  final String? semestre;

  Map<String, dynamic> toJson() => {'nome': nome, 'semestre': semestre};
}

/// PATCH /eu. Só o nome.
class AtualizarPerfilRequest {
  const AtualizarPerfilRequest({required this.nome});

  final String nome;

  Map<String, dynamic> toJson() => {'nome': nome};
}

class TrocarSenhaRequest {
  const TrocarSenhaRequest({required this.senhaAtual, required this.novaSenha});

  final String senhaAtual;
  final String novaSenha;

  Map<String, dynamic> toJson() =>
      {'senhaAtual': senhaAtual, 'novaSenha': novaSenha};
}

// ---------------------------------------------------------------- turma

/// POST /turmas.
class TurmaCriada {
  const TurmaCriada({
    required this.id,
    required this.nome,
    required this.codigoConvite,
    this.semestre,
  });

  factory TurmaCriada.fromJson(Map<String, dynamic> j) => TurmaCriada(
        id: _reqStr(j, 'id'),
        nome: _reqStr(j, 'nome'),
        codigoConvite: _reqStr(j, 'codigoConvite'),
        semestre: _texto(j['semestre']),
      );

  final String id;
  final String nome;
  final String? semestre;
  final String codigoConvite;
}

/// POST /turmas/entrar. O backend manda só id, turmaId e papel: usuarioId e entrouEm são opcionais.
class Membro {
  const Membro({
    required this.id,
    required this.turmaId,
    required this.papel,
    this.usuarioId,
    this.entrouEm,
  });

  factory Membro.fromJson(Map<String, dynamic> j) => Membro(
        id: _reqStr(j, 'id'),
        turmaId: _reqStr(j, 'turmaId'),
        papel: _enumObrig(j, 'papel', PapelMembro.values),
        usuarioId: _texto(j['usuarioId']),
        entrouEm: _texto(j['entrouEm']),
      );

  final String id;
  final String turmaId;
  final PapelMembro papel;
  final String? usuarioId;
  final String? entrouEm;
}

class MeuAlcance {
  const MeuAlcance({required this.tipo, required this.materiaIds});

  factory MeuAlcance.fromJson(Map<String, dynamic> j) => MeuAlcance(
        tipo: _enumObrig(j, 'tipo', TipoAlcance.values),
        materiaIds: _strings(j['materiaIds']),
      );

  final TipoAlcance tipo;
  final List<String> materiaIds;
}

class MembroDaTurma {
  const MembroDaTurma({
    required this.usuarioId,
    required this.nome,
    required this.papel,
    required this.entrouEm,
    this.selo,
    this.contestado = false,
    this.lecionadas = const [],
  });

  factory MembroDaTurma.fromJson(Map<String, dynamic> j) => MembroDaTurma(
        usuarioId: _reqStr(j, 'usuarioId'),
        nome: _reqStr(j, 'nome'),
        papel: _enumObrig(j, 'papel', PapelMembro.values),
        entrouEm: _reqStr(j, 'entrouEm'),
        selo: _enumOpc(Selo.values, j['selo']),
        contestado: _bool(j['contestado']) ?? false,
        lecionadas: _strings(j['lecionadas']),
      );

  final String usuarioId;
  final String nome;
  final PapelMembro papel;

  /// String ISO-8601. Quem exibe trata parse falho como ''.
  final String entrouEm;
  final Selo? selo;
  final bool contestado;

  /// Siglas, não ids.
  final List<String> lecionadas;
}

/// GET /turmas/minha. Só o id é usado no fluxo de entrada.
class MinhaTurma {
  const MinhaTurma({
    required this.id,
    required this.nome,
    required this.codigoConvite,
    required this.membros,
    this.semestre,
    this.meuAlcance,
  });

  factory MinhaTurma.fromJson(Map<String, dynamic> j) => MinhaTurma(
        id: _reqStr(j, 'id'),
        nome: _reqStr(j, 'nome'),
        codigoConvite: _reqStr(j, 'codigoConvite'),
        semestre: _texto(j['semestre']),
        membros: _reqLista(j, 'membros', MembroDaTurma.fromJson),
        meuAlcance: j['meuAlcance'] is Map<String, dynamic>
            ? MeuAlcance.fromJson(j['meuAlcance'] as Map<String, dynamic>)
            : null,
      );

  final String id;
  final String nome;
  final String? semestre;
  final String codigoConvite;
  final List<MembroDaTurma> membros;

  /// Ausente = NENHUM.
  final MeuAlcance? meuAlcance;
}

/// Par id e nome de uma turma.
class TurmaRef {
  const TurmaRef({required this.turmaId, required this.nome});

  final String turmaId;
  final String nome;
}

/// Turma ativa do docente (chave pf.turmaAtiva). Só vale se usuarioId for o logado.
class TurmaAtiva {
  const TurmaAtiva({
    required this.usuarioId,
    required this.turmaId,
    required this.nome,
  });

  /// Null se algum campo faltar ou tiver tipo errado. Ignorado em silêncio.
  static TurmaAtiva? tryFromJson(Map<String, dynamic> j) {
    final usuarioId = j['usuarioId'];
    final turmaId = j['turmaId'];
    final nome = j['nome'];
    if (usuarioId is! String || turmaId is! String || nome is! String) {
      return null;
    }
    return TurmaAtiva(usuarioId: usuarioId, turmaId: turmaId, nome: nome);
  }

  final String usuarioId;
  final String turmaId;
  final String nome;

  Map<String, dynamic> toJson() => {
        'usuarioId': usuarioId,
        'turmaId': turmaId,
        'nome': nome,
      };
}

/// Conta na sessão é docente? Tipo define a interface, não o status. Ausente = aluno.
bool ehContaDocente(Usuario? u) {
  final tipo = u?.tipoConta;
  return tipo != null && tipo != TipoConta.aluno;
}

/// Status do docente. Null para aluno.
DocenteStatus? statusDocente(Usuario? u) => u?.docenteStatus;

// ---------------------------------------------------------------- matéria e eventos

class Materia {
  const Materia({
    required this.id,
    required this.nome,
    required this.sigla,
    required this.corHex,
    this.sala,
    this.professor,
  });

  factory Materia.fromJson(Map<String, dynamic> j) => Materia(
        id: _reqStr(j, 'id'),
        nome: _reqStr(j, 'nome'),
        sigla: _reqStr(j, 'sigla'),
        corHex: _reqStr(j, 'corHex'),
        sala: _texto(j['sala']),
        professor: _texto(j['professor']),
      );

  final String id;
  final String nome;
  final String sigla;

  /// Uma das 12 hues da paleta. Vem do servidor, nunca digitada.
  final String corHex;
  final String? sala;
  final String? professor;

  Map<String, dynamic> toJson() => {
        'id': id,
        'nome': nome,
        'sigla': sigla,
        'corHex': corHex,
        'sala': sala,
        'professor': professor,
      };
}

class Autoria {
  const Autoria({
    required this.autorId,
    required this.autorNome,
    required this.criadoEm,
    required this.atualizadoEm,
    this.autorSelo,
    this.editadoPorNome,
    this.editadoPorSelo,
  });

  factory Autoria.fromJson(Map<String, dynamic> j) => Autoria(
        autorId: _reqStr(j, 'autorId'),
        autorNome: _reqStr(j, 'autorNome'),
        criadoEm: _reqStr(j, 'criadoEm'),
        atualizadoEm: _reqStr(j, 'atualizadoEm'),
        autorSelo: _enumOpc(Selo.values, j['autorSelo']),
        editadoPorNome: _texto(j['editadoPorNome']),
        editadoPorSelo: _enumOpc(Selo.values, j['editadoPorSelo']),
      );

  final String autorId;
  final String autorNome;

  /// ISO instant.
  final String criadoEm;
  final String atualizadoEm;

  /// Ausente = sem poder na matéria.
  final Selo? autorSelo;

  /// Ausente = ninguém além do autor corrigiu.
  final String? editadoPorNome;
  final Selo? editadoPorSelo;

  Map<String, dynamic> toJson() => {
        'autorId': autorId,
        'autorNome': autorNome,
        'criadoEm': criadoEm,
        'atualizadoEm': atualizadoEm,
        'autorSelo': autorSelo?.wire,
        'editadoPorNome': editadoPorNome,
        'editadoPorSelo': editadoPorSelo?.wire,
      };
}

/// Item de GET /home, de GET /meu-quadro e do snapshot. Já vem ordenado, na janela e no teto.
class ItemHome {
  const ItemHome({
    required this.eventoId,
    required this.tipo,
    required this.titulo,
    required this.data,
    required this.materiaSigla,
    required this.materiaCorHex,
    required this.autoria,
    required this.feitoPeloUsuario,
    this.hora,
  });

  factory ItemHome.fromJson(Map<String, dynamic> j) => ItemHome(
        eventoId: _reqStr(j, 'eventoId'),
        tipo: _enumObrig(j, 'tipo', TipoEvento.values),
        titulo: _reqStr(j, 'titulo'),
        data: _reqStr(j, 'data'),
        hora: _texto(j['hora']),
        materiaSigla: _reqStr(j, 'materiaSigla'),
        materiaCorHex: _reqStr(j, 'materiaCorHex'),
        autoria: Autoria.fromJson(_reqMap(j, 'autoria')),
        feitoPeloUsuario: _bool(j['feitoPeloUsuario']) ?? false,
      );

  final String eventoId;
  final TipoEvento tipo;
  final String titulo;

  /// AAAA-MM-DD.
  final String data;

  /// HH:mm:ss, ou null.
  final String? hora;
  final String materiaSigla;
  final String materiaCorHex;
  final Autoria autoria;

  /// Vem de estado_pessoal.
  final bool feitoPeloUsuario;

  Map<String, dynamic> toJson() => {
        'eventoId': eventoId,
        'tipo': tipo.wire,
        'titulo': titulo,
        'data': data,
        'hora': hora,
        'materiaSigla': materiaSigla,
        'materiaCorHex': materiaCorHex,
        'autoria': autoria.toJson(),
        'feitoPeloUsuario': feitoPeloUsuario,
      };
}

/// Snapshot offline (chave pf.snapshot). Um por aparelho.
class SnapshotLocal {
  const SnapshotLocal({
    required this.eventos,
    required this.materias,
    required this.ultimoSync,
  });

  factory SnapshotLocal.fromJson(Map<String, dynamic> j) => SnapshotLocal(
        eventos: _reqLista(j, 'eventos', ItemHome.fromJson),
        materias: _reqLista(j, 'materias', Materia.fromJson),
        ultimoSync: _reqStr(j, 'ultimoSync'),
      );

  final List<ItemHome> eventos;
  final List<Materia> materias;

  /// ISO. Permite mostrar "dados de 09:15".
  final String ultimoSync;

  Map<String, dynamic> toJson() => {
        'eventos': [for (final e in eventos) e.toJson()],
        'materias': [for (final m in materias) m.toJson()],
        'ultimoSync': ultimoSync,
      };
}

class Evento {
  const Evento({
    required this.id,
    required this.tipo,
    required this.titulo,
    required this.data,
    required this.materiaId,
    required this.materiaSigla,
    required this.materiaCorHex,
    required this.autoria,
    required this.version,
    required this.visivelTurma,
    this.hora,
    this.excluidoEm,
    this.sala,
  });

  factory Evento.fromJson(Map<String, dynamic> j) => Evento(
        id: _reqStr(j, 'id'),
        tipo: _enumObrig(j, 'tipo', TipoEvento.values),
        titulo: _reqStr(j, 'titulo'),
        data: _reqStr(j, 'data'),
        hora: _texto(j['hora']),
        materiaId: _reqStr(j, 'materiaId'),
        materiaSigla: _reqStr(j, 'materiaSigla'),
        materiaCorHex: _reqStr(j, 'materiaCorHex'),
        autoria: Autoria.fromJson(_reqMap(j, 'autoria')),
        version: _reqInt(j, 'version'),
        visivelTurma: _reqBool(j, 'visivelTurma'),
        excluidoEm: _texto(j['excluidoEm']),
        sala: _texto(j['sala']),
      );

  final String id;
  final TipoEvento tipo;
  final String titulo;
  final String data;

  /// HH:mm:ss, ou null.
  final String? hora;
  final String materiaId;
  final String materiaSigla;
  final String materiaCorHex;
  final Autoria autoria;

  /// If-Match de PATCH e DELETE. Sem ele o servidor responde 428.
  final int version;
  final bool visivelTurma;
  final String? excluidoEm;

  /// Sala deste evento, quando difere da matéria. Ausente = sala da matéria.
  final String? sala;
}

/// GET /eventos/{id}. Os materiais são SÓ os vinculados a este evento.
class EventoDetalhe extends Evento {
  const EventoDetalhe({
    required super.id,
    required super.tipo,
    required super.titulo,
    required super.data,
    required super.materiaId,
    required super.materiaSigla,
    required super.materiaCorHex,
    required super.autoria,
    required super.version,
    required super.visivelTurma,
    super.hora,
    super.excluidoEm,
    super.sala,
    required this.materiais,
  });

  factory EventoDetalhe.fromJson(Map<String, dynamic> j) {
    final e = Evento.fromJson(j);
    return EventoDetalhe(
      id: e.id,
      tipo: e.tipo,
      titulo: e.titulo,
      data: e.data,
      hora: e.hora,
      materiaId: e.materiaId,
      materiaSigla: e.materiaSigla,
      materiaCorHex: e.materiaCorHex,
      autoria: e.autoria,
      version: e.version,
      visivelTurma: e.visivelTurma,
      excluidoEm: e.excluidoEm,
      sala: e.sala,
      materiais: _reqLista(j, 'materiais', Material.fromJson),
    );
  }

  final List<Material> materiais;
}

class Material {
  const Material({
    required this.id,
    required this.tipo,
    required this.titulo,
    required this.materiaId,
    required this.autoria,
    required this.version,
    required this.visivelTurma,
    this.url,
    this.arquivoRef,
    this.excluidoEm,
    this.dataAula,
    this.resumo,
    this.resumoEm,
  });

  factory Material.fromJson(Map<String, dynamic> j) => Material(
        id: _reqStr(j, 'id'),
        tipo: _enumObrig(j, 'tipo', TipoMaterial.values),
        titulo: _reqStr(j, 'titulo'),
        url: _texto(j['url']),
        arquivoRef: _texto(j['arquivoRef']),
        materiaId: _reqStr(j, 'materiaId'),
        autoria: Autoria.fromJson(_reqMap(j, 'autoria')),
        version: _reqInt(j, 'version'),
        visivelTurma: _reqBool(j, 'visivelTurma'),
        excluidoEm: _texto(j['excluidoEm']),
        dataAula: _texto(j['dataAula']),
        resumo: _texto(j['resumo']),
        resumoEm: _texto(j['resumoEm']),
      );

  final String id;
  final TipoMaterial tipo;
  final String titulo;
  final String? url;

  /// Sempre null no MVP. Upload entra na Task 15.
  final String? arquivoRef;
  final String materiaId;
  final Autoria autoria;
  final int version;
  final bool visivelTurma;
  final String? excluidoEm;

  /// AAAA-MM-DD. Ausente = não se aplica.
  final String? dataAula;

  /// Resumo por IA compartilhado com a turma.
  final String? resumo;
  final String? resumoEm;
}

/// GET /materias/{id}.
class MateriaDetalhe {
  const MateriaDetalhe({
    required this.materia,
    required this.materiaisAula,
    required this.materiaisAdicionais,
    required this.eventos,
  });

  factory MateriaDetalhe.fromJson(Map<String, dynamic> j) => MateriaDetalhe(
        materia: Materia.fromJson(_reqMap(j, 'materia')),
        materiaisAula: _reqLista(j, 'materiaisAula', Material.fromJson),
        materiaisAdicionais:
            _reqLista(j, 'materiaisAdicionais', Material.fromJson),
        eventos: _reqLista(j, 'eventos', Evento.fromJson),
      );

  final Materia materia;
  final List<Material> materiaisAula;
  final List<Material> materiaisAdicionais;
  final List<Evento> eventos;
}

/// GET /meu-quadro.
class MeuQuadro {
  const MeuQuadro({required this.aFazer, required this.feito});

  factory MeuQuadro.fromJson(Map<String, dynamic> j) => MeuQuadro(
        aFazer: _reqLista(j, 'aFazer', ItemHome.fromJson),
        feito: _reqLista(j, 'feito', ItemHome.fromJson),
      );

  final List<ItemHome> aFazer;
  final List<ItemHome> feito;
}

/// Registros do próprio autor ocultos ou excluídos.
class NaoListados {
  const NaoListados({required this.eventos, required this.materiais});

  factory NaoListados.fromJson(Map<String, dynamic> j) => NaoListados(
        eventos: _reqLista(j, 'eventos', Evento.fromJson),
        materiais: _reqLista(j, 'materiais', Material.fromJson),
      );

  final List<Evento> eventos;
  final List<Material> materiais;
}

/// POST e PATCH /eventos. O PATCH substitui tudo, por isso hora e sala vão sempre (null explícito).
class CriarEventoRequest {
  const CriarEventoRequest({
    required this.materiaId,
    required this.tipo,
    required this.titulo,
    required this.data,
    this.hora,
    this.sala,
  });

  final String materiaId;
  final TipoEvento tipo;
  final String titulo;

  /// AAAA-MM-DD.
  final String data;

  /// HH:mm. Null apaga o horário.
  final String? hora;

  /// Null = sala de sempre.
  final String? sala;

  Map<String, dynamic> toJson() => {
        'materiaId': materiaId,
        'tipo': tipo.wire,
        'titulo': titulo,
        'data': data,
        'hora': hora,
        'sala': sala,
      };
}

typedef AtualizarEventoRequest = CriarEventoRequest;

/// POST e PATCH /materiais. url é obrigatória no MVP.
class CriarMaterialRequest {
  const CriarMaterialRequest({
    required this.materiaId,
    required this.tipo,
    required this.titulo,
    required this.url,
    this.dataAula,
  });

  final String materiaId;
  final TipoMaterial tipo;
  final String titulo;
  final String url;

  /// Null = não é de uma aula.
  final String? dataAula;

  Map<String, dynamic> toJson() => {
        'materiaId': materiaId,
        'tipo': tipo.wire,
        'titulo': titulo,
        'url': url,
        'dataAula': dataAula,
      };
}

typedef AtualizarMaterialRequest = CriarMaterialRequest;

/// POST e PATCH /materias. professorId vai sempre; null quando não há escolha válida.
class CriarMateriaRequest {
  const CriarMateriaRequest({
    required this.nome,
    required this.sigla,
    required this.corHex,
    this.sala,
    this.professor,
    this.professorId,
  });

  final String nome;
  final String sigla;
  final String corHex;
  final String? sala;
  final String? professor;
  final String? professorId;

  Map<String, dynamic> toJson() => {
        'nome': nome,
        'sigla': sigla,
        'corHex': corHex,
        'sala': sala,
        'professor': professor,
        'professorId': professorId,
      };
}

// ---------------------------------------------------------------- moderação

/// Pedido de exclusão feito por alguém da turma, visto pelo líder.
class PedidoDeExclusao {
  const PedidoDeExclusao({
    required this.registroTipo,
    required this.registroId,
    required this.titulo,
    required this.pedidoPor,
    required this.em,
    this.motivo,
  });

  factory PedidoDeExclusao.fromJson(Map<String, dynamic> j) =>
      PedidoDeExclusao(
        registroTipo: _enumObrig(j, 'registroTipo', RegistroTipo.values),
        registroId: _reqStr(j, 'registroId'),
        titulo: _reqStr(j, 'titulo'),
        motivo: _texto(j['motivo']),
        pedidoPor: _reqStr(j, 'pedidoPor'),
        em: _reqStr(j, 'em'),
      );

  final RegistroTipo registroTipo;
  final String registroId;
  final String titulo;
  final String? motivo;
  final String pedidoPor;
  final String em;
}

/// Item de GET /moderacao/ocultados.
class Ocultado {
  const Ocultado({
    required this.registroTipo,
    required this.registroId,
    required this.titulo,
    required this.autorId,
    this.autorNome,
    this.ocultadoEm,
  });

  factory Ocultado.fromJson(Map<String, dynamic> j) => Ocultado(
        registroTipo: _enumObrig(j, 'registroTipo', RegistroTipo.values),
        registroId: _reqStr(j, 'registroId'),
        titulo: _reqStr(j, 'titulo'),
        autorId: _reqStr(j, 'autorId'),
        autorNome: _texto(j['autorNome']),
        ocultadoEm: _texto(j['ocultadoEm']),
      );

  final RegistroTipo registroTipo;
  final String registroId;
  final String titulo;
  final String autorId;

  /// Pode faltar se o autor sumiu.
  final String? autorNome;

  /// Ausente = sem data.
  final String? ocultadoEm;
}

// ---------------------------------------------------------------- notas

class Nota {
  const Nota({
    required this.id,
    required this.alcance,
    required this.data,
    required this.texto,
    required this.autorId,
    required this.criadoEm,
    required this.atualizadoEm,
    required this.version,
    required this.visivelTurma,
    this.autorNome,
    this.autorSelo,
  });

  factory Nota.fromJson(Map<String, dynamic> j) => Nota(
        id: _reqStr(j, 'id'),
        alcance: _enumObrig(j, 'alcance', AlcanceNota.values),
        data: _reqStr(j, 'data'),
        texto: _reqStr(j, 'texto'),
        autorId: _reqStr(j, 'autorId'),
        autorNome: _texto(j['autorNome']),
        autorSelo: _enumOpc(Selo.values, j['autorSelo']),
        criadoEm: _reqStr(j, 'criadoEm'),
        atualizadoEm: _reqStr(j, 'atualizadoEm'),
        version: _reqInt(j, 'version'),
        visivelTurma: _reqBool(j, 'visivelTurma'),
      );

  final String id;
  final AlcanceNota alcance;

  /// AAAA-MM-DD.
  final String data;

  /// Até 2000 caracteres.
  final String texto;
  final String autorId;

  /// Só vem em nota da turma. Ausente na pessoal.
  final String? autorNome;

  /// Só COORDENACAO e só em nota da turma.
  final Selo? autorSelo;
  final String criadoEm;
  final String atualizadoEm;
  final int version;

  /// false = o líder tirou da lista da turma. Só o autor continua vendo.
  final bool visivelTurma;
}

/// POST e PATCH /notas.
class SalvarNota {
  const SalvarNota({
    required this.alcance,
    required this.data,
    required this.texto,
  });

  final AlcanceNota alcance;
  final String data;
  final String texto;

  Map<String, dynamic> toJson() => {
        'alcance': alcance.wire,
        'data': data,
        'texto': texto,
      };
}

/// PUT de estado pessoal no quadro.
class EstadoPessoalRequest {
  const EstadoPessoalRequest({required this.feito});

  final bool feito;

  Map<String, dynamic> toJson() => {'feito': feito};
}

// ---------------------------------------------------------------- painel e admin

class MateriaLecionada {
  const MateriaLecionada({
    required this.materiaId,
    required this.sigla,
    required this.corHex,
  });

  factory MateriaLecionada.fromJson(Map<String, dynamic> j) =>
      MateriaLecionada(
        materiaId: _reqStr(j, 'materiaId'),
        sigla: _reqStr(j, 'sigla'),
        corHex: _reqStr(j, 'corHex'),
      );

  final String materiaId;
  final String sigla;
  final String corHex;
}

/// Turma de GET /painel. proximos já vem filtrado, ordenado e cortado: não reordenar.
class TurmaDoPainel {
  const TurmaDoPainel({
    required this.turmaId,
    required this.nome,
    required this.contestado,
    required this.lecionadas,
    required this.proximos,
    this.semestre,
    this.papel,
    this.selo,
  });

  factory TurmaDoPainel.fromJson(Map<String, dynamic> j) => TurmaDoPainel(
        turmaId: _reqStr(j, 'turmaId'),
        nome: _reqStr(j, 'nome'),
        semestre: _texto(j['semestre']),
        papel: _enumOpc(PapelDocente.values, j['papel']),
        selo: _enumOpc(Selo.values, j['selo']),
        contestado: _reqBool(j, 'contestado'),
        lecionadas: _reqLista(j, 'lecionadas', MateriaLecionada.fromJson),
        proximos: _reqLista(j, 'proximos', ItemHome.fromJson),
      );

  final String turmaId;
  final String nome;
  final String? semestre;

  /// Null se o papel não for docente.
  final PapelDocente? papel;

  /// Null = sem poder nesta turma.
  final Selo? selo;
  final bool contestado;
  final List<MateriaLecionada> lecionadas;
  final List<ItemHome> proximos;
}

/// GET /painel. Lista vazia = não tem turma. Null no estado do repositório = ainda não chegou.
class Painel {
  const Painel({required this.turmas});

  factory Painel.fromJson(Map<String, dynamic> j) =>
      Painel(turmas: _reqLista(j, 'turmas', TurmaDoPainel.fromJson));

  final List<TurmaDoPainel> turmas;
}

class MateriaAdmin {
  const MateriaAdmin({
    required this.id,
    required this.nome,
    required this.sigla,
  });

  factory MateriaAdmin.fromJson(Map<String, dynamic> j) => MateriaAdmin(
        id: _reqStr(j, 'id'),
        nome: _reqStr(j, 'nome'),
        sigla: _reqStr(j, 'sigla'),
      );

  final String id;
  final String nome;
  final String sigla;
}

/// GET /admin/turmas. Nunca traz código de convite.
class TurmaAdmin {
  const TurmaAdmin({
    required this.id,
    required this.nome,
    required this.materias,
    this.semestre,
  });

  factory TurmaAdmin.fromJson(Map<String, dynamic> j) => TurmaAdmin(
        id: _reqStr(j, 'id'),
        nome: _reqStr(j, 'nome'),
        semestre: _texto(j['semestre']),
        materias: _reqLista(j, 'materias', MateriaAdmin.fromJson),
      );

  final String id;
  final String nome;
  final String? semestre;
  final List<MateriaAdmin> materias;
}

/// Linha de GET /admin/docentes.
class DocenteAdmin {
  const DocenteAdmin({
    required this.usuarioId,
    required this.nome,
    required this.email,
    required this.tipoConta,
    required this.docenteStatus,
    required this.criadoEm,
    required this.emailVerificado,
  });

  factory DocenteAdmin.fromJson(Map<String, dynamic> j) => DocenteAdmin(
        usuarioId: _reqStr(j, 'usuarioId'),
        nome: _reqStr(j, 'nome'),
        email: _reqStr(j, 'email'),
        tipoConta: _enumObrig(j, 'tipoConta', TipoConta.values),
        docenteStatus: _enumObrig(j, 'docenteStatus', DocenteStatus.values),
        criadoEm: _reqStr(j, 'criadoEm'),
        emailVerificado: _bool(j['emailVerificado']) ?? false,
      );

  final String usuarioId;
  final String nome;
  final String email;
  final TipoConta tipoConta;
  final DocenteStatus docenteStatus;

  /// Data de criação da conta.
  final String criadoEm;

  /// Hoje sempre false.
  final bool emailVerificado;
}

/// GET /admin/docentes/{id}/turmas e resposta do PUT.
class VinculoAdmin {
  const VinculoAdmin({
    required this.turmaId,
    required this.turmaNome,
    required this.contestado,
    required this.materias,
    required this.lecionadas,
    this.semestre,
    this.papel,
  });

  factory VinculoAdmin.fromJson(Map<String, dynamic> j) => VinculoAdmin(
        turmaId: _reqStr(j, 'turmaId'),
        turmaNome: _reqStr(j, 'turmaNome'),
        semestre: _texto(j['semestre']),
        papel: _enumOpc(PapelDocente.values, j['papel']),
        contestado: _reqBool(j, 'contestado'),
        materias: _reqLista(j, 'materias', MateriaAdmin.fromJson),
        lecionadas: _strings(j['lecionadas']),
      );

  final String turmaId;
  final String turmaNome;
  final String? semestre;
  final PapelDocente? papel;
  final bool contestado;

  /// Todas as matérias da turma.
  final List<MateriaAdmin> materias;

  /// Ids das matérias que esta conta leciona nesta turma.
  final List<String> lecionadas;
}

/// PUT de lecionadas. [] = nenhuma.
class LecionadasRequest {
  const LecionadasRequest({required this.materiaIds});

  final List<String> materiaIds;

  Map<String, dynamic> toJson() => {'materiaIds': materiaIds};
}

/// PATCH da turma. semestre vai null quando vazio após trim.
class AtualizarTurmaRequest {
  const AtualizarTurmaRequest({required this.nome, this.semestre});

  final String nome;
  final String? semestre;

  Map<String, dynamic> toJson() => {'nome': nome, 'semestre': semestre};
}

class TransferirLiderancaRequest {
  const TransferirLiderancaRequest({required this.novoLiderUsuarioId});

  final String novoLiderUsuarioId;

  Map<String, dynamic> toJson() =>
      {'novoLiderUsuarioId': novoLiderUsuarioId};
}

// ---------------------------------------------------------------- lembretes e sync

/// Preferências de lembrete do aparelho.
class PreferenciasLembrete {
  const PreferenciasLembrete({
    this.noDia = true,
    this.vespera = true,
    this.umaHora = true,
  });

  /// Aviso às 07:00 do dia.
  final bool noDia;

  /// Aviso às 19:00 da véspera.
  final bool vespera;

  /// 1 h antes. Só existe para evento com hora.
  final bool umaHora;
}

/// Alarme personalizado de um evento. Uma das duas formas (sealed).
sealed class AlarmePersonalizado {
  const AlarmePersonalizado();

  /// Null para forma desconhecida. O chamador descarta em silêncio.
  static AlarmePersonalizado? tryFromJson(Object? j) {
    if (j is! Map<String, dynamic>) return null;
    final modo = j['modo'];
    if (modo == 'RELATIVO' && j['horasAntes'] is num) {
      return AlarmeRelativo((j['horasAntes'] as num).toDouble());
    }
    if (modo == 'EXATO' && j['data'] is String && j['hora'] is String) {
      return AlarmeExato(j['data'] as String, j['hora'] as String);
    }
    return null;
  }

  Map<String, dynamic> toJson();
}

/// Horas antes do evento. Dias viram 24 h cada.
final class AlarmeRelativo extends AlarmePersonalizado {
  const AlarmeRelativo(this.horasAntes);

  final double horasAntes;

  @override
  Map<String, dynamic> toJson() => {'modo': 'RELATIVO', 'horasAntes': horasAntes};
}

/// Hora de parede de America/Sao_Paulo, nunca instante.
final class AlarmeExato extends AlarmePersonalizado {
  const AlarmeExato(this.data, this.hora);

  /// AAAA-MM-DD.
  final String data;

  /// HH:mm.
  final String hora;

  @override
  Map<String, dynamic> toJson() => {'modo': 'EXATO', 'data': data, 'hora': hora};
}

/// Config de lembretes (chave pf.lembretes). Campo ausente vira o padrão.
class ConfigLembretes {
  const ConfigLembretes({
    this.noDia = true,
    this.vespera = true,
    this.umaHora = true,
    this.personalizados = const {},
  });

  static const ConfigLembretes padrao = ConfigLembretes();

  /// Alarme inválido é descartado; campo ausente cai no padrão.
  factory ConfigLembretes.fromJson(Map<String, dynamic> j) {
    final personalizados = <String, AlarmePersonalizado>{};
    final bruto = j['personalizados'];
    if (bruto is Map<String, dynamic>) {
      bruto.forEach((eventoId, valor) {
        final alarme = AlarmePersonalizado.tryFromJson(valor);
        if (alarme != null) personalizados[eventoId] = alarme;
      });
    }
    return ConfigLembretes(
      noDia: _bool(j['noDia']) ?? true,
      vespera: _bool(j['vespera']) ?? true,
      umaHora: _bool(j['umaHora']) ?? true,
      personalizados: personalizados,
    );
  }

  final bool noDia;
  final bool vespera;
  final bool umaHora;

  /// Chave é o eventoId.
  final Map<String, AlarmePersonalizado> personalizados;

  Map<String, dynamic> toJson() => {
        'noDia': noDia,
        'vespera': vespera,
        'umaHora': umaHora,
        'personalizados': {
          for (final e in personalizados.entries) e.key: e.value.toJson(),
        },
      };
}

/// Entrada de calcularAgendamentos. Sem fromJson: quem chama monta a partir de ItemHome ou Evento.
class EventoAgendavel {
  const EventoAgendavel({
    required this.eventoId,
    required this.tipo,
    required this.titulo,
    required this.data,
    required this.materiaSigla,
    this.hora,
    this.visivelTurma,
    this.excluidoEm,
  });

  final String eventoId;
  final TipoEvento tipo;
  final String titulo;

  /// AAAA-MM-DD.
  final String data;
  final String materiaSigla;

  /// HH:mm:ss ou HH:mm. Null ou vazio = sem horário.
  final String? hora;

  /// Ausente = visível.
  final bool? visivelTurma;

  /// Null ou vazio = ativo.
  final String? excluidoEm;
}

/// Saída de calcularAgendamentos. Sem JSON.
class Agendamento {
  const Agendamento({
    required this.eventoId,
    required this.tipo,
    required this.dispararEm,
    required this.titulo,
    required this.corpo,
  });

  final String eventoId;
  final TipoLembrete tipo;

  /// Instante absoluto, sempre no futuro no momento do cálculo.
  final DateTime dispararEm;
  final String titulo;
  final String corpo;
}

/// Item de GET /sync (só o usado). Tudo opcional exceto id: pode ser lápide.
class ItemSync {
  const ItemSync({
    required this.id,
    this.tipo,
    this.titulo,
    this.data,
    this.hora,
    this.materiaSigla,
    this.visivelTurma,
    this.excluidoEm,
  });

  factory ItemSync.fromJson(Map<String, dynamic> j) => ItemSync(
        id: _reqStr(j, 'id'),
        tipo: _texto(j['tipo']),
        titulo: _texto(j['titulo']),
        data: _texto(j['data']),
        hora: _texto(j['hora']),
        materiaSigla: _texto(j['materiaSigla']),
        visivelTurma: _bool(j['visivelTurma']),
        excluidoEm: _texto(j['excluidoEm']),
      );

  final String id;
  final String? tipo;
  final String? titulo;
  final String? data;
  final String? hora;
  final String? materiaSigla;

  /// Ausente = visível. Só false oculta.
  final bool? visivelTurma;
  final String? excluidoEm;
}

/// GET /sync (só o usado).
class RespostaSync {
  const RespostaSync({required this.eventosAlterados});

  factory RespostaSync.fromJson(Map<String, dynamic> j) => RespostaSync(
        eventosAlterados: _reqLista(j, 'eventosAlterados', ItemSync.fromJson),
      );

  final List<ItemSync> eventosAlterados;
}
