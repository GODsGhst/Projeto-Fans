# Roteiro de apresentação — fans_lab (7 min)

Para a banca de Aplicações Móveis e Distribuídas. Cada passo diz o que tocar, o que a banca vê, qual critério aquilo prova e onde está o código (`arquivo` + classe/método), para mostrar se pedirem.

Textos entre aspas são os da tela, conferidos com grep no código. Teste no aparelho que você vai usar, com a mesma versão que vai apresentar (`flutter run` ou APK).

---

## Antes da banca (preparação, 10 min antes)

1. **Acorde a API.** `curl https://projetofans-api.onrender.com/api/v1/saude` (ou abra a URL no navegador). Deve responder `{"status":"ok",...}`. Se der 502 ou demorar, repita até responder. Ela volta a dormir se ficar parada, então acorde perto da hora, não horas antes.
2. **Entre uma vez** no app com sua conta. A Home precisa carregar uma vez com rede, para o cache existir.
3. **Confira a Home.** Precisa ter:
   - uma **prova** e uma **entrega** nos próximos 14 dias (para a comparação visual aparecer);
   - um **evento da turma com material vinculado** (chamado **S** aqui). O app não tem tela para criar material: se S não tiver material no servidor, a seção mostra "Nenhum material vinculado.". Diga isso se perguntarem;
   - um **evento seu** com data nos próximos 14 dias, título **"Teste B — apresentação"** (prova ou entrega). Só o autor vê Editar e Excluir, por isso ele precisa ser seu.
4. **Abra "+ Adicionar prova ou entrega" uma vez, com rede**, e volte. Isso grava as matérias no cache; sem isso o formulário não abre sem rede.
5. **Esvazie a fila.** Configurações → Fila de envio → **Sincronizar agora**, se houver algo pendente.
6. **Modo avião desligado.** Tema claro. Terminal aberto em `fans_lab/`, com o `flutter` no PATH (para o plano B).
7. Os eventos de teste vão para a turma real. Use os títulos indicados e apague tudo no passo 8.

---

## Roteiro

| Min | Passo | O que prova |
|---|---|---|
| 0:00 | 1. Login | POST; erro 401 tratado na tela |
| 0:50 | 2. Home | GET com ordem do servidor; prova × entrega; autoria |
| 1:40 | 3. Criar evento online | POST (201) |
| 2:30 | 4. Detalhe: marcar feito, editar, excluir | GET por id; PUT; PATCH com If-Match; DELETE com If-Match |
| 3:50 | 5. Tema escuro e reinício | SharedPreferences; dados após fechar o app |
| 4:20 | 6. Modo avião | cache da Home; SQLite; criação e feito offline; fila; CRUD local |
| 5:50 | 7. Religar e sincronizar | fila → API; estado de envio |
| 6:30 | 8. Erros e limpeza | mensagens de erro; vazio × falha |

Observação de ordem: **marcar feito e editar offline só funcionam com a tela já aberta.** O detalhe não tem cache, então abrir um evento sem rede dá "Sem conexão com o servidor.". Por isso o passo 6 abre o detalhe antes de ligar o modo avião.

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

Ligue o modo avião **só depois** de cada ponto indicado.

**6.1 Editar sem internet.** Com rede, abra **Teste B — apresentação** e toque **Editar**. Com a tela de edição aberta, ligue o modo avião e toque **Salvar** → **"Editar precisa de internet."**. A tela continua aberta com o que você digitou. Toque na seta de voltar, sem salvar.
- *Critério:* PATCH sem rede não vai para a fila; o erro aparece na tela (Tratamento de erros).
- *Código:* `lib/screens/evento_form_page.dart`: `_msgEditar`, `_salvar` (ramo `ev != null`).

**6.2 Marcar feito offline.** Ainda no Teste B, com o detalhe aberto e sem rede, toque **Marcar como feito** → **"Salvo no aparelho — será enviado quando houver conexão."**. O botão vira **Desmarcar feito**.
- *Critério:* a marcação vai para o SQLite (`estado_pessoal`, `sincronizado = 0`) e é enviada depois (offline-first, Sincronização).
- *Código:* `lib/screens/evento_detalhe_page.dart`: `_alternarFeito`; `lib/repositories/estado_pessoal_repository.dart`: `marcarLocal`; `lib/database/app_database.dart`: tabela `estado_pessoal`.

**6.3 Home do cache.** Toque na seta de voltar. A Home mostra a faixa **"Sem conexão — mostrando o que foi salvo às HH:mm."**. Os cartões continuam na ordem salva. O Teste B aparece com ✓ e título riscado.
- *Critério:* cache da Home (SQLite, `home_cache`, coluna `posicao`) quando a API não responde. O "feito" vem de `estado_pessoal` (LEFT JOIN), não do cache.
- *Código:*
  - `lib/services/home_service.dart`: `HomeService.carregar` (cai no cache com `semConexao` ou 5xx)
  - `lib/repositories/home_cache_repository.dart`: `HomeCacheRepository.listar` (ORDER BY posicao)
  - `lib/screens/home_page.dart`: `_corpo` (faixa offline)

**6.4 Criar evento offline.** Toque **+ Adicionar prova ou entrega** → "O que é": `Teste offline — apresentação` → data → **Salvar** → **"Salvo no aparelho — será enviado quando houver conexão."**. A Home mostra "1 aguardando envio" com o botão **Ver fila**.
- *Critério:* CRUD local (inserir) na tabela `rascunhos`; offline-first.
- *Código:* `lib/screens/evento_form_page.dart`: `_salvar` (ramo sem `evento`: `rascunhos.inserir`); `lib/repositories/rascunho_repository.dart`: `RascunhoRepository.inserir`.

**6.5 Fila de envio e edição local.** Toque **Ver fila**. A banca vê o rascunho com **"você · aguardando envio"** e a linha "Marcações de feito pendentes: 1". Toque **Editar** no rascunho, troque o título, toque **Salvar** (ainda offline, mesmo snack do 6.4).
- *Critério:* Read e Update locais; o estado de envio aparece por item (pendente, enviado ✓ ou erro).
- *Código:*
  - `lib/screens/fila_page.dart`: `_FilaPageState._conteudo`, `_status`, `_editar`
  - `lib/repositories/rascunho_repository.dart`: `listar`, `atualizar`
- *Se perguntarem sobre excluir:* rascunho não enviado pode ser excluído na mesma tela ("Excluir este rascunho?" → **Excluir**). Ele some só deste aparelho. Código: `fila_page.dart`: `_excluir`; `rascunho_repository.dart`: `excluir`.

**6.6 Fechar e reabrir sem rede.** Feche o app pelos apps recentes e abra de novo **ainda em modo avião**. A Home abre do cache, com a faixa "Sem conexão…", e o rascunho continua na fila.
- *Critério:* dados após fechar o app (SQLite e SharedPreferences), sem rede.
- *Código:* `lib/main.dart`: `main`; `lib/services/home_service.dart`: `carregar`.

### Passo 7 — Religar e sincronizar (5:50 a 6:30)

- **Toque:** desligue o modo avião. Abra **Ver fila** e toque **Sincronizar agora**.
- **A banca vê:** o snack **"Enviados: 2 · Com erro: 0 · Pendentes: 0"** (2 se só o rascunho do 6.4 e a marcação do 6.2 estavam pendentes). O rascunho passa a **"você · enviado ✓"** e a linha de marcações diz "Nenhuma marcação de feito pendente.". Ao voltar à Home, a faixa offline some e o "Teste offline — apresentação" aparece, com a autoria vinda do servidor.
- *Critério:* Sincronização. O POST (201) do rascunho e o PUT (204) do feito são enviados; a fila zera; a data da sincronização é gravada; a Home volta a vir da API.
- *Código:*
  - `lib/services/sync_service.dart`: `SyncService.sincronizar`, `_executar` (rascunhos → `criarEvento`; feitos → `marcarFeito`)
  - `lib/repositories/rascunho_repository.dart`: `marcarSincronizado`
  - `lib/repositories/estado_pessoal_repository.dart`: `marcarSincronizado`
  - `lib/screens/fila_page.dart`: `_FilaPageState._sincronizar`
- **Dica:** o botão de sincronizar no topo da Home é o ícone de setas (tooltip "Sincronizar"), com um contador de pendentes. A Fila tem o texto "Sincronizar agora".

### Passo 8 — Erros e limpeza (6:30 a 7:00)

Mostre de novo, sem refazer, o que já passou:

- senha errada → **"E-mail ou senha incorretos."** (passo 1);
- editar sem rede → **"Editar precisa de internet."** (passo 6.1);
- semana vazia → **"Nada nos próximos 14 dias."**; falha sem cache → a mensagem de erro com **Tentar de novo**. Falha nunca aparece como lista vazia.
- *Código:* `lib/services/api_service.dart`: `_enviar` (traduz `SocketException`, `ClientException` e `TimeoutException` em `ApiException.semConexao`), `_erroHttp`; `lib/services/api_exception.dart`: `ApiException`; `lib/services/home_service.dart`: `carregar` (sem cache, relança); `lib/screens/home_page.dart`: `_carregar`.

**Limpeza (com rede):** abra **Teste B — apresentação** → **Excluir** → **Excluir**. Depois abra **Teste offline — apresentação** → **Excluir** → **Excluir**. Não deixe eventos de teste na turma.

---

## Plano B: API não acorda ou rede cai

Use quando o login ou a Home ficar girando por mais de 1 minuto, ou aparecer "Sem conexão com o servidor.".

1. Diga: "O servidor gratuito está dormindo / sem rede. Vou mostrar os testes que cobrem o mesmo código."
2. No terminal, em `fans_lab/`:

```bash
flutter test test/api_service_test.dart     # HTTP com MockClient: GET, POST, PUT, PATCH, DELETE, If-Match, 401, 409, timeout, HTML no lugar de JSON
flutter test test/repositories_test.dart    # SQLite (sqflite_common_ffi, sem aparelho): cache, estado pessoal, rascunhos, limparTudo
flutter test test/services_test.dart        # sincronização e offline: fila, POST 201, PUT, duas chamadas simultâneas = 2 POSTs
flutter test test/telas_home_test.dart      # Home: ordem do servidor, semana vazia, falha sem cache
flutter test test/widgets_test.dart         # prova sólida, entrega com contorno, distinção em escala de cinza
flutter test                                # tudo: 97 testes
```

Para mostrar um teste específico: `flutter test --plain-name "duas chamadas simultâneas"`.

3. Testes para apontar, com o que cada um prova:
   - `api_service_test.dart`: "atualizarEvento faz PATCH com If-Match: 3 e devolve o Evento"; "atualizarEvento com 409 vira conflito"; "200 com corpo <html> vira respostaInvalida, sem marcar falta de conexão".
   - `repositories_test.dart`: "feito vem do estado_pessoal e não fica no cache"; "inserir, listar, atualizar e excluir".
   - `services_test.dart`: "sincronizar envia 2 rascunhos (201), zera pendentes e grava ultimaSincronizacao"; "sem conexão depois de um carregar online devolve o cache com offline=true"; "sem conexão sem nunca ter carregado lança semConexao, nunca lista vazia".
   - `telas_home_test.dart`: "home mostra os itens na ordem que o servidor mandou"; "falha sem cache mostra Tentar de novo, nunca lista vazia".
   - `widgets_test.dart`: "prova: bloco sólido com provaBg"; "entrega: contorno 1px sobre surface".
4. Mostre o código dos passos 3, 6 e 7 (ver a lista de arquivos em cada passo).

---

## Checklist final (critérios das rubricas)

A apostila de Persistência não está neste repositório, então esta lista segue os critérios de `docs/ENTREGA-FLUTTER.md` §3. O pedido fala em §24 e o documento em §25: confira o texto da apostila antes da banca e ajuste os nomes dos itens.

| Critério | Onde está (arquivo: classe/método) | Como mostrar |
|---|---|---|
| **HTTP** | | |
| GET com status checado | `lib/services/api_service.dart`: `ApiService.home`, `_enviar` | passo 2; `api_service_test.dart`: "200 preserva a ordem recebida e envia Bearer quando há token" |
| JSON → Model e Model → JSON | `lib/models/item_home.dart`: `ItemHome.fromJson`; `lib/models/rascunho_evento.dart`: `toCriarJson` | `models_test.dart`: "fromJson lê todos os campos" |
| POST (201) | `ApiService.criarEvento` | passo 3; `api_service_test.dart`: "criarEvento faz POST com o corpo recebido e devolve Evento do 201" |
| PUT (204) | `ApiService.marcarFeito` | passo 4; `api_service_test.dart`: "marcarFeito faz PUT em estado-pessoal com {\"feito\":true} e aceita 204" |
| PATCH com If-Match (200) | `ApiService.atualizarEvento` | passo 4; `api_service_test.dart`: "atualizarEvento faz PATCH com If-Match: 3 e devolve o Evento" |
| DELETE com If-Match (204) | `ApiService.excluirEvento` | passo 4; `api_service_test.dart`: "excluirEvento faz DELETE com If-Match e aceita 204" |
| Erros: 401, 409, sem conexão | `lib/services/api_service.dart`: `_erroHttp`; `lib/services/api_exception.dart`: `ApiException` | passos 1, 6.1, 8; `api_service_test.dart`: "401 vira ... mesmo com detail do servidor", "atualizarEvento com 409 vira conflito" |
| Interface: carregando, erro, sucesso | `lib/screens/home_page.dart`: `_corpo` (spinner, "Tentar de novo", SnackBar) | passos 2 e 8 |
| Organização em pastas | `lib/`: models, database, repositories, services, screens, widgets | README, seção Estrutura |
| **Persistência** | | |
| SQLite com esquema | `lib/database/app_database.dart`: `_esquema`, `AppDatabase.abrir` | passo 6.3; `repositories_test.dart` |
| CRUD local | `lib/repositories/rascunho_repository.dart`: `inserir`, `listar`, `atualizar`, `excluir` | passos 6.4 e 6.5; "inserir, listar, atualizar e excluir" |
| SharedPreferences | `lib/repositories/sessao_store.dart`: `SessaoStore` | passo 5; `sessao_store_test.dart`: "tema e datas voltam iguais" |
| Dados após fechar o app | SQLite (`rascunhos`, `home_cache`) e SharedPreferences (`sessao`) | passos 5 e 6.6 |
| Cache offline | `lib/services/home_service.dart`: `HomeService.carregar` | passo 6.3; "sem conexão depois de um carregar online devolve o cache com offline=true" |
| Sincronização | `lib/services/sync_service.dart`: `SyncService.sincronizar`, `_executar` | passo 7; "sincronizar envia 2 rascunhos (201), zera pendentes e grava ultimaSincronizacao" |
| Sincronização sem duplicar execução concorrente | `lib/services/sync_service.dart`: `_emCurso` | "duas chamadas simultâneas de sincronizar() fazem exatamente 2 POSTs" |
| Erro distinto de lista vazia | `lib/services/home_service.dart` (relança sem cache); `lib/screens/home_page.dart` | passo 8; "falha sem cache mostra Tentar de novo, nunca lista vazia" |
| Regras do projeto | autoria, ordem do servidor, prova × entrega, cor + sigla, só o autor edita | passos 2 e 4; `widgets_test.dart` |

---

## Perguntas prováveis

- **Por que PATCH na edição e PUT só no "feito"?** O "feito" é estado pessoal e vai para `PUT /eventos/{id}/estado-pessoal`. A edição do evento inteiro é `PATCH /eventos/{id}`, com `If-Match`. A rubrica aceita PUT ou PATCH.
- **O que é o If-Match?** A versão do evento que você viu. Se outra pessoa mudou o evento antes, o servidor responde 409 e o app avisa para abrir de novo.
- **Por que SQLite e SharedPreferences?** SQLite guarda dados em tabelas (cache, rascunhos, marcações pendentes). SharedPreferences guarda poucos valores (sessão, tema, datas).
- **E se a rede cair no meio do envio?** O rascunho continua pendente e a próxima sincronização tenta de novo. Limite: se o POST chegar ao servidor e a resposta se perder por timeout, o evento pode ser enviado duas vezes. Não há chave de idempotência no backend.
- **O token está seguro?** Não. Ele fica em SharedPreferences, em texto puro. O caminho seguro é `flutter_secure_storage`, que não foi implementado.
- **Por que a Home não ordena?** A regra do projeto é que ordem é urgência, não tipo, e quem decide é o servidor (`HomeService` e `ApiService.home` só repassam a lista).

## O que não afirmar

- Não diga que o APK foi testado em aparelho. Nesta versão, não foi.
- Não diga que editar ou excluir funciona sem rede. Mostra erro, e a mensagem diz isso.
- Não diga que o detalhe de evento abre offline. Não abre.
- Não diga que a sincronização garante envio único. Pode duplicar no caso de timeout (ver acima).
- Se aparecer um 401 durante a apresentação, o app sai sozinho e apaga o cache e o que ainda não foi enviado (`lib/main.dart`: `_aoSair`). Diga isso se perguntarem; não tente explicar como se fosse o comportamento desejado.
