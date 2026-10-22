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
| Loading / erro / sucesso | todas as telas têm os 3 estados; SnackBar de sucesso e de erro |
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
ids são UUID string; enums em MAIÚSCULAS):

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
{ ...campos de Evento..., "materiais":[{"id":"uuid","tipo":"LINK","titulo":"Slides aula 3","url":"https://..."|null,
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
| E | R1 | Sonnet | Revisão de código: bugs, regras da §6, testes |
| E | R2 | Opus | Avaliação como professor: nota por critério das duas rubricas + pré-mortem |
| F | Hx | Haiku | Correções apontadas por R1/R2 |

## 8. Andamento

(atualizado a cada fase)

- 2026-10-22 — SDK Flutter 3.47.7 / Dart 3.13.5 instalado no container; projeto `fans_lab` criado
  (`--platforms android`), dependências adicionadas. Figma recusou acesso (P4).

## 9. Riscos e pontos cegos

- **P1 pode estar errada**: se o professor queria exatamente o `tarefas_http` / "Catálogo de
  Jogos", este app cobre os mesmos critérios com outro domínio — mas confirme com o enunciado.
- **Render dorme**: acorde a API antes de apresentar (`curl .../api/v1/saude`), senão a 1ª tela
  fica ~50 s carregando na frente da banca.
- **JWT em SharedPreferences** é texto puro no armazenamento do app. A própria apostila (§16) pede
  armazenamento seguro para credenciais; o caminho é `flutter_secure_storage`. Ficou fora por
  prazo — está declarado aqui e no código.
- Sem Android SDK aqui: **nenhum APK foi gerado nem testado em aparelho nesta sessão.**
