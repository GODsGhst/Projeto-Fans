# fans_lab

App Flutter do projetoFans. Consome a API da turma (backend Spring em `../backend`) e cobre as duas apostilas da disciplina Aplicações Móveis e Distribuídas: **Protocolo HTTP** e **Persistência local com sincronização**.

## O que cobre

- **HTTP** (`lib/services/api_service.dart`): GET (`home`, `materias`, `evento`), POST (`criarEvento`, espera 201), PUT (`marcarFeito`, em `/eventos/{id}/estado-pessoal`, espera 204), PATCH (`atualizarEvento`) e DELETE (`excluirEvento`). Edição e exclusão enviam `If-Match` com a versão do evento.
- **JSON e Model** (`lib/models/`): `fromJson`/`toJson` para a API; `toMap`/`fromMap` para o SQLite.
- **SQLite** (`lib/database/app_database.dart`, `lib/repositories/`): cache da Home, matérias, rascunhos (CRUD local) e estado pessoal ("feito").
- **SharedPreferences** (`lib/repositories/sessao_store.dart`): sessão, tema escuro e datas de sincronização.
- **Offline e sincronização** (`lib/services/home_service.dart`, `lib/services/sync_service.dart`): sem rede, a Home vem do cache; criar evento e marcar feito vão para uma fila e são enviados depois.

Fora do escopo: edição e exclusão offline, cache do detalhe de evento, armazenamento seguro do token (ver "Limites conhecidos").

## Pré-requisitos

- Flutter **3.47.7** e Dart **3.13.5** (confira com `flutter --version`).
- Android SDK e um emulador ou aparelho com depuração USB. O projeto tem só a plataforma Android.

## Como rodar

```bash
flutter pub get
flutter run                                                    # API de produção
flutter run --dart-define=API_URL=http://10.0.2.2:8080/api/v1  # API local (backend na porta 8080 do PC)
flutter test                                                   # 97 testes, no PC, sem aparelho
flutter build apk --release                                    # APK em build/app/outputs/flutter-apk/app-release.apk
```

- `10.0.2.2` é o `localhost` do PC visto pelo emulador Android.
- A URL padrão fica em `lib/config.dart`.
- Nenhum APK vem pronto no repositório. O comando acima gera o arquivo no caminho indicado; esse build não foi testado em aparelho.

## Estrutura

```
lib/
  main.dart        inicialização, tema claro/escuro, rota inicial (login ou Home)
  config.dart      API_URL (--dart-define)
  app_deps.dart    monta as dependências (AppDeps.padrao)
  models/          dados puros: fromJson/toJson, toMap/fromMap; sem Flutter
  database/        AppDatabase: SQLite (sqflite), esquema versão 1
  repositories/    CRUD local (cache, matérias, rascunhos, estado pessoal) e SessaoStore
  services/        ApiService (HTTP), ApiException, HomeService (API ou cache), SyncService (fila)
  screens/         login, Home, detalhe, formulário, fila de envio, configurações
  widgets/         MateriaChip, EventoCard, tema (CoresFans), tempo_relativo
test/              97 testes: HTTP (MockClient), modelos, SQLite (ffi), serviços, telas, widgets
```

## Problemas comuns

- **A 1ª chamada leva cerca de 50 s.** O Render gratuito dorme. Acorde a API antes: `curl https://projetofans-api.onrender.com/api/v1/saude` (ou abra a URL no navegador). Deve responder `{"status":"ok",...}`. Um 502 nessa hora também é o serviço acordando: repita.
- **APK de release sem rede.** A permissão `INTERNET` está em `android/app/src/main/AndroidManifest.xml`. Não a remova.
- **"Sem conexão com o servidor." com API local em `http://`.** Não testado em aparelho. Android 9 em diante bloqueia HTTP sem TLS por padrão, e o projeto não libera isso. Para apresentar, use a API de produção.
- **"E-mail ou senha incorretos."** Senha errada no login (401).
- **401 em outras telas = sessão expirada.** O app sai sozinho. Essa saída também apaga o cache e os rascunhos e marcações ainda não enviados, sem a confirmação do botão Sair. Sincronize antes de a sessão expirar.
- **Zerar dados.** Configurações → Sair (pede confirmação; apaga rascunhos e marcações não enviados e mantém o tema) ou desinstalar o app (apaga tudo).

## Limites conhecidos

- O token (JWT) fica em SharedPreferences, em texto puro. O caminho seguro é `flutter_secure_storage`; não foi feito.
- Editar e excluir evento exigem internet: PATCH e DELETE não entram na fila.
- Abrir o detalhe de um evento sem rede mostra "Sem conexão com o servidor.": não há cache de detalhe.
- Se a resposta de um POST se perder por timeout, o rascunho continua pendente e pode ser enviado de novo (comentário `ponytail` em `lib/services/sync_service.dart`). Não há chave de idempotência.
- Não há tela para criar material. A seção "Materiais vinculados" só mostra o que já existe no servidor.
