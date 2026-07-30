# Spec de design — projetoFans

- **Data:** 2026-07-29
- **Status:** aprovado pelo dono do projeto (decisões da Seção 6 do handoff fechadas)
- **Fonte de produto:** `docs/HANDOFF-v2.md` (o original está preservado como `docs/HANDOFF-v1-original.md`)
- **Nome:** `projetoFans` (provisório — ver `docs/PERGUNTAS-ABERTAS.md`)

Este documento é a fonte de verdade **técnica**. O handoff v2 é a fonte de verdade **de produto**. Onde eles divergirem, o handoff ganha em questão de regra de negócio e este spec ganha em questão de implementação.

---

## 1. O problema, em uma frase

A turma precisa saber, junta, o que cai na semana e o que foi dado em cada aula. O app vende *"o que foi dado no período"*, nunca *"o que vai cair na prova"*.

Consequência técnica direta: o dado é compartilhado entre dispositivos, então **não existe versão local-only**. Backend é requisito, não escolha.

---

## 2. Decisões fechadas

Todas as sete decisões abertas da Seção 6 do handoff foram resolvidas com o dono do projeto em 2026-07-29.

### 2.1 Stack (era 6.1)

**Rota B enxuta:** Spring Boot 3.x / Java 21 / Maven + Postgres gerenciado + FCM via Firebase Admin SDK. Front Ionic 8 + Angular 20 (standalone components + signals) + Capacitor.

Razões, em ordem de peso:

1. **O modelo de dados da Seção 3 é relacional.** Três regras do handoff seriam hostilizadas pelo Firestore: `EventoMaterial` é N:N de verdade (regra 5); `Revisao` é append-only auditável (regra 2); e a regra 3 proíbe gravar estado pessoal dentro do fato compartilhado — exatamente o oposto do idioma denormalizador do Firestore. Passar o projeto lutando contra a ferramenta numa regra não-negociável é custo recorrente, não custo de setup.
2. **O maior trunfo da Rota A é separável.** FCM não exige Firestore nem Firebase Auth. Dá para usar o push do Firebase e deixar o banco dele. Isso neutraliza a principal vantagem da Rota A.
3. **Portfólio.** Consequência, não premissa, mas real: a Rota A não gera artefato de backend.

**Restrição adicional do dono:** a arquitetura deve permitir expansão para uso por faculdades no futuro. Isso **não** altera o escopo do MVP (Seção 5 do handoff continua valendo — uma turma só). Altera quatro escolhas baratas agora:

- **UUID como PK** em vez de auto-increment: mesclar dados de instituições distintas depois não colide, e IDs não são enumeráveis. Custo hoje: zero.
- **`turma_id` em todo fato compartilhado**, inclusive `evento` e `material`, não só `materia`. O filtro futuro por turma ou instituição é uma cláusula `WHERE`, não uma reescrita de joins. Custo hoje: uma coluna.
- **`membro` como tabela N:N** em vez de `usuario.turma_id`. Não é especulação: a decisão 2.4 (entrada por convite) já exige um registro de vínculo com data. Como o vínculo tem de existir, dar a ele a forma N:N sai de graça.
- **Escopo de turma resolvido em um único componente** (`TurmaScopeResolver`), não espalhado por endpoint.

O nível `Instituicao` **não** é construído agora. Como tudo escopa via `turma_id`, adicioná-lo depois é uma migration com uma tabela e uma FK em `turma` — nenhuma query muda.

### 2.2 Backend obrigatório (era 6.2)

Confirmado. Sem ressalva.

### 2.3 Push (era 6.3)

O furo do handoff é real: push puramente local só dispara sobre dado que já está no aparelho, então um evento cadastrado 12h antes por um colega nunca gera alerta se o app não for aberto no intervalo.

**Solução: data-push no cadastro + reagendamento local.**

1. Autor cadastra, edita ou apaga um evento. O service persiste e publica um evento de domínio.
2. `FcmNotifier` envia **data-message** (sem UI própria) para os `device_token` da turma, exceto o do autor, com payload `{"tipo":"sync","desde":"<ISO-8601>"}`.
3. O app recebe em background, chama `GET /api/v1/sync?desde=`, grava no armazenamento local e **recalcula todos os agendamentos locais**.
4. A notificação em si é **local**, disparando às 19:00 (hora local) do dia anterior a `data_evento`.
5. O recálculo também roda em: foreground, login, e pull-to-refresh.

Por que o alerta é local e não remoto: hibernação do servidor não pode quebrá-lo (free tier hiberna, e um job `@Scheduled` às 19h simplesmente não roda num host dormindo — o não-negociável falharia em silêncio). O servidor só precisa estar acordado quando alguém está usando o app, que é exatamente quando ele está.

**Furo residual, documentado e aceito:** Android com o app em force-stop ou sob restrição agressiva de bateria pode não receber o data-message; o sync no foreground cobre com atraso. Em iOS, entrega de data-message em background é best-effort — se iOS entrar no escopo, será preciso somar uma notificação visível no cadastro. Ver `docs/PERGUNTAS-ABERTAS.md`.

### 2.4 Identidade e entrada na turma (era 6.4)

Duas coisas separadas de propósito:

- **Identidade:** conta criada por Google Sign-In **ou** por e-mail + senha. Livre, sem convite.
- **Vínculo com a turma:** exige o **código de convite** da turma.

Efeito colateral relevante: o código de convite passa a ser a fronteira de confiança, não o provedor de login. Por isso e-mail+senha com nome autodeclarado deixa de ser um furo — apenas quem tem o código está dentro da sala, e a autoria visível (regra 1) continua significando algo.

Consequência assumida: suportar e-mail+senha obriga a ter **recuperação de senha**. Sem isso, o primeiro aluno trancado fora vira suporte manual. Implementação: token de uso único com validade, enviado por SMTP de tier gratuito. É um endpoint e um template.

O backend valida o ID token do Google com a biblioteca oficial e emite **JWT próprio**. O app nunca fala com o backend usando o token do Google diretamente — só o JWT interno. Isso mantém uma única forma de autenticação nos endpoints, independente de como a pessoa entrou.

### 2.5 Edição e moderação (era 6.5)

- **Somente o autor edita ou exclui o próprio registro.**
- **O líder pode ocultar um registro da turma** e **pedir exclusão ao autor**.
- Se o autor não acata o pedido, o registro **permanece oculto para a turma e visível apenas para o autor**, numa área "Não listados".
- Exclusão é sempre **soft** (`excluido_em`), porque a regra 2 do handoff proíbe apagar histórico e "Não listados" precisa do registro existindo.

**Líder:** quem cria a turma vira `LIDER`. Um por turma — evita matriz de permissão e conflito entre moderadores agindo em sequência sobre o mesmo registro. O papel é transferível a outro membro, o que evita turma órfã se o líder sair ou trancar matéria. A transferência é registrada em `acao_moderacao`.

**Isto contradiz a Seção 4 do handoff original**, que veta "sem 'líder de turma'" pelo nome. O dono do projeto foi alertado, reafirmou a decisão, e a cláusula foi emendada no handoff v2 com data e justificativa. Ver Seção 3 deste spec.

**O que continua verdadeiro do não-negociável:** nada é aprovado antes de existir. Postar é livre, sem fila e sem aprovação prévia. O que existe é moderação **posterior ao fato**. Isso é testável e vira teste (Seção 12).

### 2.6 Data e hora do evento (era 6.6)

`data_evento` é **DATE, obrigatório**. `hora_evento` é **TIME, opcional**.

Razão: entrega costuma ter hora ("até 23:59") e prova tem horário de aula, mas obrigar hora faz o aluno inventar dado — e dado inventado corrói a confiança que é o único ativo do app.

Consequências:

- A notificação da véspera dispara em horário fixo, **19:00 local**, tenha o evento hora ou não. Constante única no código (`NOTIFICACAO_HORA_VESPERA`), um lugar para mudar.
- Quando existe, a hora aparece na UI e serve de desempate na ordenação.
- Timezone fixo em `America/Sao_Paulo` no MVP. A turma é local; internacionalizar agora seria custo sem beneficiário.

**Ordenação da Home, na íntegra** (é não-negociável, então está aqui como regra e não como sugestão):

1. `data_evento` crescente
2. `hora_evento` crescente, com nulos por último
3. `PROVA` antes de `ENTREGA`
4. `criado_em` crescente

Passo 3 existe só como desempate dentro do mesmo dia e horário. **Não é agrupamento por tipo** — a Seção 2.1 do handoff proíbe agrupar, e ordenar por data primeiro garante que um evento de amanhã venha antes de um de depois de amanhã independentemente do tipo.

### 2.7 Nome (era 6.7)

`projetoFans`, provisório. Package `com.projetofans.app`. Nome definitivo é pergunta aberta, mas não bloqueia nada além de rebranding cosmético depois.

---

## 3. Emenda ao handoff

A Seção 4 do handoff original diz:

> **Qualquer aluno posta.** Sem gatekeeper, sem aprovação, sem "líder de turma".

O handoff v2 substitui por:

> **Qualquer aluno posta.** Sem gatekeeper e sem aprovação: nenhum registro passa por fila ou revisão antes de existir e ficar visível.
> Moderação existe apenas **posterior ao fato**: o líder da turma pode ocultar um registro já publicado e pedir exclusão ao autor. Ele não pode editar registro alheio nem impedir a criação de nada.

Justificativa registrada: decisão explícita do dono do projeto em 2026-07-29, após ser alertado de que a cláusula original vetava o papel pelo nome. A parte do não-negociável que protege o fluxo de publicação foi preservada e virou teste automatizado.

Todo o resto da Seção 4 permanece intocado e continua não-negociável.

---

## 4. Arquitetura

Monorepo, dois artefatos:

```
Projeto Fans/
├── AGENTS.md              regras que o Codex lê antes de qualquer tarefa
├── backend/               Spring Boot — dono de TODA regra de negócio
├── app/                   Ionic + Angular + Capacitor
└── docs/
    ├── HANDOFF-v2.md      fonte de verdade de produto
    ├── plano-codex.md     tarefas ordenadas, uma por vez
    ├── LOG.md             log de progresso
    ├── PERGUNTAS-ABERTAS.md
    └── design/            design system e mockups (responsabilidade do Claude)
```

### 4.1 Camadas do backend

```
web/        controllers + DTOs        entidade JPA nunca cruza esta fronteira
service/    regra de negócio          teto de 6, janela de 14d, ordenação,
                                      autorização de edição, moderação
domain/     entidades JPA + enums
repo/       Spring Data JPA
security/   filtro JWT + TurmaScopeResolver
notify/     interface Notifier + FcmNotifier
```

Duas peças carregam o peso do design:

**`TurmaScopeResolver`** — ponto único de estrangulamento. Resolve a turma do usuário autenticado e é o único lugar que injeta `turma_id` em query. Nenhum controller monta filtro de turma à mão. É literalmente o arquivo que se altera para suportar múltiplas turmas ou instituições depois.

**`Notifier` como interface**, `FcmNotifier` como implementação. Teste roda com `FakeNotifier`, sem rede e sem credencial. Isto é o que permite entregar a tarefa de push ao Codex antes de existir projeto Firebase.

### 4.2 Camadas do app

```
core/            http client, auth, storage (Capacitor Preferences), interceptors
data/            repositories tipados + models
features/        home | calendario | materias | quadro
shared/          MateriaChipComponent, EventoItemComponent, BadgeAutoriaComponent
notifications/   LocalNotifications + PushNotifications + o reagendador
```

### 4.3 Onde vive a regra

**Toda regra de negócio vive no backend.** O app é uma vitrine com cache. Isso é decisão consciente, e a mais importante do documento — ver Seção 6.1.

---

## 5. Modelo de dados

Postgres. Migrations via Flyway, versionadas e nunca editadas depois de aplicadas.

```sql
CREATE TABLE turma (
  id              UUID PRIMARY KEY,
  nome            TEXT        NOT NULL,
  semestre        TEXT        NOT NULL,
  codigo_convite  TEXT        NOT NULL UNIQUE,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE usuario (
  id          UUID PRIMARY KEY,
  nome        TEXT        NOT NULL,
  email       TEXT        NOT NULL UNIQUE,
  senha_hash  TEXT        NULL,          -- NULL quando entrou por Google
  google_sub  TEXT        NULL UNIQUE,   -- NULL quando entrou por e-mail+senha
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT usuario_tem_credencial CHECK (senha_hash IS NOT NULL OR google_sub IS NOT NULL)
);

CREATE TYPE papel_membro AS ENUM ('ALUNO','LIDER','PROFESSOR');

CREATE TABLE membro (
  id          UUID PRIMARY KEY,
  usuario_id  UUID NOT NULL REFERENCES usuario(id),
  turma_id    UUID NOT NULL REFERENCES turma(id),
  papel       papel_membro NOT NULL DEFAULT 'ALUNO',
  entrou_em   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, turma_id)
);
-- um LIDER por turma
CREATE UNIQUE INDEX membro_um_lider_por_turma
  ON membro (turma_id) WHERE papel = 'LIDER';

CREATE TABLE materia (
  id         UUID PRIMARY KEY,
  turma_id   UUID NOT NULL REFERENCES turma(id),
  nome       TEXT NOT NULL,
  sigla      TEXT NOT NULL,
  cor_hex    TEXT NOT NULL,   -- restrito à paleta; validado na aplicação
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (turma_id, sigla)
);

CREATE TYPE tipo_evento AS ENUM ('PROVA','ENTREGA');

CREATE TABLE evento (
  id             UUID PRIMARY KEY,
  turma_id       UUID NOT NULL REFERENCES turma(id),
  materia_id     UUID NOT NULL REFERENCES materia(id),
  tipo           tipo_evento NOT NULL,
  titulo         TEXT        NOT NULL,
  data_evento    DATE        NOT NULL,
  hora_evento    TIME        NULL,
  autor_id       UUID        NOT NULL REFERENCES usuario(id),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  version        INTEGER     NOT NULL DEFAULT 0,
  visivel_turma  BOOLEAN     NOT NULL DEFAULT true,
  excluido_em    TIMESTAMPTZ NULL
);
CREATE INDEX evento_feed ON evento (turma_id, data_evento)
  WHERE visivel_turma AND excluido_em IS NULL;

CREATE TYPE tipo_material AS ENUM ('AULA','ADICIONAL');

CREATE TABLE material (
  id             UUID PRIMARY KEY,
  turma_id       UUID NOT NULL REFERENCES turma(id),
  materia_id     UUID NOT NULL REFERENCES materia(id),
  tipo           tipo_material NOT NULL,
  titulo         TEXT        NOT NULL,
  url            TEXT        NULL,
  arquivo_ref    TEXT        NULL,
  autor_id       UUID        NOT NULL REFERENCES usuario(id),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  version        INTEGER     NOT NULL DEFAULT 0,
  visivel_turma  BOOLEAN     NOT NULL DEFAULT true,
  excluido_em    TIMESTAMPTZ NULL,
  CONSTRAINT material_tem_conteudo CHECK (url IS NOT NULL OR arquivo_ref IS NOT NULL)
);
-- No MVP, upload de arquivo não está implementado (ver PERGUNTAS-ABERTAS.md A4),
-- então arquivo_ref é sempre NULL e o DTO de criação exige `url`.
-- A coluna e o CHECK existem para que ligar upload depois seja uma tarefa, não uma migration de dados.

-- vínculo N:N: é daqui que sai "o que estudar pra essa prova"
CREATE TABLE evento_material (
  evento_id      UUID NOT NULL REFERENCES evento(id),
  material_id    UUID NOT NULL REFERENCES material(id),
  vinculado_por  UUID NOT NULL REFERENCES usuario(id),
  vinculado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (evento_id, material_id)
);

-- estado pessoal: tabela separada, NUNCA coluna em evento
CREATE TABLE estado_pessoal (
  usuario_id  UUID    NOT NULL REFERENCES usuario(id),
  evento_id   UUID    NOT NULL REFERENCES evento(id),
  feito       BOOLEAN NOT NULL DEFAULT false,
  feito_em    TIMESTAMPTZ NULL,
  PRIMARY KEY (usuario_id, evento_id)
);

CREATE TYPE acao_revisao AS ENUM ('CRIAR','EDITAR','EXCLUIR');

CREATE TABLE revisao (
  id             UUID PRIMARY KEY,
  registro_tipo  TEXT  NOT NULL,      -- 'EVENTO' | 'MATERIAL'
  registro_id    UUID  NOT NULL,
  autor_id       UUID  NOT NULL REFERENCES usuario(id),
  em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  acao           acao_revisao NOT NULL,
  snapshot       JSONB NOT NULL
);
CREATE INDEX revisao_registro ON revisao (registro_tipo, registro_id, em DESC);

CREATE TYPE acao_moderacao_tipo AS ENUM
  ('OCULTAR','REEXIBIR','PEDIR_EXCLUSAO','TRANSFERIR_LIDERANCA');

CREATE TABLE acao_moderacao (
  id             UUID PRIMARY KEY,
  registro_tipo  TEXT  NULL,          -- NULL em TRANSFERIR_LIDERANCA
  registro_id    UUID  NULL,
  acao           acao_moderacao_tipo NOT NULL,
  lider_id       UUID  NOT NULL REFERENCES usuario(id),
  em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  motivo         TEXT  NULL
);

CREATE TABLE device_token (
  id             UUID PRIMARY KEY,
  usuario_id     UUID NOT NULL REFERENCES usuario(id),
  fcm_token      TEXT NOT NULL UNIQUE,
  plataforma     TEXT NOT NULL,       -- 'android' | 'ios' | 'web'
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 5.1 Quatro pontos não óbvios do schema

**`estado_pessoal` é tabela separada, e isso transforma a regra 3 do handoff numa garantia do banco.** Não existe coluna `feito` em `evento` para alguém preencher por engano. É a diferença entre uma regra escrita num documento e uma regra que o banco recusa violar.

**Exclusão é sempre soft.** A regra 2 diz que histórico não se apaga, e "Não listados" precisa do registro existindo. Nenhum `DELETE` em `evento` ou `material` no código de aplicação.

**Visibilidade é um predicado único, num lugar único:**

- Feed da turma: `turma_id = :turma AND visivel_turma AND excluido_em IS NULL`
- Não listados do autor: `autor_id = :eu AND (NOT visivel_turma OR excluido_em IS NOT NULL)`

Estes dois predicados são métodos nomeados no repository. Nenhum controller reescreve a condição.

**O índice parcial `membro_um_lider_por_turma`** garante "um líder por turma" no banco, não na aplicação. Transferência de liderança precisa ser transacional: rebaixa o atual e promove o novo na mesma transação.

---

## 6. API

Prefixo `/api/v1`. JSON. Autenticação por `Authorization: Bearer <jwt>` em tudo, exceto `auth/*`.

### 6.1 A decisão de API que mais importa

**`GET /api/v1/home` calcula a janela de 14 dias, a ordenação por urgência e o teto de 6 no servidor.** O cliente recebe uma lista pronta e renderiza na ordem que veio.

Razão: são três não-negociáveis da Seção 4. No servidor eles têm uma implementação e uma suíte de teste. No cliente, cada tela pode divergir com o tempo e ninguém percebe até a turma perder uma prova. Isso também transforma a tarefa correspondente do Codex num método de service testável, em vez de lógica espalhada em componente Angular — muito mais difícil de errar e muito mais fácil de revisar.

Query de referência:

```sql
SELECT e.*, m.sigla, m.cor_hex, u.nome AS autor_nome
FROM evento e
JOIN materia m ON m.id = e.materia_id
JOIN usuario u ON u.id = e.autor_id
WHERE e.turma_id = :turma
  AND e.visivel_turma
  AND e.excluido_em IS NULL
  AND e.data_evento >= CURRENT_DATE
  AND e.data_evento <= CURRENT_DATE + 14
ORDER BY e.data_evento ASC,
         e.hora_evento ASC NULLS LAST,
         CASE e.tipo WHEN 'PROVA' THEN 0 ELSE 1 END,
         e.criado_em ASC
LIMIT 6;
```

### 6.2 Endpoints

| Método | Rota | Notas |
|---|---|---|
| POST | `/auth/google` | `{idToken}` → `{jwt, usuario}`. Valida com lib oficial, emite JWT próprio |
| POST | `/auth/registrar` | `{nome, email, senha}` → `{jwt, usuario}` |
| POST | `/auth/login` | `{email, senha}` → `{jwt, usuario}` |
| POST | `/auth/senha/esqueci` | `{email}` → 204 sempre (não revela se o e-mail existe) |
| POST | `/auth/senha/reset` | `{token, novaSenha}` → 204 |
| POST | `/turmas` | cria turma; criador vira `LIDER`. Existe para uso real; o seed de dev cria uma turma pronta, e o seed **também** tem de criar um `membro` com papel `LIDER` — sem isso os endpoints de moderação ficam impossíveis de testar à mão |
| POST | `/turmas/entrar` | `{codigoConvite}` → `{membro}` |
| POST | `/turmas/lideranca/transferir` | `{novoLiderUsuarioId}`; só `LIDER`; transacional |
| GET | `/home` | 14d, teto 6, ordenado. Servidor decide |
| GET | `/eventos?de=&ate=` | alimenta o Calendário |
| POST | `/eventos` | qualquer membro. Sem aprovação |
| PATCH | `/eventos/{id}` | **só o autor**. Exige `If-Match: <version>` → 409 em conflito |
| DELETE | `/eventos/{id}` | **só o autor**. Soft delete |
| GET | `/eventos/{id}` | inclui **somente** materiais vinculados |
| POST | `/eventos/{id}/materiais/{materialId}` | cria vínculo N:N |
| DELETE | `/eventos/{id}/materiais/{materialId}` | remove vínculo |
| GET | `/materias` | com cor e sigla |
| POST | `/materias` | |
| GET | `/materias/{id}` | inclui materiais separados por tipo e eventos da matéria |
| POST | `/materiais` | |
| PATCH/DELETE | `/materiais/{id}` | **só o autor**; mesma regra de `version` |
| PUT | `/eventos/{id}/estado-pessoal` | `{feito}`. Grava em `estado_pessoal` |
| GET | `/meu-quadro` | a fazer / feito, do usuário autenticado |
| GET | `/nao-listados` | registros do autor ocultos ou soft-deletados |
| POST | `/moderacao/{tipo}/{id}/ocultar` | só `LIDER`. `{motivo?}` |
| POST | `/moderacao/{tipo}/{id}/reexibir` | só `LIDER` |
| POST | `/moderacao/{tipo}/{id}/pedir-exclusao` | só `LIDER`. Notifica o autor |
| POST | `/devices` | registra/atualiza `fcm_token` |
| DELETE | `/devices/{token}` | no logout |
| GET | `/sync?desde=` | delta para o reagendador local |

### 6.3 Regras transversais de API

- **Entidade JPA nunca sai pelo controller.** Sempre DTO. Isso evita vazar `senha_hash` por acidente e desacopla o schema do contrato.
- **Acesso a registro de outra turma retorna 404, não 403.** 403 confirmaria que o registro existe.
- **403 e 404 não são intercambiáveis, e a distinção é deliberada.** Registro de **outra turma** → 404, porque você não tem direito de saber que ele existe. Registro **da sua turma** que você não pode editar por não ser o autor → 403, porque você já o vê na Home e negar a existência seria mentira confusa. Regra prática: 404 quando o escopo de turma falha, 403 quando o escopo passa e a autorização falha.
- **`PATCH` exige `If-Match` com a `version`.** Ausência → 428. Divergência → 409. Isso impede perda silenciosa quando duas pessoas editam junto.
- **`POST /auth/senha/esqueci` retorna 204 mesmo para e-mail inexistente.** Não é enumerável.

---

## 7. Regras de negócio como asserções verificáveis

Cada linha vira ao menos um teste. Esta é a tradução dos não-negociáveis do handoff em algo que falha vermelho.

| # | Asserção |
|---|---|
| R1 | Todo `evento` e `material` tem `autor_id` e `criado_em` não nulos, e a API os devolve |
| R2 | Editar cria linha em `revisao` com snapshot anterior. Nada é perdido |
| R3 | Marcar `feito` não altera nenhuma linha de `evento`. Nenhuma coluna de estado pessoal existe em `evento` |
| R4 | `material.tipo` é `AULA` ou `ADICIONAL`, e a tela de matéria os apresenta separados |
| R5 | `GET /eventos/{id}` devolve exatamente os materiais em `evento_material` para aquele evento — nem um a mais |
| R6 | `GET /home` devolve no máximo 6 itens |
| R7 | `GET /home` devolve só itens com `data_evento` entre hoje e hoje+14 |
| R8 | `GET /home` devolve ordenado por (data, hora nulls last, PROVA antes de ENTREGA, criado_em) |
| R9 | `GET /home` de semana vazia devolve lista vazia. Nada de preenchimento |
| R10 | `POST /eventos` por membro `ALUNO` retorna 201 sem qualquer etapa de aprovação |
| R11 | `PATCH`/`DELETE` de evento alheio retorna 403, mesmo para `LIDER` |
| R12 | Moderação por `ALUNO` retorna 403 |
| R13 | `ocultar` não altera `autor_id`, `titulo` nem `data_evento` — só `visivel_turma` |
| R14 | Registro oculto não aparece em `/home`, `/eventos` nem `/materias/{id}` |
| R15 | Registro oculto aparece em `/nao-listados` **apenas** para o autor |
| R16 | `estado_pessoal` de A não aparece em `/meu-quadro` de B |
| R17 | Qualquer leitura de registro de outra turma retorna 404 |
| R18 | `PATCH` com `version` divergente retorna 409 |
| R19 | Existe no máximo um `LIDER` por turma (garantido por índice) |
| R20 | `POST /eventos` dispara exatamente uma chamada ao `Notifier` (verificado com `FakeNotifier`) |

---

## 8. Armazenamento local no app

**Capacitor Preferences**, com um snapshot JSON por turma, versionado por `ultimoSync`.

**Não SQLite.** O plugin adiciona complexidade de build nativo para um volume trivial — uma turma gera centenas de eventos por semestre, não centenas de milhares. Se passar de ~2000 eventos, revisar.

O snapshot existe por dois motivos: permitir agendar notificações locais (que precisam da lista de eventos no aparelho) e não mostrar tela branca quando offline.

---

## 9. Design system e linguagem visual

**Responsabilidade do Claude, não do Codex.** Decisão do dono do projeto: Codex é competente em plumbing e ruim em julgamento visual — ele geraria o card genérico do framework e passaria por cima justamente dos não-negociáveis visuais.

Entrega em duas fases:

1. **Mockup navegável** publicado como Artifact: paleta, tokens, as 4 telas em alta fidelidade, os estados vazios, e a prova de que prova se distingue de entrega em escala de cinza. Ajuste nesta fase custa minutos.
2. **Componentes Ionic/Angular reais** no repo, convertidos do mockup aprovado.

Codex recebe os componentes prontos e faz apenas o wiring: chamar o repository, ligar no signal, tratar loading e erro. Ele não tem liberdade para inventar UI.

### 9.1 As regras visuais, e como o código as torna invioláveis

**"Cor + sigla sempre. Nunca só bolinha colorida."** Não vai existir componente que renderize apenas a cor. Existe `MateriaChipComponent`, que renderiza cor **e** sigla, sempre juntas, e é o único jeito de mostrar uma matéria. A regra deixa de depender de disciplina e passa a depender da API do componente.

**`cor_hex` sai de uma paleta fixa de 12 cores com contraste validado.** O aluno escolhe da paleta, não digita hex. Isso evita amarelo em fundo branco e garante que o par cor/texto passe em contraste. Validado na aplicação, não só na UI.

**"Prova mais pesada visualmente que entrega" se resolve por peso de tinta, não por cor:**

- **Prova:** bloco **sólido**, preenchido no valor oposto ao da página (tinta no tema claro, papel no tema escuro), título em peso 700, glifo de tipo preenchido.
- **Entrega:** **contorno** de 1px, sem preenchimento, título em peso 600, glifo vazado.

**Isto substitui a ideia inicial de borda-esquerda-grossa,** por duas razões descobertas ao desenhar: borda grossa é uma diferença pequena demais para sobreviver a uma olhada de dois segundos, e é o clichê de card com trilho de acento. Bloco sólido contra contorno é a maior diferença de tinta disponível.

A cor **não pode** participar dessa distinção — ela já está ocupada identificando a matéria.

Critério de aceite verificável: *screenshot em escala de cinza ainda distingue prova de entrega*. O mockup em `docs/design/design-system-v1.html` tem um interruptor de escala de cinza que roda esse teste. Isso também faz o app funcionar para daltônicos — sigla, peso de tinta e forma do glifo são três canais redundantes, nenhum deles cromático.

### 9.3 A paleta, e o que o cálculo desmentiu

12 hues, todas com contraste ≥ 4.5:1 para texto branco sobre o preenchimento — verificado por `node docs/design/validar-paleta.mjs`, não afirmado.

As 12 ficam entre **L\* 37 e 47**. A intenção original era luminosidade única; isso não é alcançável ao longo da roda de cores mantendo hue reconhecível e o piso de contraste — âmbar e violeta não coexistem no mesmo L\* sem que um deles deixe de parecer âmbar ou violeta. Dez pontos de L\* é estreito o bastante para que nenhuma matéria pareça mais urgente que outra por acidente.

O chip é **preenchimento sólido da hue + texto branco, em qualquer ground e qualquer tema** — uma regra só, sem variante por tema, o que remove uma classe inteira de bug.

**Semana vazia mostra pouca coisa, e isso é informação.** O estado vazio da Home diz que não há nada nos próximos 14 dias. Não preenche com sugestão, dica, card promocional ou skeleton permanente. Este é o ponto onde o Codex mais tentaria "ajudar", então o estado vazio é entregue pronto por mim.

### 9.2 Onde vive "Não listados"

Seção recolhida **abaixo** do kanban em "Meu quadro", não uma terceira coluna — a Seção 2.4 do handoff especifica duas colunas, e isso é preservado literalmente. A seção só aparece se o autor tiver algum registro oculto, então a maioria dos usuários nunca a vê.

---

## 10. Tratamento de erro

**Backend:** `@ControllerAdvice` central devolvendo `ProblemDetail` (RFC 7807). 409 em conflito de `version`, 403 em edição por não-autor, 404 em cross-turma, 428 em `PATCH` sem `If-Match`.

**Frontend:** interceptor HTTP central.

- 401 → limpa token e volta para o login
- 403 → mensagem específica ("só quem criou pode editar")
- 409 → avisa "alguém editou isso" e recarrega o registro
- 5xx → mensagem genérica + botão de tentar novamente
- offline → banner "sem conexão, dados de \<hora do último sync\>". Nunca tela branca, nunca lista vazia disfarçada de "não há eventos"

**Proibido engolir erro.** Nenhum `catch` vazio, nenhum fallback que devolva lista vazia como se fosse sucesso. Um `catch` que não relança tem de logar e sinalizar na UI. Confundir "não há provas" com "falhou ao buscar provas" é o pior bug possível neste app.

---

## 11. Configuração externa

Tudo que depende de conta de terceiro sai como variável de ambiente com contrato definido, para que o Codex implemente e teste sem credencial real:

| Variável | Uso | Fallback em dev/teste |
|---|---|---|
| `DATABASE_URL` | Postgres | `docker-compose` local |
| `JWT_SECRET` | assinatura do JWT | valor de dev no `application-dev.yml` |
| `GOOGLE_OAUTH_CLIENT_ID` | validação do ID token | validador fake em teste |
| `FCM_SERVICE_ACCOUNT_JSON` | Admin SDK | `FakeNotifier` |
| `SMTP_*` | reset de senha | logger que imprime o link |
| `NOTIFICACAO_HORA_VESPERA` | default `19:00` | — |
| `APP_TIMEZONE` | default `America/Sao_Paulo` | — |

Consequência: **nenhuma tarefa do Codex fica bloqueada esperando conta ser criada.** Provisionar Google Cloud, Firebase, SMTP e Postgres gerenciado é etapa humana posterior, listada em `docs/PERGUNTAS-ABERTAS.md`.

---

## 12. Testes

**Backend:** JUnit 5 + Testcontainers Postgres. Um teste por asserção da Seção 7 e um teste por checkbox do aceite da Seção 8 do handoff. `Notifier` trocado por `FakeNotifier`.

**Frontend:** teste unitário nos repositories e no **reagendador de notificações**, escrito como função pura:

```
(eventos, agora, horaVespera) -> Agendamento[]
```

Função pura de propósito. É ali que um bug de notificação moraria — off-by-one de dia, timezone, evento no passado, evento hoje, hora nula, DST. Como função pura, cada um desses casos é um teste de duas linhas em vez de um teste de integração com relógio falso.

**E2E manual:** o checklist da Seção 8 em dois aparelhos reais. É o único critério de "pronto".

---

## 13. Fora de escopo

Não implementar, mesmo que pareça fácil (Seção 5 do handoff):

- Assinatura / monetização
- Resumo por IA
- Notas / boletim
- Integração com sistema da faculdade
- Suporte a múltiplas turmas
- Envio e correção de trabalho

**Detalhe importante sobre múltiplas turmas:** `membro` suporta N turmas por construção, mas **a API resolve exatamente uma turma por usuário no MVP**. Se um usuário tiver dois vínculos, `TurmaScopeResolver` pega o mais recente e loga aviso. Não existe seletor de turma na UI. A tabela está pronta; a feature não está.

---

## 14. Divisão de trabalho

**Claude:** decisões de arquitetura, modelo de dados, este spec, o plano, o design system e os componentes visuais, e review de tudo que o Codex produzir contra os não-negociáveis.

**Codex:** backend inteiro e o wiring das telas. Uma tarefa por vez, cada uma com os não-negociáveis anexados e critério de aceite verificável. Ver `docs/plano-codex.md`.

---

## 15. Riscos e furos aceitos

| Risco | Mitigação / status |
|---|---|
| Data-message não chega em Android force-stopped | Sync no foreground cobre com atraso. Documentado |
| Data-message em iOS background é best-effort | Se iOS entrar no escopo, somar notificação visível no cadastro. Pergunta aberta |
| Free tier hibernando | Alerta é local, não depende do servidor no horário. Resolvido por design |
| Líder abusa da moderação | Uma turma, pessoas que se conhecem, toda ação registrada em `acao_moderacao`. Aceito |
| Diário eletrônico da faculdade já resolve o problema | Seção 9 do handoff. Não bloqueia scaffold, bloqueia investir semanas. Pergunta aberta |
| Nome provisório | Rebranding depois é cosmético. Aceito |
