# Entrega Flutter — Fans Lab (Lab. de Aplicações Móveis e Distribuídas)

> Registro de tudo que foi pedido, decidido, construído e avaliado nesta sessão do Claude Code.
> Também é o **brief compartilhado** dos agentes: todo agente lê este arquivo inteiro antes de codar.

## 1. O pedido (2026-10-22)

- Entregar hoje o que pedem as duas apostilas da disciplina:
  - *Implementação do Protocolo HTTP no Flutter* (GET/POST/PUT/DELETE, JSON → Model, erros).
  - *Persistência Local e Banco de Dados Remoto* (SharedPreferences, SQLite, CRUD local, API REST,
    offline, sincronização).
- Referência visual: Figma "Fans Lab — Aplicações Móveis e Distribuídas" (node 295-2).
- Código feito por modelos simples (Haiku), cada um com contexto e alvo fechados; avaliação por
  Sonnet/Opus. Seguir todos os critérios de avaliação das apostilas.
- Mensagem do dono no meio do trabalho: **"deve usar o Dart e o Flutter"**.

## 2. Premissas (e confiança)

| # | Premissa | Confiança |
|---|---|---|
| P1 | A entrega é **um app Flutter do projetoFans** que consome a API da turma (o backend Spring deste repo), não o app genérico de tarefas/jogos da apostila. Base: o Figma enviado é do "Fans Lab" e a nota didática da apostila HTTP manda trocar o JSONPlaceholder "pelos endpoints do servidor/API desenvolvidos pela turma". | média-alta |
| P2 | Um único app cobre as **duas** rubricas (HTTP + Persistência). | alta |
| P3 | O "PUT" da rubrica é atendido por `PUT /eventos/{id}/estado-pessoal` (marcar feito — o "concluir" da apostila) e a edição usa `PATCH` (o desafio final aceita "PUT/PATCH"). | alta |
| P4 | O Figma do link **não abriu** (a conta conectada ao Claude não tem acesso ao arquivo). O visual segue `docs/design/png-figma/*.png` e os tokens de `app/src/theme/variables.scss`, que são o mesmo design. | média — se o Figma tiver telas diferentes, ajustar |
| P5 | Apresentação roda na máquina do dono (Android). Aqui não há Android SDK: a verificação é `flutter analyze` + `flutter test`. | alta |

## 3. Rubricas → onde cada critério é atendido

**Apostila HTTP (§20)** — Comunicação HTTP 2,0 · JSON/Model 1,5 · Operações REST 2,0 · Interface 1,5 ·
Organização 1,5 · Tratamento de erros 1,0 · Apresentação 0,5

**Apostila Persistência (§25)** — SQLite 2,0 · CRUD local 1,5 · API REST 2,0 · Sincronização 1,5 ·
Interface 1,0 · Organização 1,0 · Tratamento de erros 0,5 · Apresentação 0,5

| Critério | Implementação |
|---|---|
| GET + tratamento de resposta | `ApiService.home()`, `materias()`, `evento(id)` — status 200 checado, demais viram `ApiException` |
| JSON ↔ objeto Dart | `lib/models/*` com `fromJson` / `toJson` / `toMap` / `fromMap` |
| POST | `ApiService.criarEvento` (201) |
| PUT | `ApiService.marcarFeito` → `PUT /eventos/{id}/estado-pessoal` (204) |
| PATCH (edição) | `ApiService.atualizarEvento` com `If-Match: <version>` (200; 409 = conflito) |
| DELETE | `ApiService.excluirEvento` com `If-Match` (204; exclusão lógica no servidor) |
| SharedPreferences | `SessaoStore`: sessão (jwt, usuário), tema escuro, hora da última sincronização |
| SQLite + CRUD local | `AppDatabase` + repositórios: cache da Home, matérias, **rascunhos** (inserir/listar/editar/excluir), estado pessoal |
| Dados após fechar o app | cache da Home e rascunhos no SQLite; sessão e tema no SharedPreferences |
| Offline | Home cai para o cache com aviso "sem conexão — mostrando o que foi salvo em HH:mm"; criar evento e marcar feito funcionam offline (fila) |
| Sincronização | `SyncService.sincronizar()` envia rascunhos (POST) e feitos (PUT) pendentes; tela mostra pendente / enviado / erro |
| Loading / erro / sucesso | Home, detalhe, formulário e fila têm os 3 estados (Configurações só lê preferências locais); SnackBar de sucesso e de erro |
| Organização | `models / database / repositories / services / screens / widgets` (apostila §20) |

## 4. Arquitetura

```
fans_lab/lib/
├── main.dart                 # inicialização, tema claro/escuro, rota inicial (login ou home)
├── config.dart               # API_URL via --dart-define (default: produção)
├── models/                   # H0 — dados puros, sem Flutter
├── database/app_database.dart# H2 — SQLite (sqflite)
├── repositories/             # H2 — CRUD local + SessaoStore (SharedPreferences)
├── services/api_service.dart # H1 — HTTP
├── services/api_exception.dart
├── services/sync_service.dart# H4 — fila offline → API
├── services/home_service.dart# H4 — API primeiro, cache se offline
├── widgets/                  # H3 — MateriaChip, EventoCard, cores
└── screens/                  # H5 — login, home, detalhe, formulário, fila de envio, configurações
```

Dependências (já no `pubspec.yaml`): `http`, `shared_preferences`, `sqflite`, `path`;
dev: `sqflite_common_ffi` (SQLite nos testes, sem aparelho). **Não adicione nenhuma outra.**

Rodar: `export PATH=/opt/flutter-sdk/flutter/bin:$PATH && cd /home/user/Projeto-Fans/fans_lab`
→ `flutter analyze` e `flutter test`.

## 5. Contrato da API (fonte: `backend/src/main/java/com/projetofans/web`)

Base: `https://projetofans-api.onrender.com/api/v1` (Render free: a 1ª chamada pode levar ~50 s
para acordar o servidor → timeout de 60 s). Todas as rotas exceto `/auth/*` exigem
`Authorization: Bearer <jwt>`. Erros saem como ProblemDetail (RFC 7807):
`{"type","title","status","detail"}` — use `detail` (ou `title`) como mensagem quando houver.

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| POST | `/auth/login` | `{"email","senha"}` | 200 `AuthResponse`; 401 credencial errada; 429 muitas tentativas |
| GET | `/home` | — | 200 `List<ItemHome>` **já ordenada, já cortada (≤6, 14 dias)** |
| GET | `/materias` | — | 200 `List<Materia>` |
| GET | `/eventos/{id}` | — | 200 `EventoDetalhe`; 404 |
| POST | `/eventos` | `CriarEvento` | 201 `Evento` |
| PATCH | `/eventos/{id}` | `CriarEvento` (objeto inteiro) + header `If-Match: <version>` | 200 `Evento`; 409 version divergente; 428 sem If-Match; 403 não é autor |
| DELETE | `/eventos/{id}` | header `If-Match: <version>` | 204; 409; 403 |
| PUT | `/eventos/{id}/estado-pessoal` | `{"feito": true}` | 204 |

JSON (chaves exatas; datas `"2026-10-25"`, horas `"19:00:00"` ou `"19:00"`, instantes ISO-8601 UTC;
ids são UUID string; enums em MAIÚSCULAS). **O servidor OMITE chaves nulas** (Jackson `non_null`):
`null` nos exemplos abaixo quer dizer "a chave pode não vir". `autoria.atualizadoEm` vem preenchido já
na criação (≈ `criadoEm`); "foi editado" é `editadoPorNome != null`. Formatos conferidos contra o
backend real pelo V3 (13/13 em `fans_lab/test_e2e/api_real_test.dart`):

```jsonc
// AuthResponse
{"jwt":"...","usuario":{"id":"uuid","nome":"Otávio","email":"o@x.com","tipoConta":"ALUNO","docenteStatus":null},"turmaId":"uuid|null"}
// AutoriaResponse
{"autorId":"uuid","autorNome":"Ana","autorSelo":null|"PROFESSOR"|"COORDENACAO","criadoEm":"2026-10-20T13:00:00Z",
 "atualizadoEm":"...|null","editadoPorNome":null|"Prof. X","editadoPorSelo":null|"PROFESSOR"}
// ItemHome
{"eventoId":"uuid","tipo":"PROVA"|"ENTREGA","titulo":"Prova 2","data":"2026-10-25","hora":"19:00:00"|null,
 "materiaSigla":"BD","materiaCorHex":"#1D4ED8","autoria":{...},"feitoPeloUsuario":false}
// Materia
{"id":"uuid","nome":"Banco de Dados","sigla":"BD","corHex":"#1D4ED8","sala":"B-204"|null,"professor":"Marcos"|null}
// Evento (EventoResponse)
{"id":"uuid","tipo":"PROVA","titulo":"...","data":"2026-10-25","hora":null,"sala":null,"materiaId":"uuid",
 "materiaSigla":"BD","materiaCorHex":"#1D4ED8","autoria":{...},"version":3,"visivelTurma":true,"excluidoEm":null}
// EventoDetalhe = campos de Evento no MESMO nível + "materiais"
{ ...campos de Evento..., "materiais":[{"id":"uuid","tipo":"AULA"|"ADICIONAL","titulo":"Slides aula 3","url":"https://..."|null,
  "dataAula":"2026-10-10"|null,"autoria":{...}}]}
// CriarEvento (POST e PATCH)
{"materiaId":"uuid","tipo":"PROVA","titulo":"...","data":"2026-10-25","hora":"19:00"|null,"sala":null|"B-10"}
```

## 6. Regras do projeto que valem no Flutter (de `AGENTS.md`) — violar = rejeitado no review

1. **Autoria visível**: todo card e detalhe mostra autor + quando ("Ana · há 2 dias"). Rascunho
   local mostra "você · aguardando envio".
2. **Ordem e teto vêm do servidor.** A Home renderiza `/home` **na ordem recebida**. Proibido
   ordenar, agrupar provas, cortar em 6 ou filtrar 14 dias no app. O cache guarda a posição.
3. **`feito` é estado pessoal**: tabela local própria (`estado_pessoal`), nunca coluna do cache de evento.
4. **Prova = bloco sólido; entrega = contorno 1px.** Em escala de cinza continuam distintos. A cor
   não participa dessa distinção (ela é da matéria).
5. **Cor + sigla sempre juntas**: só existe um jeito de mostrar matéria — `MateriaChip`.
6. **Semana vazia mostra pouco**: lista vazia = texto curto "Nada nos próximos 14 dias."
   Sem sugestão, sem card promocional, sem skeleton permanente.
7. **Só o autor edita/exclui**: botões de editar/excluir só aparecem se
   `autoria.autorId == usuario.id`. O servidor decide de verdade (403 é tratado).
8. **Tela de evento mostra só os materiais vinculados** (os que vêm em `materiais`).
9. **Nunca `catch` vazio, nunca `catch` que devolve lista vazia como sucesso.** "Não há provas" e
   "falhou ao buscar" têm de ser distinguíveis na tela. Se não sabe tratar, relance.
10. **Sem segredo no código.** URL por `--dart-define`; senha nunca é salva.
11. **Proibido**: múltiplas turmas / seletor de turma, notas/boletim, IA, monetização, envio de trabalho.

## 7. Plano de agentes

Cada coder (Haiku) recebe: este documento + o alvo dele + os arquivos que **só ele** pode tocar +
o critério de pronto. Nenhum coder mexe em arquivo de outro. Pronto = `flutter analyze` sem
erros nem avisos nos seus arquivos **e** `flutter test` dos seus testes verde, com a saída colada no
relatório final.

| Fase | Agente | Modelo | Alvo |
|---|---|---|---|
| A | H0 | Haiku | Models + testes de JSON |
| B | H1 | Haiku | `ApiService` + `ApiException` + testes com `MockClient` |
| B | H2 | Haiku | `AppDatabase` + repositórios + `SessaoStore` + testes com ffi |
| B | H3 | Haiku | `MateriaChip`, `EventoCard`, cores do tema + widget tests |
| C | H4 | Haiku | `SyncService` + `HomeService` + testes |
| D | H5 | Haiku | Telas + `main.dart` + permissão de Internet no Android |
| — | — | — | **Depois do pedido "faça em paralelo": H1–H5 rodam todos juntos contra a §7.1; o coordenador integra.** |
| E | R1 | Sonnet | Revisão de código: bugs, regras da §6, testes |
| E | R2 | Opus | Avaliação como professor: nota por critério das duas rubricas + pré-mortem |
| F | Hx | Haiku | Correções apontadas por R1/R2 |

## 7.1 Contratos (todos os agentes trabalham EM PARALELO contra isto)

Mensagem do dono: **"faça cada parte em paralelo"**. Para isso funcionar, cada classe abaixo tem
assinatura fixa. Implemente **exatamente** estes nomes. Use outra classe só pelo que está aqui —
não abra o arquivo de outro agente para "descobrir" a API, e **nunca edite arquivo de outro agente**.
Se o arquivo de que você depende ainda não existe, escreva seu código mesmo assim; se ele existe e
diverge do contrato, não conserte: anote no relatório.

### Models — H0 (`lib/models/`, puro Dart)
```dart
// formatos.dart
T campo<T>(Map<String, dynamic> json, String chave);          // FormatException se ausente/tipo errado
T? campoOpcional<T>(Map<String, dynamic> json, String chave);
String dataIso(DateTime d);            // 'yyyy-MM-dd'
DateTime lerData(String s);            // só a data, local
String? horaCurta(String? h);          // '19:00:00' -> '19:00'
DateTime lerInstante(String s);
// tipo_evento.dart
enum TipoEvento { prova, entrega; static TipoEvento fromJson(String s); String toJson(); }
// autoria.dart
class Autoria { String autorId, autorNome; String? autorSelo; DateTime criadoEm; DateTime? atualizadoEm;
  String? editadoPorNome, editadoPorSelo; factory Autoria.fromJson(Map<String, dynamic>); Map<String, dynamic> toJson(); }
// item_home.dart
class ItemHome { String eventoId; TipoEvento tipo; String titulo; DateTime data; String? hora; String materiaSigla;
  String materiaCorHex; Autoria autoria; bool feitoPeloUsuario;
  factory ItemHome.fromJson(Map<String, dynamic>); Map<String, dynamic> toMap(int posicao);
  factory ItemHome.fromMap(Map<String, dynamic>, {bool feito = false}); ItemHome copyWith({bool? feitoPeloUsuario}); }
// materia.dart
class Materia { String id, nome, sigla, corHex; String? sala, professor;
  factory Materia.fromJson(...); Map<String, dynamic> toMap(); factory Materia.fromMap(...); }
// evento.dart
class Evento { String id; TipoEvento tipo; String titulo; DateTime data; String? hora; String? sala; String materiaId;
  String materiaSigla; String materiaCorHex; Autoria autoria; int version; bool visivelTurma; DateTime? excluidoEm;
  factory Evento.fromJson(...); }
// material_aula.dart
class MaterialAula { String id, tipo, titulo; String? url; DateTime? dataAula; Autoria autoria; factory MaterialAula.fromJson(...); }
// evento_detalhe.dart
class EventoDetalhe { Evento evento; List<MaterialAula> materiais; factory EventoDetalhe.fromJson(...); }
// usuario.dart / sessao.dart
class Usuario { String id, nome, email; fromJson; toJson; }
class Sessao { String jwt; Usuario usuario; String? turmaId; fromJson; toJson; }
// rascunho_evento.dart
class RascunhoEvento { int? localId; String materiaId, materiaSigla, materiaCorHex; TipoEvento tipo; String titulo;
  DateTime data; String? hora; String? sala; DateTime criadoEm; bool sincronizado; String? ultimoErro;
  Map<String, dynamic> toMap(); factory RascunhoEvento.fromMap(...); Map<String, dynamic> toCriarJson();
  RascunhoEvento copyWith({int? localId, bool? sincronizado, String? ultimoErro, bool limparErro = false}); }
```
Construtores dos models: nomeados, com `required` nos campos não-nulos.
`lib/config.dart`: `const String apiUrl = String.fromEnvironment('API_URL', defaultValue: 'https://projetofans-api.onrender.com/api/v1');`

### HTTP — H1 (`lib/services/api_exception.dart`, `lib/services/api_service.dart`)
```dart
class ApiException implements Exception {
  final int? status;          // null quando a requisição não chegou ao servidor
  final String mensagem;      // pronta para mostrar ao usuário, em português
  final bool semConexao;
  const ApiException.http(int this.status, this.mensagem) : semConexao = false;
  const ApiException.semConexao([this.mensagem = 'Sem conexão com o servidor.']) : status = null, semConexao = true;
  const ApiException.respostaInvalida(int this.status)
      : mensagem = 'O servidor respondeu num formato inesperado.', semConexao = false;
  bool get naoAutorizado => status == 401;
  bool get conflito => status == 409;
  bool get naoEncontrado => status == 404;
  @override String toString() => mensagem;
}
class ApiService {
  ApiService({http.Client? client, String baseUrl = apiUrl, Duration timeout = const Duration(seconds: 60)});
  String? token;                                   // jwt; quando não-nulo vai em Authorization: Bearer
  Future<Sessao> login(String email, String senha);              // POST /auth/login 200
  Future<List<ItemHome>> home();                                 // GET /home 200, ordem preservada
  Future<List<Materia>> materias();                              // GET /materias 200
  Future<EventoDetalhe> evento(String id);                       // GET /eventos/{id} 200
  Future<Evento> criarEvento(Map<String, dynamic> corpo);        // POST /eventos 201
  Future<Evento> atualizarEvento(String id, int version, Map<String, dynamic> corpo); // PATCH + If-Match 200
  Future<void> excluirEvento(String id, int version);            // DELETE + If-Match 204
  Future<void> marcarFeito(String eventoId, bool feito);         // PUT /eventos/{id}/estado-pessoal 204
}
```
Toda falha sai como `ApiException` — nunca outra exceção, nunca lista vazia.

### SQLite e SharedPreferences — H2 (`lib/database/`, `lib/repositories/`)
```dart
typedef AbrirDb = Future<Database> Function();
class AppDatabase {
  static Future<Database> abrir();                 // singleton, arquivo fans_lab.db, version 1
  static Future<Database> abrirEmMemoria();        // testes: NOVO banco a cada chamada (singleInstance: false)
  static Future<void> limparTudo([AbrirDb? abrir]); // apaga as linhas das 4 tabelas (logout)
}
class HomeCacheRepository { HomeCacheRepository([AbrirDb? abrir]);
  Future<void> substituir(List<ItemHome> itens);   // troca o snapshot inteiro, posicao = índice
  Future<List<ItemHome>> listar(); }               // ORDER BY posicao, feito via LEFT JOIN estado_pessoal
class MateriaRepository { MateriaRepository([AbrirDb? abrir]);
  Future<void> substituirTodas(List<Materia> materias); Future<List<Materia>> listar(); } // ORDER BY sigla
class RascunhoRepository { RascunhoRepository([AbrirDb? abrir]);
  Future<int> inserir(RascunhoEvento r); Future<List<RascunhoEvento>> listar();  // local_id DESC
  Future<List<RascunhoEvento>> listarPendentes();                                // sincronizado=0, local_id ASC
  Future<void> atualizar(RascunhoEvento r); Future<void> excluir(int localId);
  Future<void> marcarSincronizado(int localId); Future<void> registrarErro(int localId, String erro); }
class EstadoPessoalRepository { EstadoPessoalRepository([AbrirDb? abrir]);
  Future<void> marcarLocal(String eventoId, bool feito);                         // sincronizado=0
  Future<List<({String eventoId, bool feito})>> pendentes();
  Future<void> marcarSincronizado(String eventoId, bool feito);                  // só se feito ainda bate
  Future<void> descartar(String eventoId);
  Future<void> aplicarDoServidor(Map<String, bool> feitos); }                    // não sobrescreve pendente local
class SessaoStore {                                                              // SharedPreferences
  Future<void> salvar(Sessao s); Future<Sessao?> carregar(); Future<void> limpar();
  Future<bool> temaEscuro(); Future<void> definirTemaEscuro(bool v);
  Future<DateTime?> ultimaSincronizacao(); Future<void> registrarSincronizacao(DateTime t);
  Future<DateTime?> homeSalvaEm(); Future<void> registrarHomeSalva(DateTime t); }
```
Tabelas: `home_cache`, `materias`, `rascunhos`, `estado_pessoal` (colunas = `toMap` dos models).

### Visual — H3 (`lib/widgets/`)
```dart
// cores.dart
class CoresFans extends ThemeExtension<CoresFans> { Color paper, surface, ink, ink2, ink3, rule, accent, accentInk,
  provaBg, provaFg, provaFg2; static const CoresFans claro; static const CoresFans escuro; ... }
ThemeData temaFans(Brightness brilho);            // inclui a extensão; ler com Theme.of(context).extension<CoresFans>()!
Color corDaMateria(String hex);                   // '#1D4ED8' ou '1D4ED8'; inválido -> cinza, nunca lança
// tempo_relativo.dart
String tempoRelativo(DateTime instante, {DateTime? agora}); // 'agora', 'há 5 min', 'há 2 h', 'há 1 dia', 'há 3 dias', '05/09/2026'
String mesAbrev(int mes);                          // 'JAN'..'DEZ'
String dataCurta(DateTime d);                      // '05/09/2026'
String diaExtenso(DateTime d);                     // 'Quinta, 22 out'
// materia_chip.dart
class MateriaChip extends StatelessWidget { const MateriaChip({super.key, required this.sigla, required this.corHex}); }
// evento_card.dart
class EventoCard extends StatelessWidget {
  const EventoCard({super.key, required this.tipo, required this.titulo, required this.data, this.hora,
    required this.materiaSigla, required this.materiaCorHex, required this.autoriaTexto, this.feito = false, this.onTap});
  factory EventoCard.deItem(ItemHome item, {VoidCallback? onTap}); // autoriaTexto = 'Nome · há X'
}
```

### Serviços e injeção — H4 (`lib/services/home_service.dart`, `sync_service.dart`, `lib/app_deps.dart`)
```dart
class ResultadoHome { final List<ItemHome> itens; final bool offline; final DateTime? salvoEm; const ResultadoHome(...); }
class HomeService { HomeService(ApiService api, HomeCacheRepository cache, EstadoPessoalRepository estado,
    MateriaRepository materias, SessaoStore sessao);
  Future<ResultadoHome> carregar();   // API -> cache; sem conexão -> cache c/ offline=true; sem cache -> relança
  Future<List<Materia>> materias(); } // API -> cache; sem conexão -> cache se não vazio; senão relança
class ResultadoSync { final int enviados; final int comErro; final int pendentes; final bool semConexao; }
class SyncService { SyncService(ApiService api, RascunhoRepository rascunhos, EstadoPessoalRepository estado, SessaoStore sessao);
  Future<ResultadoSync> sincronizar();  // chamadas simultâneas compartilham a MESMA execução
  Future<int> contarPendentes(); }
class AppDeps { final ApiService api; final SessaoStore sessao; final HomeCacheRepository homeCache;
  final MateriaRepository materias; final RascunhoRepository rascunhos; final EstadoPessoalRepository estado;
  final HomeService home; final SyncService sync; final AbrirDb abrirDb;
  factory AppDeps.padrao({http.Client? client, AbrirDb? abrirDb, String baseUrl = apiUrl}); }
```

### Telas — H5a e H5b (`lib/screens/`)
```dart
// H5a
class LoginPage { const LoginPage({super.key, required AppDeps deps, required void Function(Sessao) aoEntrar}); }
class HomePage { const HomePage({super.key, required AppDeps deps, required VoidCallback aoSair,
    required ValueChanged<bool> aoMudarTema}); }
class ConfiguracoesPage { const ConfiguracoesPage({super.key, required AppDeps deps,
    required ValueChanged<bool> aoMudarTema, required VoidCallback aoSair}); }
// main.dart (H5a): class FansLabApp { const FansLabApp({super.key, required AppDeps deps, Sessao? sessaoInicial, bool temaEscuro = false}); }
// H5b — cada uma devolve `true` no Navigator.pop quando algo mudou
class EventoDetalhePage { const EventoDetalhePage({super.key, required AppDeps deps, required String eventoId, this.feito = false}); }
class EventoFormPage { const EventoFormPage({super.key, required AppDeps deps, this.rascunho, this.evento}); } // nenhum = novo
class FilaPage { const FilaPage({super.key, required AppDeps deps}); }
```

## 7.2 Loop de correção (swarm de Haiku) — pedido do dono: "use vários haikus … loop engineering com swarm de agentes"

```
┌─► 1. Revisores (R1 Sonnet + R2 Opus) apontam achados com arquivo:linha
│   2. Coordenador agrupa os achados POR ARQUIVO → 1 Haiku por grupo, todos em paralelo
│      (dono exclusivo dos seus arquivos; nunca dois Haiku no mesmo arquivo)
│   3. Cada Haiku: corrige → escreve/ajusta o teste que falharia sem a correção → analyze + test
│   4. Coordenador integra: `flutter analyze` + `flutter test` do projeto inteiro (2×)
│   5. Verificador (Sonnet) confere CADA achado: corrigido / não corrigido / regrediu
└── 6. Sai do loop se: 0 bloqueantes e 0 importantes abertos E nota do R2 ≥ 9,0 nas duas
       rubricas — ou após 3 voltas (o que vier primeiro). Achado "menor" não segura o loop.
```
Regras de cada volta: correção mínima (o que o achado pede, nada além); nenhum teste é
apagado, pulado ou enfraquecido para ficar verde; achado que exige decisão do dono (escopo,
segurança) não é "corrigido" por Haiku — vai para a §9 e para o dono.

## 8. Andamento

(atualizado a cada fase)

- 2026-10-22 — SDK Flutter 3.47.7 / Dart 3.13.5 instalado no container; projeto `fans_lab` criado
  (`--platforms android`), dependências adicionadas. Figma recusou acesso (P4).
- H0 (Haiku) entregou os models: `flutter analyze` sem issues, 19/19 testes — conferido pelo
  coordenador. Decisões dele: `lerData` recusa data inválida que o `DateTime.parse` rolaria
  (30/02 → 02/03); `materiais` ausente no detalhe é erro, não lista vazia (regra §6.9).
- Dono pediu **"faça cada parte em paralelo"** → escrita a §7.1 (contratos) e disparados H1, H2, H3,
  H4, H5a e H5b ao mesmo tempo (todos Haiku). Custo assumido: divergência de contrato na
  integração, que o coordenador resolve rodando analyze/test e devolvendo o erro ao dono do arquivo.
- Resultado da integração: **nenhuma divergência de contrato** — os 6 agentes compilaram juntos de
  primeira. Suíte final: `flutter analyze` sem issues, **97/97 testes**, rodada 2× seguidas (sem
  flake). Um vermelho intermediário (SnackBar do form offline) foi corrigido pelo próprio H5b com
  espera pelo texto, sem enfraquecer a asserção.
- Decisões notáveis dos coders: If-Match vai como número puro (o backend lê `Integer`); 5xx durante a
  sincronização marca o rascunho com erro mas mantém pendente; "Sair" avisa que a fila não enviada
  será apagada; a fila distingue "falhou ao ler" de "vazia".
- Dono: **"rode modelos em paralelo para acelerar tudo"** → em paralelo agora: R1 (Sonnet, revisão
  das camadas), R2 (Opus, nota pela rubrica + telas + pré-mortem), H6 (Haiku, README + roteiro da
  apresentação), B1 (Sonnet, perguntas prováveis da banca).
- **Loop, volta 1.** R1 (Sonnet): 0 bloqueantes, 5 importantes, 7 testes fracos — todos provados por
  mutação numa cópia. R2 (Opus): **nota 16,95/20 (HTTP 8,55 · Persistência 8,4)**; 14 bugs de tela,
  3 deles quebram a demo offline (criar offline em instalação nova, marcar feito offline, voltar
  durante o salvar). O 401 que apaga a fila foi achado por R1, R2 e H6 de forma independente.
  Swarm da volta 1: 7 Haiku em paralelo, cada um dono de arquivos disjuntos — L1-A (HTTP), L1-B
  (sync/home), L1-D (contorno + teste do chip), L1-E (testes fracos), L1-C1 (401/Home/sessão),
  L1-C2 (detalhe/formulário), L1-C3 (overflow + HTTP local no debug). Cada correção exige o teste que
  fica vermelho sem ela (mutação de controle no relatório).
  Decisões do coordenador: duplicata após timeout fica como limite documentado (timeout 90 s);
  datas em português (`flutter_localizations`) fica para a volta 2, porque mexe no `pubspec.yaml`,
  que está com outro agente.
- Verificado: `dl.google.com` bloqueado neste ambiente → **sem Android SDK, sem APK gerado aqui**.
  A API do Render também não é alcançável daqui.
- **V3 (Sonnet) subiu o backend Spring LOCAL** (perfil `dev`, Postgres embutido) e rodou o
  `ApiService` e o `SyncService` reais contra ele: **13/13 verdes, nenhuma incompatibilidade de
  contrato**. Teste em `fans_lab/test_e2e/api_real_test.dart` (fora de `test/`, precisa de servidor).
  Como subir: `cd backend && sh ./mvnw -DskipTests spring-boot:run -Dspring-boot.run.profiles=dev`
  (o `mvnw` está sem bit de execução, por isso o `sh`). Seed de dev: `ana@exemplo.dev` /
  `otavio@exemplo.dev`, senha `senha123`, turma `TURMA01`.
- V5 (Sonnet, segurança): nenhum ALTO; riscos baixos registrados na §9.

## 9. Riscos e pontos cegos

- **P1 pode estar errada**: se o professor queria exatamente o `tarefas_http` / "Catálogo de
  Jogos", este app cobre os mesmos critérios com outro domínio — mas confirme com o enunciado.
- **Render dorme**: acorde a API antes de apresentar (`curl .../api/v1/saude`), senão a 1ª tela
  fica ~50 s carregando na frente da banca.
- **JWT em SharedPreferences** é texto puro no armazenamento do app. A própria apostila (§16) pede
  armazenamento seguro para credenciais; o caminho é `flutter_secure_storage`. Ficou fora por
  prazo — está declarado aqui e no código.
- Sem Android SDK aqui: **nenhum APK foi gerado nem testado em aparelho nesta sessão.**
- **POST duplicado após timeout** (achado do R1, provado): se o POST chega ao servidor mas a
  resposta passa do timeout, o rascunho fica pendente e o próximo envio cria o evento de novo.
  Mitigação: timeout de 90 s e API acordada antes. Correção real: chave de idempotência no backend.
- Sem tela para criar material: "Materiais vinculados" mostra o que já existe no servidor.
- PATCH e DELETE são só online (precisam da `version` atual); não entram na fila offline.
- (V5, segurança) **Logout não revoga o JWT no servidor** — não existe endpoint de revogação; um
  token já copiado vale até expirar (720 h). O app limpa tudo localmente.
- (V5) **O APK de release é assinado com a chave debug** (TODO do template Flutter). Serve para
  entregar ao professor; não serve para loja.
- (V5) HTTP em claro só no build **debug**: apontar o debug para um IP da rede local manda senha e JWT
  sem criptografia. Para o emulador (`10.0.2.2`) é loopback e não há risco.
