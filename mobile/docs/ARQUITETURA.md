# Arquitetura do app Flutter — contrato

Leia antes de escrever qualquer arquivo em `mobile/`. Este documento existe para que agentes
diferentes, escrevendo áreas diferentes em paralelo, produzam um app só. Onde ele for explícito,
siga exatamente; onde for omisso, siga a especificação da área em `docs/spec/<area>.json`.

## O que estamos fazendo

Portando o app Ionic/Angular de `../app/src/app` para Flutter. **O backend não muda**: a API em
`https://projetofans-api.onrender.com/api/v1` é a mesma, com os mesmos caminhos, corpos, cabeçalhos
e erros. O comportamento também não muda: cada tela faz o que a tela Ionic faz, com o mesmo texto.

A fonte de verdade de comportamento é `docs/spec/<area>.json` (telas, endpoints, modelos, regras,
**armadilhas** e testes). Em dúvida sobre um detalhe, abra o arquivo Angular correspondente em
`../app/src/app` — ele é o original. Não invente comportamento que não está em nenhum dos dois.

Os não-negociáveis de `../AGENTS.md` valem integralmente aqui.

## Comandos

Flutter fica fora do PATH global. Todo comando começa com:

```bash
export PATH="/d/dev/flutter/bin:$PATH" PUB_CACHE="D:/dev/pub-cache" GRADLE_USER_HOME="D:/dev/gradle-home"
cd "C:/Users/gh0st/Projeto Fans/mobile"
```

- Análise: `flutter analyze` — precisa sair **sem nenhum issue** antes de você terminar.
- Testes: `flutter test test/<arquivo>_test.dart` (o seu) e `flutter test` (todos).
- Nunca rode `flutter pub add` para pacote fora da lista abaixo.

## Pacotes permitidos

| Pacote | Para quê | Equivale no Ionic |
|---|---|---|
| `http` | chamadas à API | HttpClient |
| `shared_preferences` | sessão, snapshot, turma ativa | Capacitor Preferences |
| `go_router` | rotas, abas, guardas | Angular Router |
| `intl` | datas em pt_BR | DatePipe / toLocale* |
| `flutter_local_notifications`, `timezone` | lembretes locais | @capacitor/local-notifications |
| `share_plus` | compartilhar código da turma | @capacitor/share |
| `url_launcher` | abrir link de material | window.open |
| `mocktail` (dev) | dublês em teste | jasmine spies |

**Nomes de widget × modelo:** os modelos `Materia` e `Nota` existem em `data/models.dart`, então os
widgets do design system se chamam `MateriaChip`, `EventoCard`, `AulaCard`, `MiniCard`,
`MaterialLinha`, `NotaCard` e `Selo`. Ícones: Material Icons na variante *outlined*, equivalente ao
ionicon `-outline` usado no Ionic.

Estado: **sem Provider, Riverpod ou Bloc.** Use `ChangeNotifier`, `ValueNotifier`,
`ListenableBuilder` e `ValueListenableBuilder` — vêm com o Flutter e são o equivalente direto dos
`signal` dos repositories Angular. Um signal vira um `ValueNotifier`; um `computed` vira um getter.

## Estrutura

```
lib/
  main.dart                 cria Servicos, restaura sessão, acorda /saude, roda o app
  app.dart                  MaterialApp.router + tema
  core/
    config.dart             apiUrl (--dart-define=API_URL, padrão: produção)
    erro_api.dart           ErroApi + mensagemDeErro()
    api.dart                ApiClient: verbos, cabeçalhos, teto de 75 s, tradução de erro
    armazenamento.dart      Armazenamento: 'pf.sessao', 'pf.snapshot', 'pf.turmaAtiva'
    auth.dart               AuthService (ChangeNotifier)
    turma_ativa.dart        TurmaAtivaService (docente)
    espera.dart             Espera: "Acordando o servidor…" após 4 s
    abas.dart               Abas: ValueNotifier<int> da aba visível
    servicos.dart           Servicos (container) + ServicosScope (InheritedWidget)
    rotas.dart              GoRouter, guardas, shell das abas
  data/
    models.dart             todos os modelos, com fromJson/toJson
    <area>_repository.dart  um por área, igual aos repositories Angular
  shared/
    tema.dart               tokens de cor, tipo, raio, espaçamento
    <componente>.dart       MateriaChip, EventoCard, AulaCard, MiniCard, MaterialLinha, Nota, Selo
  features/<area>/
    rotas_<area>.dart       List<RouteBase> da área — único ponto de ligação com rotas.dart
    <tela>_page.dart
  notifications/
    reagendador.dart        função PURA (sem plugin, sem relógio global)
    notificacoes.dart       NotificacoesService
test/                       espelha lib/
```

## Quem é dono de quê

A construção tem duas etapas. **Fundação** primeiro: `core/`, `data/` inteiro (modelos **e todos os
repositories**, porque eles são compartilhados entre áreas — o de eventos serve Calendário e Evento,
o de materiais serve Evento e Matérias), `shared/`, `notifications/`, `rotas.dart`, `main.dart`,
`app.dart`, e um **esqueleto** de cada tela da tabela abaixo. Depois, **as áreas**, em paralelo:
cada uma substitui os esqueletos das suas telas pela tela real, mais testes e helpers puros da área
(ex.: `features/calendario/mes.dart`).

Área não edita `core/`, `data/`, `shared/`, `notifications/` nem `rotas.dart`. Faltou algo lá?
Não edite: registre em `docs/PENDENCIAS.md` na seção da sua área e contorne localmente.

Os helpers de view-model compartilhados do Ionic (`features/evento-vm.ts` — `eventoVm`,
`diaPorExtenso`, `assinatura` — e `features/material-vm.ts` — `materialVm`) são da fundação, em
`lib/shared/evento_vm.dart` e `lib/shared/material_vm.dart`.

## Rotas — interface fixa

Cada tela é uma classe com **exatamente** este nome, arquivo e construtor. A fundação cria o
esqueleto; a área troca o corpo e mantém a assinatura.

**Fora das abas, sem guarda**

| Caminho | Classe e construtor | Arquivo | Área |
|---|---|---|---|
| `/login` | `LoginPage()` | `features/auth/login_page.dart` | auth |
| `/cadastro` | `CadastroPage()` | `features/auth/cadastro_page.dart` | auth |
| `/entrar-turma` | `EntrarTurmaPage()` | `features/auth/entrar_turma_page.dart` | auth |
| `/recuperar` | `RecuperarPage()` | `features/auth/recuperar_page.dart` | auth |
| `/senha/reset?token=` | `RedefinirPage({String? token})` | `features/auth/redefinir_page.dart` | auth |

**Abas** — `StatefulShellRoute.indexedStack`, 5 ramos. Aba 1 e aba 4 dependem do tipo de conta
(spec `nucleo-http-e-navegacao`): aluno vê Home e Meu quadro; docente vê Painel e Turma.

| Ramo | Caminho | Classe | Arquivo | Área |
|---|---|---|---|---|
| 0 | `/tabs/home` (aluno) | `HomePage()` | `features/home/home_page.dart` | home |
| 0 | `/tabs/painel` (docente) | `PainelPage()` | `features/painel/painel_page.dart` | docente |
| 1 | `/tabs/calendario` | `CalendarioPage()` | `features/calendario/calendario_page.dart` | calendario |
| 2 | `/tabs/materias` | `MateriasPage()` | `features/materias/materias_page.dart` | materias |
| 3 | `/tabs/quadro` (aluno) | `QuadroPage()` | `features/quadro/quadro_page.dart` | notas-e-quadro |
| 3 | `/tabs/turma` | `TurmaPage()` | `features/turma/turma_page.dart` | turma |
| 4 | `/tabs/perfil` | `PerfilPage()` | `features/perfil/perfil_page.dart` | perfil-e-ajustes |

**Telas empurradas por cima das abas** (`parentNavigatorKey` = navegador raiz). As que começam com
o caminho de uma aba são sub-rotas dela; as demais são rotas de topo. Literais antes de parâmetros
(`nova` antes de `:id`).

| Caminho | Classe e construtor | Arquivo | Área |
|---|---|---|---|
| `/tabs/materias/nova` | `NovaMateriaPage()` | `features/materias/nova_materia_page.dart` | materias |
| `/tabs/materias/:id` | `MateriaPage(id: …)` | `features/materias/materia_page.dart` | materias |
| `/tabs/materias/:id/editar` | `NovaMateriaPage(materiaId: …)` | (mesmo arquivo) | materias |
| `/tabs/materias/:id/material/novo` | `NovoMaterialPage(materiaId: …)` | `features/materias/novo_material_page.dart` | materias |
| `/tabs/materiais/:id/editar` | `EditarMaterialPage(id: …)` | `features/materias/editar_material_page.dart` | materias |
| `/tabs/materiais/:id/resumo` | `ResumoPage(materialId: …)` | `features/materias/resumo_page.dart` | materias |
| `/tabs/eventos/novo?tipo=&materiaId=` | `NovoEventoPage(tipo: …, materiaId: …)` | `features/evento/novo_evento_page.dart` | evento |
| `/tabs/eventos/:id` | `EventoPage(id: …)` | `features/evento/evento_page.dart` | evento |
| `/tabs/eventos/:id/editar` | `NovoEventoPage(eventoId: …)` | (mesmo arquivo) | evento |
| `/tabs/eventos/:id/anexar` | `AnexarMaterialPage(eventoId: …)` | `features/evento/anexar_material_page.dart` | evento |
| `/tabs/notas/nova?dia=` | `NovaNotaPage(dia: …)` | `features/notas/nova_nota_page.dart` | notas-e-quadro |
| `/tabs/notas/:id/editar` | `NovaNotaPage(notaId: …)` | (mesmo arquivo) | notas-e-quadro |
| `/tabs/turma/editar` | `EditarTurmaPage()` | `features/turma/editar_turma_page.dart` | turma |
| `/tabs/turma/transferir` | `TransferirPage()` | `features/turma/transferir_page.dart` | turma |
| `/tabs/admin` | `AdminPage()` | `features/admin/admin_page.dart` | docente |
| `/tabs/ajustes` | `AjustesPage()` | `features/ajustes/ajustes_page.dart` | perfil-e-ajustes |

Assinaturas completas: `RedefinirPage({String? token})`, `NovaMateriaPage({String? materiaId})`,
`NovoEventoPage({String? eventoId, String? tipo, String? materiaId})`,
`NovaNotaPage({String? notaId, String? dia})`; as demais com `id`/`materiaId`/`eventoId`/`materialId`
são `required String`.

**Guardas** (spec `auth`, tela `/`): sem sessão → `/login`; com sessão e sem turma →
`/entrar-turma`; `/tabs` sem resto → `/tabs/painel` se docente, senão `/tabs/home`;
`/tabs/home` e `/tabs/quadro` são só de aluno (docente vai ao painel); `/tabs/painel` só de docente.
**Rota desconhecida** → `/tabs` (o Ionic não tinha coringa; aqui tem).

**Voltar**: no Ionic, 16 botões voltar têm destino fixo para quando não há histórico. Aqui:
`context.canPop() ? context.pop() : context.go(<destino do spec>)`.

## Acesso aos serviços

```dart
final s = Servicos.of(context);   // s.api, s.auth, s.armazenamento, s.turmaAtiva, s.abas, s.notificacoes
```

Repositories são criados pela fundação dentro de `Servicos` (um campo por área, `s.home`,
`s.materias`…). O construtor recebe `ApiClient` e o que mais precisar; nada de singleton global —
os testes montam `Servicos` com um `http.Client` falso (`MockClient` de `package:http/testing.dart`).

## Rede — ApiClient

Reproduz os quatro interceptores do Ionic, na mesma ordem lógica:

1. **Authorization**: `Bearer <jwt>` sempre que houver token, **exceto** se o caminho contém `/auth/`.
2. **X-Turma-Id**: só para conta docente (tipoConta presente e ≠ `ALUNO`) e só se houver turma ativa
   do mesmo dono. Aluno nunca envia.
3. **Teto de 75 s** por requisição. Estourar vira `ErroApi.demorou`.
4. **Tradução de erro** — toda falha vira `ErroApi` com a frase pronta para a tela:

| Situação | Classe | Mensagem |
|---|---|---|
| sem rede (SocketException etc.) | OFFLINE | `Sem conexão.` |
| teto de 75 s | DEMOROU | `O servidor demorou demais para responder. Tente de novo.` |
| 401 | AUTH | detail do servidor ?? `Sua sessão expirou. Entre de novo.` |
| 403 | PROIBIDO | detail ?? `Só quem criou pode editar.` |
| 404 | NAO_ENCONTRADO | detail ?? `Isso não existe mais.` |
| 409 | CONFLITO | detail ?? `Alguém editou isso enquanto você editava.` (recarregarRegistro = true) |
| 428 | PRECONDICAO | detail ?? `Recarregue o registro e tente de novo.` |
| ≥ 500 | SERVIDOR | `Deu problema no servidor. Tente de novo.` — **sempre esta, nunca o detail** |
| outro | DESCONHECIDO | detail ?? `Não deu para completar a ação.` |

`detail` do ProblemDetail tem prioridade sobre `title`; corpo pode vir vazio ou em HTML — aí não há
"detail do servidor" e vale a frase padrão. `podeTentarNovamente` = true em OFFLINE, DEMOROU e 5xx.

Efeitos colaterais, como no interceptor Angular:
- **401** → `auth.encerrarSessao()` e navegar para `/login`.
- **404 com `codigo == 'SEM_TURMA'`** → `auth.registrarTurma(null)` e navegar para `/entrar-turma`.
- Sempre relança o `ErroApi`. Quem chamou decide o que mostrar.

`GET /saude` no boot é chamada crua, sem teto e sem tratar erro — só acorda o servidor.

`mensagemDeErro(Object e)`: `ErroApi` → `e.message`; qualquer outra coisa →
`Não deu para completar a ação. Tente de novo.`

**Proibido**: `catch` vazio, ou `catch` que transforma falha em lista vazia. Um repository que falha
deixa `erro` preenchido e **mantém** os dados anteriores; nunca devolve `[]` como se fosse sucesso.

## Telas

- Toda tela de lista tem **três estados que não podem se parecer**: carregando, erro e vazio.
  Vazio = carregou, sem erro, e não há nada. Copie as frases dos estados vazios do spec.
- **Recarregar ao voltar para a tela.** O Ionic recarrega em `ionViewWillEnter`; aqui:
  (a) cada página de aba escuta `s.abas` e recarrega quando a aba dela fica visível;
  (b) depois de `await context.push(...)` voltar, a página que empurrou recarrega.
  Na primeira abertura, uma carga só — não duas.
- Texto visível: **copie literalmente** do spec, com acentos. Não traduza nem reescreva.
- A ordem das listas vem do servidor. Não ordene, não filtre, não corte no cliente (não-negociável 5).
- Formulários: botão desabilitado enquanto envia; rótulo muda conforme o spec ("Entrando…",
  "Acordando o servidor…" após 4 s via `Espera`).

## Persistência

Mesmas chaves do Ionic, mesmo formato JSON: `pf.sessao` `{jwt, usuario, turmaId}`,
`pf.snapshot` `{eventos, materias, ultimoSync}`, `pf.turmaAtiva` `{usuarioId, turmaId, nome}`.
JSON inválido no disco: logar, apagar a chave e seguir como se não existisse — nunca derrubar o app.

## Testes

Cada área porta os comportamentos listados em `testes` do spec dela. Prioridade: repositories
(com `MockClient`) e funções puras. Widget test para os estados carregando / erro / vazio de cada
lista. `flutter test` precisa passar inteiro.

## Definição de pronto de uma área

1. `flutter analyze` sem issues.
2. Os testes da área passam.
3. Toda tela e todo endpoint do `docs/spec/<area>.json` existem.
4. Cada item de `armadilhas` foi tratado — ou registrado em `docs/PENDENCIAS.md` com o motivo.
