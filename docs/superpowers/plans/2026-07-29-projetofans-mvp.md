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

**Tarefas 10, 11 e 12 estão BLOQUEADAS** até `app/src/app/shared/` existir (entrega do Claude). Não comece: você não tem os componentes visuais e improvisá-los viola os não-negociáveis 7 e 8 do `AGENTS.md`.

```
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8       backend completo, sem bloqueio
              9                      app core (paralelo a 5-8 se quiser)
                    [design: shared/]
              10 → 11 → 12           wiring das telas
```

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

# TAREFAS BLOQUEADAS

> **NÃO EXECUTE 10, 11 ou 12** até `app/src/app/shared/` existir com os componentes visuais.
>
> Eles são entregues pelo Claude, não por você. Improvisar UI aqui viola os não-negociáveis 6, 7 e 8 do `AGENTS.md`, e o review vai rejeitar.
>
> Ao chegar aqui com `shared/` ainda vazio: registre no log que as tarefas 1-9 fecharam e que 10-12 aguardam o design. Pare.

## Task 10: Wiring da Home e do Calendário

Consome `HomeRepository` (Task 9) e os componentes `EventoItemComponent` e `MateriaChipComponent` de `shared/`.

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

## Self-review deste plano

**Cobertura do spec** — cada seção do spec tem tarefa: Seção 4 arquitetura → 1; Seção 5 schema → 2; Seção 6.1 Home → 5; Seção 6.2 endpoints → 3,4,5,6,7,8; Seção 7 asserções R1-R20 → mapeadas nos testes nomeados; Seção 8 storage local → 9; Seção 9 design → fora do escopo do Codex, por decisão; Seção 10 erros → 3 (backend) e 9 (frontend); Seção 11 config → 1 e 3; Seção 12 testes → todas; Seção 13 fora de escopo → Global Constraints.

**Asserções sem tarefa:** R4 (material tem tipo, separado na UI) cai na Task 11, que está bloqueada — é a única asserção do spec que não fecha nas tarefas desbloqueadas, e é esperado, porque é uma regra de apresentação.

**Consistência de tipos:** `ItemHomeResponse` (Java, Task 5) e `ItemHome` (TS, Task 9) têm os mesmos campos com os mesmos nomes. `AutoriaResponse`/`Autoria` idem. `PayloadSync.tipo` é sempre `"sync"`, e é o que o app espera na Task 12.

**Contagem de testes das tarefas desbloqueadas:** 1 + 4 + 13 + 23 + 9 + 6 + 11 + 7 + 6 = **80 testes**.
