# Stack — projetoFans

Decisões de tecnologia, com versão, motivo e o que já está de pé nesta máquina.

Atualizado em **2026-08-30**. Fonte de verdade técnica continua sendo
`docs/superpowers/specs/2026-07-29-projetofans-design.md`; este arquivo é o resumo operacional —
o que roda, com o quê, e o que ainda não.

---

## O resumo

| Camada | Escolha | Versão | Estado |
|---|---|---|---|
| Linguagem backend | Java | **17** | ✅ compila |
| Framework backend | Spring Boot | 3.5.3 | ✅ |
| Build | Maven (wrapper) | 3.9.x | ✅ |
| Banco | PostgreSQL | 16 | ✅ |
| Migrations | Flyway | (gerenciado pelo Boot) | ✅ V1 aplicada |
| Testes de banco | **embedded-postgres (Zonky)** | 2.0.7 / binário 16.2 | ✅ 7/7 verdes |
| Auth | JWT (jjwt) + Google Sign-In | jjwt 0.12.6 | ⬜ Task 3 |
| Push | Firebase Admin (só FCM) | 9.9.0 | ⬜ Task 8 |
| Arquivos | Cloudflare R2 (S3-compatível) | — | ⬜ Task 15 |
| App | Ionic + Angular standalone/signals | Ionic 8 / Angular 20 | ✅ build passa |
| Empacotamento | Capacitor | 8.5.0 | ✅ APK debug gera |

✅ de pé · ⬜ planejado, não começado

---

## Backend

**Java 17, não 21 nem 25.** O spec dizia 21. Está em 17 por um motivo de máquina, não de gosto:
o `JAVA_HOME` daqui aponta para `C:\Users\gh0st\dev-tools\jdk-17`, e o Maven usa o `JAVA_HOME`,
não o `java` do PATH. Há Zulu 25 e JDK 24 instalados, mas mexer no `JAVA_HOME` global afeta os
outros projetos Java desta máquina. 17 é a baseline do Spring Boot 3 e nada aqui usa recurso
exclusivo do 21 — sem virtual threads, sem pattern matching de switch.

> **Isto já quebrou uma vez.** Alguém subiu o pom para `<java.version>25</java.version>` e o build
> passou a falhar com `release version 25 not supported`, porque o Maven continuava rodando no 17.
> Ficou quebrado até 2026-08-30. Para usar 25 de verdade: aponte `JAVA_HOME` para o zulu-25
> **antes** de mudar o número no pom. O comentário no `pom.xml` repete este aviso.

**Entidade JPA nunca cruza o controller** — sempre DTO. É o que impede `senha_hash` de vazar por
acidente numa serialização automática.

**`ddl-auto: validate` em todos os perfis.** O schema é do Flyway. O Hibernate só confere se o que
ele espera bate com o que existe, e quebra se não bater. Migration aplicada nunca se edita: cria a
próxima.

---

## Banco e testes — a mudança de 2026-08-30

**Era Testcontainers. Virou Postgres embutido.**

O Docker Desktop desta máquina não sobe desde **2026-08-03**: o named pipe
`dockerDesktopLinuxEngine` não existe, a distro WSL `docker-desktop` fica em `Stopped`, e o app
parece travado numa tela de onboarding esperando alguém clicar. Testcontainers exige um daemon
Docker. Resultado: a suíte de testes **nunca rodou uma vez** entre 03/08 e 30/08 — 27 dias em que
nenhuma tarefa de backend conseguia atingir o próprio critério de aceite.

O substituto é `io.zonky.test:embedded-postgres`, que baixa e executa um **binário real do
Postgres 16**, sem daemon nenhum.

**Por que não H2 em modo de compatibilidade**, que seria ainda mais leve: este schema depende de
`CHECK` constraint, índice parcial com `WHERE`, `TIMESTAMPTZ` e de consultas a `information_schema`
— o teste `eventoNaoTemColunaFeito` literalmente lê o catálogo do banco. Um banco "quase
compatível" aprovaria coisas que o Postgres reprova, e reprovaria coisas que ele aceita. Suíte que
mente é pior que suíte que não roda.

**Para voltar ao Testcontainers** se o Docker um dia viver: trocar a dependência
`embedded-postgres` pelas três antigas (`spring-boot-testcontainers`, `testcontainers:postgresql`,
`testcontainers:junit-jupiter`) e restaurar `TesteComPostgres` do git. Nenhum teste muda.

**Rodar:**

```bash
cd backend && ./mvnw test
```

Primeira execução baixa ~40 MB de binários do Postgres. Depois é offline.

**Postgres para desenvolvimento** (não para teste) ainda é o `docker-compose.yml`, que continua
dependendo do Docker. Enquanto ele não subir, `-Dspring.profiles.active=dev` não tem banco. Isso
**não bloqueia nenhuma tarefa**, porque toda tarefa fecha com `./mvnw test`.

---

## Credenciais externas — nada bloqueia nenhuma tarefa

Todo serviço externo tem fake ou fallback. O plano inteiro, das tarefas 1 a 16, fecha sem uma
conta sequer.

| Precisa de | Para que | O que roda hoje no lugar |
|---|---|---|
| Google Cloud + OAuth Client ID | Google Sign-In | validador de token fake injetado |
| Firebase + service account | FCM data-push | `FakeNotifier` |
| Postgres gerenciado (Neon/Supabase/Railway) | rodar em aparelho real | Postgres embutido nos testes |
| SMTP (Brevo tem 300/dia grátis) | reset de senha | logger imprime o link no console |
| Cloudflare R2 | envio de arquivo | `FakeArmazenamento` em diretório temporário |

Elas viram necessárias só no aceite da Seção 8 — rodar em dois aparelhos de verdade.

**Uma escolha ainda aberta (B3):** onde a API roda em produção. Free tier que hiberna está ok — o
design já assume isso, e é por isso que a notificação da véspera é **local** no aparelho, não
empurrada pelo servidor. Só evite host que hiberne **e** cobre 30 s de cold start, senão cadastrar
evento fica desagradável.

---

## App

**Ionic 8 + Angular 20**, standalone components e signals. Sem `NgModule` novo.

**Nenhuma regra de negócio no componente.** Ordenação da Home, teto de 6 itens e janela de 14 dias
vêm prontos da API — ver não-negociável 5 no `AGENTS.md`. A exceção deliberada é comparar relógio
para marcar "aula em andamento": flag calculada no servidor chega velha, então o servidor manda
`horaInicio`/`horaFim` e a página compara. Isso é apresentação, não regra.

**`app/src/app/shared/` é zona proibida.** Os seis componentes visuais (`MateriaChip`,
`EventoCard`, `AulaCard`, `MiniCard`, `MaterialLinha`, `Nota`) são entregues prontos pelo design.
Tarefa de wiring liga dados neles; não os altera.

**Rodar:**

```bash
cd app && npx ng test --watch=false --browsers=ChromeHeadless && npx ng lint && npx ng build
```

**Android primeiro.** O código é Capacitor, então iOS compila, mas o design não foi feito em torno
das restrições dele — entrega de data-message em background no iOS é best-effort, e isso reabriria
parte do furo do push. Ver A7 em `PERGUNTAS-ABERTAS.md`.

---

## Armadilhas conhecidas desta arvore

**Esta máquina precisa de DOIS `JAVA_HOME` diferentes.** Não é preferência, é incompatibilidade
real, e já quebrou um build de cada lado:

| O que você roda | `JAVA_HOME` obrigatório | Por quê |
|---|---|---|
| Backend (`./mvnw`) | `dev-tools\jdk-17` | o `pom.xml` compila com `release 17` |
| Android (`./gradlew`) | `C:\Program Files\Zulu\zulu-25` | o Capacitor 8 compila com `source release 21` |

O `JAVA_HOME` global aponta para o 17, então o backend funciona sozinho e o Android **não**:

```
error: invalid source release: 21
```

É a mesma classe de erro que quebrou o backend quando o `pom` foi para Java 25 sem mexer no
`JAVA_HOME` — Maven e Gradle usam o `JAVA_HOME`, nunca o `java` do `PATH`. Não há JDK 21 nem 24
aqui, só 17 e 25; o Gradle 8.14.3 suporta oficialmente até o 24, mas **roda no 25** nesta
configuração, verificado com build completo. Detalhes em `docs/ANDROID.md`.

**O cache do Angular mente.** Em 2026-08-31 o `home.page.spec.ts` acusou falha num teste cujo
codigo-fonte estava correto: `vazia()` checava `erro() === null` no disco, mas o bundle
compilado ainda era o anterior, e a tela renderizava o estado vazio junto com o aviso de erro.
Instrumentar os sinais confirmou `erro = "Sem conexao."` no exato momento da assercao — fonte e
runtime discordando.

Se um teste do app falhar de um jeito que o codigo torna impossivel, **limpe o cache antes de
investigar**:

```bash
cd app && rm -rf .angular/cache && npx ng test --watch=false --browsers=ChromeHeadless
```

Custa 40 segundos e ja economizou uma sessao inteira de agente perseguindo bug que nao existia.

## Design

Tokens em `docs/design/design-system-v1.html`, validador em `docs/design/validar-paleta.mjs`.
Mockups navegáveis: `telas-v2.html` (chapado) e `telas-v3.html` (com profundidade, aprovado em
30/08). Fonte: Roboto. 12 hues de matéria, todas ≥ 4.5:1 com texto branco.

O Figma existe mas está pela metade — `https://www.figma.com/design/dj58VB52MRck2VoEQifptB` — e
travou na **cota MCP do plano Starter**. Não é paralelizável com agentes: a cota é da conta.

---

## Histórico de mudanças de stack

| Data | Mudança | Motivo |
|---|---|---|
| 2026-07-29 | Rota B: Spring Boot + Postgres gerenciado + FCM | decisão inicial, ver `HANDOFF-v2.md` |
| 2026-08-03 | Java 21 → 17 | `JAVA_HOME` da máquina; nada usa recurso do 21 |
| 2026-08-03 | Enum nativo do PG → `TEXT` + `CHECK` | atrito com `ddl-auto: validate`; e `ALTER TYPE` é pior que trocar constraint |
| 2026-08-22 | Upload entra no escopo, storage = Cloudflare R2 | egress grátis; API compatível com S3; A4 revertida |
| 2026-08-30 | Java 25 → 17 (reversão) | build quebrado: Maven roda no `JAVA_HOME`, não no PATH |
| 2026-08-30 | **Testcontainers → embedded-postgres** | Docker morto há 27 dias; suíte nunca tinha rodado |
