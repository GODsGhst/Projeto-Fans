# Banca: perguntas prováveis e respostas (fans_lab)

Preparação para a apresentação de *Laboratório de Desenvolvimento de Aplicações Móveis e Distribuídas*.
Tudo abaixo foi conferido no código em 2026-10-23. Caminhos são relativos a `fans_lab/`, salvo os que
começam com `backend/`.

## Como ler

- **Falar** é o que dizer em voz alta (2 a 5 linhas). O resto é apoio para você consultar.
- **Apostila** = conceito ensinado em aula, com a seção. **Projeto** = decisão deste app, que não vem da
  apostila. **Código** = onde abrir se o professor pedir para mostrar. **Limitação** = diga, não esconda.
- "HTTP §n" é a apostila *Implementação do Protocolo HTTP no Flutter*. "Persistência §n" é a apostila
  *Persistência Local e Banco de Dados Remoto*. A numeração é a impressa nos PDFs.
- Não existe nada neste documento que você não possa abrir no repositório. Se o professor perguntar por
  algo que não está aqui, a resposta honesta é "isso o app não faz".

## Mapa de 30 segundos

```
Tela (screens/)
  |  usa
  v
Service (HomeService, SyncService)  ----  ApiService ---- HTTP/JSON ---- API Spring (Render) --- Postgres
  |  usa
  v
Repository (SQLite: home_cache, materias, rascunhos, estado_pessoal)   SessaoStore (SharedPreferences)
```

- 5 verbos: GET (home, matérias, detalhe), POST (login, criar evento), PUT (marcar feito),
  PATCH (editar evento, com `If-Match`), DELETE (excluir evento, com `If-Match`).
- SharedPreferences: 4 chaves (`sessao`, `temaEscuro`, `ultimaSincronizacao`, `homeSalvaEm`).
  SQLite: arquivo `fans_lab.db`, 4 tabelas.
- Verificado agora: `flutter analyze` sem issues; `flutter test` com **97 testes, todos verdes**
  (api 20, models 19, repositories 13, services 14, sessao_store 6, telas_evento 5, telas_home 4, widgets 16).

## Antes de entrar na sala

1. Acorde a API: `curl https://projetofans-api.onrender.com/api/v1/saude`. O plano gratuito do Render dorme e a
   primeira chamada pode levar cerca de 50 s (`docs/ENTREGA-FLUTTER.md` §5 e §9). A tela de login avisa isso.
2. Ensaie no aparelho o roteiro offline (Pergunta 11). A entrega diz que nenhum APK foi gerado nem testado em
   aparelho na sessão de desenvolvimento (`docs/ENTREGA-FLUTTER.md` §9). Se você já rodou, diga o que viu.
3. Leia as 5 armadilhas no fim. São as perguntas em que dá para se enrolar.

---

## 1. Conceitos

### 1. HTTP, REST e JSON são a mesma coisa?

**Falar:** Não. HTTP é o protocolo: o app envia uma requisição (método, URL, headers, corpo) e o servidor
devolve uma resposta (status, headers, corpo). REST é um estilo de organizar a API em recursos e verbos, como
`/eventos/{id}` com GET, PATCH e DELETE. JSON é só o formato do texto que viaja no corpo.

- **Apostila:** HTTP §4, caixa "Importante": "HTTP é o protocolo... REST é um estilo arquitetural... JSON é um
  formato de representação de dados. Eles não são sinônimos."
- **Projeto:** a API é o backend Spring da própria turma (a nota didática da apostila manda trocar o
  JSONPlaceholder pelos endpoints desenvolvidos pela turma). A URL base vem de `--dart-define=API_URL`, com
  default `https://projetofans-api.onrender.com/api/v1`. Os erros do servidor seguem ProblemDetail (RFC 7807).
- **Código:** `lib/config.dart: apiUrl`; `lib/services/api_service.dart: ApiService._enviar`
  (monta a URI e os headers `Content-Type: application/json; charset=UTF-8` e `Accept`).

### 2. Quais métodos HTTP o app usa e para quê?

**Falar:** Cinco. GET lê: Home, matérias e detalhe do evento. POST cria: login e criar evento. PUT marca "feito",
que é um estado pessoal. PATCH edita o evento. DELETE exclui o evento. PATCH e DELETE mandam `If-Match` com a
versão, para o servidor recusar se alguém mexeu antes.

- **Apostila:** HTTP §4.2 (GET, POST, PUT, DELETE) e §10 a §12. PATCH não está na tabela da apostila;
  Persistência §23 aceita "PUT/PATCH".
- **Projeto:** a exclusão é lógica, no servidor (campo `excluido_em`). O app só enxerga o 204.
- **Código:** `lib/services/api_service.dart`: `home()`, `materias()`, `evento()` (GET); `login()`,
  `criarEvento()` (POST); `marcarFeito()` (PUT); `atualizarEvento()` (PATCH); `excluirEvento()` (DELETE).

### 3. Que status codes o app espera, e o que faz quando vem outro?

**Falar:** Cada chamada declara o status esperado: 200 nos GET, no PATCH e no login; 201 no POST; 204 no PUT e
no DELETE. Qualquer outro vira uma `ApiException` com mensagem em português. Em geral, 2xx é sucesso, 4xx é
problema do pedido (401 sem autenticação, 403 sem permissão, 404 não existe) e 5xx é problema do servidor.

- **Apostila:** HTTP §4.3 lista 200, 201, 400, 401, 403, 404 e 500.
- **Projeto:** 204, 409 (versão divergente), 428 (faltou `If-Match`) e 429 (muitas tentativas de login) não estão
  na apostila; vêm do contrato da API (`docs/ENTREGA-FLUTTER.md` §5).
- **Código:** `lib/services/api_service.dart: _enviar(esperado:)` (linha 111: `if (r.statusCode != esperado)`)
  e `_erroHttp`.
- **Limitação:** a comparação é de igualdade. Um 200 onde se esperava 201 também vira erro ("Erro HTTP 200.").

### 4. Como o JSON vira objeto Dart, e o caminho de volta?

**Falar:** `jsonDecode` transforma o texto em `Map`. Cada model tem um `factory X.fromJson(Map)` que monta o
objeto tipado. A volta é `jsonEncode` em cima de um `Map` gerado por `toJson` ou `toCriarJson`. Meus models são
estritos: campo ausente ou do tipo errado lança `FormatException`, e o `ApiService` converte isso em "O servidor
respondeu num formato inesperado". Decodifico os bytes como UTF-8 de propósito.

- **Apostila:** HTTP §8 (Model com `fromJson` e `jsonDecode`); Persistência §7 (`toMap`/`fromMap` para o SQLite).
- **Projeto:** `campo<T>()` e `campoOpcional<T>()` não aceitam valor padrão em silêncio; `lerData` recusa
  `2026-02-30`, que o `DateTime.parse` rolaria para março. `utf8.decode(r.bodyBytes)` porque o `response.body`
  do pacote `http` cai em Latin-1 quando o header não traz charset (documentado no `http` 1.6.0); há o teste "UTF-8".
- **Código:** `lib/models/formatos.dart: campo`, `lerData`; `lib/models/item_home.dart: ItemHome.fromJson,
  toMap, fromMap`; `lib/services/api_service.dart: _decodificar, _converter, _lerLista`;
  `lib/models/rascunho_evento.dart: toCriarJson`.
- **Limitação:** um item inválido derruba a lista inteira (`_lerLista` lança). É escolha: não esconder dado ruim.

### 5. O que são Future, async e await? O app trava enquanto espera a rede?

**Falar:** Future é um resultado que ainda vai chegar. `async` marca a função que devolve Future, e `await`
suspende só aquela função até o resultado chegar, sem bloquear a interface. A tela continua respondendo e mostra
o indicador de carregamento. Depois de cada `await` eu confiro `mounted` antes de chamar `setState`, porque a
pessoa pode ter saído da tela.

- **Apostila:** HTTP §6.2 ("await aguardará a resposta sem bloquear a execução da interface") e glossário §21.
- **Código:** `lib/services/api_service.dart: home()` (`await _enviar`); `lib/screens/home_page.dart:
  _HomePageState._carregar` (`await widget.deps.home.carregar()`, depois `if (!mounted) return;`);
  `_enviar` aplica `.timeout(timeout)` no Future.

### 6. initState × build: por que a chamada à API fica no initState?

**Falar:** `initState` roda uma vez, quando a tela nasce. `build` roda toda vez que a interface é reconstruída:
`setState`, rotação, troca de tema. Uma chamada de API dentro do `build` dispararia uma requisição a cada
reconstrução. Por isso a Home chama `_carregar()` no `initState`, e o detalhe guarda o Future em `_futuro` no
`initState`, e o `FutureBuilder` só o consome no `build`.

- **Apostila:** HTTP §7, caixa "Por que initState()?", e §9 (FutureBuilder).
- **Código:** `lib/screens/home_page.dart: initState` (chama `_carregar`); `lib/screens/evento_detalhe_page.dart:
  initState` (`_futuro = widget.deps.api.evento(...)`) e `build` (`FutureBuilder`); `evento_form_page.dart:
  initState -> _carregarMaterias`; `fila_page.dart: initState`.
- **Projeto:** o "Tentar de novo" troca o `_futuro` dentro de `setState` (`_recarregar`), nunca dentro do `build`.
  A Home usa `setState` com `_resultado`, `_erro` e `_carregando` em vez de FutureBuilder; as duas formas aparecem
  no app e na apostila.

---

## 2. Organização

### 7. Como o projeto está organizado e qual a responsabilidade de cada pasta?

**Falar:** `models` são dados puros (`fromJson`, `toJson`, `toMap`, `fromMap`). `database` abre o SQLite e cria as
tabelas. `repositories` fazem o CRUD local e a sessão no SharedPreferences. `services` falam com a API
(`ApiService`) e orquestram API mais banco local (`HomeService`, `SyncService`). `screens` são as telas e `widgets`
são peças visuais reaproveitadas, como `MateriaChip` e `EventoCard`.

- **Apostila:** Persistência §20 (a mesma árvore) e glossário §26: Repository é "camada de acesso aos dados",
  Service é "comunicação com serviços externos".
- **Projeto:** `widgets/` é acréscimo nosso. `HomeService` e `SyncService` ficam em `services/`, mas não falam só
  HTTP: decidem entre API e cache, então fazem a cola entre as camadas.
- **Código:** árvore de `lib/`; `lib/app_deps.dart: AppDeps.padrao` monta tudo num lugar só.

### 8. Por que separar Model, Service, Repository e Screen? Onde isso ajudou?

**Falar:** Cada camada muda por um motivo: a tela, quando o design muda; o Service, quando a API muda; o
Repository, quando o esquema do SQLite muda. Separar também deixa testar sem celular e sem internet. No app,
nenhuma tela importa `package:http` nem `sqflite`: só o `ApiService` fala HTTP e só os repositórios falam SQL.

- **Apostila:** HTTP §13.3 (a tela cuida da interface, o Model representa dados, o Service concentra a API,
  fica mais fácil de testar e manter, a mesma API serve várias telas).
- **Prova:** os 97 testes trocam o cliente HTTP e o banco por `AppDeps.padrao(client:, abrirDb:)`.
- **Código:** a classe `ApiService` se descreve como "Único ponto de HTTP do app".
  A única exceção de camada é `lib/main.dart`, que chama `AppDatabase.limparTudo` no logout.

### 9. Como as dependências chegam às telas? Por que setState e não Provider ou Bloc?

**Falar:** O `main()` cria um único `AppDeps` e o passa para as telas pelo construtor, uma injeção manual. Para
um app de 6 telas, `setState` com `FutureBuilder` basta, e é o pré-requisito que a apostila declara. Adicionar
Provider ou Bloc seria dependência a mais sem necessidade. O custo é que toda tela recebe `deps` e o estado
global (sessão, tema) sobe por callbacks até o `FansLabApp`.

- **Apostila:** HTTP §3 (pré-requisito: "gerenciamento de estado com setState").
- **Projeto:** a entrega proíbe dependência além de `http`, `shared_preferences`, `sqflite`, `path` (e
  `sqflite_common_ffi` nos testes). Ver `pubspec.yaml`.
- **Código:** `lib/main.dart: main, FansLabApp` (callbacks `_aoEntrar`, `_aoSair`, `_aoMudarTema`);
  `lib/app_deps.dart`.

---

## 3. Persistência

### 10. SharedPreferences, SQLite e banco remoto: quando usar cada um?

**Falar:** SharedPreferences guarda chave e valor simples: tema, sessão. SQLite guarda dados estruturados e
consultáveis no aparelho: cache da Home, fila de envio. O banco remoto fica no servidor e é compartilhado pela
turma; o app nunca fala com ele direto, só com a API REST. Os três sobrevivem a fechar o app; variável em memória
não.

- **Apostila:** Persistência §5 (tabela: memória não permanece; SharedPreferences, SQLite e banco remoto
  permanecem), §2 e §14 (o banco remoto não fica dentro do app).
- **Projeto:** SharedPreferences: `sessao` (JSON com jwt, usuário e turmaId), `temaEscuro`, `ultimaSincronizacao`,
  `homeSalvaEm`. SQLite: `home_cache`, `materias`, `rascunhos`, `estado_pessoal`. Remoto: Postgres atrás da API.
- **Código:** `lib/repositories/sessao_store.dart: SessaoStore`; `lib/database/app_database.dart: _esquema`.

### 11. O que sobrevive a fechar o app? Como você provou?

**Falar:** Ao fechar, perde-se o que está só em memória: a lista na tela, o `api.token`, o estado dos botões.
Permanecem a sessão e o tema (SharedPreferences) e o cache da Home, as matérias, os rascunhos e o estado pessoal
(SQLite). Ao abrir, o `main()` lê a sessão e recoloca o token no `ApiService`; a Home tenta a API e, sem rede, cai
no cache. Logout apaga tudo isso, menos o tema.

- **Código:** `lib/main.dart: main()` (`carregar()` e `api.token = sessao?.jwt`);
  `lib/database/app_database.dart: AppDatabase.abrir` (arquivo `fans_lab.db` em `getDatabasesPath()`);
  `AppDatabase.limparTudo` e `SessaoStore.limpar` no logout.
- **Limitação (diga):** os testes usam SQLite em memória (`abrirEmMemoria`) e SharedPreferences simulado
  (`setMockInitialValues`). Nenhum teste fecha e reabre o app, e `AppDatabase.abrir()` (o arquivo real) nunca é
  executado nos testes. A prova de persistência é a demonstração no aparelho: criar um rascunho sem rede, matar o
  app, reabrir e ver o rascunho na fila.

### 12. Como é o CRUD local?

**Falar:** O CRUD completo é o dos rascunhos, os eventos criados no aparelho. Inserir é `db.insert`, listar é
`db.query` com `orderBy`, atualizar é `db.update` com `where: 'local_id = ?'` e `whereArgs`, excluir é `db.delete`.
O banco é criado no `onCreate` com `version: 1`. Cache da Home e matérias são "troca tudo numa transação".

- **Apostila:** Persistência §7 a §11 (INSERT, SELECT, UPDATE, DELETE com `where` e `whereArgs`).
- **Código:** `lib/repositories/rascunho_repository.dart: inserir, listar, listarPendentes, atualizar, excluir`;
  telas: `evento_form_page.dart` (criar e editar rascunho) e `fila_page.dart` (listar, editar, excluir).
  Teste: `test/repositories_test.dart` "inserir, listar, atualizar e excluir".
- **Limitação:** não existe `onUpgrade`. Mudar o esquema exige subir para versão 2 e escrever a migração
  (o comentário em `app_database.dart` diz isso). Rascunho já enviado não pode ser editado nem excluído pela tela
  (`if (!r.sincronizado)` em `fila_page.dart`).

### 13. Por que "feito" fica numa tabela separada (estado_pessoal)?

**Falar:** Porque "feito" é do usuário, e o cache da Home é um espelho do servidor que eu apago e regravo inteiro
a cada atualização. Se "feito" fosse uma coluna do cache, cada refresh apagaria a marcação que ainda não foi
enviada. Separando, a lista é montada com um `LEFT JOIN` e a marcação pendente local prevalece sobre o que o
servidor disser.

- **Projeto (não é da apostila):** regra "fato compartilhado nunca guarda estado pessoal"
  (`AGENTS.md` regra 3; `docs/ENTREGA-FLUTTER.md` §6.3).
- **Código:** `lib/repositories/home_cache_repository.dart: substituir` (apaga e regrava) e `listar` (LEFT JOIN);
  `lib/repositories/estado_pessoal_repository.dart: aplicarDoServidor` (pula ids pendentes),
  `marcarSincronizado` (só se o valor enviado ainda é o atual).
- **Testes:** `services_test.dart` "feito pendente local prevalece sobre o que o servidor diz";
  `repositories_test.dart` "feito vem do estado_pessoal e não fica no cache".

---

## 4. Offline e sincronização

### 14. Qual é a estratégia: "salva local e depois envia"?

**Falar:** Salvo primeiro no SQLite com `sincronizado = 0` e só então tento a API. Se der certo, marco
`sincronizado = 1`. Se falhar por falta de rede, o item continua pendente para o próximo envio. Se o servidor
recusar (400, por exemplo), guardo a mensagem em `ultimo_erro` e mostro na fila. "Marcar feito" segue o mesmo
caminho: grava local e depois faz o PUT.

- **Apostila:** Persistência §17 (salvar no SQLite, tentar enviar; sucesso = sincronizada, erro = pendente;
  `sincronizado` 0 ou 1), §18 e §19 (loop sobre os pendentes).
- **Projeto:** vai além do loop da apostila: ordem de criação (`local_id ASC`); erro por item (um rascunho com 400
  não trava os outros); 401 interrompe e sobe; falta de rede interrompe o loop.
- **Código:** `lib/screens/evento_form_page.dart: _salvar` (`rascunhos.inserir` e depois `_sincronizar`);
  `lib/services/sync_service.dart: SyncService._executar`; `rascunho_repository.dart: listarPendentes,
  marcarSincronizado, registrarErro`; `evento_detalhe_page.dart: _alternarFeito` (`estado.marcarLocal` e depois
  `sync.sincronizar`).

### 15. O que acontece sem rede, tela por tela?

**Falar:** Criar evento e marcar feito funcionam: ficam no aparelho e o app avisa "Salvo no aparelho, será enviado
quando houver conexão". A Home mostra o último cache com a faixa "Sem conexão, mostrando o que foi salvo às
HH:mm". O que precisa de internet é editar, excluir, abrir o detalhe de um evento e entrar (login).

| Tela / ação | Sem rede |
|---|---|
| Criar evento | Salva rascunho, `sincronizado = 0`, mensagem "Salvo no aparelho" |
| Marcar feito | Grava em `estado_pessoal` (pendente), mesma mensagem |
| Home | Cache com `offline: true` e a faixa; se nunca carregou, erro com "Tentar de novo" |
| Matérias do formulário | Cache se existir; senão erro |
| Detalhe do evento | Sem cache: erro com "Tentar de novo" |
| Editar / excluir evento | "Editar precisa de internet." / "Excluir precisa de internet." |
| Login | Erro "Sem conexão com o servidor." |

- **Código:** `lib/services/home_service.dart: carregar` (`salvoEm == null` relança), `materias`;
  `lib/screens/home_page.dart: _corpo` (faixa offline); `evento_form_page.dart: _msgEditar`;
  `evento_detalhe_page.dart: _excluir` e `build` (chama `api.evento` direto, sem cache).
- **Limitação:** offline de verdade são três coisas: criar, marcar feito e reler a Home. O detalhe não tem cache.

### 16. E se o usuário clicar várias vezes? Duplica?

**Falar:** Há três proteções. Primeira: o botão fica desabilitado enquanto a operação roda (`_enviando`,
`_salvando`, `_salvandoFeito`, `_sincronizando`). Segunda: `SyncService.sincronizar()` guarda a execução em curso
em `_emCurso`, então chamadas simultâneas recebem o mesmo Future e não há dois envios em paralelo. Terceira:
depois de enviado, o rascunho vira `sincronizado = 1` e não entra mais na fila.

- **Apostila:** HTTP §15 lista "usuário clicando repetidamente no botão de envio" entre os cenários a testar.
- **Código:** `lib/screens/login_page.dart: _entrar` (`if (_enviando ...) return`); `evento_form_page.dart: _salvar`;
  `lib/services/sync_service.dart: sincronizar` (`_emCurso ??= _executar().whenComplete(...)`).
- **Teste:** `services_test.dart` "duas chamadas simultâneas de sincronizar() fazem exatamente 2 POSTs"
  (2 rascunhos, 2 POSTs, e os dois resultados são o mesmo objeto).
- **Limitação:** o desabilitar dos botões não tem teste de widget. O ícone de sincronizar da Home não é
  desabilitado; ele depende do `_emCurso`. Caso de borda: um item que entra na fila quando uma execução em curso
  já leu a fila só sai no próximo envio, e a mensagem "Enviado para a turma." do formulário não consulta `pendentes`.

### 17. Então nunca duplica? E se o POST chegar ao servidor mas a resposta se perder?

**Falar:** Esse caso pode duplicar, e está documentado no código. O POST chega, o servidor cria o evento, a
resposta não volta (timeout de 60 s). O app trata como "sem conexão", o rascunho continua pendente e o próximo
envio cria outro evento. O mesmo vale se o app morrer entre o 201 e o `marcarSincronizado`. A correção é uma chave
de idempotência: o cliente manda um UUID por rascunho e o servidor ignora repetições. Não está implementada, nem
no app nem no servidor. O PUT do "feito" não tem esse problema, porque repetir dá o mesmo resultado.

- **Código:** `lib/services/sync_service.dart: _executar` (comentário `ponytail:` nas linhas 48 a 50, depois
  `await _api.criarEvento(...)` e `await _rascunhos.marcarSincronizado(...)`); `api_service.dart: _enviar`
  (`TimeoutException` vira `semConexao`).
- **Limitação:** assuma isso em voz alta; é uma limitação conhecida, não um bug escondido.

### 18. Dois alunos editam o mesmo evento. Como o app trata o conflito (If-Match e 409)?

**Falar:** Todo evento tem um número de versão. Ao editar ou excluir, o app manda `If-Match` com a versão que ele
leu. Se outro aluno salvou antes, a versão no servidor mudou e ele responde 409 Conflict, sem sobrescrever. Sem o
header, responde 428. Na tela de edição o app avisa "Alguém alterou este evento antes de você, volte e abra de
novo"; na exclusão avisa "Recarregando" e busca o evento de novo, já com a versão nova.

- **Apostila:** não cobre isso. É decisão do projeto, para não perder em silêncio a edição de outra pessoa
  (conceito geral de concorrência otimista).
- **Código (app):** `lib/services/api_service.dart: atualizarEvento, excluirEvento` (`versao` vira `If-Match`);
  `lib/screens/evento_form_page.dart: _salvar, _msgEditar`; `lib/screens/evento_detalhe_page.dart: _excluir`.
- **Código (servidor):** `backend/src/main/java/com/projetofans/service/EventoService.java: exigirVersao`
  (lança `ConflitoVersaoException`, 409) e `erro/IfMatchAusenteException.java` (428).
- **Testes:** `api_service_test.dart`: "PATCH com If-Match: 3", "409 vira conflito", "DELETE com If-Match".
- **Limitação:** não há merge nem comparação: a pessoa refaz a edição. Editar e excluir são só online (não entram na
  fila), então não existe conflito esperando na fila. O formato é do projeto: `If-Match: 3` (inteiro puro, não um ETag entre
  aspas) e 409 no lugar do 412 que a RFC 9110 usaria. O fluxo de conflito na tela não tem teste de widget.

### 19. Por que PATCH e não PUT na edição? E onde está o PUT?

**Falar:** A apostila ensina PUT para atualizar. Aqui a edição do evento é PATCH porque é o que o servidor expõe em
`/eventos/{id}`, e é nele que o servidor grava o histórico e exige `If-Match`. O PUT está em marcar feito:
`PUT /eventos/{id}/estado-pessoal` com `{"feito": true}`, resposta 204. PUT cabe ali porque é "defina o estado como
X": repetir dá o mesmo resultado (idempotente), e como não mexe no evento compartilhado não precisa de `If-Match`.

- **Apostila:** HTTP §11 (PUT atualiza); Persistência §23 aceita "PUT/PATCH". Decisão P3 em
  `docs/ENTREGA-FLUTTER.md` §2.
- **Código:** `lib/services/api_service.dart: marcarFeito` e `atualizarEvento`;
  `backend/src/main/java/com/projetofans/web/controller/QuadroController.java: marcar` (o comentário explica por
  que é PUT e sem `If-Match`) e `EventoController` (só há PATCH e DELETE em `/eventos/{id}`).
  Teste: `api_service_test.dart` "marcarFeito faz PUT em estado-pessoal".
- **Limitação (honesta):** o PATCH do app envia o objeto inteiro (`toCriarJson`, como o servidor espera), então na
  prática é uma substituição completa com o verbo PATCH. O verbo é ditado pelo contrato do servidor. O servidor
  não oferece PUT para editar evento.

---

## 5. Erros

### 20. O que cada status vira na tela?

**Falar:** Todo erro de rede ou HTTP sai do `ApiService` como uma única `ApiException` com mensagem pronta em
português. A mensagem é o `detail` do ProblemDetail do servidor; se não houver, o `title`; se não houver, uma
tabela por status. As telas têm os três estados (carregando, sucesso, erro) e usam SnackBar ou botão "Tentar de
novo".

| Situação | Mensagem | O que o app faz |
|---|---|---|
| Sem rede, timeout, TLS | "Sem conexão com o servidor." | Home vai para o cache; criar e feito vão para a fila |
| 400 | `detail` do servidor ou "Dados inválidos." | No envio: grava `ultimo_erro` no rascunho; aparece na fila |
| 401 no login | "E-mail ou senha incorretos." | Fica no login |
| 401 depois | "Sessão expirada. Entre de novo." | Home faz logout; outras telas só avisam |
| 403 | "Você não tem permissão para isso." | Botões Editar e Excluir só aparecem ao autor |
| 404 | "Não encontrado, pode ter sido excluído." | No envio de "feito": tira da fila |
| 409 | "Alguém alterou este evento antes..." | Recarrega (excluir) ou pede para reabrir (editar) |
| 428 | "Faltou a versão do registro." | O app sempre manda `If-Match`; só apareceria por bug |
| 429 | "Muitas tentativas. Espere alguns minutos." | Limite de tentativas de login do servidor |
| 5xx | "Erro no servidor. Tente de novo em instantes." | Home e matérias caem no cache (ver armadilha 3) |
| 200 com JSON quebrado | "O servidor respondeu num formato inesperado." | Não é tratado como "sem conexão" |

- **Apostila:** HTTP §15 (cenários: sem conexão, 404, 500, JSON inesperado) e Persistência §21.
- **Código:** `lib/services/api_service.dart: _erroHttp` (linha 116), `_mensagemPadrao` (linha 165);
  `lib/services/api_exception.dart: ApiException` (`semConexao`, `naoAutorizado`, `conflito`, `naoEncontrado`).
  Telas: `home_page.dart`, `evento_detalhe_page.dart`, `evento_form_page.dart`, `fila_page.dart`, `login_page.dart`.
- **Testes:** `api_service_test.dart` grupos "erros HTTP" e "sem conexão" (404 com ProblemDetail, só `title`, 500,
  400/403/428/429, `ClientException`, `SocketException`, timeout).

### 21. Por que uma falha não vira lista vazia?

**Falar:** Porque "não há provas nesta semana" e "falhou ao buscar" são coisas diferentes, e confundir as duas é o
pior bug possível para um app de provas. Então o `ApiService` sempre lança em falha, o `HomeService` só devolve o
cache se ele existe, e a Home mostra uma mensagem de erro com "Tentar de novo". Lista vazia só aparece quando o
servidor respondeu 200 com `[]`, e aí o texto é "Nada nos próximos 14 dias."

- **Projeto:** regra §6.9 de `docs/ENTREGA-FLUTTER.md`. Não há `catch` vazio no app. O único `catch` que devolve
  null é `SessaoStore.carregar`, para sessão salva corrompida (`FormatException`), e o efeito é pedir novo login.
- **Código:** `lib/services/home_service.dart: carregar` (`if (salvoEm == null) rethrow;`) e `materias`
  (`if (cache.isEmpty) rethrow;`); `lib/screens/home_page.dart: _corpo` (erro com botão) e `_carregar` (com lista
  já carregada, mantém a lista e mostra a faixa "Não foi possível atualizar").
- **Testes:** `telas_home_test.dart` "falha sem cache mostra Tentar de novo, nunca lista vazia" e "home com lista
  vazia mostra o texto de semana vazia"; `services_test.dart` "sem conexão sem nunca ter carregado lança
  semConexao, nunca lista vazia".

### 22. E o timeout, o servidor dormindo e uma URL incorreta?

**Falar:** O timeout é de 60 s porque o servidor gratuito do Render dorme e a primeira chamada pode levar cerca de
50 s; a tela de login avisa isso. Timeout, DNS que não resolve e falha de TLS viram `semConexao`. URL com host
errado cai aí; caminho errado volta 404. A URL vem de `--dart-define=API_URL`, não está fixa no código.

- **Apostila:** HTTP §15 lista "URL incorreta" e "sem conexão" como cenários.
- **Código:** `lib/services/api_service.dart: ApiService` (`timeout = Duration(seconds: 60)`) e `_enviar`
  (captura `SocketException`, `http.ClientException`, `TimeoutException`, `HandshakeException`);
  `lib/screens/login_page.dart` (texto "pode levar até 1 minuto"); `lib/config.dart`.
- **Limitação:** timeout e "sem rede" ficam na mesma mensagem; o app não distingue servidor lento de aparelho
  offline. E só essas quatro exceções são convertidas: uma `API_URL` malformada a ponto de fazer `Uri.parse`
  lançar `FormatException` escaparia como exceção que não é `ApiException`, e as telas só capturam
  `ApiException`. Então "toda falha sai como ApiException" é o objetivo do contrato, não uma garantia total.

---

## 6. Segurança

### 23. O que é JWT e como o app o usa?

**Falar:** JWT é um token assinado pelo servidor, no formato cabeçalho.corpo.assinatura. O servidor o entrega no
login, e o app o devolve em todo pedido no header `Authorization: Bearer <jwt>`. O servidor valida a assinatura e
a validade; para o app o token é opaco, eu não o decodifico. Quem diz que expirou é o servidor, com 401.

- **Apostila:** HTTP §16 mostra o header `Authorization: Bearer SEU_TOKEN`. A estrutura do JWT é conhecimento geral,
  não está nas apostilas (o corpo do JWT é só codificado, não criptografado; não se põe segredo nele).
- **Projeto:** o token vive no campo `jwt` de `Sessao`, é posto em `api.token` no login e restaurado no `main()`.
  No servidor a validade configurada é de 720 h (30 dias): `backend/src/main/resources/application.yml`
  (`jwt-expiracao-horas: 720`).
- **Código:** `lib/services/api_service.dart: login` e `_enviar` (`if (token != null) 'Authorization': 'Bearer $token'`);
  `lib/main.dart: _aoEntrar`; `lib/models/sessao.dart: Sessao`.

### 24. Por que a senha não é salva?

**Falar:** Porque guardar a senha no aparelho só aumenta o estrago se o aparelho for comprometido, e o token já
basta para manter a sessão. A senha existe apenas no campo de texto da tela de login, vai uma vez no POST
`/auth/login` e não vai para o SharedPreferences nem para o SQLite. No servidor ela é guardada como hash BCrypt.
Quando o token expira, a pessoa digita a senha de novo.

- **Código:** `lib/screens/login_page.dart` (comentário "A senha só existe nesta tela. Nunca é salva."; o campo
  usa `obscureText: true`); `lib/models/sessao.dart` (a `Sessao` só tem `jwt`, `usuario`, `turmaId`);
  `lib/repositories/sessao_store.dart` (doc: "A senha nunca passa por aqui");
  `backend/src/main/java/com/projetofans/config/SegurancaConfig.java: passwordEncoder` (BCrypt).
- **Limitação:** nenhum teste afirma "a senha não é salva"; isso vale pela ausência do campo no modelo. A URL padrão
  é HTTPS, e o app não registra nada em log (não há `print` em `lib/`).

### 25. Qual o limite de guardar o JWT em SharedPreferences? Qual a alternativa?

**Falar:** SharedPreferences não é criptografado. O JWT fica em texto no armazenamento do app, protegido só pelo
isolamento do Android. Quem tiver acesso ao arquivo (aparelho com root, backup, malware com privilégio) pode usar o
token como se fosse a pessoa, até ele expirar. A alternativa é o pacote `flutter_secure_storage`, que guarda cifrado
(Keystore no Android, Keychain no iOS). Não implementei por prazo, e isso está declarado no código e na entrega.

- **Apostila:** HTTP §16, caixa "Atenção": credenciais devem usar "mecanismos apropriados de configuração e
  armazenamento seguro". A apostila não cita o pacote; o nome é conhecimento adicional. Persistência trata o
  SharedPreferences como lugar de "informações simples".
- **Código:** `lib/repositories/sessao_store.dart: SessaoStore.salvar` (comentário `ponytail:` apontando
  `flutter_secure_storage`); `docs/ENTREGA-FLUTTER.md` §9. O pacote não está no `pubspec.yaml`.
- **Projeto:** a troca é pequena: só o jwt iria para o armazenamento seguro, e o tema continuaria no
  SharedPreferences. O que existe hoje: logout apaga a sessão, o padrão é HTTPS, o token expira no servidor.
  O manifesto Android não define `android:allowBackup`, então vale o padrão do sistema; não afirme que o arquivo
  fica fora de backup.

### 26. Como o app percebe que o token expirou?

**Falar:** Ele não lê a data de dentro do JWT. Só descobre quando o servidor responde 401. Na Home, o 401 mostra
"Sessão expirada. Entre de novo." e faz logout, voltando ao login. Nas outras telas aparece a mensagem "Sessão
expirada, volte e entre de novo". No login, 401 significa credencial errada e a mensagem é outra.

- **Código:** `lib/services/api_service.dart: _erroHttp` (`login && status == 401`);
  `lib/screens/home_page.dart: _carregar`, `_sincronizar`, `_sessaoExpirou` (linha 83);
  `lib/main.dart: _aoSair` (linhas 52 a 58).
- **Limitação:** veja a armadilha 4: esse logout automático apaga a fila offline.

---

## 7. Testes

### 27. Como você testa HTTP sem internet? (MockClient)

**Falar:** O `ApiService` recebe o `http.Client` pelo construtor. Nos testes passo um `MockClient`, do pacote
`http/testing.dart`: ele recebe o `http.Request` (método, URL, headers, corpo) e devolve um `http.Response` ou
lança uma exceção para simular falha de rede. Assim confiro verbos, URLs, headers e corpo, e simulo 401, 404, 500,
JSON quebrado e queda de rede, sem servidor.

- **Código:** `test/api_service_test.dart` (20 testes). O `ApiService` aceita `client` e `timeout` no construtor;
  `AppDeps.padrao(client:)` repassa o cliente.
- **Prova:** que o cliente cumpre o contrato (Bearer só com token; `If-Match: 3`; PUT em `estado-pessoal` com
  `{"feito":true}`; ordem da lista preservada; lista vazia é sucesso; `ClientException`, `SocketException` e timeout
  viram `semConexao`; corpo `<html>` ou item sem `titulo` viram `respostaInvalida`).
- **Não prova:** que o servidor real responde assim, nem TLS, nem comportamento em Android.

### 28. Por que sqflite_common_ffi? O que ele prova?

**Falar:** O `sqflite` normal precisa do plugin nativo do Android ou iOS, que não existe em `flutter test` no
computador. O `sqflite_common_ffi` traz um SQLite real por FFI. Nos testes eu chamo `sqfliteFfiInit()`, troco o
`databaseFactory` e uso `AppDatabase.abrirEmMemoria()`, que dá um banco novo e vazio a cada teste. Os repositórios
recebem uma função `AbrirDb`, então aceitam esse banco por injeção.

- **Código:** `test/repositories_test.dart` (13 testes), `test/services_test.dart` (14), usando
  `lib/database/app_database.dart: abrirEmMemoria` (`singleInstance: false`) e o `typedef AbrirDb`.
- **Prova:** o SQL de verdade: ordem por `posicao`, `LEFT JOIN` do feito, `substituir` em transação, regras de
  pendente e `limparTudo` esvaziando as 4 tabelas.
- **Limitação:** é o SQLite do computador, não o do Android (o código evita UPSERT por causa do "SQLite antigo do
  Android", comentário em `estado_pessoal_repository.dart`). O arquivo real, o caminho `getDatabasesPath()` e
  migração de esquema não são testados.

### 29. O que cada suíte prova, e o que não prova?

**Falar:** São 97 testes em 8 arquivos, todos verdes, e o `flutter analyze` não aponta nada. Eles cobrem as
camadas isoladamente: models, HTTP com cliente simulado, SQLite em memória, serviços de cache e envio, e algumas
telas. Não cobrem o aparelho real nem o servidor real.

| Arquivo | Testes | O que prova | O que não prova |
|---|---|---|---|
| `api_service_test.dart` | 20 | contrato HTTP do cliente, status para `ApiException`, sem conexão, JSON inválido, UTF-8 | servidor real |
| `models_test.dart` | 19 | `fromJson`, `toMap`/`fromMap` de ida e volta, `lerData`, `FormatException` | |
| `repositories_test.dart` | 13 | SQL, ordem, transações, regras de pendente, CRUD de rascunhos, `limparTudo` | arquivo real no aparelho, migração |
| `services_test.dart` | 14 | `HomeService` (cache, offline, 401, feito pendente) e `SyncService` (envio, 400 por item, 401, PUT, 404, concorrência) | 5xx na Home, envio automático, duplicação por timeout |
| `sessao_store_test.dart` | 6 | sessão, tema e datas; JSON corrompido apaga a chave; `limpar` mantém o tema | criptografia (não existe) |
| `telas_home_test.dart` | 4 | login 401 mostra mensagem; Home na ordem do servidor; lista vazia; falha sem cache é erro | 401 vira logout (`aoSair` é `() {}` nos testes); faixa offline |
| `telas_evento_test.dart` | 5 | formulário offline salva rascunho e avisa; título vazio não grava; fila mostra "aguardando envio"; autor vê Editar, não autor não | 409 na tela, excluir, envio bem-sucedido pelo botão Sincronizar |
| `widgets_test.dart` | 16 | `MateriaChip` (sigla e cor inválida), `EventoCard` (prova sólida, entrega em contorno), `tempoRelativo` | |

- **Como rodar para mostrar:** `export PATH=/opt/flutter-sdk/flutter/bin:$PATH && cd fans_lab && flutter analyze && flutter test`.
- **Nunca foi feito** (diga, se perguntarem): teste de integração contra a API real; execução em aparelho nesta
  sessão (`docs/ENTREGA-FLUTTER.md` §9).

---

## 8. Cinco perguntas armadilha

### 30. "Quando a internet volta, o app envia tudo sozinho, certo?"

**Por que enrola:** a tabela da entrega fala em "fila" e "sincronização", e dá vontade de responder "automático".

**Resposta segura:** "Não. O app é offline-first para criar evento e marcar feito: nada se perde sem rede, tudo
fica na fila. Mas o envio é disparado por ação: o ícone de sincronizar da Home, o botão 'Sincronizar agora' da fila,
ou ao salvar um evento ou marcar feito (cada um tenta enviar a fila toda). Não escuto a conectividade nem tenho
envio em segundo plano. O próximo passo seria sincronizar ao voltar a rede ou ao abrir o app." Complete: editar,
excluir, abrir o detalhe e entrar precisam de internet.

- **Onde:** `sincronizar()` só é chamado em `home_page.dart: _sincronizar`, `fila_page.dart: _sincronizar`,
  `evento_form_page.dart: _sincronizar`, `evento_detalhe_page.dart: _alternarFeito`. A Home ao abrir só chama
  `contarPendentes()`. Não há `Timer`, listener de conectividade nem WorkManager em `lib/`.

### 31. "Os 97 testes passam, então o app funciona no celular?"

**Por que enrola:** teste verde passa sensação de "está provado".

**Resposta segura:** "Os testes provam as camadas isoladas: contrato HTTP com cliente simulado, SQL com SQLite
em memória, regras de cache e de fila. Não provam o aparelho nem o servidor real. A demonstração ao vivo é a
prova de ponta a ponta." Se você ensaiou no Android, conte o que viu; se não ensaiou, diga que não. A entrega
registra que nenhum APK foi testado em aparelho na sessão de desenvolvimento.

- **Onde:** Pergunta 29; `docs/ENTREGA-FLUTTER.md` §2 (P5) e §9.

### 32. "Aparece 'Sem conexão' só quando está sem internet?"

**Por que enrola:** a resposta natural é "sim", mas o código diz outra coisa.

**Resposta segura:** "Não só. Na Home e nas matérias, o erro 5xx do servidor também cai no cache, com a mesma
faixa 'Sem conexão, mostrando o que foi salvo'. A intenção é que servidor fora do ar, como o Render dormindo ou
caindo, não deixe a tela em branco. A frase é imprecisa para o caso 5xx. No envio da fila a regra é outra: 5xx
conta como erro do item e ele fica pendente. Esse caso 5xx não tem teste."

- **Onde:** `lib/services/home_service.dart: _semRede` (linha 81: `e.semConexao || (e.status ?? 0) >= 500`);
  `lib/screens/home_page.dart: _corpo` (texto da faixa); `lib/services/sync_service.dart: _executar` (só
  `semConexao` interrompe).

### 33. "Se o token expirar e eu tiver evento ainda não enviado, o que acontece?"

**Por que enrola:** o aluno pensa na mensagem "Sessão expirada" e não nas consequências.

**Resposta segura:** "Hoje, a fila é apagada. Na Home, o 401 chama o logout, e o logout chama
`AppDatabase.limparTudo`, que esvazia rascunhos e marcações pendentes, sem pedir confirmação. O aviso de confirmação
existe só no 'Sair' manual das configurações. O token vale 30 dias no servidor e também deixaria de valer se for
inválido, então é raro, mas é perda de dado real. A correção é não apagar a fila em 401: manter os dados, pedir novo
login e enviar depois. Não está feita."

- **Onde:** `lib/screens/home_page.dart: _sessaoExpirou` (linha 83) chama `widget.aoSair()`; `lib/main.dart:
  _aoSair` (linhas 52 a 58) chama `AppDatabase.limparTudo`; confirmação só em
  `lib/screens/configuracoes_page.dart: _confirmarSair`. Nenhum teste cobre o caminho (nos testes `aoSair` é `() {}`).

### 34. "Isso não é o app que a apostila pediu (tarefas, Catálogo de Jogos)."

**Por que enrola:** é uma pergunta de adequação ao enunciado, e a entrega registra que a escolha não foi confirmada.

**Resposta segura:** "A apostila usa JSONPlaceholder para treino e diz que, no projeto da disciplina, os endpoints
devem ser os da API desenvolvida pela turma. Escolhi o app da turma, com a API da turma. As operações pedidas
estão todas, só com outro domínio: GET (home, matérias, detalhe), POST (criar evento), PUT (marcar feito), PATCH
(editar), DELETE (excluir), SQLite com CRUD local nos rascunhos (o equivalente das 'tarefas'), modo offline e
sincronização, com loading, erro e sucesso em todas as telas." Não diga que o professor aprovou essa escolha.

- **Onde:** nota didática no fim da apostila HTTP; `docs/ENTREGA-FLUTTER.md` §2 (P1, confiança média-alta) e §3
  (tabela critério para implementação), §9 ("P1 pode estar errada").

---

## Frases para não dizer

- "Sincroniza automaticamente quando volta a internet." (Pergunta 30)
- "Nunca duplica." (Pergunta 17)
- "O token está seguro no aparelho." (Pergunta 25)
- "Os testes provam que funciona no celular." (Pergunta 31)
- "Offline funciona em tudo." (Pergunta 15: são criar, marcar feito e reler a Home)
