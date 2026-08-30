# projetoFans — Plano de Implementação (MVP)

> **Para o agente executor (Codex):** leia `AGENTS.md` na raiz **antes** de tocar em qualquer arquivo. Pegue **a próxima tarefa não concluída**, faça **só ela**, registre em `docs/LOG.md` e pare.

**Goal:** App onde uma turma mantém, junta, provas, entregas e o material dado em cada aula — com aviso na véspera.

**Architecture:** Backend Spring Boot dono de toda regra de negócio (a Home é calculada no servidor, não no cliente); front Ionic/Angular como vitrine com cache local; notificação da véspera é **local** no aparelho, disparada por reagendamento após data-push do FCM.

**Tech Stack:** Java 21 · Spring Boot 3.x · Maven · Postgres · Flyway · JUnit 5 + Testcontainers · Ionic 8 · Angular 20 (standalone + signals) · Capacitor · Firebase Admin SDK (só FCM).

**Fontes de verdade:** produto → `docs/HANDOFF-v2.md` · técnica → `docs/superpowers/specs/2026-07-29-projetofans-design.md` (referida abaixo como **spec**).

---

## Nota sobre a densidade deste plano

Este plano especifica **exaustivamente**: caminho de arquivo, assinatura de método, nome de teste, comportamento esperado e comando de aceite. Ele traz **código completo** nos pontos onde a implementação ingênua viola um não-negociável ou é sutil: ordenação da Home, escopo de turma, locking otimista, predicados de visibilidade e o reagendador de notificações.

Ele **não** transcreve boilerplate (entidade JPA, controller CRUD trivial) — para esses, a lista de campos e a assinatura são exatas e a implementação é mecânica. Se em algum ponto você não souber o que fazer, isso é uma falha do plano: registre em `docs/LOG.md` sob "Travas / dúvidas" em vez de adivinhar.

---

## Global Constraints

Valem para **toda** tarefa. Violação é rejeição no review, mesmo com teste verde.

- **Java 21**, Spring Boot **3.x**, build **Maven** (`./mvnw`).
- **Angular 20** com componentes **standalone** e **signals**. Nenhum `NgModule` novo.
- **Postgres**. Migrations **Flyway**, numeradas, **nunca editadas depois de aplicadas**.
- **UUID** como PK em toda tabela. Nunca auto-increment.
- **`turma_id` presente em todo fato compartilhado** (`materia`, `evento`, `material`).
- **`turma_id` nunca é filtrado à mão em controller.** Só via `TurmaScopeResolver`.
- **Entidade JPA nunca cruza a fronteira do controller.** Sempre DTO.
- **Exclusão é sempre lógica** (`excluido_em`). Nenhum `DELETE` físico em `evento` ou `material`.
- **Erro sai como `ProblemDetail`** (RFC 7807) via `@ControllerAdvice` único.
- **Nenhum `catch` vazio, e nenhum `catch` que devolva lista vazia como sucesso.** Confundir "não há provas" com "falhou ao buscar provas" é o pior bug possível neste app.
- **Nenhum segredo hardcoded.** Tudo por variável de ambiente (spec, Seção 11).
- **Timezone da aplicação:** `America/Sao_Paulo`. Hora da notificação da véspera: `19:00`, constante `NOTIFICACAO_HORA_VESPERA`.
- **Zona proibida:** `app/src/app/shared/` contém componentes visuais entregues prontos. Não crie, não altere, não "melhore". Faltando algo, registre no log.
- **Nunca implemente** nada da lista "Proibido implementar" do `AGENTS.md`.

### Contrato de erro HTTP

| Situação | Status |
|---|---|
| Registro de **outra turma** (qualquer verbo) | **404** — você não tem direito de saber que existe |
| Registro da **sua turma**, você não é o autor, tentou editar/excluir | **403** |
| Ação de moderação por quem não é `LIDER` | **403** |
| `PATCH` sem header `If-Match` | **428** |
| `PATCH` com `version` divergente | **409** |
| Validação de payload | **400** |

---

## Estrutura de arquivos

```
backend/
├── pom.xml
├── docker-compose.yml                    Postgres para dev
├── src/main/resources/
│   ├── application.yml                   perfis: dev, test, prod
│   └── db/migration/
│       ├── V1__schema_inicial.sql
│       └── V2__seed_dev.sql              só no perfil dev
└── src/main/java/com/projetofans/
    ├── ProjetoFansApplication.java
    ├── config/       ClockConfig, JacksonConfig, CorsConfig
    ├── domain/       Turma Usuario Membro Materia Evento Material
    │                 EventoMaterial EstadoPessoal Revisao AcaoModeracao DeviceToken
    │                 + enums PapelMembro TipoEvento TipoMaterial AcaoRevisao AcaoModeracaoTipo
    ├── repo/         um repository por agregado
    ├── service/      AuthService TurmaService EventoService MaterialService
    │                 HomeService EstadoPessoalService ModeracaoService
    │                 RevisaoService SyncService
    ├── web/
    │   ├── controller/   um por recurso
    │   ├── dto/          request/response, records
    │   └── ProblemDetailHandler.java     @ControllerAdvice único
    ├── security/     JwtFilter JwtService TurmaScopeResolver UsuarioAtual
    │                 GoogleTokenVerifier (interface) + impl
    └── notify/       Notifier (interface) FcmNotifier PayloadSync

app/
├── capacitor.config.ts
└── src/app/
    ├── core/            api.service.ts auth.service.ts storage.service.ts
    │                    http-error.interceptor.ts auth.interceptor.ts
    ├── data/            models.ts evento.repository.ts materia.repository.ts
    │                    material.repository.ts home.repository.ts
    │                    quadro.repository.ts sync.repository.ts
    ├── features/        home/ calendario/ materias/ quadro/
    ├── shared/          ZONA PROIBIDA — entregue pronto pelo Claude
    └── notifications/   reagendador.ts (função pura) notificacoes.service.ts
```

---

## Ordem e dependências

**Tarefas 1 a 9 não dependem de nada externo.** Nenhuma conta no Google, Firebase, SMTP ou Postgres gerenciado é necessária — tudo tem fake ou fallback local. Pode executar em sequência, sem parar para perguntar.

**Tarefas 10, 11 e 12 foram DESBLOQUEADAS em 2026-08-22:** `app/src/app/shared/` existe com
`MateriaChip`, `EventoCard`, `AulaCard`, `MiniCard`, `MaterialLinha` e `Nota`. A pasta continua
sendo zona proibida — ligar dado nos componentes, nunca alterá-los.

**Tarefas 13 a 16 são V2**, escritas em 2026-08-26 para cobrir o que o design abriu depois do
plano original: grade de aulas, anotações e envio de arquivo. Também não dependem de conta
nenhuma — `FakeArmazenamento` cobre o R2 em dev e teste.

```
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8       backend completo, sem bloqueio
              9                      app core (paralelo a 5-8 se quiser)
              10 → 11 → 12           wiring das telas (desbloqueado)
13 → 14                              grade e anotacoes (backend V2)
15                                   envio de arquivo (independente de 14)
                    9 + 13-15 → 16   wiring da grade, anotacoes e envio
```

**Estado real em 2026-08-30** — ver `docs/LOG.md`: **1 e 2 fechadas** (7/7 testes verdes),
3 a 16 não começadas. O bloqueio de Docker que segurou a Task 2 por 27 dias foi resolvido trocando
Testcontainers por Postgres embutido: **nenhuma tarefa deste plano precisa mais de Docker**, e o
critério de aceite de todas elas é `cd backend && ./mvnw test`. Ver `docs/STACK.md`.

**A próxima tarefa não concluída é a Task 3.**

---

# TAREFAS DESBLOQUEADAS

---

## Task 1: Scaffold do monorepo e as 4 telas vazias

**Files:**
- Create: `backend/pom.xml`, `backend/docker-compose.yml`, `backend/src/main/resources/application.yml`
- Create: `backend/src/main/java/com/projetofans/ProjetoFansApplication.java`
- Create: `backend/src/test/java/com/projetofans/SmokeTest.java`
- Create: `app/` (via Ionic CLI), `app/capacitor.config.ts`
- Create: `app/src/app/features/{home,calendario,materias,quadro}/*.page.ts`
- Modify: `app/src/app/app.routes.ts`, o componente de tabs
- Create: `.gitignore` na raiz

**Interfaces produzidas:** nenhuma lógica. Entrega dois artefatos que sobem.

- [ ] **Step 1: Gerar o backend**

Spring Initializr via Maven, ou monte à mão. Dependências exatas no `pom.xml`: `spring-boot-starter-web`, `spring-boot-starter-data-jpa`, `spring-boot-starter-validation`, `spring-boot-starter-security`, `flyway-core`, `postgresql`, `spring-boot-starter-test`, `org.testcontainers:postgresql`, `org.testcontainers:junit-jupiter`, `io.jsonwebtoken:jjwt-api/impl/jackson`, `com.google.firebase:firebase-admin`, `com.google.api-client:google-api-client`.

Package base: `com.projetofans`. Java 21.

- [ ] **Step 2: `docker-compose.yml` para o Postgres de dev**

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: projetofans
      POSTGRES_USER: projetofans
      POSTGRES_PASSWORD: dev
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
volumes:
  pgdata:
```

- [ ] **Step 3: `application.yml` com três perfis**

`dev` aponta para o docker-compose e liga o seed. `test` deixa Testcontainers assumir. `prod` lê tudo de env var, sem default. `spring.jpa.hibernate.ddl-auto: validate` em **todos** os perfis — o schema é do Flyway, nunca do Hibernate.

Defaults obrigatórios: `app.timezone: America/Sao_Paulo`, `app.notificacao-hora-vespera: "19:00"`.

- [ ] **Step 4: Escrever o teste de fumaça (falha primeiro)**

```java
@SpringBootTest
@Testcontainers
class SmokeTest {
    @Container @ServiceConnection
    static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:16");

    @Test
    void contextoSobe() { }
}
```

- [ ] **Step 5: Rodar e verificar que falha**

Run: `cd backend && ./mvnw test -Dtest=SmokeTest`
Expected: FAIL — sem `ProjetoFansApplication` ou sem datasource.

- [ ] **Step 6: Criar a classe de aplicação e fazer passar**

Run: `cd backend && ./mvnw test -Dtest=SmokeTest`
Expected: PASS.

- [ ] **Step 7: Gerar o app Ionic**

```bash
npm install -g @ionic/cli
ionic start app tabs --type=angular --capacitor
```

Depois: converter para standalone se o template não vier assim, e reduzir para **4 abas** — Home, Calendário, Matérias, Meu quadro. Cada página é um componente standalone com só um título. **Sem conteúdo, sem placeholder, sem card de exemplo.**

`capacitor.config.ts`: `appId: 'com.projetofans.app'`, `appName: 'projetoFans'`.

- [ ] **Step 8: Verificar as 4 abas**

Run: `cd app && npm start`
Expected: 4 abas navegáveis, cada uma mostrando seu título. Nada além disso.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold do monorepo com backend Spring Boot e app Ionic de 4 abas"
```

**Critério de aceite:** `./mvnw test` verde no backend; `npm start` no app abre e navega entre as 4 abas.

---

## Task 2: Schema, entidades e seed

**Files:**
- Create: `backend/src/main/resources/db/migration/V1__schema_inicial.sql`
- Create: `backend/src/main/resources/db/migration/V2__seed_dev.sql`
- Create: `backend/src/main/java/com/projetofans/domain/*.java` (11 entidades + 5 enums)
- Create: `backend/src/main/java/com/projetofans/repo/*.java`
- Create: `backend/src/test/java/com/projetofans/domain/SchemaTest.java`

**Interfaces produzidas:** todas as entidades e repositories. Tudo depois disso consome.

- [ ] **Step 1: Escrever `V1__schema_inicial.sql`**

Copie o DDL **literalmente** da Seção 5 do spec. Ele já está completo e correto, incluindo:
- o `CHECK usuario_tem_credencial` (senha_hash OU google_sub)
- o índice único parcial `membro_um_lider_por_turma`
- o índice parcial `evento_feed`
- o `CHECK material_tem_conteudo`

Não "melhore" o DDL. Se algo parecer errado, registre no log.

- [ ] **Step 2: Escrever os testes de schema (falham primeiro)**

Quatro testes, cada um verificando uma garantia que o **banco** dá — não a aplicação:

```java
@Test void naoPermiteDoisLideresNaMesmaTurma()      // espera DataIntegrityViolationException
@Test void naoPermiteUsuarioSemNenhumaCredencial()  // espera DataIntegrityViolationException
@Test void naoPermiteSiglaDuplicadaNaMesmaTurma()   // espera DataIntegrityViolationException
@Test void permiteMesmaSiglaEmTurmasDiferentes()    // espera sucesso
```

O terceiro e o quarto juntos são o que prova que a unicidade é **por turma**, não global — é o que mantém a porta aberta para múltiplas turmas depois.

- [ ] **Step 3: Rodar e verificar que falham**

Run: `./mvnw test -Dtest=SchemaTest`
Expected: FAIL — entidades não existem.

- [ ] **Step 4: Criar as entidades JPA**

Uma classe por tabela do spec Seção 5, com os campos exatos e os mesmos nomes. Notas obrigatórias:

- `@Version` no campo `version` de `Evento` e `Material` — é isso que faz o locking otimista funcionar.
- `EventoMaterial` tem `@EmbeddedId` composto de `(eventoId, materialId)`.
- `EstadoPessoal` tem `@EmbeddedId` composto de `(usuarioId, eventoId)`.
- Enums Postgres mapeados como `@Enumerated(EnumType.STRING)` com `@JdbcTypeCode(SqlTypes.NAMED_ENUM)`.
- `Revisao.snapshot` é `JSONB` → `@JdbcTypeCode(SqlTypes.JSON)` sobre um `String` ou `JsonNode`.
- **Nenhuma entidade tem campo `feito`.** Se você escrever um, apagou o não-negociável 3.

- [ ] **Step 5: Rodar e verificar que passam**

Run: `./mvnw test -Dtest=SchemaTest`
Expected: PASS, 4 testes.

- [ ] **Step 6: Escrever `V2__seed_dev.sql`**

Uma turma, código de convite `TURMA01`, quatro matérias com sigla e cor da paleta, **dois** usuários e **dois** membros — um com papel `LIDER` e um com `ALUNO`.

Os dois membros são obrigatórios: sem um `LIDER` no seed, os endpoints de moderação da Task 7 ficam impossíveis de testar à mão; sem um `ALUNO`, os testes de 403 ficam impossíveis.

Cores das quatro matérias: use `#2563EB`, `#DC2626`, `#059669`, `#7C3AED`.

- [ ] **Step 7: Verificar o seed**

Run: `docker compose up -d && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev`
Expected: sobe sem erro. Confirme com `docker compose exec db psql -U projetofans -c "select papel, count(*) from membro group by papel;"` → uma linha `LIDER 1` e uma `ALUNO 1`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: schema Flyway, entidades JPA e seed de desenvolvimento"
```

**Critério de aceite:** migration roda em Postgres limpo; 4 testes de schema verdes; seed cria 1 turma, 4 matérias, 1 líder e 1 aluno.

---

## Task 3: Autenticação, entrada na turma e escopo

Esta é a tarefa mais importante do backend. `TurmaScopeResolver` nasce aqui, e é o componente que todas as tarefas seguintes usam para não vazar dado entre turmas.

**Files:**
- Create: `security/JwtService.java`, `security/JwtFilter.java`, `security/UsuarioAtual.java`
- Create: `security/TurmaScopeResolver.java`
- Create: `security/GoogleTokenVerifier.java` (interface) + `GoogleTokenVerifierImpl.java`
- Create: `service/AuthService.java`, `service/TurmaService.java`
- Create: `web/controller/AuthController.java`, `web/controller/TurmaController.java`
- Create: `web/ProblemDetailHandler.java`
- Create: `service/EmailSender.java` (interface) + `SmtpEmailSender.java` + `LogEmailSender.java`
- Create: `backend/src/test/java/com/projetofans/security/TurmaScopeTest.java`
- Create: `backend/src/test/java/com/projetofans/auth/AuthFlowTest.java`
- Create: `backend/src/test/java/com/projetofans/support/FakeGoogleTokenVerifier.java`

**Interfaces:**

*Consumes:* entidades e repositories da Task 2.

*Produces* — assinaturas exatas que as tarefas 4 a 8 vão usar:

```java
// security/UsuarioAtual.java — injetado nos controllers via @AuthenticationPrincipal
public record UsuarioAtual(UUID usuarioId, String nome) {}

// security/TurmaScopeResolver.java
public interface TurmaScopeResolver {
    /** Turma do usuário autenticado. Se houver mais de um vínculo, o mais recente. */
    UUID turmaDoUsuario(UUID usuarioId);

    /** Papel do usuário na turma dele. */
    PapelMembro papelDoUsuario(UUID usuarioId);

    /** Lança AcessoNegadoException(404) se o registro não pertence à turma do usuário. */
    void exigirMesmaTurma(UUID usuarioId, UUID turmaIdDoRegistro);
}

// service/EmailSender.java
public interface EmailSender {
    void enviarLinkResetSenha(String email, String token);
}

// security/GoogleTokenVerifier.java
public interface GoogleTokenVerifier {
    /** @return sub e email do token, ou lança TokenInvalidoException */
    GoogleIdentidade verificar(String idToken);
}
public record GoogleIdentidade(String sub, String email, String nome) {}
```

- [ ] **Step 1: Escrever `TurmaScopeTest` (falha primeiro)**

Estes quatro testes são a rede de segurança de todo o resto do backend:

```java
@Test void resolveTurmaDoUsuarioComUmVinculo()
@Test void comDoisVinculosPegaOMaisRecente()          // e loga aviso
@Test void exigirMesmaTurmaPassaQuandoIgual()
@Test void exigirMesmaTurmaLanca404QuandoDiferente()  // 404, NÃO 403
```

O último é o que impede vazamento de existência entre turmas. Se ele virar 403 algum dia, é regressão de segurança.

- [ ] **Step 2: Rodar e verificar que falham**

Run: `./mvnw test -Dtest=TurmaScopeTest`
Expected: FAIL — `TurmaScopeResolver` não existe.

- [ ] **Step 3: Implementar `TurmaScopeResolver`**

Único lugar do sistema que sabe resolver turma. Com dois vínculos, pega o de `entrou_em` mais recente e emite `log.warn` — múltiplas turmas está fora do escopo (spec Seção 13), e o aviso é para detectar se alguém implementou por engano.

- [ ] **Step 4: Rodar e verificar que passam**

Run: `./mvnw test -Dtest=TurmaScopeTest`
Expected: PASS, 4 testes.

- [ ] **Step 5: Escrever `AuthFlowTest` (falha primeiro)**

Nove testes cobrindo os dois caminhos de identidade e a entrada na turma:

```java
@Test void registraComEmailESenhaEDevolveJwt()
@Test void loginComSenhaCorretaDevolveJwt()
@Test void loginComSenhaErradaDevolve401()
@Test void registrarComEmailJaUsadoDevolve409()
@Test void loginPorGoogleCriaUsuarioNaPrimeiraVez()      // usa FakeGoogleTokenVerifier
@Test void loginPorGoogleReusaUsuarioNaSegundaVez()       // mesmo google_sub, mesmo id
@Test void esqueciSenhaDevolve204MesmoParaEmailInexistente()  // não é enumerável
@Test void entrarNaTurmaComCodigoValidoCriaMembroAluno()
@Test void entrarNaTurmaComCodigoInvalidoDevolve404()
```

O sétimo é requisito de segurança, não cortesia: resposta diferente para e-mail existente vazaria a lista de quem tem conta.

- [ ] **Step 6: Rodar, verificar que falham, implementar, verificar que passam**

Implementação: BCrypt para senha; JWT com `sub` = usuarioId e expiração; `JwtFilter` populando `UsuarioAtual`; token de reset de uso único com validade em tabela ou como JWT de escopo restrito.

`GoogleTokenVerifierImpl` usa `GoogleIdTokenVerifier` da lib oficial com `GOOGLE_OAUTH_CLIENT_ID`. **Em teste, injete `FakeGoogleTokenVerifier`** — você não precisa de projeto no Google Cloud para completar esta tarefa.

`EmailSender`: `LogEmailSender` ativo em dev e test (imprime o link no console); `SmtpEmailSender` em prod.

Run: `./mvnw test -Dtest=AuthFlowTest`
Expected: PASS, 9 testes.

- [ ] **Step 7: `ProblemDetailHandler`**

`@ControllerAdvice` único mapeando as exceções de domínio para os status da tabela em Global Constraints. Nenhum controller monta corpo de erro por conta própria.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: autenticacao por senha e Google, entrada na turma por convite e escopo de turma"
```

**Critério de aceite:** 13 testes verdes (4 de escopo + 9 de auth). Acesso a registro de outra turma resulta em 404. Nenhuma credencial real usada.

---

## Task 4: CRUD de evento e material, vínculo, locking e histórico

**Files:**
- Create: `service/EventoService.java`, `service/MaterialService.java`, `service/RevisaoService.java`
- Create: `web/controller/EventoController.java`, `web/controller/MaterialController.java`
- Create: `web/dto/` — `CriarEventoRequest`, `AtualizarEventoRequest`, `EventoResponse`, `AutoriaResponse`, e os equivalentes de material
- Modify: `repo/EventoRepository.java`, `repo/MaterialRepository.java` — adicionar os predicados de visibilidade
- Create: `backend/src/test/java/com/projetofans/evento/EventoCrudTest.java`
- Create: `backend/src/test/java/com/projetofans/evento/VinculoMaterialTest.java`

**Interfaces:**

*Consumes:* `UsuarioAtual`, `TurmaScopeResolver` (Task 3).

*Produces:*

```java
// Predicados de visibilidade — MÉTODOS NOMEADOS no repository.
// Nenhum controller ou service reescreve estas condições.
public interface EventoRepository extends JpaRepository<Evento, UUID> {

    @Query("""
        select e from Evento e
        where e.turmaId = :turmaId
          and e.visivelTurma = true
          and e.excluidoEm is null
        """)
    List<Evento> visiveisDaTurma(UUID turmaId);

    @Query("""
        select e from Evento e
        where e.autorId = :autorId
          and (e.visivelTurma = false or e.excluidoEm is not null)
        """)
    List<Evento> naoListadosDoAutor(UUID autorId);
}

// service/EventoService.java
public interface EventoService {
    EventoResponse criar(UsuarioAtual autor, CriarEventoRequest req);
    /** @throws NaoAutorException 403 se autor != usuario; ConflitoVersaoException 409 se version divergir */
    EventoResponse atualizar(UsuarioAtual usuario, UUID eventoId, int versionEsperada, AtualizarEventoRequest req);
    void excluirLogicamente(UsuarioAtual usuario, UUID eventoId, int versionEsperada);
    /** Inclui SOMENTE materiais vinculados. */
    EventoDetalheResponse buscar(UsuarioAtual usuario, UUID eventoId);
    void vincularMaterial(UsuarioAtual usuario, UUID eventoId, UUID materialId);
    void desvincularMaterial(UsuarioAtual usuario, UUID eventoId, UUID materialId);
}

// service/RevisaoService.java
public interface RevisaoService {
    void registrar(String registroTipo, UUID registroId, UUID autorId, AcaoRevisao acao, Object snapshotAnterior);
}

// Toda resposta de fato compartilhado carrega autoria. Sem exceção.
public record AutoriaResponse(UUID autorId, String autorNome, Instant criadoEm, Instant atualizadoEm) {}
```

- [ ] **Step 1: Escrever `EventoCrudTest` (falha primeiro)**

Onze testes. Cada um corresponde a uma asserção da Seção 7 do spec:

```java
@Test void alunoQualquerCriaEventoSemAprovacao()            // R10 — 201, sem status pendente
@Test void respostaSempreTrazAutorECriadoEm()               // R1
@Test void autorAtualizaComVersionCorreta()                 // 200
@Test void naoAutorRecebe403AoAtualizar()                   // R11
@Test void liderTambemRecebe403AoEditarEventoAlheio()       // R11 — líder NÃO edita conteúdo
@Test void patchSemIfMatchRecebe428()
@Test void patchComVersionDivergenteRecebe409()             // R18
@Test void eventoDeOutraTurmaRecebe404()                    // R17
@Test void excluirNaoRemoveLinhaDoBanco()                   // exclusão lógica
@Test void editarGravaRevisaoComSnapshotAnterior()          // R2
@Test void horaOpcionalAceitaNulo()                         // 6.6
```

O quinto merece atenção: é o teste que impede o líder de virar editor. Ele pode ocultar (Task 7), nunca alterar conteúdo alheio.

- [ ] **Step 2: Rodar, verificar falha, implementar, verificar passagem**

`atualizar` compara `versionEsperada` (do header `If-Match`) com a `version` atual e lança `ConflitoVersaoException` na divergência. `RevisaoService.registrar` é chamado **antes** de aplicar a mudança, com o estado anterior serializado.

Run: `./mvnw test -Dtest=EventoCrudTest`
Expected: PASS, 11 testes.

- [ ] **Step 3: Escrever `VinculoMaterialTest` (falha primeiro)**

```java
@Test void vinculaMaterialAoEvento()
@Test void buscarEventoDevolveApenasMateriaisVinculados()   // R5 — o teste central
@Test void materialNaoVinculadoNaoApareceNoEvento()         // R5, pelo negativo
@Test void desvincularRemoveDoEvento()
@Test void vincularMaterialDeOutraTurmaDevolve404()         // R17
@Test void vincularDuasVezesEIdempotente()                  // não estoura PK duplicada
```

O segundo e o terceiro juntos são o que garante a regra 6 do handoff: a tela de prova não despeja o semestre inteiro.

- [ ] **Step 4: Implementar e verificar**

Run: `./mvnw test -Dtest=VinculoMaterialTest`
Expected: PASS, 6 testes.

- [ ] **Step 5: Replicar para material**

`MaterialService` e `MaterialController` seguem exatamente o mesmo formato: autor-only, `If-Match`, exclusão lógica, revisão. Testes equivalentes em `MaterialCrudTest`.

Validação do DTO: `url` é **obrigatória** no MVP. `arquivo_ref` fica sempre nulo — upload está fora do escopo (`PERGUNTAS-ABERTAS.md` A4).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: CRUD de evento e material com autor-only, locking otimista, vinculo N:N e historico"
```

**Critério de aceite:** ~23 testes verdes. Nenhum `DELETE` físico no código. Toda resposta traz autoria.

---

## Task 5: A Home — teto, janela e ordenação no servidor

Tarefa curta e de altíssimo risco: três não-negociáveis vivem aqui. Trate os testes como especificação, não como verificação.

**Files:**
- Create: `service/HomeService.java`
- Create: `web/controller/HomeController.java`
- Create: `web/dto/ItemHomeResponse.java`
- Modify: `repo/EventoRepository.java`
- Create: `backend/src/test/java/com/projetofans/home/HomeServiceTest.java`

**Interfaces:**

```java
// service/HomeService.java
public interface HomeService {
    /** Máximo 6 itens, entre hoje e hoje+14, ordenados por urgência. */
    List<ItemHomeResponse> home(UsuarioAtual usuario);
}

public record ItemHomeResponse(
    UUID eventoId, TipoEvento tipo, String titulo,
    LocalDate data, LocalTime hora,          // hora pode ser null
    String materiaSigla, String materiaCorHex,
    AutoriaResponse autoria,
    boolean feitoPeloUsuario                 // vem de estado_pessoal, NÃO de evento
) {}
```

- [ ] **Step 1: Escrever `HomeServiceTest` (falha primeiro)**

Nove testes. Este bloco é a definição executável dos não-negociáveis:

```java
@Test void devolveNoMaximoSeisItens()                       // R6 — cadastre 10, espere 6
@Test void naoDevolveEventoDepoisDeQuatorzeDias()           // R7 — dia 15 fora
@Test void devolveEventoNoDecimoQuartoDia()                 // R7 — fronteira inclusiva
@Test void naoDevolveEventoPassado()                        // data < hoje fora
@Test void devolveEventoDeHoje()                            // fronteira inclusiva
@Test void ordenaPorDataCrescenteIndependenteDoTipo()       // R8 + proibição de agrupar
@Test void empateDeDataOrdenaPorHoraComNulosPorUltimo()     // R8
@Test void empateDeDataEHoraColocaProvaAntesDeEntrega()     // R8
@Test void semanaVaziaDevolveListaVazia()                   // R9 — sem preenchimento
```

**`ordenaPorDataCrescenteIndependenteDoTipo` é o mais importante do arquivo.** Monte assim: uma ENTREGA amanhã e uma PROVA em dez dias. O resultado **tem** de vir com a entrega primeiro. Se vier a prova, alguém agrupou por tipo — que a Seção 2.1 do handoff proíbe.

- [ ] **Step 2: Rodar e verificar que falham**

Run: `./mvnw test -Dtest=HomeServiceTest`
Expected: FAIL, 9 testes.

- [ ] **Step 3: Implementar a query**

Use exatamente esta ordenação. Ela é a Seção 6.1 do spec, e não é negociável:

```java
@Query(value = """
    select e.id, e.tipo, e.titulo, e.data_evento, e.hora_evento,
           m.sigla, m.cor_hex,
           e.autor_id, u.nome as autor_nome, e.criado_em, e.atualizado_em,
           coalesce(ep.feito, false) as feito
    from evento e
    join materia m on m.id = e.materia_id
    join usuario u on u.id = e.autor_id
    left join estado_pessoal ep on ep.evento_id = e.id and ep.usuario_id = :usuarioId
    where e.turma_id = :turmaId
      and e.visivel_turma
      and e.excluido_em is null
      and e.data_evento >= current_date
      and e.data_evento <= current_date + 14
    order by e.data_evento asc,
             e.hora_evento asc nulls last,
             case e.tipo when 'PROVA' then 0 else 1 end,
             e.criado_em asc
    limit 6
    """, nativeQuery = true)
List<Object[]> home(UUID turmaId, UUID usuarioId);
```

Três coisas para não errar:

O `LIMIT 6` fica **na query**, não num `.subList()` em Java — filtrar depois de trazer tudo funciona hoje e fica lento sem ninguém perceber.

O `case tipo` é o **terceiro** critério, atrás de data e hora. Movê-lo para o primeiro lugar transforma ordenação em agrupamento e quebra o não-negociável.

`feito` vem de `left join estado_pessoal` filtrado pelo usuário. **Nunca** de uma coluna em `evento` — não existe, e criar uma apaga o não-negociável 3.

- [ ] **Step 4: Verificar que passam**

Run: `./mvnw test -Dtest=HomeServiceTest`
Expected: PASS, 9 testes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: GET /home com janela de 14 dias, teto de 6 e ordenacao por urgencia no servidor"
```

**Critério de aceite:** 9 testes verdes. `LIMIT` está no SQL. O critério de tipo é o terceiro na cláusula `order by`.

---

## Task 6: Estado pessoal, Meu quadro e Não listados

**Files:**
- Create: `service/EstadoPessoalService.java`
- Create: `web/controller/QuadroController.java`
- Create: `web/dto/MeuQuadroResponse.java`, `web/dto/NaoListadosResponse.java`
- Create: `backend/src/test/java/com/projetofans/quadro/EstadoPessoalTest.java`

**Interfaces:**

```java
public interface EstadoPessoalService {
    void marcar(UsuarioAtual usuario, UUID eventoId, boolean feito);
    MeuQuadroResponse meuQuadro(UsuarioAtual usuario);
    /** Registros DO PRÓPRIO usuário que estão ocultos ou logicamente excluídos. */
    NaoListadosResponse naoListados(UsuarioAtual usuario);
}

public record MeuQuadroResponse(List<ItemHomeResponse> aFazer, List<ItemHomeResponse> feito) {}
```

- [ ] **Step 1: Escrever `EstadoPessoalTest` (falha primeiro)**

```java
@Test void marcarFeitoNaoAlteraNenhumaColunaDeEvento()      // R3 — o teste central
@Test void estadoDeAdoNaoApareceNoQuadroDeB()               // R16
@Test void marcarDuasVezesEIdempotente()
@Test void quadroSeparaAFazerDeFeito()
@Test void naoListadosSoMostraRegistrosDoProprioAutor()     // R15
@Test void naoListadosDeOutroAutorNaoAparece()              // R15, pelo negativo
```

**`marcarFeitoNaoAlteraNenhumaColunaDeEvento`** é o guardião do não-negociável 3. Implemente assim: leia a linha de `evento` inteira antes, marque feito, leia depois, compare tudo — inclusive `atualizado_em` e `version`. Nada pode ter mudado.

- [ ] **Step 2: Rodar, implementar, verificar**

Run: `./mvnw test -Dtest=EstadoPessoalTest`
Expected: PASS, 6 testes.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: estado pessoal isolado, Meu quadro e Nao listados"
```

**Critério de aceite:** 6 testes verdes. `evento` não tem coluna `feito` e não é tocado ao marcar.

---

## Task 7: Moderação do líder

**Files:**
- Create: `service/ModeracaoService.java`
- Create: `web/controller/ModeracaoController.java`
- Create: `backend/src/test/java/com/projetofans/moderacao/ModeracaoTest.java`

**Interfaces:**

```java
public interface ModeracaoService {
    void ocultar(UsuarioAtual lider, String registroTipo, UUID registroId, String motivo);
    void reexibir(UsuarioAtual lider, String registroTipo, UUID registroId);
    void pedirExclusao(UsuarioAtual lider, String registroTipo, UUID registroId, String motivo);
    /** Rebaixa o líder atual e promove o novo NA MESMA TRANSAÇÃO. */
    void transferirLideranca(UsuarioAtual lider, UUID novoLiderUsuarioId);
}
```

- [ ] **Step 1: Escrever `ModeracaoTest` (falha primeiro)**

```java
@Test void liderOcultaRegistro()                            // 200, visivel_turma = false
@Test void alunoRecebe403AoTentarOcultar()                  // R12
@Test void ocultarNaoAlteraAutorTituloNemData()             // R13 — só visibilidade
@Test void registroOcultoNaoApareceNaHome()                 // R14
@Test void registroOcultoNaoApareceNaTelaDeMateria()        // R14
@Test void registroOcultoApareceEmNaoListadosDoAutor()      // R15
@Test void registroOcultoNaoApareceEmNaoListadosDeOutro()   // R15
@Test void liderReexibeRegistro()
@Test void todaAcaoDeModeracaoGravaLinhaEmAcaoModeracao()
@Test void transferirLiderancaMantemExatamenteUmLider()     // R19
@Test void alunoRecebe403AoTentarTransferirLideranca()
```

**`ocultarNaoAlteraAutorTituloNemData` é o limite constitucional do papel.** Compare a linha antes e depois: só `visivel_turma` muda. Se `titulo` ou `data_evento` mudar, o líder virou editor e o não-negociável 10 caiu.

- [ ] **Step 2: Rodar, implementar, verificar**

`transferirLideranca` é transacional: rebaixa o atual para `ALUNO` e promove o novo para `LIDER` na mesma transação. Se rodar em duas transações, o índice único `membro_um_lider_por_turma` estoura no meio.

Run: `./mvnw test -Dtest=ModeracaoTest`
Expected: PASS, 11 testes.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: moderacao do lider com ocultar, reexibir, pedir exclusao e transferir lideranca"
```

**Critério de aceite:** 11 testes verdes. Ocultar muda só visibilidade. Sempre exatamente um líder por turma.

---

## Task 8: Push — device tokens, notifier e sync

**Files:**
- Create: `notify/Notifier.java`, `notify/FcmNotifier.java`, `notify/PayloadSync.java`
- Create: `backend/src/test/java/com/projetofans/support/FakeNotifier.java`
- Create: `service/SyncService.java`
- Create: `web/controller/DeviceController.java`, `web/controller/SyncController.java`
- Modify: `service/EventoService.java` — publicar após persistir
- Create: `backend/src/test/java/com/projetofans/notify/NotificacaoTest.java`

**Interfaces:**

```java
// notify/Notifier.java — SEMPRE via esta interface. Nunca chame o SDK do Firebase de um service.
public interface Notifier {
    /** Data-message para os aparelhos da turma, EXCETO o do autor. */
    void avisarMudancaNaTurma(UUID turmaId, UUID autorIdExcluido, PayloadSync payload);
}

public record PayloadSync(String tipo, Instant desde) {   // tipo é sempre "sync"
    public static PayloadSync agora(Instant t) { return new PayloadSync("sync", t); }
}

// service/SyncService.java
public interface SyncService {
    /** Delta desde o timestamp. Alimenta o reagendador local do app. */
    SyncResponse delta(UsuarioAtual usuario, Instant desde);
}

public record SyncResponse(
    List<EventoResponse> eventosAlterados,   // inclui os ocultos/excluídos, para o app remover
    List<MateriaResponse> materias,
    Instant servidorEm
) {}
```

- [ ] **Step 1: Escrever `NotificacaoTest` (falha primeiro)**

```java
@Test void criarEventoChamaNotifierUmaVez()                 // R20
@Test void notifierNaoRecebeOTokenDoProprioAutor()          // quem cadastrou já sabe
@Test void editarEventoChamaNotifier()
@Test void excluirEventoChamaNotifier()
@Test void syncDevolveEventosAlteradosDepoisDoTimestamp()
@Test void syncIncluiEventoOcultoParaQueOAppOReMova()       // senão fica fantasma no aparelho
@Test void registrarDeviceTokenDuasVezesNaoDuplica()
```

O sexto é sutil e importante: se o sync omitisse registros ocultos, o app manteria a notificação agendada para um evento que a turma não vê mais.

- [ ] **Step 2: Rodar, implementar, verificar**

`FakeNotifier` guarda as chamadas numa lista e é o bean ativo nos perfis `test` e `dev`. `FcmNotifier` só é criado quando `FCM_SERVICE_ACCOUNT_JSON` está presente — **esta tarefa fecha sem projeto Firebase**.

Run: `./mvnw test -Dtest=NotificacaoTest`
Expected: PASS, 7 testes.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: device tokens, notifier com data-push e endpoint de sync"
```

**Critério de aceite:** 7 testes verdes. Backend completo. Nenhuma chamada direta ao SDK do Firebase fora de `FcmNotifier`.

---

## Task 9: Core do app — http, auth, storage e repositories

Última tarefa desbloqueada. Nenhuma tela, nenhum componente visual: só a camada que as telas vão consumir depois.

**Files:**
- Create: `app/src/app/core/api.service.ts`, `auth.service.ts`, `storage.service.ts`
- Create: `app/src/app/core/auth.interceptor.ts`, `http-error.interceptor.ts`
- Create: `app/src/app/data/models.ts` e os seis repositories
- Create: `app/src/app/data/*.repository.spec.ts`

**Interfaces:**

```ts
// data/models.ts — espelha os DTOs do backend. Nomes idênticos aos das Tasks 4-8.
export type TipoEvento = 'PROVA' | 'ENTREGA';
export type TipoMaterial = 'AULA' | 'ADICIONAL';

export interface Autoria { autorId: string; autorNome: string; criadoEm: string; atualizadoEm: string; }

export interface ItemHome {
  eventoId: string; tipo: TipoEvento; titulo: string;
  data: string; hora: string | null;
  materiaSigla: string; materiaCorHex: string;
  autoria: Autoria; feitoPeloUsuario: boolean;
}

// core/storage.service.ts — Capacitor Preferences, um snapshot JSON por turma
export interface SnapshotLocal { eventos: ItemHome[]; materias: Materia[]; ultimoSync: string; }

export class StorageService {
  async ler(): Promise<SnapshotLocal | null>;
  async gravar(s: SnapshotLocal): Promise<void>;
  async limpar(): Promise<void>;
}

// data/home.repository.ts
export class HomeRepository {
  /** Chama GET /home. NÃO reordena, NÃO filtra, NÃO corta: a ordem e o teto vêm do servidor. */
  readonly itens = signal<ItemHome[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);
  async carregar(): Promise<void>;
}
```

- [ ] **Step 1: Escrever os testes dos repositories (falham primeiro)**

```ts
it('HomeRepository preserva a ordem que o servidor devolveu')
it('HomeRepository nao corta nem reordena a lista')
it('StorageService faz round-trip de snapshot')
it('interceptor de erro mapeia 401 para logout')
it('interceptor de erro mapeia 409 para conflito sinalizado')
it('erro de rede NAO devolve lista vazia como sucesso')
```

Os dois primeiros existem porque replicar ordenação ou teto no cliente é a violação mais provável desta camada. O último impede o pior bug possível do app: exibir "não há provas" quando a verdade é "falhei ao buscar as provas".

- [ ] **Step 2: Rodar, implementar, verificar**

`http-error.interceptor.ts` trata **todos** os status: 401 limpa token e navega para login; 403 propaga mensagem específica; 409 sinaliza conflito; 5xx mensagem genérica com retry; erro de rede marca `offline` e o repository serve o snapshot local **com a hora do último sync**, nunca como se fosse dado fresco.

Run: `cd app && npm test`
Expected: PASS, 6 testes.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: core do app com interceptors, storage local e repositories tipados"
```

**Critério de aceite:** 6 testes verdes. Nenhuma ordenação, filtro ou corte de lista no cliente. Nenhum `catch` que devolva lista vazia.

---

# TAREFAS DESBLOQUEADAS EM 2026-08-22

> `app/src/app/shared/` foi entregue. Estes são os componentes que existem, com os seletores reais:
>
> | componente | seletor | inputs |
> |---|---|---|
> | `MateriaChipComponent` | `app-materia-chip` | `cor`, `sigla` (ambos obrigatórios) |
> | `EventoCardComponent` | `app-evento-card` | evento de PROVA ou ENTREGA |
> | `AulaCardComponent` | `app-aula-card` | `materia`, `nome`, `hora`, `sala`, `detalhe?`, `atividade?` |
> | `MiniCardComponent` | `app-mini-card` | `materia`, `titulo`, `tipo`, `aviso?` |
> | `MaterialLinhaComponent` | `app-material-linha` | `tipo`, `titulo`, `autoria` |
> | `NotaComponent` | `app-nota` | `alcance`, `texto`, `autoria?` |
>
> **A pasta continua proibida.** Ligar dado, nunca alterar. Se faltar algo num componente,
> registre no log em vez de improvisar — improvisar UI viola os não-negociáveis 6, 7 e 8.

## Task 10: Wiring da Home e do Calendário

Consome `HomeRepository` (Task 9) e os componentes `EventoCardComponent` e `MateriaChipComponent` de `shared/`.

> **Correção de 2026-08-26:** o plano original citava `EventoItemComponent`, que nunca existiu.
> O componente entregue chama-se `EventoCardComponent`, seletor `app-evento-card`.

Sua responsabilidade é só ligar: `@for` sobre `home.itens()`, estados de carregando/erro/offline, e o estado vazio **que já vem pronto** de `shared/` — não escreva um.

Testes: a página renderiza na ordem do repository; estado vazio aparece com lista vazia; banner offline aparece com erro de rede.

## Task 11: Wiring de Matérias e da tela de evento

A tela de evento mostra **apenas os materiais vinculados** — o backend já garante isso (Task 4), e o cliente não deve buscar material por matéria nesta tela.

Teste obrigatório: material não vinculado não aparece na tela do evento.

## Task 12: Wiring de Meu quadro, Não listados e o reagendador

O reagendador é **função pura**, e é a única parte desta tarefa com risco real:

```ts
// notifications/reagendador.ts
export interface Agendamento { eventoId: string; dispararEm: Date; titulo: string; corpo: string; }

/**
 * Um agendamento por evento futuro, às `horaVespera` do dia anterior a `data`.
 * Ignora evento cujo disparo já passou. Ignora evento excluído ou oculto.
 */
export function calcularAgendamentos(
  eventos: ItemHome[], agora: Date, horaVespera: string, timezone: string
): Agendamento[];
```

Ela é pura de propósito: é onde um bug de notificação moraria, e como função pura cada caso é um teste de duas linhas em vez de um teste de integração com relógio falso.

Testes obrigatórios — cada um é um jeito real de errar:

```ts
it('agenda 19h do dia anterior')
it('ignora evento cujo disparo ja passou')
it('evento de hoje nao gera agendamento')         // véspera já passou
it('evento de amanha agenda para hoje 19h')
it('hora nula do evento nao afeta a hora do aviso')
it('evento oculto nao gera agendamento')
it('respeita America/Sao_Paulo e nao desloca por UTC')   // o bug classico
```

---

# TAREFAS V2 — o que o design abriu e o plano ainda não cobria

> Escritas em 2026-08-26. As telas v2 (`docs/design/telas-v2.html`, aprovadas) e a
> reversão da A4 introduziram três coisas que **não existem no schema V1 nem nas
> tarefas 1-12**: grade de aulas, anotações e envio de arquivo. Sem estas tarefas,
> metade dos componentes de `shared/` não tem de onde puxar dado.
>
> Dependência: **13 → 14** (backend), **15** independente de 14, **16** exige a 9.

---

## Task 13: Migration V2 — grade de aulas e anotações

**Files:**
- Create: `backend/src/main/resources/db/migration/V2__aula_e_anotacao.sql`
- Create: `domain/Aula.java`, `domain/AulaExcecao.java`, `domain/Anotacao.java`, `domain/AlcanceAnotacao.java`
- Create: `repo/AulaRepository.java`, `repo/AulaExcecaoRepository.java`, `repo/AnotacaoRepository.java`
- Modify: `backend/src/test/java/com/projetofans/domain/SchemaTest.java`

**Não edite `V1__schema_inicial.sql`.** Ela já foi aplicada; a regra do `AGENTS.md` vale.

**Schema:**

```sql
CREATE TABLE aula (
  id             UUID        PRIMARY KEY,
  turma_id       UUID        NOT NULL REFERENCES turma(id),
  materia_id     UUID        NOT NULL REFERENCES materia(id),
  dia_semana     SMALLINT    NOT NULL,   -- 1=segunda .. 7=domingo (ISO-8601, igual a DayOfWeek)
  hora_inicio    TIME        NOT NULL,
  hora_fim       TIME        NOT NULL,
  sala           TEXT        NOT NULL,
  autor_id       UUID        NOT NULL REFERENCES usuario(id),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  version        INTEGER     NOT NULL DEFAULT 0,
  visivel_turma  BOOLEAN     NOT NULL DEFAULT true,
  excluido_em    TIMESTAMPTZ NULL,
  CONSTRAINT aula_dia_valido       CHECK (dia_semana BETWEEN 1 AND 7),
  CONSTRAINT aula_horario_coerente CHECK (hora_fim > hora_inicio)
);
CREATE INDEX aula_grade ON aula (turma_id, dia_semana, hora_inicio);

-- Feriado, cancelamento e troca de sala. Sem esta tabela a Home mente no primeiro
-- feriado, e mentir sobre onde a pessoa precisa estar agora e o pior erro desta tela.
CREATE TABLE aula_excecao (
  id         UUID        PRIMARY KEY,
  aula_id    UUID        NOT NULL REFERENCES aula(id),
  data       DATE        NOT NULL,
  cancelada  BOOLEAN     NOT NULL DEFAULT false,
  sala_nova  TEXT        NULL,
  motivo     TEXT        NULL,
  autor_id   UUID        NOT NULL REFERENCES usuario(id),
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT aula_excecao_faz_algo CHECK (cancelada OR sala_nova IS NOT NULL),
  CONSTRAINT aula_excecao_unica    UNIQUE (aula_id, data)
);

CREATE TABLE anotacao (
  id             UUID        PRIMARY KEY,
  turma_id       UUID        NOT NULL REFERENCES turma(id),
  autor_id       UUID        NOT NULL REFERENCES usuario(id),
  alcance        TEXT        NOT NULL,
  texto          TEXT        NOT NULL,
  data           DATE        NULL,   -- opcional: anotacao presa a um dia, ou solta
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  version        INTEGER     NOT NULL DEFAULT 0,
  excluido_em    TIMESTAMPTZ NULL,
  CONSTRAINT anotacao_alcance_valido CHECK (alcance IN ('TURMA','PESSOAL'))
);
CREATE INDEX anotacao_turma   ON anotacao (turma_id, data DESC) WHERE alcance = 'TURMA';
CREATE INDEX anotacao_pessoal ON anotacao (autor_id, data DESC) WHERE alcance = 'PESSOAL';
```

**Uma tabela `anotacao`, não duas.** O log de 2026-08-21 propôs `anotacao` + `anotacao_pessoal`
separadas, citando o não-negociável 3. É leitura errada do não-negociável: ele proíbe **estado
pessoal dentro de fato compartilhado** — `feito` como coluna de `evento`. Anotação pessoal não é
estado sobre fato alheio; é registro próprio, com autor próprio. Além disso `shared/tipos.ts` já
congelou `AlcanceNota = 'TURMA' | 'PESSOAL'` como **um** tipo, e o componente `Nota` recebe
`alcance` como input — duas tabelas contradiriam o componente entregue. Custo se eu estiver
errado: uma migration separando a tabela enquanto ela está vazia. Barato.

**`anotacao` não tem `visivel_turma`.** `alcance` já responde quem vê. Duas colunas para a mesma
pergunta divergem no primeiro bug.

- [ ] **Step 1: Escrever os testes em `SchemaTest` (falham primeiro)**

```java
@Test void aulaNaoAceitaDiaSemanaForaDe1a7()
@Test void aulaNaoAceitaHoraFimAntesDoInicio()
@Test void aulaExcecaoNaoAceitaDuasLinhasParaMesmaAulaEData()
@Test void anotacaoNaoAceitaAlcanceInvalido()
@Test void anotacaoNaoTemColunaVisivelTurma()   // information_schema, igual ao eventoNaoTemColunaFeito
```

- [ ] **Step 2: Rodar, implementar entidades e repositories, verificar**

Run: `cd backend && ./mvnw test -Dtest=SchemaTest`
Expected: PASS, **11 testes** (os 6 que já existiam + 5).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(backend): schema V2 com grade de aulas, excecoes e anotacoes"
```

**Critério de aceite:** 11 testes verdes. `V1` intocada. `anotacao` sem coluna de visibilidade.

---

## Task 14: API da grade e das anotações

**Files:**
- Create: `service/GradeService.java`, `service/AnotacaoService.java`
- Create: `web/controller/GradeController.java`, `web/controller/AnotacaoController.java`
- Create: `web/dto/AulaDoDiaResponse.java`, `web/dto/AnotacaoResponse.java`
- Create: `backend/src/test/java/com/projetofans/grade/GradeTest.java`
- Create: `backend/src/test/java/com/projetofans/anotacao/AnotacaoTest.java`

**Interfaces:**

```java
public interface GradeService {
    /** Aulas de um dia concreto, com excecao ja aplicada. Aula cancelada NAO aparece. */
    List<AulaDoDiaResponse> doDia(UsuarioAtual usuario, LocalDate dia);

    /** As proximas `limite` aulas a partir de agora, atravessando dias. A Home usa limite=3. */
    List<AulaDoDiaResponse> proximas(UsuarioAtual usuario, int limite);
}

public record AulaDoDiaResponse(
    UUID id, MateriaResponse materia, String nome,
    LocalDate data, LocalTime horaInicio, LocalTime horaFim,
    String sala,        // sala_nova da excecao quando houver
    String detalhe,     // motivo da excecao, ou null
    String atividade    // titulo do evento daquela materia naquele dia, ou null
) {}

public interface AnotacaoService {
    /** As de alcance TURMA mais as PESSOAIS do proprio usuario. Nunca as pessoais de outro. */
    List<AnotacaoResponse> doDia(UsuarioAtual usuario, LocalDate dia);
    AnotacaoResponse criar(UsuarioAtual usuario, AlcanceAnotacao alcance, String texto, LocalDate data);
}
```

**Os campos batem um a um com os inputs de `AulaCardComponent`** (`materia`, `nome`, `hora`,
`sala`, `detalhe`, `atividade`). De propósito: o wiring da Task 16 não deve traduzir nada.

**`agora` não vai no DTO.** O card tem estado "aula em andamento", mas flag calculada no servidor
chega velha — a resposta é cacheada, o app fica aberto, e às 10h05 ele ainda destaca a aula das 9h.
O servidor manda `horaInicio`/`horaFim`; a página compara com o relógio. Comparar relógio é
apresentação, não regra de negócio. O teto de 6 e a janela de 14 dias continuam no servidor —
esses **são** regra.

**Endpoints:**

```
GET  /api/v1/grade?dia=2026-08-26        -> List<AulaDoDiaResponse>
GET  /api/v1/grade/proximas?limite=3     -> List<AulaDoDiaResponse>
POST /api/v1/aulas                       -> cria linha da grade
POST /api/v1/aulas/{id}/excecoes         -> cancela ou troca sala num dia
GET  /api/v1/anotacoes?dia=2026-08-26    -> List<AnotacaoResponse>
POST /api/v1/anotacoes                   -> { alcance, texto, data? }
```

Escopo de turma sempre por `TurmaScopeResolver`. Registro de outra turma → **404**.

- [ ] **Step 1: Escrever os testes (falham primeiro)**

```java
// GradeTest
@Test void diaSemAulaRetornaListaVazia()                  // nao-negociavel 6
@Test void aulaCanceladaNaoApareceNoDia()
@Test void trocaDeSalaSubstituiASalaDaGrade()
@Test void excecaoDeOutroDiaNaoAfetaODiaConsultado()      // o off-by-one classico
@Test void aulaDeOutraTurmaRetorna404NaoLista()
@Test void proximasAtravessaODiaEMantemOrdemDeHorario()

// AnotacaoTest
@Test void anotacaoPessoalDeAdoNaoApareceParaB()          // o teste central
@Test void anotacaoDaTurmaApareceParaTodosDaTurma()
@Test void membroSemPapelDeLiderCriaAnotacaoDeTurma()     // nao-negociavel 9
@Test void soOAutorEditaAnotacao()                        // nao-negociavel 10
@Test void anotacaoDeOutraTurmaRetorna404()
```

**`membroSemPapelDeLiderCriaAnotacaoDeTurma` corrige uma contradição.** O log do design descreveu
a nota da turma como "lembrete do líder" e escreveu que isso "amplia o papel do líder: hoje ele só
modera, aqui passa a emitir". Colide de frente com o não-negociável 9 e com a A5. **O líder não
ganha poder nenhum aqui**: nota da turma é de qualquer membro, como qualquer outro registro.
"Do líder" no mockup descreve quem costuma escrever, não permissão.

- [ ] **Step 2: Rodar, implementar, verificar**

Run: `cd backend && ./mvnw test -Dtest='GradeTest,AnotacaoTest'`
Expected: PASS, 11 testes.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(backend): grade de aulas com excecoes e anotacoes de turma e pessoais"
```

**Critério de aceite:** 11 testes verdes. Nenhum `turma_id` filtrado à mão em controller.

---

## Task 15: Envio de arquivo — armazenamento pré-assinado

Fecha a A4, revertida em 2026-08-22. `material.arquivo_ref` deixa de ser sempre NULL. O comentário
na `V1` que diz o contrário fica lá — migration aplicada não se edita — e passa a estar
desatualizado de propósito; esta tarefa é a nota de rodapé dele.

**Files:**
- Create: `service/Armazenamento.java` (interface), `service/R2Armazenamento.java`, `service/FakeArmazenamento.java`
- Create: `web/controller/UploadController.java`
- Create: `web/dto/PreAssinarRequest.java`, `web/dto/PreAssinarResponse.java`, `web/dto/ConfirmarUploadRequest.java`
- Create: `backend/src/test/java/com/projetofans/upload/UploadTest.java`
- Modify: `application.yml` (bloco `armazenamento`), Seção 11 do spec (tabela de env)

**Interface:**

```java
public interface Armazenamento {
    /** URL de PUT de validade curta, sempre sob o prefixo tmp/. */
    UrlPreAssinada paraEnvio(UUID turmaId, String nomeArquivo, String mime, long tamanhoBytes);

    /** Valida e move de tmp/ para mat/. Retorna a chave definitiva (vai em arquivo_ref). */
    String confirmar(UsuarioAtual usuario, String chaveTmp);

    /** URL de GET de validade curta. O app nunca recebe credencial. */
    UrlPreAssinada paraLeitura(String chaveDefinitiva);
}
```

**Duas fases, sem `@Scheduled`.** Pré-assina → app faz PUT em `tmp/` → backend confirma e move
para `mat/`. O que ficar em `tmp/` morre por *lifecycle rule* do próprio bucket em 24h. Mesmo
motivo da decisão 2.3: host de tier gratuito hiberna, e job agendado em host dormindo não roda —
limpeza que depende do servidor acordado falha em silêncio.

**Limites, validados no servidor:** 15 MB; whitelist de MIME **e** de extensão, checados juntos.
Nunca confie no `Content-Type` que o cliente declara.

**Nada disto exige conta.** `FakeArmazenamento` (`@Profile({"dev","test"})`) grava em diretório
temporário e devolve URL `file:`. R2 só entra quando for rodar em aparelho real.

| Env | Para que | Sem ela |
|---|---|---|
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET` | credenciais S3-compatíveis | `FakeArmazenamento` |
| `ARMAZENAMENTO_MAX_BYTES` | teto por arquivo | default 15728640 |

- [ ] **Step 1: Escrever `UploadTest` (falha primeiro)**

```java
@Test void recusaArquivoAcimaDoTeto()
@Test void recusaMimeForaDaWhitelist()
@Test void recusaExtensaoQueNaoBateComOMimeDeclarado()   // o ataque: .exe dizendo image/png
@Test void preAssinarSempreEmiteChaveSobTmp()
@Test void confirmarMoveDeTmpParaMat()
@Test void confirmarChaveDeOutraTurmaRetorna404()        // 404, nao 403
@Test void materialComArquivoRefDispensaUrl()            // a CHECK da V1 aceita os dois caminhos
@Test void confirmarDuasVezesEIdempotente()
```

- [ ] **Step 2: Rodar, implementar, verificar**

Run: `cd backend && ./mvnw test -Dtest=UploadTest`
Expected: PASS, 8 testes.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(backend): envio de arquivo em duas fases com URL pre-assinada"
```

**Critério de aceite:** 8 testes verdes com `FakeArmazenamento`, sem nenhuma credencial de nuvem.

**Fora desta tarefa, de propósito:** cota por turma. Continua aberto na A4 — decisão de produto.

---

## Task 16: Wiring da grade, das anotações e do envio

**Depende da Task 9** (core do app: http, auth, storage, repositories).

**Files:**
- Create: `core/repositories/grade.repository.ts`, `anotacao.repository.ts`, `upload.repository.ts`
- Create: `core/grade/aula-em-andamento.ts`, `core/upload/comprimir-imagem.ts`
- Create: `features/anotacao/anotacao.page.ts`
- Modify: `features/home/home.page.ts` (próximas 3 aulas), `features/calendario/calendario.page.ts` (dia expansível)

Os componentes já existem e **não se altera nenhum**: `AulaCard`, `Nota`, `MaterialLinha`,
`MateriaChip`. Ligar dado, só.

**A única parte com risco real é a de sempre — relógio. Função pura:**

```ts
/** True quando `agora` cai dentro de [inicio, fim). Fuso do aparelho, sem UTC no meio. */
export function aulaEmAndamento(agora: Date, inicio: string, fim: string): boolean;
```

- [ ] **Step 1: Escrever os testes (falham primeiro)**

```ts
it('aula em andamento e a unica com destaque')
it('exatamente na hora de inicio ja conta como em andamento')
it('exatamente na hora de fim ja nao conta')          // fronteira fechada-aberta
it('nenhuma aula em andamento fora do horario de aula')
it('dia sem aula mostra estado vazio, nao skeleton')  // nao-negociavel 6
it('nota da turma e nota pessoal usam o mesmo componente com alcances diferentes')
it('imagem acima de 2MB e comprimida antes do PUT')
it('falha no PUT nao chama confirmar')                // senao nasce material apontando para nada
```

- [ ] **Step 2: Rodar, implementar, verificar**

Run: `cd app && npx ng test --watch=false --browsers=ChromeHeadless && npx ng lint && npx ng build`
Expected: todos verdes, lint limpo, build completa.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(app): wiring da grade, anotacoes e envio de arquivo"
```

**Critério de aceite:** testes verdes, lint limpo, build passa, `shared/` sem uma linha alterada.

---

## Self-review deste plano

**Cobertura do spec** — cada seção do spec tem tarefa: Seção 4 arquitetura → 1; Seção 5 schema → 2; Seção 6.1 Home → 5; Seção 6.2 endpoints → 3,4,5,6,7,8; Seção 7 asserções R1-R20 → mapeadas nos testes nomeados; Seção 8 storage local → 9; Seção 9 design → fora do escopo do Codex, por decisão; Seção 10 erros → 3 (backend) e 9 (frontend); Seção 11 config → 1 e 3; Seção 12 testes → todas; Seção 13 fora de escopo → Global Constraints.

**Asserções sem tarefa:** R4 (material tem tipo, separado na UI) cai na Task 11, que está bloqueada — é a única asserção do spec que não fecha nas tarefas desbloqueadas, e é esperado, porque é uma regra de apresentação.

**Consistência de tipos:** `ItemHomeResponse` (Java, Task 5) e `ItemHome` (TS, Task 9) têm os mesmos campos com os mesmos nomes. `AutoriaResponse`/`Autoria` idem. `PayloadSync.tipo` é sempre `"sync"`, e é o que o app espera na Task 12.

**Contagem de testes das tarefas desbloqueadas:** 1 + 4 + 13 + 23 + 9 + 6 + 11 + 7 + 6 = **80 testes**.

---

## Self-review das tarefas V2 (2026-08-26)

**O que estas quatro tarefas fecham.** Todo componente entregue em `shared/` passa a ter origem
de dado: `AulaCard` ← Task 14, `Nota` ← Task 14, `MaterialLinha` ← Task 15 (arquivo) e Task 4
(link), `MiniCard`/`EventoCard`/`MateriaChip` ← tarefas 4-6 que já existiam. Antes destas
tarefas, três dos seis componentes não tinham de onde puxar nada.

**Consistência de tipos.** `AulaDoDiaResponse` (Java, Task 14) e os inputs de `AulaCardComponent`
(TS, já entregue) têm os mesmos nomes de campo. `AlcanceAnotacao` (Java) e `AlcanceNota` (TS)
têm os mesmos dois valores. `alcance` é sempre `"TURMA"` ou `"PESSOAL"`, nas duas pontas.

**Contradições que estas tarefas resolvem, e como:**

| contradição | resolução |
|---|---|
| Log do design propôs `anotacao` + `anotacao_pessoal`; `tipos.ts` tem um tipo só com `alcance` | uma tabela, `alcance` como coluna — Task 13 explica por que o não-negociável 3 não se aplica |
| Log do design disse que a nota da turma "amplia o papel do líder"; não-negociável 9 e A5 dizem que papel não dá poder | qualquer membro escreve nota de turma; teste nomeado na Task 14 |
| Task 10 citava `EventoItemComponent`, que não existe | corrigido para `EventoCardComponent` |
| `V1` comenta que `arquivo_ref` é sempre NULL; A4 foi revertida | Task 15 liga o campo; o comentário fica desatualizado porque migration aplicada não se edita |

**Contagem de testes das tarefas V2:** 5 + 11 + 8 + 8 = **32 testes**, sobre os 80 do plano
original. Total do plano fechado: 112.

**Risco que continua aberto e não é código.** A grade de aulas empurra o produto de *"o que foi
dado no período"* para *"grade horária"*. Se a faculdade já publica a grade e o diário eletrônico
já responde o que foi dado, as Tasks 13, 14 e 16 são trabalho duplicado com risco de divergir do
oficial. Isso é a C4 de `PERGUNTAS-ABERTAS.md`, e vale a pergunta à coordenação **antes** de
começar a Task 13 — é a tarefa que mais custa se a resposta for "já existe".
