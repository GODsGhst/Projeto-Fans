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
- SharedPreferences: 5 chaves (`sessao`, `temaEscuro`, `ultimaSincronizacao`, `homeSalvaEm`,
  `ultimoUsuarioId`). SQLite: arquivo `fans_lab.db`, 4 tabelas.
- Verificado na última conferência: `flutter analyze` sem issues e `flutter test` com **177 testes, todos
  verdes** (contagem por arquivo na Pergunta 29). Há também 13 testes contra o backend Spring local
  (`test_e2e/`), fora do `flutter test` padrão.

## Antes de entrar na sala

1. Acorde a API: `curl https://projetofans-api.onrender.com/api/v1/saude`. O plano gratuito do Render dorme e a
   primeira chamada pode levar cerca de 50 s (`docs/ENTREGA-FLUTTER.md` §5 e §9). O app espera até 90 s. A tela de
   login avisa que a primeira entrada pode levar até 1 minuto.
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
  na apostila; vêm do contrato da API (`docs/ENTREGA-FLUTTER.md` §5). As mensagens desses status são do app, não
  do servidor: o texto técnico do ProblemDetail só aparece em 400 (onde diz qual campo está errado) e em status
  que o app não conhece.
- **Código:** `lib/services/api_service.dart: _enviar(esperado:)` (a comparação `r.statusCode != esperado`) e
  `_erroHttp`.
- **Limitação:** a comparação é de igualdade. Um 200 onde se esperava 201 também vira erro ("Erro HTTP 200.").

### 4. Como o JSON vira objeto Dart, e o caminho de volta?

**Falar:** `jsonDecode` transforma o texto em `Map`. Cada model tem um `factory X.fromJson(Map)` que monta o
objeto tipado. A volta é `jsonEncode` em cima de um `Map` gerado por `toJson` ou `toCriarJson`. Meus models são
estritos: campo ausente ou do tipo errado lança `FormatException`, e o `ApiService` converte isso em "O servidor
respondeu num formato inesperado". Decodifico os bytes como UTF-8 de propósito.

- **Apostila:** HTTP §8 (Model com `fromJson` e `jsonDecode`); Persistência §7 (`toMap`/`fromMap` para o SQLite).
- **Projeto:** `campo<T>()` e `campoOpcional<T>()` não aceitam valor padrão em silêncio; `lerData` recusa
  `2026-02-30`, que o `DateTime.parse` rolaria para março. `utf8.decode(r.bodyBytes)` porque o `response.body`
  do pacote `http` cai em Latin-1 quando o header não traz charset (documentado no `http` 1.6.0); há o grupo de
  testes "UTF-8".
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
- **Prova:** os testes trocam o cliente HTTP e o banco por `AppDeps.padrao(client:, abrirDb:)`.
- **Código:** a classe `ApiService` se descreve como "Único ponto de HTTP do app".
  A exceção de camada é `lib/main.dart`, que chama `AppDatabase.limparTudo` no logout e também quando alguém entra
  com outra conta (para não enviar a fila de um com a autoria de outro).

### 9. Como as dependências chegam às telas? Por que setState e não Provider ou Bloc?

**Falar:** O `main()` cria um único `AppDeps` e o passa para as telas pelo construtor, uma injeção manual. Para
um app de 6 telas, `setState` com `FutureBuilder` basta, e é o pré-requisito que a apostila declara. Adicionar
Provider ou Bloc seria dependência a mais sem necessidade. O custo é que toda tela recebe `deps` e o estado
global (sessão, tema) sobe por callbacks até o `FansLabApp`.

- **Apostila:** HTTP §3 (pré-requisito: "gerenciamento de estado com setState").
- **Projeto:** a regra da entrega é não adicionar dependência além de `http`, `shared_preferences`, `sqflite` e
  `path`, com `sqflite_common_ffi` nos testes (`docs/ENTREGA-FLUTTER.md` §4). Duas coisas aparecem no `pubspec.yaml`
  além disso, e você deve dizer isso se perguntarem: `flutter_localizations` (pacote do próprio SDK do Flutter,
  adicionado na volta 2 para datas e seletores em português) e as dependências que vêm do template `flutter create`
  (`cupertino_icons`, `flutter_lints`).
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
  `homeSalvaEm` e `ultimoUsuarioId` (dono da última sessão, para a regra de troca de conta). SQLite: `home_cache`,
  `materias`, `rascunhos`, `estado_pessoal`. Remoto: Postgres atrás da API.
- **Código:** `lib/repositories/sessao_store.dart: SessaoStore`; `lib/database/app_database.dart: _esquema`.

### 11. O que sobrevive a fechar o app? Como você provou?

**Falar:** Ao fechar, perde-se o que está só em memória: a lista na tela, o `api.token`, o estado dos botões.
Permanecem a sessão e o tema (SharedPreferences) e o cache da Home, as matérias, os rascunhos e o estado pessoal
(SQLite). Ao abrir, o `main()` lê a sessão e recoloca o token no `ApiService`; a Home tenta a API e, sem rede, cai
no cache. Logout apaga tudo isso, menos o tema. Uma sessão expirada (401) também não apaga a fila.

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
caminho: grava local e depois faz o PUT. Além dos botões, a Home também envia a fila quando carrega com rede
(Pergunta 30).

- **Apostila:** Persistência §17 (salvar no SQLite, tentar enviar; sucesso = sincronizada, erro = pendente;
  `sincronizado` 0 ou 1), §18 e §19 (loop sobre os pendentes).
- **Projeto:** vai além do loop da apostila: ordem de criação (`local_id ASC`); erro por item (um rascunho com 400
  não trava os outros); 401 interrompe e sobe, sem apagar nada; falta de rede interrompe o loop.
- **Código:** `lib/screens/evento_form_page.dart: _salvar` (`rascunhos.inserir` e depois `_sincronizar`);
  `lib/services/sync_service.dart: SyncService._executar`; `rascunho_repository.dart: listarPendentes,
  marcarSincronizado, registrarErro`; `evento_detalhe_page.dart: _alternarFeito` (`estado.marcarLocal` e depois
  `sync.sincronizar`).

### 15. O que acontece sem rede, tela por tela?

**Falar:** Criar evento e marcar feito funcionam: ficam no aparelho e o app avisa "Salvo no aparelho — será enviado
quando houver conexão". A Home mostra o último cache com a faixa "Sem conexão com o servidor — mostrando o que foi
salvo às HH:mm". Editar e excluir precisam de internet, e abrir o detalhe também: sem rede, o detalhe mostra o
erro, mas ainda deixa marcar feito. Entrar precisa de internet.

| Tela / ação | Sem rede |
|---|---|
| Criar evento | Salva rascunho, `sincronizado = 0`, mensagem "Salvo no aparelho — será enviado quando houver conexão." |
| Marcar feito | Grava em `estado_pessoal` (pendente), mesma mensagem. Funciona também no detalhe sem rede |
| Home | Cache com `offline: true` e a faixa "Sem conexão com o servidor — mostrando o que foi salvo às HH:mm."; se nunca carregou, erro com "Tentar de novo" |
| Matérias do formulário | Cache se existir (a Home grava as matérias quando carrega online); senão erro com "Tentar de novo" |
| Detalhe do evento | "Sem conexão com o servidor." com "Marcar como feito" e "Tentar de novo" |
| Editar / excluir evento | "Editar precisa de internet." / "Excluir precisa de internet." |
| Sincronizar (Home ou Fila) | "Sem conexão — nada foi enviado." |
| Login | "Sem conexão com o servidor." |

- **Código:** `lib/services/home_service.dart: carregar` (`salvoEm == null` relança), `materias`;
  `lib/screens/home_page.dart: _corpo` (faixa offline); `evento_form_page.dart: _msgEditar`;
  `evento_detalhe_page.dart: _estadoErro` (botão de feito offline) e `_excluir`.
- **Limitação:** offline de verdade são três coisas: criar, marcar feito e reler a Home. O detalhe não tem cache:
  sem rede, ele só oferece marcar feito.

### 16. E se o usuário clicar várias vezes? Duplica?

**Falar:** Há três proteções. Primeira: o botão fica desabilitado enquanto a operação roda (`_enviando`,
`_salvando`, `_salvandoFeito`, `_sincronizando`). Segunda: `SyncService.sincronizar()` guarda a execução em curso
em `_emCurso`, então chamadas simultâneas recebem o mesmo Future e não há dois envios em paralelo. Terceira:
depois de enviado, o rascunho vira `sincronizado = 1` e não entra mais na fila.

- **Apostila:** HTTP §15 lista "usuário clicando repetidamente no botão de envio" entre os cenários a testar.
- **Código:** `lib/screens/login_page.dart: _entrar` (`if (_enviando ...) return`); `evento_form_page.dart: _salvar`;
  `lib/services/sync_service.dart: sincronizar` (`_emCurso`, com rodada extra quando há chamada concorrente).
- **Teste:** `services_test.dart` "duas chamadas simultâneas de sincronizar() fazem exatamente 2 POSTs"
  (2 rascunhos, 2 POSTs, e os dois resultados são o mesmo objeto).
- **Limitação:** o desabilitar dos botões não tem teste de widget. O ícone de sincronizar da Home fica desabilitado
  enquanto o próprio toque roda (`_sincronizando`), mas a sincronização que a Home dispara ao carregar com rede não
  passa por essa flag: quem impede envio duplicado nesse caso é o `_emCurso`. Caso de borda: um item que entra na
  fila quando uma execução em curso já leu a fila só sai no próximo envio, e a mensagem "Enviado para a turma." do
  formulário não consulta `pendentes`.

### 17. Então nunca duplica? E se o POST chegar ao servidor mas a resposta se perder?

**Falar:** Esse caso pode duplicar, e está documentado no código. O POST chega, o servidor cria o evento, a
resposta não volta (o timeout é de 90 s). O app trata como "sem conexão", o rascunho continua pendente e o próximo
envio cria outro evento. O mesmo vale se o app morrer entre o 201 e o `marcarSincronizado`. A correção é uma chave
de idempotência: o cliente manda um UUID por rascunho e o servidor ignora repetições. Não está implementada, nem
no app nem no servidor. O PUT do "feito" não tem esse problema, porque repetir dá o mesmo resultado.

- **Código:** `lib/services/sync_service.dart: _executar` (comentário `ponytail:` antes do `await _api.criarEvento(...)`,
  que explica o reenvio duplicado e aponta a chave de idempotência); `api_service.dart: _enviar`
  (`TimeoutException` vira `semConexao`).
- **Limitação:** assuma isso em voz alta; é uma limitação conhecida, não um bug escondido.

### 18. Dois alunos editam o mesmo evento. Como o app trata o conflito (If-Match e 409)?

**Falar:** Todo evento tem um número de versão. Ao editar ou excluir, o app manda `If-Match` com a versão que ele
leu. Se outro aluno salvou antes, a versão no servidor mudou e ele responde 409 Conflict, sem sobrescrever. Sem o
header, responde 428. Na edição, o app avisa "Alguém alterou este evento antes de você. Volte e abra de novo."; na
exclusão, avisa "Alguém alterou este evento antes. Recarregando…" e busca o evento de novo, já com a versão nova.

- **Apostila:** não cobre isso. É decisão do projeto, para não perder em silêncio a edição de outra pessoa
  (conceito geral de concorrência otimista).
- **Código (app):** `lib/services/api_service.dart: atualizarEvento, excluirEvento` (`versao` vira `If-Match`);
  `lib/screens/evento_form_page.dart: _salvar, _msgEditar`; `lib/screens/evento_detalhe_page.dart: _excluir`.
- **Código (servidor):** `backend/src/main/java/com/projetofans/service/EventoService.java: exigirVersao`
  (lança `ConflitoVersaoException`, 409) e `erro/IfMatchAusenteException.java` (428).
- **Testes:** `api_service_test.dart`: "atualizarEvento faz PATCH com If-Match: 3, envia o corpo e devolve o Evento",
  "atualizarEvento com 409 vira conflito", "excluirEvento faz DELETE com If-Match e aceita 204".
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
  `backend/src/main/java/com/projetofans/web/controller/QuadroController.java` (o comentário explica por que o
  "feito" é PUT e sem `If-Match`) e `EventoController`, que não tem PUT: a edição é `@PatchMapping("/{id}")`.
  Teste: `api_service_test.dart` "marcarFeito faz PUT em estado-pessoal com {"feito":true} e aceita 204".
- **Limitação (honesta):** o PATCH do app envia o objeto inteiro (`toCriarJson`, como o servidor espera), então na
  prática é uma substituição completa com o verbo PATCH. O verbo é ditado pelo contrato do servidor. O servidor
  não oferece PUT para editar evento.

---

## 5. Erros

### 20. O que cada status vira na tela?

**Falar:** Todo erro de rede ou HTTP sai do `ApiService` como uma única `ApiException` com mensagem pronta em
português. Para 401, 403, 404, 409, 428, 429 e 5xx, a mensagem é do app. O texto técnico do servidor (`detail`) só
aparece em 400, onde explica o campo errado, e em status que o app não conhece. Por isso a tela não mostra texto
cru do servidor. As telas têm os três estados (carregando, sucesso, erro) e usam SnackBar ou botão "Tentar de novo".

| Situação | Mensagem | O que o app faz |
|---|---|---|
| Sem rede, TLS | "Sem conexão com o servidor." | Home vai para o cache; criar e feito vão para a fila |
| Timeout (90 s) | "O servidor demorou para responder — ele pode estar acordando. Tente de novo em instantes." | Igual à falta de rede: Home vai para o cache; criar e feito vão para a fila |
| 400 | `detail` do servidor ou "Dados inválidos." | No envio: grava `ultimo_erro` no rascunho; aparece na fila |
| 401 no login | "E-mail ou senha incorretos." | Fica no login |
| 401 nas outras chamadas | "Sessão expirada. Entre de novo." (Home) ou "Sessão expirada — volte e entre de novo." (demais telas) | Volta ao login. A fila fica no aparelho |
| 403 | "Você não tem permissão para isso." | Botões Editar e Excluir só aparecem ao autor |
| 404 | "Não encontrado — pode ter sido excluído." | No envio de "feito": sai da fila |
| 409 | Edição: "Alguém alterou este evento antes de você. Volte e abra de novo." Exclusão: "Alguém alterou este evento antes. Recarregando…" | Exclusão recarrega o evento; edição pede para reabrir |
| 428 | "Faltou a versão do registro." | O app sempre manda `If-Match`; só apareceria por bug |
| 429 | "Muitas tentativas. Espere alguns minutos." | Limite de tentativas de login do servidor |
| 5xx | "Erro no servidor. Tente de novo em instantes." | Home e matérias caem no cache (ver Pergunta 32); no envio, o item fica pendente com esse erro |
| 200 com JSON quebrado | "O servidor respondeu num formato inesperado." | Não é tratado como "sem conexão" |

- **Apostila:** HTTP §15 (cenários: sem conexão, 404, 500, JSON inesperado) e Persistência §21.
- **Código:** `lib/services/api_service.dart: _erroHttp` e `_mensagemPadrao` (a tabela de mensagens do app);
  `lib/services/api_exception.dart: ApiException` (`semConexao`, `naoAutorizado`, `conflito`, `naoEncontrado`).
  Telas: `home_page.dart`, `evento_detalhe_page.dart`, `evento_form_page.dart`, `fila_page.dart`, `login_page.dart`.
- **Testes:** `api_service_test.dart` grupos "erros HTTP" e "sem conexão": "404 com ProblemDetail usa a mensagem do
  app, não o detail", "400 sem detail usa \"Dados inválidos.\", não o title do servidor", "status fora da tabela sem
  detail usa o title", "timeout vira semConexao com mensagem de servidor acordando", "CertificateException (TLS) vira
  semConexao".

### 21. Por que uma falha não vira lista vazia?

**Falar:** Porque "não há provas nesta semana" e "falhou ao buscar" são coisas diferentes, e confundir as duas é o
pior bug possível para um app de provas. Então o `ApiService` sempre lança em falha, o `HomeService` só devolve o
cache se ele existe, e a Home mostra uma mensagem de erro com "Tentar de novo". Lista vazia só aparece quando o
servidor respondeu 200 com `[]`, e aí o texto é "Nada nos próximos 14 dias."

- **Projeto:** regra §6.9 de `docs/ENTREGA-FLUTTER.md`. Não há `catch` vazio no app. O único `catch` que devolve
  null é `SessaoStore.carregar`, para sessão salva corrompida (`FormatException`), e o efeito é pedir novo login.
- **Código:** `lib/services/home_service.dart: carregar` (`if (salvoEm == null) rethrow;`) e `materias`
  (`if (cache.isEmpty) rethrow;`); `lib/screens/home_page.dart: _corpo` (erro com botão) e `_carregar` (com lista
  já carregada, mantém a lista e mostra a faixa "Não foi possível atualizar: <motivo>").
- **Testes:** `telas_home_test.dart` "falha sem cache mostra Tentar de novo, nunca lista vazia" e "home com lista
  vazia mostra o texto de semana vazia"; `services_test.dart` "sem conexão sem nunca ter carregado lança
  semConexao, nunca lista vazia" e "503 sem nunca ter carregado lança ApiException com status 503, nunca lista vazia".

### 22. E o timeout, o servidor dormindo e uma URL incorreta?

**Falar:** O timeout é de 90 s porque o servidor gratuito do Render dorme e a primeira chamada pode levar cerca de
50 s; a tela de login avisa que a primeira entrada pode levar até 1 minuto. Quando o tempo estoura, a tela mostra
"O servidor demorou para responder — ele pode estar acordando. Tente de novo em instantes.". DNS que não resolve e
falha de TLS aparecem como "Sem conexão com o servidor.". URL com host errado cai aí; caminho errado volta 404. A
URL vem de `--dart-define=API_URL`, não está fixa no código.

- **Apostila:** HTTP §15 lista "URL incorreta" e "sem conexão" como cenários.
- **Código:** `lib/services/api_service.dart: ApiService` (`timeout = Duration(seconds: 90)`) e `_enviar`
  (captura `SocketException`, `http.ClientException`, `TimeoutException` e `TlsException`; `HandshakeException` e
  `CertificateException` são subclasses de `TlsException`); `lib/screens/login_page.dart` (texto "pode levar até 1
  minuto"); `lib/config.dart`.
- **Limitação:** a mensagem de timeout só aparece quando o servidor não responde em 90 s. Um aparelho sem rede
  recebe "Sem conexão com o servidor.", então as duas situações têm textos diferentes. Mesmo assim, o app não
  consegue afirmar com certeza se o problema é o servidor lento ou a internet quando o pedido estoura o tempo. E só
  essas exceções de rede são convertidas: uma `API_URL` malformada a ponto de fazer `Uri.parse` lançar
  `FormatException` escaparia como exceção que não é `ApiException`, e as telas só capturam `ApiException`. Então
  "toda falha sai como ApiException" é o objetivo do contrato, não uma garantia total.

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
  é HTTPS. O app não grava token nem senha em log: as únicas saídas de console são `debugPrint` de erros em
  `home_page.dart`.

### 25. Qual o limite de guardar o JWT em SharedPreferences? Qual a alternativa?

**Falar:** SharedPreferences não é criptografado. O JWT fica em texto no armazenamento do app, protegido só pelo
isolamento do Android. Quem tiver acesso ao arquivo (aparelho com root, malware com privilégio) pode usar o
token como se fosse a pessoa, até ele expirar. O backup do Android está desligado, então o arquivo não sai por
backup. A alternativa é o pacote `flutter_secure_storage`, que guarda cifrado (Keystore no Android, Keychain no
iOS). Não implementei por prazo, e isso está declarado no código e na entrega.

- **Apostila:** HTTP §16, caixa "Atenção": credenciais devem usar "mecanismos apropriados de configuração e
  armazenamento seguro". A apostila não cita o pacote; o nome é conhecimento adicional. Persistência trata o
  SharedPreferences como lugar de "informações simples".
- **Código:** `lib/repositories/sessao_store.dart: SessaoStore.salvar` (comentário `ponytail:` apontando
  `flutter_secure_storage`); `docs/ENTREGA-FLUTTER.md` §9. O pacote não está no `pubspec.yaml`.
- **Projeto:** a troca é pequena: só o jwt iria para o armazenamento seguro, e o tema continuaria no
  SharedPreferences. O que existe hoje: logout apaga a sessão, o padrão é HTTPS, o token expira no servidor, e o
  manifesto Android define `android:allowBackup="false"` e `android:fullBackupContent="false"`
  (`android/app/src/main/AndroidManifest.xml`; o teste `manifest_test.dart` confere isso). O logout não revoga o
  token no servidor, porque não existe endpoint de revogação.

### 26. Como o app percebe que o token expirou?

**Falar:** Ele não lê a data de dentro do JWT. Só descobre quando o servidor responde 401. Na Home, o 401 mostra
"Sessão expirada. Entre de novo." e volta ao login, sem apagar a fila. Nas outras telas aparece a mensagem
"Sessão expirada — volte e entre de novo.". No login, 401 significa credencial errada e a mensagem é outra.

- **Código:** `lib/services/api_service.dart: _erroHttp` (`login && status == 401`);
  `lib/screens/home_page.dart: _carregar`, `_sincronizar`, `_sessaoExpirou` (chama `aoSessaoExpirar`);
  `lib/main.dart: _sessaoExpirou` (limpa a sessão e mantém o banco), `_aoEntrar` (apaga o banco só se a conta mudou)
  e `_aoSair` (apaga tudo, usado pelo "Sair" manual).
- **Testes:** `telas_home_test.dart` "401 na app volta ao login e não apaga a fila" e "entrar com outra conta apaga a
  fila de quem saiu".
- **Limitação:** esses testes passam pelo `FansLabApp` com HTTP simulado. Não cobrem o aparelho real nem o caso de
  fechar e reabrir o app depois do 401.

---

## 7. Testes

### 27. Como você testa HTTP sem internet? (MockClient)

**Falar:** O `ApiService` recebe o `http.Client` pelo construtor. Nos testes passo um `MockClient`, do pacote
`http/testing.dart`: ele recebe o `http.Request` (método, URL, headers, corpo) e devolve um `http.Response` ou
lança uma exceção para simular falha de rede. Assim confiro verbos, URLs, headers e corpo, e simulo 401, 404, 500,
JSON quebrado e queda de rede, sem servidor.

- **Código:** `test/api_service_test.dart` (29 testes). O `ApiService` aceita `client` e `timeout` no construtor;
  `AppDeps.padrao(client:)` repassa o cliente.
- **Prova:** que o cliente cumpre o contrato (Bearer só com token; `If-Match: 3`; PUT em `estado-pessoal` com
  `{"feito":true}`; ordem da lista preservada; lista vazia é sucesso; `ClientException`, `SocketException` e timeout
  viram `semConexao`; corpo `<html>` ou item sem `titulo` viram `respostaInvalida`; mensagens do app no lugar do
  `detail` do servidor).
- **Não prova:** que o servidor real responde assim, nem TLS real, nem comportamento em Android. O contrato com o
  backend Spring local está em `test_e2e/api_real_test.dart` (13 testes), que roda à parte.

### 28. Por que sqflite_common_ffi? O que ele prova?

**Falar:** O `sqflite` normal precisa do plugin nativo do Android ou iOS, que não existe em `flutter test` no
computador. O `sqflite_common_ffi` traz um SQLite real por FFI. Nos testes eu chamo `sqfliteFfiInit()`, troco o
`databaseFactory` e uso `AppDatabase.abrirEmMemoria()`, que dá um banco novo e vazio a cada teste. Os repositórios
recebem uma função `AbrirDb`, então aceitam esse banco por injeção.

- **Código:** `test/repositories_test.dart` (14 testes), `test/services_test.dart` (23), usando
  `lib/database/app_database.dart: abrirEmMemoria` (`singleInstance: false`) e o `typedef AbrirDb`.
- **Prova:** o SQL de verdade: ordem por `posicao`, `LEFT JOIN` do feito, `substituir` em transação, regras de
  pendente e `limparTudo` esvaziando as 4 tabelas.
- **Limitação:** é o SQLite do computador, não o do Android (o código evita UPSERT por causa do "SQLite antigo do
  Android", comentário em `estado_pessoal_repository.dart`). O arquivo real, o caminho `getDatabasesPath()` e
  migração de esquema não são testados.

### 29. O que cada suíte prova, e o que não prova?

**Falar:** São 177 testes em 13 arquivos, todos verdes, e o `flutter analyze` não aponta nada. Eles cobrem as
camadas isoladamente: models, HTTP com cliente simulado, SQLite em memória, serviços de cache e envio, telas,
e um roteiro completo com servidor simulado. Não cobrem o aparelho real nem o servidor real.

| Arquivo | Testes | O que prova | O que não prova |
|---|---|---|---|
| `api_service_test.dart` | 29 | contrato HTTP do cliente, verbos e If-Match, mensagens do app para 401/404/409 etc., sem conexão e timeout, JSON inválido, UTF-8 | servidor real |
| `models_test.dart` | 25 | `fromJson`, `toMap`/`fromMap` de ida e volta, `lerData`, `FormatException`, chaves ausentes | |
| `repositories_test.dart` | 14 | SQL, ordem, transações, regras de pendente, CRUD de rascunhos, `limparTudo` | arquivo real no aparelho, migração |
| `services_test.dart` | 23 | `HomeService` (cache, offline, 401, 503 com cache, feito pendente) e `SyncService` (envio, 400 por item, 401, PUT, 404, concorrência) | envio automático, duplicação por timeout |
| `sessao_store_test.dart` | 7 | sessão, tema e datas; JSON corrompido apaga a chave; `limpar` mantém o tema e o dono da última sessão | criptografia (não existe) |
| `telas_home_test.dart` | 10 | login 401 mostra "E-mail ou senha incorretos."; Home na ordem do servidor; semana vazia; falha sem cache é erro; 401 volta ao login sem apagar a fila; outra conta apaga a fila de quem saiu | o "Sair" manual no aparelho; fechar e reabrir o app |
| `telas_evento_test.dart` | 22 | formulário offline salva rascunho e avisa; título vazio não grava; fila mostra "aguardando envio"; autor vê Editar, não autor não; feito offline pelo detalhe; aviso de excluído e de oculto; dois toques em Salvar mandam um PATCH | 409 na tela; a confirmação de excluir |
| `widgets_test.dart` | 25 | `MateriaChip` (sigla e cor inválida), `EventoCard` (prova sólida, entrega em contorno, distinção em cinza, fonte grande em 360 dp), `tempoRelativo` | |
| `manifest_test.dart` | 4 | permissão de Internet e backup desligado no manifesto release; HTTP em claro só no debug | o APK gerado |
| `localizacao_test.dart` | 1 | seletor de data sai em português, pelo `FansLabApp` | |
| `home_regressoes_test.dart` | 12 | Sair não mostra "sessão expirada" falso; evento enviado aparece sem puxar a lista; um toque em sincronizar = uma tentativa; pré-carga de matérias; troca de conta falha fechado | |
| `mensagem_sync_test.dart` | 4 | envio parcial (1 enviado, depois a rede cai) não diz "nada foi enviado", na Home e na Fila | |
| `fluxo_demo_test.dart` | 1 | o roteiro da apresentação inteiro (online, modo avião, fila, sincronização), com servidor simulado em memória | o servidor real |

- **Como rodar para mostrar:** `export PATH=/opt/flutter-sdk/flutter/bin:$PATH && cd fans_lab && flutter analyze && flutter test`.
- **Nunca foi feito** (diga, se perguntarem): execução em aparelho ou emulador nesta sessão
  (`docs/ENTREGA-FLUTTER.md` §9). Os 13 testes de `test_e2e/` rodam contra o backend Spring local, não contra o
  Render.

---

## 8. Cinco perguntas armadilha

### 30. "Quando a internet volta, o app envia tudo sozinho, certo?"

**Por que enrola:** a tabela da entrega fala em "fila" e "sincronização", e dá vontade de responder "automático".

**Resposta segura:** "Não sozinho, em segundo plano. O app é offline-first para criar evento e marcar feito: nada
se perde sem rede, tudo fica na fila. O envio acontece por ação, e também quando eu abro ou recarrego a Home com
rede: a Home envia a fila sozinha nesse momento. Os outros gatilhos são o ícone de sincronizar, o botão 'Sincronizar
agora' da fila e salvar um evento ou marcar feito. Não há serviço em segundo plano nem escuta de conectividade: se a
rede voltar com o app fechado, nada é enviado até eu abrir o app." Complete: editar, excluir, abrir o detalhe e
entrar precisam de internet.

- **Onde:** `sincronizar()` é chamado em `home_page.dart: _carregar` (quando a Home carrega online com pendentes)
  e `_sincronizar`, `fila_page.dart: _sincronizar`, `evento_form_page.dart: _sincronizar`,
  `evento_detalhe_page.dart: _alternarFeito`. Não há `Timer`, listener de conectividade nem WorkManager em `lib/`.

### 31. "Os testes passam, então o app funciona no celular?"

**Por que enrola:** teste verde passa sensação de "está provado".

**Resposta segura:** "Os testes provam as camadas isoladas: contrato HTTP com cliente simulado, SQL com SQLite
em memória, regras de cache e de fila, e o roteiro da demo com servidor simulado. Não provam o aparelho nem o
servidor real. Há 13 testes contra o backend Spring local, que provam o contrato com o servidor de verdade, mas não
o Render. A demonstração ao vivo é a prova de ponta a ponta." Se você ensaiou no Android, conte o que viu; se não
ensaiou, diga que não. A entrega registra que nenhum APK foi testado em aparelho na sessão de desenvolvimento.

- **Onde:** Pergunta 29; `docs/ENTREGA-FLUTTER.md` §2 (P5) e §9.

### 32. "Aparece 'Sem conexão' só quando está sem internet?"

**Por que enrola:** a resposta natural é "sim", mas o código diz outra coisa.

**Resposta segura:** "Não só. Na Home e nas matérias, o erro 5xx do servidor também cai no cache, com a mesma
faixa 'Sem conexão com o servidor — mostrando o que foi salvo às HH:mm'. A intenção é que servidor fora do ar, como o
Render dormindo ou caindo, não deixe a tela em branco. A frase é imprecisa para o caso 5xx: o aparelho pode ter
internet, quem falhou foi o servidor. No envio da fila a regra é outra: 5xx conta como erro do item, que fica
pendente com a mensagem guardada. Esses casos têm teste: a Home com 503 depois de um carregar online devolve o cache,
e o envio com 503 em tudo não grava a data da sincronização."

- **Onde:** `lib/services/home_service.dart: _semRede` (`e.semConexao || (e.status ?? 0) >= 500`);
  `lib/screens/home_page.dart: _corpo` (texto da faixa); `lib/services/sync_service.dart: _executar` (só
  `semConexao` interrompe o loop).

### 33. "Se o token expirar e eu tiver evento ainda não enviado, o que acontece?"

**Por que enrola:** o aluno pensa na mensagem "Sessão expirada" e acha que a fila foi junto.

**Resposta segura:** "A fila é preservada. Na Home, o 401 leva ao login com a mensagem 'Sessão expirada. Entre de
novo.', mas não apaga rascunhos nem marcações pendentes. Se a mesma conta entrar de novo, a fila é enviada
normalmente. Se outra conta entrar, os dados locais da conta anterior são apagados antes, para não enviar evento com
a autoria errada. Só o 'Sair' manual das configurações apaga a fila de propósito, e ele pede confirmação. O token vale
30 dias no servidor. Se ele expirar com a fila cheia, o que está no aparelho espera o novo login."

- **Testes:** `telas_home_test.dart` "401 na app volta ao login e não apaga a fila" e "entrar com outra conta apaga a
  fila de quem saiu". Esses testes passam pelo `FansLabApp`, mas não cobrem fechar e reabrir o app.
- **Onde:** `lib/main.dart: _sessaoExpirou` (limpa a sessão, mantém o banco), `_aoEntrar` (apaga o banco se o dono
  mudou) e `_aoSair` (apaga tudo); `lib/screens/home_page.dart: _sessaoExpirou` (chama `aoSessaoExpirar`);
  confirmação só em `lib/screens/configuracoes_page.dart: _confirmarSair`.

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

- "Sincroniza sozinho quando a rede volta." (Pergunta 30: só sincroniza quando a Home carrega com rede ou quando você age)
- "Nunca duplica." (Pergunta 17)
- "O token está seguro no aparelho." (Pergunta 25)
- "Os testes provam que funciona no celular." (Pergunta 31)
- "Offline funciona em tudo." (Pergunta 15: são criar, marcar feito e reler a Home)
- "O 401 apaga a fila." (Pergunta 33: não apaga; só o "Sair" manual apaga)
