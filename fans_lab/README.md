# fans_lab

App Flutter do projetoFans, para **Android e navegador**. Consome a API da turma (backend Spring em `../backend`, Postgres) e cobre as quatro apostilas da disciplina Aplicações Móveis e Distribuídas: **Protocolo HTTP**, **Persistência local com sincronização**, **Autenticação, autorização e tokens** e **Upload de arquivos e notificações** (as duas últimas: ver "Apostilas de tokens e de upload").

## Requisitos da Etapa 2 → onde estão

| Requisito do enunciado | Como o app atende | Onde |
|---|---|---|
| Multiplataforma: Android e navegador | o mesmo código roda nos dois; testado em emulador Android 15 e no Chrome | `android/`, `web/`, `web_dev_config.yaml` |
| Comunicação HTTP com serviço/API | GET, POST, PUT, PATCH e DELETE na API REST | `lib/services/api_service.dart` |
| Acesso real a banco de dados | a API grava e lê no PostgreSQL do servidor; nada é fictício nem fica só em memória | `../backend` |
| Consulta | Home e detalhe vêm do banco por GET | `ApiService.home`, `ApiService.evento` |
| Cadastro | criar conta (POST `/auth/registrar`), entrar na turma pelo código (POST `/turmas/entrar`) e cadastrar prova ou entrega (POST `/eventos`), que aparece para a turma com autor e hora | `cadastro_page.dart`, `entrar_turma_page.dart`, `evento_form_page.dart` |
| Persistência após fechar e abrir | sessão (com o token) no `flutter_secure_storage`, tema em SharedPreferences; cache, rascunhos e "feito" em SQLite (no navegador, o mesmo SQLite em WebAssembly, gravando no IndexedDB) | `lib/repositories/`, `lib/database/app_database.dart` |
| Atualização da interface | a Home recarrega ao voltar de qualquer tela e depois de salvar, editar, excluir ou sincronizar | `lib/screens/home_page.dart` |
| Validação | e-mail com formato válido; senha de 8 a 100 caracteres, repetida igual; nome e código obrigatórios; matéria e título obrigatórios, título até 120 e sala até 40 caracteres; data de hoje em diante. O envio fica bloqueado até corrigir | `cadastro_page.dart`, `login_page.dart`, `evento_form_page.dart` |
| Tratamento de erros | sem conexão, servidor fora do ar, 401, 404, 409, 5xx e JSON inesperado viram mensagem na tela; falha nunca aparece como lista vazia | `ApiService._enviar`, `_erroHttp`, `HomeService.carregar` |
| Organização | Model, Database, Repository, Service e Screen em pastas separadas | ver "Estrutura" |

## Apostilas de tokens e de upload → onde estão

**Autenticação, autorização e tokens** (atividade prática da apostila):

| Pedido da apostila | Como o app atende | Onde |
|---|---|---|
| Tela de login com e-mail e senha | formato do e-mail e senha obrigatória conferidos antes de enviar | `screens/login_page.dart` |
| Enviar as credenciais e obter o token | POST `/auth/login`; a resposta traz o JWT e o usuário | `ApiService.login`, `models/sessao.dart` |
| Guardar o token de forma adequada à plataforma | cofre do sistema com `flutter_secure_storage`: Keystore no Android; no navegador, cifrado com WebCrypto (a chave fica no próprio `localStorage`, ver "Limites conhecidos"). Se o cofre não abrir, o app pede login de novo em vez de travar. A sessão antiga, de quando ficava no SharedPreferences, migra na primeira leitura e sai de lá | `repositories/sessao_store.dart` |
| Mandar `Authorization: Bearer <token>` | em toda chamada autenticada, inclusive no upload | `ApiService._enviar`, `UploadService.enviar` |
| Tratar 200, 401 e 403 | 401: "Sessão expirada. Entre de novo." e volta ao login; 403: "Você não tem permissão para isso." Membro de outra turma recebe 404, que não confirma que o registro existe | `ApiService._erroHttp`, `main.dart` (`_sessaoExpirou`) |
| Logout que impede voltar às telas protegidas | Configurações → Sair apaga a sessão do cofre, fecha todas as telas e abre o login; o "voltar" não reabre nada | `screens/configuracoes_page.dart`, `main.dart` (`_aoSair`) |
| Usuários com permissões diferentes | só o autor edita ou exclui o próprio evento: o servidor devolve 403 para os outros, e o app nem mostra os botões ("Só Ana edita ou apaga este registro.") | `../backend` (`EventoService`), `screens/evento_detalhe_page.dart` |

**Upload de arquivos e notificações** (atividade "Central de documentos", aplicada a provas e entregas):

| Pedido da apostila | Como o app atende | Onde |
|---|---|---|
| Tela com "Selecionar documento" e "Enviar" | detalhe do evento → **Anexar arquivo** | `screens/enviar_arquivo_page.dart` |
| Só PDF, PNG ou JPG | seletor do sistema filtrado (`file_picker`) e conferência de extensão e tamanho (até 5 MB) no aparelho | `UploadService.validar` |
| Nome e tamanho visíveis; não envia sem arquivo | nome e tamanho aparecem ao escolher; Enviar fica desabilitado sem arquivo válido | `enviar_arquivo_page.dart` |
| `multipart/form-data` conforme o contrato | Dio com `FormData`: campo `arquivo` + campo opcional `descricao`; POST `/eventos/{id}/arquivos`, que responde 201 com o material criado | `services/upload_service.dart` |
| Progresso durante o envio | `LinearProgressIndicator` alimentado pelo `onSendProgress` do Dio (indeterminado se o total não vier) | `enviar_arquivo_page.dart` |
| Cancelamento, sucesso e falha | cancelar o seletor não é erro ("Seleção cancelada.") e mantém a escolha anterior; 401, 403, 404, 413, 415, 5xx, timeout e sem conexão viram mensagem própria | `UploadService._traduzir` |
| Notificação local ao concluir | `flutter_local_notifications` no Android e no navegador; a permissão é pedida no primeiro envio, não ao abrir o app. Também há aviso dentro do app | `services/notificacao_service.dart`, `evento_detalhe_page.dart` |
| Servidor valida e armazena | extensão **e** primeiros bytes do arquivo (um `.exe` renomeado para `.pdf` volta 415), teto de 5 MB, escopo da turma; o arquivo fica no Postgres e vira material com autor e hora, já vinculado ao evento | `../backend` (`ArquivoService`, `V11__arquivo_enviado.sql`) |

Push com Firebase (FCM) fica de fora: exigiria projeto no Firebase e registrar o token do aparelho no backend. O backend já tem a interface `Notifier` (com `FcmNotifier`) por onde esse aviso sairia.

## O que cobre

- **HTTP** (`lib/services/api_service.dart`): GET (`home`, `materias`, `evento`), POST (`criarEvento`, espera 201), PUT (`marcarFeito`, em `/eventos/{id}/estado-pessoal`, espera 204), PATCH (`atualizarEvento`) e DELETE (`excluirEvento`). Edição e exclusão enviam `If-Match` com a versão do evento.
- **JSON e Model** (`lib/models/`): `fromJson`/`toJson` para a API; `toMap`/`fromMap` para o SQLite.
- **SQLite** (`lib/database/app_database.dart`, `lib/repositories/`): cache da Home, matérias, rascunhos (CRUD local) e estado pessoal ("feito").
- **SharedPreferences** (`lib/repositories/sessao_store.dart`): tema escuro, datas de sincronização e o dono da última sessão. A sessão em si fica no cofre (próximo item).
- **Offline e sincronização** (`lib/services/home_service.dart`, `lib/services/sync_service.dart`): sem rede, a Home vem do cache. Criar evento e marcar feito (inclusive pelo detalhe, sem rede) vão para uma fila e são enviados depois. A Home envia a fila sozinha quando carrega com rede. Não há serviço em segundo plano.
- **Autenticação** (`lib/repositories/sessao_store.dart`): o JWT fica no cofre do sistema (`flutter_secure_storage`); tema e datas continuam em SharedPreferences, porque não são segredo.
- **Upload** (`lib/services/upload_service.dart`, `lib/screens/enviar_arquivo_page.dart`): `file_picker` escolhe, Dio envia em `multipart/form-data` com progresso. O arquivo vira material do evento, com o nome de quem enviou.
- **Notificação local** (`lib/services/notificacao_service.dart`): aviso "Arquivo enviado" no Android (canal `envios`) e no navegador (service worker do plugin).
- **Navegador**: o SQLite roda em WebAssembly (`sqflite_common_ffi_web`; `web/sqlite3.wasm` e `web/sqflite_sw.js` vêm de `dart run sqflite_common_ffi_web:setup`). A API só aceita chamadas de navegador vindas de `http://localhost:8100` (CORS), por isso o `web_dev_config.yaml` fixa essa porta no `flutter run`.

Fora do escopo: edição e exclusão offline, cache do detalhe de evento, push remoto (FCM) (ver "Limites conhecidos").

## Primeiro acesso

Na tela de login, **Não tem conta? Criar conta** → nome, e-mail e senha → código de convite da turma. Depois disso o app abre direto na Home, também ao fechar e abrir de novo. O código de convite é de quem criou a turma; no backend local, a turma de exemplo é `TURMA01`.

## Pré-requisitos

- Flutter **3.47.7** e Dart **3.13.5** (confira com `flutter --version`).
- Android: Android SDK e um emulador ou aparelho com depuração USB.
- Navegador: Google Chrome (ou Edge).

## Como rodar

```bash
flutter pub get
flutter run -d chrome                                          # navegador, API de produção (sobe em http://localhost:8100)
flutter run                                                    # Android, API de produção
flutter run --dart-define=API_URL=http://10.0.2.2:8080/api/v1  # Android, API local (backend na porta 8080 do PC)
flutter run -d chrome --dart-define=API_URL=http://localhost:8080/api/v1  # navegador, API local
flutter test                                                   # 213 testes, no PC, sem aparelho e sem backend
flutter build apk --release                                    # APK em build/app/outputs/flutter-apk/app-release.apk
flutter build web                                              # site em build/web (sirva em http://localhost:8100)
```

- `10.0.2.2` é o `localhost` do PC visto pelo emulador Android.
- A URL padrão fica em `lib/config.dart`.
- Nenhum APK vem pronto no repositório. O comando acima gera o arquivo no caminho indicado.
- Verificado em 24/10/2026, no emulador Android 15 (API 35) e no Chrome, contra o backend local: login, consulta, cadastro com validação, fechar e reabrir, sem conexão (modo avião no Android, servidor desligado no navegador), cadastro offline e sincronização. O APK de release abre no emulador.

## Rodar contra o backend local

O backend Spring fica em `../backend`. Com o perfil `dev`, ele sobe com Postgres embutido e cria os usuários de exemplo (`SeedDev`).

```bash
cd backend
sh ./mvnw -DskipTests spring-boot:run -Dspring-boot.run.profiles=dev
```

- `sh` é necessário porque `mvnw` está sem permissão de execução no repositório.
- Porta 8080. Para conferir: `curl http://localhost:8080/api/v1/saude` deve responder `{"status":"ok",...}`.
- Usuários de exemplo: `ana@exemplo.dev` e `otavio@exemplo.dev`, senha `senha123`, turma `TURMA01` (código de convite).

Depois, no emulador Android (o `10.0.2.2` é o `localhost` do PC):

```bash
cd fans_lab
flutter run --dart-define=API_URL=http://10.0.2.2:8080/api/v1
```

- HTTP sem TLS só é liberado no build de debug (`android/app/src/debug/AndroidManifest.xml`). Por isso o `flutter run` (debug) alcança o backend local e o build de release não.
- No navegador: `flutter run -d chrome --dart-define=API_URL=http://localhost:8080/api/v1`. O backend local aceita a mesma origem `http://localhost:8100`.

## Teste contra o backend real

`test_e2e/api_real_test.dart` tem 13 testes que chamam o backend de verdade. Eles conferem o que o `ApiService` entende contra o HTTP cru do servidor. Ficam fora de `test/`, então o `flutter test` padrão não depende de servidor.

Com o backend local no ar:

```bash
cd fans_lab
API_URL=http://localhost:8080/api/v1 E2E_EMAIL=ana@exemplo.dev E2E_SENHA=senha123 \
  flutter test test_e2e/api_real_test.dart
```

- Os testes criam eventos de teste na turma do usuário informado e os apagam no fim. Rode contra o backend local, não contra a turma real.
- `E2E_EMAIL_2` e `E2E_SENHA_2` (opcionais) são de outro membro da mesma turma. Com eles, os testes de autoria alheia são ligados.
- Última execução registrada no repositório: 13/13 contra o Spring local (commit `ee537ba`).

## Estrutura

```
lib/
  main.dart        inicialização, tema claro/escuro, rota inicial (login ou Home)
  config.dart      API_URL (--dart-define)
  app_deps.dart    monta as dependências (AppDeps.padrao)
  models/          dados puros: fromJson/toJson, toMap/fromMap; sem Flutter
  database/        AppDatabase: SQLite (sqflite; no navegador, sqflite_common_ffi_web), esquema versão 1
  repositories/    CRUD local (cache, matérias, rascunhos, estado pessoal) e SessaoStore
  services/        ApiService (HTTP), ApiException, HomeService (API ou cache), SyncService (fila),
                   UploadService (multipart com Dio), NotificacaoService (notificação local)
  screens/         login, criar conta, entrar na turma, Home, detalhe, formulário, anexar arquivo, fila de envio, configurações
  widgets/         MateriaChip, EventoCard, tema (CoresFans), tempo_relativo
test/              213 testes: HTTP (MockClient), upload (Dio e seletor falsos), cofre, modelos, SQLite (ffi), serviços, telas, widgets, localização
test_e2e/          13 testes contra o backend real (ver "Teste contra o backend real")
```

## Problemas comuns

- **A 1ª chamada leva cerca de 50 s.** O Render gratuito dorme. Acorde a API antes: `curl https://projetofans-api.onrender.com/api/v1/saude` (ou abra a URL no navegador). Deve responder `{"status":"ok",...}`. Um 502 nessa hora também é o serviço acordando: repita.
- **Timeout de 90 s.** Se o servidor não responder nesse tempo, aparece "O servidor demorou para responder — ele pode estar acordando. Tente de novo em instantes."
- **APK de release sem rede.** A permissão `INTERNET` está em `android/app/src/main/AndroidManifest.xml`. Não a remova.
- **"Sem conexão com o servidor." com API local em `http://`.** Use o build de debug (`flutter run`) com `--dart-define=API_URL=http://10.0.2.2:8080/api/v1`. O release é só HTTPS e não alcança o backend local. Para apresentar, use a API de produção.
- **No navegador, "Sem conexão com o servidor." logo no login.** O app subiu numa porta diferente de 8100 e a API recusou a origem (CORS). Rode com `flutter run -d chrome` dentro de `fans_lab/` (lê `web_dev_config.yaml`) ou passe `--web-port 8100`.
- **"E-mail ou senha incorretos."** Senha errada no login (401).
- **"Endereço do servidor inválido. Confira o API_URL."** O `--dart-define=API_URL` está sem `https://` (ou com esquema errado). Nada é enviado.
- **401 em outras telas (sessão expirada).** O app volta ao login com a mensagem "Sessão expirada. Entre de novo.". Rascunhos e marcações não enviados continuam no aparelho: entre de novo com a mesma conta e eles são enviados. Entrar com outra conta apaga os dados locais da conta anterior, para não enviar evento com a autoria errada.
- **Build Android falha em `:android_file_picker:compileDebugKotlin` com "different roots".** No Windows, o projeto e o `PUB_CACHE` estão em drives diferentes (ex.: projeto em `C:`, pub cache em `D:`), e o cache do Kotlin não aceita. Gere o APK de uma cópia no mesmo drive do `PUB_CACHE` (`git worktree add D:\...`) ou use o `PUB_CACHE` padrão.
- **A notificação de envio não aparece.** A permissão foi negada. No Android: Configurações → Apps → Fans Lab → Notificações. No navegador: o cadeado na barra de endereço → Notificações → Permitir. O envio não depende disso.
- **Zerar dados.** Configurações → Sair (pede confirmação; apaga rascunhos e marcações não enviados e mantém o tema) ou desinstalar o app (apaga tudo).

## Limites conhecidos

- Logout não revoga o JWT no servidor: não existe endpoint de revogação. O token vale até expirar (720 h). O app limpa tudo localmente.
- Editar e excluir evento exigem internet: PATCH e DELETE não entram na fila.
- Abrir o detalhe de um evento sem rede mostra "Sem conexão com o servidor.": não há cache de detalhe. Mesmo assim, o botão "Marcar como feito" aparece e grava no aparelho.
- Sem serviço em segundo plano. A fila é enviada ao carregar a Home com rede, pelo ícone de sincronizar, pelo botão "Sincronizar agora" da tela Fila de envio, e ao salvar ou marcar feito. Se a rede voltar com o app fechado, nada é enviado até o app ser aberto.
- Se a resposta de um POST se perder por timeout, o rascunho continua pendente e o próximo envio cria outro evento. Não há chave de idempotência (comentário `ponytail` em `lib/services/sync_service.dart`).
- No navegador o token fica cifrado, mas a chave do WebCrypto mora no mesmo `localStorage`: protege de quem olha o armazenamento por cima, não de um script na mesma origem nem de quem abre as ferramentas do navegador. No Android a chave fica no Keystore.
- O site Ionic (`app/`) ainda trata material de arquivo como link: mostra a linha com o rótulo "LINK", não abre o arquivo e não oferece editar. O líder continua podendo ocultar pelo site.
- Nem o fans_lab nem o site oferecem apagar material de arquivo pela tela; pela API, `DELETE /materiais/{id}` vale para o autor, como em qualquer material.
- Cada turma tem até 100 MB de arquivos e o servidor inteiro até 300 MB (o banco gratuito tem 0,5 GB para tudo); acima disso o envio volta 507, "Acabou o espaço para arquivos da turma".
- Pelo app só se cria material de **arquivo** (Anexar arquivo). Material por link continua só pelo servidor ou pelo app Ionic.
- O arquivo enviado aparece na lista do evento, mas o fans_lab não o abre. A API entrega o arquivo em `GET /arquivos/{id}`, com token e só para quem é da turma, então um link direto no navegador não funciona.
- O arquivo fica no próprio Postgres (até 5 MB cada). Serve para a turma; volume grande pede um bucket (comentário `ponytail` na `V11`).
- A notificação depende da permissão. Negada, o envio funciona igual e o aviso aparece só dentro do app. No navegador, clicar na notificação não faz nada com o app aberto (o service worker do plugin não traz a aba para a frente).
- O APK de release é assinado com a chave debug (TODO do template Flutter). Serve para entregar, não para loja.
- HTTP em claro só no build de debug. Apontar o debug para um IP da rede local manda senha e token sem criptografia. Para o emulador (`10.0.2.2`) é loopback.
