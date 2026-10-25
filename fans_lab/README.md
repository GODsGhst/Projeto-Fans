# fans_lab

App Flutter do projetoFans, para **Android e navegador**. Consome a API da turma (backend Spring em `../backend`, Postgres) e cobre as duas apostilas da disciplina Aplicações Móveis e Distribuídas: **Protocolo HTTP** e **Persistência local com sincronização**.

## Requisitos da Etapa 2 → onde estão

| Requisito do enunciado | Como o app atende | Onde |
|---|---|---|
| Multiplataforma: Android e navegador | o mesmo código roda nos dois; testado em emulador Android 15 e no Chrome | `android/`, `web/`, `web_dev_config.yaml` |
| Comunicação HTTP com serviço/API | GET, POST, PUT, PATCH e DELETE na API REST | `lib/services/api_service.dart` |
| Acesso real a banco de dados | a API grava e lê no PostgreSQL do servidor; nada é fictício nem fica só em memória | `../backend` |
| Consulta | Home e detalhe vêm do banco por GET | `ApiService.home`, `ApiService.evento` |
| Cadastro | criar conta (POST `/auth/registrar`), entrar na turma pelo código (POST `/turmas/entrar`) e cadastrar prova ou entrega (POST `/eventos`), que aparece para a turma com autor e hora | `cadastro_page.dart`, `entrar_turma_page.dart`, `evento_form_page.dart` |
| Persistência após fechar e abrir | sessão e tema em SharedPreferences; cache, rascunhos e "feito" em SQLite (no navegador, o mesmo SQLite em WebAssembly, gravando no IndexedDB) | `lib/repositories/`, `lib/database/app_database.dart` |
| Atualização da interface | a Home recarrega ao voltar de qualquer tela e depois de salvar, editar, excluir ou sincronizar | `lib/screens/home_page.dart` |
| Validação | e-mail com formato válido; senha de 8 a 100 caracteres, repetida igual; nome e código obrigatórios; matéria e título obrigatórios, título até 120 e sala até 40 caracteres; data de hoje em diante. O envio fica bloqueado até corrigir | `cadastro_page.dart`, `login_page.dart`, `evento_form_page.dart` |
| Tratamento de erros | sem conexão, servidor fora do ar, 401, 404, 409, 5xx e JSON inesperado viram mensagem na tela; falha nunca aparece como lista vazia | `ApiService._enviar`, `_erroHttp`, `HomeService.carregar` |
| Organização | Model, Database, Repository, Service e Screen em pastas separadas | ver "Estrutura" |

## O que cobre

- **HTTP** (`lib/services/api_service.dart`): GET (`home`, `materias`, `evento`), POST (`criarEvento`, espera 201), PUT (`marcarFeito`, em `/eventos/{id}/estado-pessoal`, espera 204), PATCH (`atualizarEvento`) e DELETE (`excluirEvento`). Edição e exclusão enviam `If-Match` com a versão do evento.
- **JSON e Model** (`lib/models/`): `fromJson`/`toJson` para a API; `toMap`/`fromMap` para o SQLite.
- **SQLite** (`lib/database/app_database.dart`, `lib/repositories/`): cache da Home, matérias, rascunhos (CRUD local) e estado pessoal ("feito").
- **SharedPreferences** (`lib/repositories/sessao_store.dart`): sessão, tema escuro, datas de sincronização e o dono da última sessão.
- **Offline e sincronização** (`lib/services/home_service.dart`, `lib/services/sync_service.dart`): sem rede, a Home vem do cache. Criar evento e marcar feito (inclusive pelo detalhe, sem rede) vão para uma fila e são enviados depois. A Home envia a fila sozinha quando carrega com rede. Não há serviço em segundo plano.
- **Navegador**: o SQLite roda em WebAssembly (`sqflite_common_ffi_web`; `web/sqlite3.wasm` e `web/sqflite_sw.js` vêm de `dart run sqflite_common_ffi_web:setup`). A API só aceita chamadas de navegador vindas de `http://localhost:8100` (CORS), por isso o `web_dev_config.yaml` fixa essa porta no `flutter run`.

Fora do escopo: edição e exclusão offline, cache do detalhe de evento, armazenamento seguro do token (ver "Limites conhecidos").

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
flutter test                                                   # 195 testes, no PC, sem aparelho e sem backend
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
  services/        ApiService (HTTP), ApiException, HomeService (API ou cache), SyncService (fila)
  screens/         login, criar conta, entrar na turma, Home, detalhe, formulário, fila de envio, configurações
  widgets/         MateriaChip, EventoCard, tema (CoresFans), tempo_relativo
test/              195 testes: HTTP (MockClient), modelos, SQLite (ffi), serviços, telas, widgets, localização
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
- **Zerar dados.** Configurações → Sair (pede confirmação; apaga rascunhos e marcações não enviados e mantém o tema) ou desinstalar o app (apaga tudo).

## Limites conhecidos

- O token (JWT) fica em SharedPreferences, em texto puro. O caminho seguro é `flutter_secure_storage`; não foi feito.
- Logout não revoga o JWT no servidor: não existe endpoint de revogação. O token vale até expirar (720 h). O app limpa tudo localmente.
- Editar e excluir evento exigem internet: PATCH e DELETE não entram na fila.
- Abrir o detalhe de um evento sem rede mostra "Sem conexão com o servidor.": não há cache de detalhe. Mesmo assim, o botão "Marcar como feito" aparece e grava no aparelho.
- Sem serviço em segundo plano. A fila é enviada ao carregar a Home com rede, pelo ícone de sincronizar, pelo botão "Sincronizar agora" da tela Fila de envio, e ao salvar ou marcar feito. Se a rede voltar com o app fechado, nada é enviado até o app ser aberto.
- Se a resposta de um POST se perder por timeout, o rascunho continua pendente e o próximo envio cria outro evento. Não há chave de idempotência (comentário `ponytail` em `lib/services/sync_service.dart`).
- Não há tela para criar material. A seção "Materiais vinculados" só mostra o que já existe no servidor.
- O APK de release é assinado com a chave debug (TODO do template Flutter). Serve para entregar, não para loja.
- HTTP em claro só no build de debug. Apontar o debug para um IP da rede local manda senha e token sem criptografia. Para o emulador (`10.0.2.2`) é loopback.
