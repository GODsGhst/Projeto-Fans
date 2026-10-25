# Roteiro de apresentação — fans_lab (7 min)

Para a banca de Aplicações Móveis e Distribuídas. Cada passo diz o que tocar, o que a banca vê, qual critério aquilo prova e onde está o código (`arquivo` + classe/método), para mostrar se pedirem.

Textos entre aspas são os da tela, conferidos com grep no código. Teste no aparelho que você vai usar, com a mesma versão que vai apresentar (`flutter run` ou APK).

---

## Antes da banca (preparação, 10 min antes)

1. **Acorde a API.** `curl https://projetofans-api.onrender.com/api/v1/saude` (ou abra a URL no navegador). Deve responder `{"status":"ok",...}`. Se der 502 ou demorar, repita até responder. Ela volta a dormir se ficar parada, então acorde perto da hora, não horas antes.
2. **Entre uma vez** no app com sua conta, com rede. A Home precisa carregar uma vez com rede: isso grava o cache da Home e as matérias. Sem isso, a Home não mostra nada sem rede e o formulário não abre. Conta sem turma abre a tela **Entrar na turma**: digite o código de convite da turma.
3. **Confira a Home.** Precisa ter:
   - uma **prova** e uma **entrega** nos próximos 14 dias (para a comparação visual aparecer);
   - um **evento da turma com material vinculado** (chamado **S** aqui). O app não tem tela para criar material: se S não tiver material no servidor, a seção mostra "Nenhum material vinculado.". Diga isso se perguntarem;
   - um **evento seu** com data nos próximos 14 dias, título **"Teste B — apresentação"** (prova ou entrega). Só o autor vê Editar e Excluir, por isso ele precisa ser seu.
4. **Não precisa abrir o formulário com rede antes.** A Home já pré-carrega as matérias quando carrega online (passo 2). Com isso, o formulário abre e cria evento sem rede, até numa instalação nova.
5. **Esvazie a fila.** Configurações → Fila de envio → **Sincronizar agora**, se houver algo pendente. Ao carregar a Home com rede, ela também envia sozinha o que estiver pendente.
6. **Modo avião desligado.** Tema claro. Terminal aberto em `fans_lab/`, com o `flutter` no PATH (para o plano B).
7. Os eventos de teste vão para a turma real. Use os títulos indicados e apague tudo no passo 8.
8. **Saia da conta por último:** ⚙ Configurações → **Sair** → **Sair**. Com a sessão salva o app abre direto na Home, e o passo 1 precisa da tela de login. Sair apaga o cache do aparelho; o passo 2 grava de novo.

---

## Roteiro

| Min | Passo | O que prova |
|---|---|---|
| 0:00 | 1. Login | POST; erro 401 tratado na tela |
| 0:50 | 2. Home | GET com ordem do servidor; prova × entrega; autoria |
| 1:40 | 3. Criar evento online | POST (201) |
| 2:30 | 4. Detalhe: marcar feito, editar, excluir | GET por id; PUT; PATCH com If-Match; DELETE com If-Match |
| 3:50 | 5. Tema escuro e reinício | SharedPreferences; dados após fechar o app |
| 4:20 | 6. Modo avião | cache da Home; SQLite; criação e feito offline (também pelo detalhe); fila; CRUD local |
| 5:50 | 7. Religar e sincronizar | fila → API; estado de envio |
| 6:30 | 8. Erros e limpeza | mensagens de erro; vazio × falha |

Observação de ordem: **editar e excluir só funcionam com rede.** O detalhe não tem cache: abrir um evento sem rede mostra "Sem conexão com o servidor.", mas o botão **Marcar como feito** continua ali e grava no aparelho. Para a edição offline do passo 6.1, abra o Teste B com rede antes de ligar o modo avião, porque o botão Editar só aparece com o detalhe carregado.

### Passo 1 — Login (0:00 a 0:50)

- **Toque:** digite seu e-mail e uma senha errada, toque em **Entrar**. Depois corrija a senha e toque em **Entrar** de novo.
- **A banca vê:** o botão mostra um spinner. Com a senha errada, aparece em vermelho, sob o botão, **"E-mail ou senha incorretos."**. Com a senha certa, abre a Home. Sob o botão há o aviso "A primeira entrada pode levar até 1 minuto: o servidor gratuito precisa acordar.".
- **Critério:** POST `/auth/login` (Operações REST). Erro 401 vira mensagem pronta para a tela, sem exceção crua (Tratamento de erros).
- **Código:**
  - `lib/screens/login_page.dart`: `_LoginPageState._entrar`
  - `lib/services/api_service.dart`: `ApiService.login`, `_erroHttp` (ramo `login && status == 401`)
  - `lib/models/sessao.dart`: `Sessao.fromJson`
  - `lib/repositories/sessao_store.dart`: `SessaoStore.salvar`
- **Fala:** "A senha só existe nesta tela. Ela nunca é salva."

### Passo 2 — Home (0:50 a 1:40)

- **Toque:** nada. Mostre a lista. Puxe para baixo para atualizar.
- **A banca vê:** no título, a data de hoje por extenso. Em "o que vem aí", os cartões em ordem de data. Prova é bloco sólido; entrega é contorno fino. Cada cartão tem a sigla da matéria com a cor, o dia, o título e "Nome · há X". Semana vazia mostra só "Nada nos próximos 14 dias.".
- **Critérios:**
  - GET `/home` com status 200 (Comunicação HTTP, Operações REST);
  - ordem, teto de 6 e janela de 14 dias vêm prontos do servidor (regras 2 e 5);
  - autoria em todo cartão (regra 1);
  - prova × entrega pelo peso de tinta, não pela cor (regra 4);
  - cor e sigla sempre juntas (regra 5).
- **Código:**
  - `lib/services/api_service.dart`: `ApiService.home`, `_lerLista` (mantém a ordem recebida)
  - `lib/services/home_service.dart`: `HomeService.carregar`
  - `lib/screens/home_page.dart`: `_HomePageState._corpo` (comentário "Ordem, teto e janela de 14 dias vêm prontos do servidor")
  - `lib/widgets/evento_card.dart`: `EventoCard` (prova usa `provaBg` sem borda; entrega usa `surface` com borda de 1 px)
  - `lib/widgets/materia_chip.dart`: `MateriaChip`
- **Fala:** "A Home não ordena nem corta nada. A ordem é a que o servidor manda."

### Passo 3 — Criar evento online (1:40 a 2:30)

- **Toque:** **+ Adicionar prova ou entrega** → Tipo **Entrega** → Matéria → "O que é": `Teste A — apresentação` → "Quando": uma data dentro dos 14 dias → **Salvar**.
- **A banca vê:** o snack **"Enviado para a turma."** e a volta à Home com o cartão novo. A autoria mostra o seu nome e "agora" (texto de `tempoRelativo` para menos de 1 minuto).
- **Critérios:** POST `/eventos` com status 201 (Operações REST). O registro passa pelo SQLite antes de ir para a rede (rascunho), então a criação também funciona sem rede (Persistência).
- **Código:**
  - `lib/screens/evento_form_page.dart`: `_EventoFormPageState._salvar`, `_sincronizar`
  - `lib/repositories/rascunho_repository.dart`: `RascunhoRepository.inserir`
  - `lib/services/sync_service.dart`: `SyncService.sincronizar` → `ApiService.criarEvento` (espera 201)
  - `lib/models/rascunho_evento.dart`: `RascunhoEvento.toCriarJson`

### Passo 4 — Detalhe: GET, PUT, PATCH, DELETE (2:30 a 3:50)

1. **Abra S** (o evento da turma com material). A banca vê a seção **Materiais vinculados** com título, URL e "Nome · há X". Toque **Marcar como feito** → snack **"Feito atualizado."** → o botão vira **Desmarcar feito**.
2. Volte. **Abra "Teste A — apresentação"** (seu). Toque **Editar**, troque o título para `Teste A editado`, toque **Salvar** → snack **"Evento atualizado."**.
3. Ainda no Teste A: **Excluir** → caixa **"Excluir este evento?"** com "Ele some para a turma inteira." → **Excluir**. Volta à Home sem o cartão.

- **Critérios:**
  - GET `/eventos/{id}` com status 200 e materiais vinculados (Operações REST);
  - PUT `/eventos/{id}/estado-pessoal` com status 204: o "feito" fica no estado pessoal, separado do evento (regra 3);
  - PATCH com `If-Match: <version>` (200);
  - DELETE com `If-Match` (204); no servidor a exclusão é lógica;
  - Editar e Excluir só aparecem para o autor (regra 10).
- **Código:**
  - `lib/screens/evento_detalhe_page.dart`: `_EventoDetalhePageState._corpo` (botões só se `ehAutor`), `_alternarFeito`, `_excluir`
  - `lib/screens/evento_form_page.dart`: `_salvar` (ramo `ev != null`, PATCH)
  - `lib/services/api_service.dart`: `ApiService.evento`, `marcarFeito`, `atualizarEvento`, `excluirEvento`; o header `If-Match` sai de `_enviar`
  - `lib/repositories/estado_pessoal_repository.dart`: `EstadoPessoalRepository.marcarLocal`
- **Fala:** "O feito é meu; o evento é da turma. Por isso o 'feito' não fica no evento."
- **Se perguntarem sobre as faixas do detalhe:** um evento que o próprio autor excluiu mostra "Você excluiu este evento — ele não aparece mais para a turma."; um evento oculto pelo líder mostra "Oculto pelo líder da turma — só você está vendo.". Não fazem parte do roteiro: a Home não lista evento excluído, então a banca só vê esses avisos se abrir um evento já excluído ou oculto.

### Passo 5 — Tema escuro e reinício (3:50 a 4:20)

- **Toque:** ⚙ **Configurações** → ligue **Tema escuro** → volte. Feche o app pelos apps recentes (deslize para fora) e abra de novo.
- **A banca vê:** o tema muda na hora. Ao reabrir, o app entra direto na Home, sem login, e continua escuro. Em Configurações, "Última sincronização" mostra data e hora.
- **Critérios:** SharedPreferences guarda sessão, tema e datas. Os dados sobrevivem a fechar o app (Persistência).
- **Código:**
  - `lib/repositories/sessao_store.dart`: `SessaoStore` (`definirTemaEscuro`, `temaEscuro`, `carregar`, `ultimaSincronizacao`)
  - `lib/main.dart`: `main` (lê sessão e tema antes do `runApp`)
  - `lib/screens/configuracoes_page.dart`: `_ConfiguracoesPageState` (SwitchListTile "Tema escuro")
  - `lib/widgets/cores.dart`: `temaFans`, `CoresFans.escuro`

### Passo 6 — Modo avião (4:20 a 5:50)

Ligue o modo avião no ponto indicado em 6.1 e deixe-o ligado até o passo 7.

**6.1 Editar sem internet.** Com rede, abra **Teste B — apresentação** (o detalhe precisa estar carregado) e toque **Editar**. Com a tela de edição aberta, ligue o modo avião e toque **Salvar** → **"Editar precisa de internet."**. A tela continua aberta com o que você digitou. Toque na seta de voltar, sem salvar: você volta ao detalhe. Toque na seta de voltar de novo: você volta à Home, que continua em modo avião.
- *Critério:* PATCH sem rede não vai para a fila; o erro aparece na tela (Tratamento de erros).
- *Código:* `lib/screens/evento_form_page.dart`: `_msgEditar`, `_salvar` (ramo `ev != null`).

**6.2 Home do cache.** Você está na Home, ainda em modo avião. A Home recarrega sozinha ao voltar de qualquer tela; sem rede, mostra a faixa **"Sem conexão com o servidor — mostrando o que foi salvo às HH:mm."**. Os cartões continuam na ordem salva. O Teste B aparece sem ✓, porque a marcação de feito ainda não foi feita.
- *Critério:* cache da Home (SQLite, `home_cache`, coluna `posicao`) quando a API não responde. O "feito" vem de `estado_pessoal` (LEFT JOIN), não do cache.
- *Código:*
  - `lib/services/home_service.dart`: `HomeService.carregar` (cai no cache com `semConexao` ou 5xx)
  - `lib/repositories/home_cache_repository.dart`: `HomeCacheRepository.listar` (ORDER BY posicao)
  - `lib/screens/home_page.dart`: `_corpo` (faixa offline), `_abrirTela` (recarrega ao voltar)

**6.3 Marcar feito offline, pelo detalhe.** Ainda em modo avião, toque em **Teste B — apresentação**. O detalhe não tem cache: aparece **"Sem conexão com o servidor."** e, logo abaixo, o botão **Marcar como feito** (e **Tentar de novo**). Toque em **Marcar como feito** → **"Salvo no aparelho — será enviado quando houver conexão."**. O botão vira **Desmarcar feito**. Toque na seta de voltar: na Home, o Teste B aparece com ✓ e título riscado.
- *Critério:* a marcação vai para o SQLite (`estado_pessoal`, `sincronizado = 0`) e é enviada depois (offline-first, Sincronização). Marcar feito funciona offline também a partir do detalhe, sem o detalhe ter sido carregado com rede.
- *Código:*
  - `lib/screens/evento_detalhe_page.dart`: `_alternarFeito`, `_estadoErro` (botão offline)
  - `lib/repositories/estado_pessoal_repository.dart`: `marcarLocal`
  - `lib/database/app_database.dart`: tabela `estado_pessoal`

**6.4 Criar evento offline.** Toque **+ Adicionar prova ou entrega** → Tipo → Matéria → "O que é": `Teste offline — apresentação` → data → **Salvar** → **"Salvo no aparelho — será enviado quando houver conexão."**. A Home mostra "2 aguardando envio" (este rascunho e a marcação de feito do 6.3) com o botão **Ver fila**.
- *Critério:* CRUD local (inserir) na tabela `rascunhos`; offline-first.
- *Código:* `lib/screens/evento_form_page.dart`: `_salvar` (ramo sem `evento`: `rascunhos.inserir`); `lib/repositories/rascunho_repository.dart`: `RascunhoRepository.inserir`.

**6.5 Fila de envio e edição local.** Toque **Ver fila**. A banca vê o rascunho com **"você · aguardando envio"** e a linha "Marcações de feito pendentes: 1". Toque **Editar** no rascunho, troque o título para `Teste offline editado`, toque **Salvar** (ainda offline, mesmo snack do 6.4). A fila também mostra o **Teste A — apresentação** com **"você · enviado ✓"**: ela guarda o estado de envio de tudo que foi criado neste aparelho, com o título da criação, mesmo depois de editado ou excluído no servidor.
- *Critério:* Read e Update locais; o estado de envio aparece por item (pendente, enviado ✓ ou erro).
- *Código:*
  - `lib/screens/fila_page.dart`: `_FilaPageState._conteudo`, `_status`, `_editar`
  - `lib/repositories/rascunho_repository.dart`: `listar`, `atualizar`
- *Se perguntarem sobre excluir:* rascunho não enviado pode ser excluído na mesma tela ("Excluir este rascunho?" → **Excluir**). Ele some só deste aparelho. Código: `fila_page.dart`: `_excluir`; `rascunho_repository.dart`: `excluir`.

**6.6 Fechar e reabrir sem rede.** Feche o app pelos apps recentes e abra de novo **ainda em modo avião**. A Home abre do cache, com a faixa "Sem conexão com o servidor — mostrando o que foi salvo às HH:mm.", e o rascunho continua na fila.
- *Critério:* dados após fechar o app (SQLite e SharedPreferences), sem rede.
- *Código:* `lib/main.dart`: `main`; `lib/services/home_service.dart`: `carregar`.

### Passo 7 — Religar e sincronizar (5:50 a 6:30)

- **Toque:** desligue o modo avião. Abra **Ver fila** e toque **Sincronizar agora**. Não puxe a Home para atualizar antes disso: a Home também envia a fila ao carregar com rede, e o contador da fila sairia zerado.
- **A banca vê:** o snack **"Enviados: 2 · Com erro: 0 · Pendentes: 0"** (2 se só o rascunho do 6.4 e a marcação do 6.3 estavam pendentes). O rascunho passa a **"você · enviado ✓"** e a linha de marcações diz "Nenhuma marcação de feito pendente.". Ao voltar à Home, a faixa offline some e o "Teste offline editado" aparece, com a autoria vinda do servidor.
- *Critério:* Sincronização. O POST (201) do rascunho e o PUT (204) do feito são enviados; a fila zera; a data da sincronização é gravada; a Home volta a vir da API.
- *Código:*
  - `lib/services/sync_service.dart`: `SyncService.sincronizar`, `_executar` (rascunhos → `criarEvento`; feitos → `marcarFeito`)
  - `lib/repositories/rascunho_repository.dart`: `marcarSincronizado`
  - `lib/repositories/estado_pessoal_repository.dart`: `marcarSincronizado`
  - `lib/screens/fila_page.dart`: `_FilaPageState._sincronizar`
  - `lib/screens/home_page.dart`: `_carregar` (envia a fila ao carregar online com pendentes)
- **Dica:** o botão de sincronizar no topo da Home é o ícone de setas (tooltip "Sincronizar"), com um contador de pendentes. A Fila tem o texto "Sincronizar agora".
- **Se perguntarem se envia sozinho:** envia quando a Home carrega com rede, e ao salvar ou marcar feito. Não há serviço em segundo plano: se a rede voltar com o app fechado, nada é enviado até abrir o app.

### Passo 8 — Erros e limpeza (6:30 a 7:00)

Mostre de novo, sem refazer, o que já passou:

- senha errada → **"E-mail ou senha incorretos."** (passo 1);
- editar sem rede → **"Editar precisa de internet."** (passo 6.1);
- semana vazia → **"Nada nos próximos 14 dias."**; falha sem cache → a mensagem de erro com **Tentar de novo**. Falha nunca aparece como lista vazia.
- *Código:* `lib/services/api_service.dart`: `_enviar` (traduz `SocketException`, `ClientException`, `TimeoutException` e `TlsException` em `ApiException.semConexao`), `_erroHttp`; `lib/services/api_exception.dart`: `ApiException`; `lib/services/home_service.dart`: `carregar` (sem cache, relança); `lib/screens/home_page.dart`: `_carregar`.

**Limpeza (com rede):** abra **Teste B — apresentação** → **Excluir** → **Excluir**. Depois abra **Teste offline editado** → **Excluir** → **Excluir**. Não deixe eventos de teste na turma.

---

## Plano B: API não acorda ou rede cai

Use quando o login ou a Home ficar girando por mais de 1 minuto (o app desiste aos 90 s), ou aparecer "Sem conexão com o servidor.".

1. Diga: "O servidor gratuito está dormindo / sem rede. Vou mostrar os testes que cobrem o mesmo código."
2. No terminal, em `fans_lab/`:

```bash
flutter test test/api_service_test.dart     # HTTP com MockClient: GET, POST, PUT, PATCH, DELETE, If-Match, 401, 409, timeout, HTML no lugar de JSON
flutter test test/repositories_test.dart    # SQLite (sqflite_common_ffi, sem aparelho): cache, estado pessoal, rascunhos, limparTudo
flutter test test/services_test.dart        # sincronização e offline: fila, POST 201, PUT, duas chamadas simultâneas = 2 POSTs, 503 com cache
flutter test test/telas_home_test.dart      # Home: ordem do servidor, semana vazia, falha sem cache, 401 sem apagar a fila
flutter test test/widgets_test.dart         # prova sólida, entrega com contorno, distinção em escala de cinza
flutter test test/fluxo_demo_test.dart      # o fio principal do roteiro: login, criar online, feito, modo avião, criar offline, fila, sincronizar
flutter test                                # tudo: 191 testes (unitários e de tela, sem servidor)
```

Para mostrar um teste específico: `flutter test --plain-name "duas chamadas simultâneas"`.

3. Testes para apontar, com o que cada um prova:
   - `api_service_test.dart`: "atualizarEvento faz PATCH com If-Match: 3, envia o corpo e devolve o Evento"; "atualizarEvento com 409 vira conflito"; "200 com corpo <html> vira respostaInvalida, sem marcar falta de conexão".
   - `repositories_test.dart`: "feito vem do estado_pessoal e não fica no cache"; "inserir, listar, atualizar e excluir".
   - `services_test.dart`: "sincronizar envia 2 rascunhos (201), zera pendentes e grava ultimaSincronizacao"; "sem conexão depois de um carregar online devolve o cache com offline=true"; "sem conexão sem nunca ter carregado lança semConexao, nunca lista vazia".
   - `telas_home_test.dart`: "home mostra os itens na ordem que o servidor mandou"; "falha sem cache mostra Tentar de novo, nunca lista vazia"; "401 na app volta ao login e não apaga a fila".
   - `widgets_test.dart`: "prova: bloco sólido com provaBg"; "entrega: contorno 1px sobre surface".
4. Mostre o código dos passos 3, 6 e 7 (ver a lista de arquivos em cada passo).

**Teste contra o backend local (só se a banca pedir contrato com o servidor):** com o backend local no ar (`cd backend && sh ./mvnw -DskipTests spring-boot:run -Dspring-boot.run.profiles=dev`), rode `cd fans_lab && API_URL=http://localhost:8080/api/v1 E2E_EMAIL=ana@exemplo.dev E2E_SENHA=senha123 flutter test test_e2e/api_real_test.dart`. São 13 testes contra o Spring real, em vez do simulado. Não é o Render: prova o contrato, não a API de produção. A última execução registrada passou 13/13 (commit `ee537ba`).

---

## Checklist final (critérios das rubricas)

Os 10 itens são os da §24 da apostila de Persistência. O PDF da apostila não está no repositório: confira os nomes com o impresso antes da banca.

| # | Item | Arquivo ou teste que comprova | Como mostrar |
|---|---|---|---|
| 1 | SQLite funcionando | `lib/database/app_database.dart`: `AppDatabase.abrir` (arquivo `fans_lab.db`) e `_esquema` (4 tabelas); `test/repositories_test.dart` roda SQLite com `sqflite_common_ffi` | passo 6.2 (cache da Home) |
| 2 | CRUD local | `lib/repositories/rascunho_repository.dart`: `inserir`, `listar`, `atualizar`, `excluir`; `test/repositories_test.dart`: "inserir, listar, atualizar e excluir" | passos 6.4 (criar) e 6.5 (editar e excluir na fila) |
| 3 | Dados permanecem após fechar | `lib/database/app_database.dart` (grava em `fans_lab.db`, no aparelho) e `lib/repositories/sessao_store.dart` (SharedPreferences: sessão, tema, datas). **Honesto:** os testes usam banco em memória (`AppDatabase.abrirEmMemoria`) e SharedPreferences simulado; nenhum teste prova a persistência. A prova é no aparelho, e só vale se você tiver rodado lá | passos 5 e 6.6: fechar o app pelos recentes e abrir de novo |
| 4 | GET funcionando | `lib/services/api_service.dart`: `home`, `materias`, `evento` (esperam 200); `test/api_service_test.dart`: "200 preserva a ordem recebida e envia Bearer quando há token" | passos 2 e 4 |
| 5 | POST funcionando | `lib/services/api_service.dart`: `criarEvento` (espera 201) e `login` (espera 200); `test/api_service_test.dart`: "criarEvento faz POST com o corpo recebido e devolve Evento do 201" | passos 1 e 3 |
| 6 | Tratamento de erro | `lib/services/api_service.dart`: `_enviar`, `_erroHttp`, `_mensagemPadrao`; `lib/services/api_exception.dart`: `ApiException`; `test/api_service_test.dart`: "401 vira \"E-mail ou senha incorretos.\" mesmo com detail do servidor" e "atualizarEvento com 409 vira conflito" | passos 1, 6.1 e 8 |
| 7 | Modo offline | `lib/services/home_service.dart`: `HomeService.carregar` (cai no cache com `semConexao` ou 5xx); `test/services_test.dart`: "sem conexão depois de um carregar online devolve o cache com offline=true" | passos 6.2, 6.3 e 6.4 |
| 8 | Sincronização | `lib/services/sync_service.dart`: `SyncService.sincronizar`, `_executar` (POST dos rascunhos, PUT dos feitos); `test/services_test.dart`: "sincronizar envia 2 rascunhos (201), zera pendentes e grava ultimaSincronizacao" e "duas chamadas simultâneas de sincronizar() fazem exatamente 2 POSTs" | passo 7 |
| 9 | Arquitetura organizada | `fans_lab/lib/` separado por responsabilidade: `models/`, `database/`, `repositories/`, `services/`, `screens/`, `widgets/`. `HomeService` junta `ApiService` (rede) e `HomeCacheRepository` (SQLite). Seção "Estrutura" do `README.md` | mostrar a árvore de `lib/` e `HomeService.carregar` |
| 10 | Apresentação | Este roteiro (`docs/APRESENTACAO-FLUTTER.md`) e a demo no aparelho. Plano B com `flutter test`, na seção "Plano B" | passos 1 a 8 no aparelho, ensaiados antes. Se não ensaiou, não afirme que o APK funciona (ver "O que não afirmar") |

O mapa completo por critério (ENTREGA-FLUTTER §3) fica abaixo.

| Critério | Onde está (arquivo: classe/método) | Como mostrar |
|---|---|---|
| **HTTP** | | |
| GET com status checado | `lib/services/api_service.dart`: `ApiService.home`, `_enviar` | passo 2; `api_service_test.dart`: "200 preserva a ordem recebida e envia Bearer quando há token" |
| JSON → Model e Model → JSON | `lib/models/item_home.dart`: `ItemHome.fromJson`; `lib/models/rascunho_evento.dart`: `toCriarJson` | `models_test.dart`: "fromJson lê todos os campos" |
| POST (201) | `ApiService.criarEvento` | passo 3; `api_service_test.dart`: "criarEvento faz POST com o corpo recebido e devolve Evento do 201" |
| PUT (204) | `ApiService.marcarFeito` | passo 4; `api_service_test.dart`: `marcarFeito faz PUT em estado-pessoal com {"feito":true} e aceita 204` |
| PATCH com If-Match (200) | `ApiService.atualizarEvento` | passo 4; `api_service_test.dart`: "atualizarEvento faz PATCH com If-Match: 3, envia o corpo e devolve o Evento" |
| DELETE com If-Match (204) | `ApiService.excluirEvento` | passo 4; `api_service_test.dart`: "excluirEvento faz DELETE com If-Match e aceita 204" |
| Erros: 401, 409, sem conexão | `lib/services/api_service.dart`: `_erroHttp`, `_mensagemPadrao`; `lib/services/api_exception.dart`: `ApiException` | passos 1, 6.1, 8; `api_service_test.dart`: "401 vira \"E-mail ou senha incorretos.\" mesmo com detail do servidor", "atualizarEvento com 409 vira conflito" |
| Interface: carregando, erro, sucesso | `lib/screens/home_page.dart`: `_corpo` (spinner, "Tentar de novo", SnackBar) | passos 2 e 8 |
| Organização em pastas | `lib/`: models, database, repositories, services, screens, widgets | README, seção Estrutura |
| **Persistência** | | |
| SQLite com esquema | `lib/database/app_database.dart`: `_esquema`, `AppDatabase.abrir` | passo 6.2; `repositories_test.dart` |
| CRUD local | `lib/repositories/rascunho_repository.dart`: `inserir`, `listar`, `atualizar`, `excluir` | passos 6.4 e 6.5; "inserir, listar, atualizar e excluir" |
| SharedPreferences | `lib/repositories/sessao_store.dart`: `SessaoStore` | passo 5; `sessao_store_test.dart`: "tema e datas voltam iguais" |
| Dados após fechar o app | SQLite (`rascunhos`, `home_cache`) e SharedPreferences (`sessao`) | passos 5 e 6.6 |
| Cache offline | `lib/services/home_service.dart`: `HomeService.carregar` | passo 6.2; "sem conexão depois de um carregar online devolve o cache com offline=true" |
| Sincronização | `lib/services/sync_service.dart`: `SyncService.sincronizar`, `_executar` | passo 7; "sincronizar envia 2 rascunhos (201), zera pendentes e grava ultimaSincronizacao" |
| Sincronização sem duplicar execução concorrente | `lib/services/sync_service.dart`: `_emCurso` | "duas chamadas simultâneas de sincronizar() fazem exatamente 2 POSTs" |
| Erro distinto de lista vazia | `lib/services/home_service.dart` (relança sem cache); `lib/screens/home_page.dart` | passo 8; "falha sem cache mostra Tentar de novo, nunca lista vazia" |
| Sessão expirada não apaga a fila | `lib/main.dart`: `_sessaoExpirou` | `telas_home_test.dart`: "401 na app volta ao login e não apaga a fila" |
| Regras do projeto | autoria, ordem do servidor, prova × entrega, cor + sigla, só o autor edita | passos 2 e 4; `widgets_test.dart` |

---

## Perguntas prováveis

- **Por que PATCH na edição e PUT só no "feito"?** O "feito" é estado pessoal e vai para `PUT /eventos/{id}/estado-pessoal`. A edição do evento inteiro é `PATCH /eventos/{id}`, com `If-Match`. A rubrica aceita PUT ou PATCH.
- **O que é o If-Match?** A versão do evento que você viu. Se outra pessoa mudou o evento antes, o servidor responde 409 e o app avisa para abrir de novo.
- **Por que SQLite e SharedPreferences?** SQLite guarda dados em tabelas (cache, rascunhos, marcações pendentes). SharedPreferences guarda poucos valores (sessão, tema, datas).
- **E se a rede cair no meio do envio?** O rascunho continua pendente e a próxima sincronização tenta de novo. Limite: se o POST chegar ao servidor e a resposta se perder (o timeout é de 90 s), o evento pode ser enviado duas vezes. Não há chave de idempotência no backend.
- **E se a sessão expirar com coisas na fila?** O app volta ao login e a fila continua no aparelho. Entrando com a mesma conta, ela é enviada. Entrando com outra conta, os dados da conta anterior são apagados antes, para não enviar com a autoria errada.
- **O token está seguro?** Não. Ele fica em SharedPreferences, em texto puro. O caminho seguro é `flutter_secure_storage`, que não foi implementado. O logout também não revoga o token no servidor.
- **Por que a Home não ordena?** A regra do projeto é que ordem é urgência, não tipo, e quem decide é o servidor (`HomeService` e `ApiService.home` só repassam a lista).

## O que não afirmar

- O app foi testado no emulador Android 15 e no Chrome contra o backend local (24/10/2026). Contra a API de produção, só vale afirmar o que você mesmo rodou com a sua conta.
- Não diga que editar ou excluir funciona sem rede. Mostra erro, e a mensagem diz isso.
- Não diga que o detalhe de evento abre offline. Sem rede ele mostra o erro; só o botão "Marcar como feito" funciona.
- Não diga que a sincronização garante envio único. Pode duplicar no caso de timeout (ver acima).
- Não diga que o app sincroniza em segundo plano. Ele envia quando a Home carrega com rede ou quando você age (salvar, marcar feito, sincronizar).
- Não diga que a API local por `http://` funciona no build de release. Só no debug.
- Se aparecer um 401 durante a apresentação, o app volta ao login e a fila fica no aparelho (`lib/main.dart`: `_sessaoExpirou`). Só o "Sair" manual apaga a fila, e ele pede confirmação. Não diga que o 401 apaga os dados.
