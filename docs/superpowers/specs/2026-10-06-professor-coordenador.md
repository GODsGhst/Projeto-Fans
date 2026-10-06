# Spec — papéis PROFESSOR e COORDENADOR

- **Data:** 2026-10-06
- **Status:** especificação, **não implementada**. Decisões do dono fechadas (Seção 1); o default de segurança da Seção 2.1 espera confirmação (A24).
- **Substitui:** a A5 de `docs/PERGUNTAS-ABERTAS.md` ("professor = nada"). A A9 continua de pé (nota da turma é de qualquer membro).
- **Emenda:** o não-negociável 10 e o item "múltiplas turmas" do `AGENTS.md`, e as Seções 4 e 5 do handoff (texto exato na Seção 11). O Codex não começa nenhuma tarefa daqui antes da PC0.
- **Depende de:** a guarda "um vínculo por pessoa" (`TurmaService.exigirSemTurma` + `UmaTurmaPorPessoaTest`), que estava **na árvore de trabalho, sem commit**, em 06/10. O próprio javadoc dela diz que professor e coordenador a reabrem; esta spec é essa revisão (Seção 5.2).

O handoff continua verdadeiro onde mais importa: **professor é contribuidor opcional, nunca requisito.** Uma turma sem nenhum professor funciona exatamente como hoje. Os poderes daqui são um acréscimo, não uma dependência.

---

## 1. Decisões do dono (fechadas — não re-litigar)

1. Professor se cadastra **já como professor**, com login próprio e **painel diferente** do aluno.
2. Professor dá aula em **várias turmas e disciplinas**. Nas disciplinas dele, nas turmas dele: põe datas de prova, entregas e materiais; **corrige datas** (edita evento de outra pessoa na matéria dele); **oculta** como um líder; tem **selo "Professor"**.
3. O poder vale **só na matéria dele**. Nas outras matérias da turma ele é aluno.
4. **Coordenador:** os mesmos poderes, mas na **turma inteira**, com selo próprio **"Coordenação"** (cor diferente). Também pode ter várias turmas.
5. **Apagar post alheio: não.** Professor e coordenador corrigem e ocultam, nunca excluem o que outra pessoa postou (confirmado em 06/10).
6. **Docente pode criar turma, mas a turma continua tendo um líder aluno** (06/10). Ver 2.7: o primeiro aluno que entrar vira líder.
7. **Painel próprio** para professor e coordenador, no lugar da Home e do Meu quadro (confirmado em 06/10).

## 2. Decisões desta spec, e o porquê

### 2.1 Conta docente nasce PENDENTE (default de segurança — pergunta A24)
Quem se cadastra como professor ou coordenador fica **pendente** até o admin da plataforma (o dono) aprovar. Até lá, **nos poderes funciona como aluno**: posta e vê tudo que aluno vê, mas não edita registro alheio, não oculta e não tem selo. O painel e as várias turmas valem desde o cadastro — ler não é poder, e é o que deixa o professor já arrumar as turmas dele enquanto espera.
**Por quê:** sem isso, qualquer aluno marca "sou professor" no cadastro e passa a editar e ocultar provas dos colegas. O código de convite prova que a pessoa é da turma; não prova que ela dá aula.

### 2.2 Aprovar é da CONTA; o poder exige também estar na turma
O admin aprova a pessoa uma vez. O poder numa turma exige, ao mesmo tempo: conta aprovada **e** vínculo na turma (entrou pelo código) **e** — para professor — a matéria declarada.
**Por quê:** aprovar turma a turma daria trabalho ao admin a cada semestre. E o admin não vê conteúdo de turma (regra da V6); ele decide quem a pessoa é, não onde ela manda.

### 2.3 Professor entra pelo código, como todo mundo, e declara as matérias
Não existe convite especial. O professor pega o código com a turma (qualquer membro vê e compartilha), entra, e marca na tela da turma quais matérias leciona. Sem fila: a declaração vale na hora.
Matéria é por turma (`materia.turma_id`), então "Cálculo na turma A" e "Cálculo na turma B" são duas matérias, declaradas uma em cada turma. Se a matéria ainda não existe, ele cria (A6: qualquer membro cria).
**Por quê:** é o mesmo contrato do resto do app — nada é aprovado antes de existir; a correção vem depois do fato.

### 2.4 Se a declaração for falsa: o líder contesta
O líder vê, na lista de membros, o selo e as matérias de cada docente. Se for mentira, ele toca **"Contestar"**: o docente perde todo poder e o selo **naquela turma**, até o líder tocar **"Restaurar"**. Entrar de novo com o código não limpa a contestação. Para fraude de verdade, o admin **recusa a conta** e o poder some em todas as turmas, na hora.
**Por quê:** um mecanismo só, posterior ao fato, como a moderação de hoje. Remover matéria por matéria viraria pingue-pongue (o professor declararia de novo).

### 2.5 Professor EDITA registro alheio, mas não EXCLUI
Na matéria dele, o professor corrige evento (e material — pergunta A25) de outra pessoa. Excluir registro alheio continua proibido: para tirar algo da turma ele **oculta**, que é reversível.
Toda edição alheia grava revisão (como hoje) e o card passa a mostrar **"editado por Prof. Fulano"**.
**Por quê:** se o professor muda a data da prova que a Ana postou, o card não pode continuar dizendo só "Ana" — seria atribuir a ela uma data que ela não escreveu. Autoria visível é o não-negociável 1.

### 2.6 Selo = "esta pessoa tem poder aqui"
O selo "Professor" aparece **só nos registros da matéria dele**; em outra matéria ele assina como aluno. "Coordenação" aparece em qualquer registro da turma. Conta pendente, recusada ou contestada: sem selo.
**Por quê:** um selo de professor numa matéria que ele não dá emprestaria autoridade a uma data que ele não tem como saber. O selo segue o poder, e o poder segue a regra 1.3. Efeito aceito: contestar ou revogar tira o selo também dos registros antigos.

### 2.7 Docente pode criar turma, mas não vira líder (decisão do dono, 2026-10-06)
Conta docente **cria turma**, e entra nela com o próprio papel (`PROFESSOR` ou `COORDENADOR`), nunca `LIDER`. A turma nasce **sem líder**, e **o primeiro aluno que entrar vira líder automaticamente**. Dali em diante vale a transferência de hoje. Docente não recebe a liderança (409), nem por transferência nem pelo admin. O líder é sempre um aluno.
Enquanto nenhum aluno entrou, a turma não tem líder; o docente criador modera pelo alcance dele, se a conta já estiver aprovada. Criar turma não é poder sobre ninguém, então conta pendente também cria.
**Por quê:** `membro.papel` é um valor só por vínculo — virar LIDER apagaria o PROFESSOR. E a turma é o grupo de alunos; o professor é visita com poderes, não dono.

### 2.8 Várias turmas: o app diz qual, o servidor confere
O docente escolhe a "turma ativa" no painel; o app manda o id dela no cabeçalho `X-Turma-Id`. O servidor só aceita se a pessoa for membro daquela turma (senão 404). **Sem o cabeçalho, tudo funciona como hoje** — e o app do aluno nunca manda.
**Por quê:** é a menor mudança que destrava várias turmas sem trocar a assinatura de nenhum service: só o `TurmaScopeResolverJpa` muda, que é exatamente o arquivo que o spec original reservou para isso.

### 2.9 Painel do docente substitui Home e Meu quadro
Toda conta docente (pendente, aprovada ou recusada) vê as abas **Painel · Calendário · Matérias · Turma**. Não tem Home de aluno nem Meu quadro (kanban de "feito" é coisa de quem tem prova para fazer). O status só muda o aviso no topo do painel e o que o servidor deixa fazer.
**Por quê:** a interface sai do tipo da conta, que o app não muda; o poder sai do status, que o servidor confere a cada requisição. Misturar os dois faria o professor pendente cair no app de aluno — que só resolve uma turma — e "perder" as outras até ser aprovado.

---

## 3. Modelo de dados

Duas migrations novas. **V1 não é editada** — o CHECK de `membro.papel` é trocado por `DROP/ADD CONSTRAINT` numa migration nova.

### 3.1 `V8__professor_e_coordenador.sql` (tarefa PC1)

```sql
-- Tipo da conta + aprovação. Só o admin muda o status, por rota (PC3).
ALTER TABLE usuario
  ADD COLUMN tipo_conta           TEXT        NOT NULL DEFAULT 'ALUNO',
  ADD COLUMN docente_status       TEXT        NULL,
  ADD COLUMN docente_decidido_por UUID        NULL REFERENCES usuario(id),
  ADD COLUMN docente_decidido_em  TIMESTAMPTZ NULL,
  ADD CONSTRAINT usuario_tipo_conta_valido
    CHECK (tipo_conta IN ('ALUNO','PROFESSOR','COORDENADOR')),
  ADD CONSTRAINT usuario_docente_status_valido
    CHECK (docente_status IN ('PENDENTE','APROVADO','RECUSADO')),
  -- aluno nunca tem status; docente sempre tem
  ADD CONSTRAINT usuario_status_so_de_docente
    CHECK ((tipo_conta = 'ALUNO') = (docente_status IS NULL));

-- COORDENADOR entra no papel. Nenhuma rota grava PROFESSOR hoje (A5), então
-- não há linha legada a migrar; e uma que existisse ficaria sem poder, porque
-- o poder exige tipo_conta aprovado no usuario.
ALTER TABLE membro DROP CONSTRAINT membro_papel_valido;
ALTER TABLE membro ADD CONSTRAINT membro_papel_valido
  CHECK (papel IN ('ALUNO','LIDER','PROFESSOR','COORDENADOR'));

-- Contestação do líder (2.4). O rastro mora na própria linha.
ALTER TABLE membro
  ADD COLUMN docente_contestado_em  TIMESTAMPTZ NULL,
  ADD COLUMN docente_contestado_por UUID        NULL REFERENCES usuario(id);

-- Quem leciona o quê. A turma vem da matéria; não repete turma_id aqui.
CREATE TABLE professor_materia (
  usuario_id    UUID        NOT NULL REFERENCES usuario(id),
  materia_id    UUID        NOT NULL REFERENCES materia(id),
  declarado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, materia_id)
);
```

`professor_materia` aceita DELETE físico: é configuração, não fato compartilhado (o não-negociável 2 fala de `evento` e `material`).

### 3.2 `V9__quem_editou.sql` (tarefa PC6)

```sql
-- NULL = nunca editado, ou legado. Preenchido em TODA edição, inclusive a do autor;
-- a API só mostra "editado por" quando difere de autor_id.
ALTER TABLE evento   ADD COLUMN atualizado_por UUID NULL REFERENCES usuario(id);
ALTER TABLE material ADD COLUMN atualizado_por UUID NULL REFERENCES usuario(id);
```

### 3.3 Java
- `PapelMembro` ganha `COORDENADOR`; o javadoc da A5 sai. Novos enums `TipoConta`, `DocenteStatus`, `Selo { PROFESSOR, COORDENACAO }`.
- `Usuario`: `tipoConta` gravável só na criação (`updatable = false`); `docenteStatus` muda só por `decidirDocente(aprovado, adminId, agora)`.
- `Membro.mudarPapel(LIDER)` lança 409 se o papel atual não é `ALUNO` — **uma** guarda que cobre transferência e admin (2.7).
- `acao_moderacao.lider_id` passa a guardar "quem moderou", que pode ser docente. Coluna **não** é renomeada (migration de dado por cosmética).

---

## 4. Escopo multi-turma (`X-Turma-Id`) — tarefa PC4

Só `TurmaScopeResolverJpa` muda; os ~20 chamadores não.

```java
UUID turmaDoUsuario(UUID usuarioId)
  // cabeçalho X-Turma-Id presente (lido via RequestContextHolder):
  //   UUID inválido ou sem vínculo -> AcessoNegadoException (404)
  //   vínculo existe -> essa turma
  // ausente (ou fora de requisição HTTP, ex.: teste de service) -> vínculo mais recente, como hoje

void exigirMesmaTurma(UUID usuarioId, UUID turmaDoRegistro)
  // passa a ser "é membro da turma do registro", independente da turma ativa.
  // Com a guarda "um vínculo por pessoa", aluno tem no máximo um: para ele é idêntico ao de hoje.

PapelMembro papelNaTurma(UUID usuarioId, UUID turmaId)   // substitui papelDoUsuario(usuarioId)
```

- `exigirMesmaTurma` por vínculo deixa o docente abrir pelo id um evento de outra turma dele (ex.: tocado no painel) sem trocar a turma ativa antes. Escrita continua escopada pela turma da **matéria**, nunca pelo cabeçalho.
- O `log.warn` de "mais de um vínculo" só dispara sem cabeçalho.
- **`SegurancaConfig`: `X-Turma-Id` entra em `allowedHeaders`.** Sem isso, toda requisição do docente no site morre no preflight — o mesmo bug que o comentário do `If-Match` já descreve.
- `papelDoUsuario` tem um chamador só (`ModeracaoService.exigirLider`), que passa a usar a turma do registro.

## 5. Quem pode o quê

Alcance: **M** = só nas matérias que declarou; **T** = turma inteira; **—** = não. "Docente" = conta APROVADA, vínculo não contestado. Docente pendente, recusado ou contestado = ALUNO nesta tabela, **exceto** "Criar turma" e entrar em várias turmas, que seguem o tipo da conta e não o status.

| Ação | ALUNO | LIDER | PROFESSOR | COORDENADOR | Admin |
|---|---|---|---|---|---|
| Criar evento / material / nota | T | T | T | T | — |
| Editar/excluir **o próprio** | sim | sim | sim | sim | — |
| Editar evento **alheio** | — | — | M (origem **e** destino) | T | — |
| Editar material **alheio** (A25) | — | — | M | T | — |
| Excluir evento/material **alheio** | — | — | — | — | — |
| Editar/excluir nota **alheia** | — | — | — | — | — |
| Desvincular material de evento alheio | — | — | M (matéria do evento) | T | — |
| Ocultar / reexibir / pedir exclusão de evento e material | — | T | M | T | — |
| Ocultar / reexibir nota da TURMA | — | T | — (nota não tem matéria) | T | — |
| Ver membros e código de convite | T | T | T | T | — |
| Editar turma (nome, período) | — | sim | — | — | — |
| Transferir liderança | — | sim (só para ALUNO) | — | — | só para ALUNO |
| Declarar matérias que leciona | — | — | sim (própria declaração) | — | — |
| Contestar / restaurar docente | — | sim | — | — | — |
| Criar turma | sim | sim | sim (entra como PROFESSOR; turma sem líder até o 1º aluno) | sim (entra como COORDENADOR; idem) | — |
| Aprovar / recusar conta docente | — | — | — | — | sim |

Ordem das checagens, igual à de hoje: **escopo (404) → poder (403) → version (409)**.

### 5.1 O que docente NÃO pode, nunca
- Ler nota PESSOAL de ninguém. A query de nota não muda; ocultar nota PESSOAL continua 404 (achado B1).
- Ver "Meu quadro", "Não listados" ou pedidos de exclusão de outra pessoa (nenhuma rota recebe usuário alvo; continua assim).
- Excluir registro alheio, inclusive na matéria dele.
- Virar líder, nem por transferência nem pelo admin.
- Agir em turma onde não entrou pelo código (404, não 403).
- Mudar o próprio status: nenhuma rota além das do admin escreve `docente_status`.

### 5.2 Implementação — tarefas PC5 e PC6

Um componente só sabe a regra, `security/PoderNaTurma` (classe, sem interface):

```java
Docentes daTurma(UUID turmaId)   // 1 query: membro + usuario + professor_materia da turma
record Docentes(...) {
  boolean alcanca(UUID usuarioId, UUID materiaIdOuNull)
    // COORDENADOR aprovado e não contestado -> true (inclusive materiaId nulo = nota)
    // PROFESSOR aprovado e não contestado   -> materiaId != null && declarou a matéria
    // resto -> false
  Selo selo(UUID usuarioId, UUID materiaIdOuNull)   // alcanca ? (coord ? COORDENACAO : PROFESSOR) : null
}
```

- `EventoService.atualizar` e `desvincularMaterial`: `exigirAutor` vira "autor **ou** `alcanca(origem)` (e, no PATCH, `alcanca(destino)`)". `excluirLogicamente` **mantém** `exigirAutor`.
- `MaterialService.atualizar`: mesma troca. `excluirLogicamente` mantém.
- `Evento.editar(...)` / `Material.editar(...)` recebem `editorId` e gravam `atualizado_por`. A revisão já grava o editor em `revisao.autor_id`.
- `ModeracaoService.exigirTurmaELider` vira `exigirModerador(usuario, turmaDoRegistro, materiaDoRegistroOuNull)`: `papelNaTurma == LIDER || alcanca(...)`. Nota passa `null`. O 403 do docente usa `ErroDeNegocio(FORBIDDEN, "Sem permissão nesta matéria")` — não precisa de classe nova.
- `TurmaService.criar`: conta ALUNO segue como hoje (vira LIDER, guarda de vínculo único). Conta docente: cria a turma e o vínculo com papel = `tipoConta`, **sem LIDER**, sem a guarda de vínculo único. `TurmaService.entrar`: se a turma não tem LIDER e quem entra é conta ALUNO, o vínculo nasce `LIDER` (o índice parcial `membro (turma_id) WHERE papel='LIDER'` garante um só sob concorrência — o perdedor da corrida tenta de novo como ALUNO). `TurmaService.entrar`: papel do novo vínculo = `ALUNO`, `PROFESSOR` ou `COORDENADOR` conforme `tipoConta`, **qualquer que seja o status** (o poder é que espera a aprovação).
- `exigirSemTurma` ("um vínculo por pessoa", 409) passa a valer **só para conta ALUNO**. Conta docente entra em quantas turmas tiver código. O índice único em `membro.usuario_id` que o javadoc dela descarta continua descartado, agora com motivo concreto.

## 6. Selo e "editado por" na autoria — tarefa PC7

```java
public record AutoriaResponse(UUID autorId, String autorNome, Selo autorSelo,
                              Instant criadoEm, Instant atualizadoEm,
                              String editadoPorNome, Selo editadoPorSelo) {}
// editadoPor* = null quando atualizado_por é nulo ou igual a autor_id
```

- Um construtor de autoria só (`service/Autorias`), usando `UsuarioRepository` + `PoderNaTurma.daTurma(...)` **uma vez por listagem**. Os ~7 `nomeDoAutor` espalhados passam por ele; nenhum service recalcula selo à mão.
- Entra em: `EventoResponse`, `MaterialResponse`, `ItemHomeResponse`, `/sync`, `/materias/{id}`, `/nao-listados`. `NotaResponse` ganha `autorSelo` (só pode ser `COORDENACAO`, só em nota TURMA).
- Lápide do `/sync` continua sem autoria.
- Front (`models.ts`): `Autoria` ganha os três campos, opcionais.

## 7. API — o que entra e o que muda

| Método | Rota | Quem | Notas |
|---|---|---|---|
| POST | `/auth/registrar` | público | ganha `tipoConta?` (`ALUNO` default). Docente nasce `PENDENTE` |
| — | `UsuarioDto`, `PerfilResponse` | — | ganham `tipoConta`, `docenteStatus` |
| GET | `/admin/docentes?status=PENDENTE\|APROVADO\|RECUSADO` | admin | `[{usuarioId, nome, email, tipoConta, docenteStatus, criadoEm}]`. Não-admin: 404 |
| POST | `/admin/docentes/{usuarioId}/aprovar` | admin | 204. Grava `decidido_por/em` |
| POST | `/admin/docentes/{usuarioId}/recusar` | admin | 204. Vale também para revogar um aprovado; efeito imediato (status é lido do banco a cada requisição, não do JWT) |
| PUT | `/turmas/minha/lecionadas` | membro PROFESSOR | `{materiaIds:[...]}` substitui o conjunto. Matéria de outra turma: 404. ALUNO: 403. Pendente pode declarar (fica inerte) |
| POST | `/turmas/minha/docentes/{usuarioId}/contestar` | LIDER | alvo precisa ser membro PROFESSOR/COORDENADOR da turma, senão 404 |
| POST | `/turmas/minha/docentes/{usuarioId}/restaurar` | LIDER | zera `docente_contestado_*` |
| GET | `/turmas/minha` | membro | ganha `meuAlcance: {tipo: NENHUM\|MATERIAS\|TURMA, materiaIds}`; cada membro ganha `selo`, `contestado`, `lecionadas` (siglas) |
| GET | `/painel` | conta docente, qualquer status | ignora `X-Turma-Id`. Conta ALUNO: 403. Ler não é poder: pendente vê o painel, sem selo |

`GET /painel`:
```json
{ "turmas": [ { "turmaId": "…", "nome": "Fans", "semestre": "2026.2",
    "papel": "PROFESSOR", "selo": "PROFESSOR", "contestado": false,
    "lecionadas": [ { "materiaId": "…", "sigla": "CALC", "corHex": "#…" } ],
    "proximos": [ /* ItemHomeResponse: 14 dias, ordem da Home, teto 6 por turma;
                     professor: só das matérias declaradas; coordenador: turma toda */ ] } ] }
```
`proximos` reaproveita a query e o comparador da `HomeService` (filtro de matéria em Java; ponytail: uma query por turma, docente tem poucas). A regra de 14 dias/6 itens continua só no servidor.

**Admin — emenda à V6:** a V6 diz "um poder só, uma rota só". O dono decidiu que aprovar docente também é do admin; a rota de **promover admin** continua não existindo, e o admin continua sem ler conteúdo de turma (a lista mostra conta, não turma).

## 8. Telas

Mockup navegável antes do componente real (Claude, PC8); wiring depois (Codex, PC10).

- **Cadastro:** escolha "Eu sou: Aluno · Professor · Coordenação". Abaixo de professor/coordenação: *"Seu cadastro passa por aprovação. Até lá, você monta seu painel e posta como qualquer membro, mas ainda não corrige nem oculta nada."* O tipo só existe no cadastro por e-mail; depois, "Entrar com Google" com o mesmo e-mail liga a conta e mantém o tipo (o `entrarComGoogle` já faz esse vínculo). Conta criada direto pelo Google é ALUNO.
- **Aviso de status** (topo do painel e perfil): pendente vê "Cadastro em análise — você ainda não corrige nem oculta"; recusado vê "Seu cadastro de professor não foi aprovado". Admin vê no perfil o link **"Aprovar professores"**.
- **Painel** (`/tabs/painel`, início do docente): 
  1. *Minhas turmas* — cartão por turma: nome, selo, chips das matérias (`MateriaChip`). Tocar = vira a turma ativa.
  2. *Próximos das minhas matérias* — `EventoCard`, agrupado por turma, na ordem que vier.
  3. *Atalhos* — "+ Prova", "+ Entrega", "+ Material" (abrem as telas de criar já existentes, com a matéria pré-escolhida por query param) e "Entrar em outra turma" (tela `entrar-turma` atual, sem o botão de criar turma).
- **Turma ativa:** título das abas Calendário/Matérias/Turma mostra o nome da turma ativa. Trocar de turma limpa o snapshot local (`pf.snapshot` é chave única hoje) e recarrega.
- **Turma:** selo ao lado do nome e matérias declaradas; marca "contestado". Professor vê **"Minhas matérias"** (lista de checkbox das matérias da turma → `PUT lecionadas`). Líder vê **"Contestar"/"Restaurar"** em cada docente.
- **Evento / material:** "Editar" e "Ocultar" aparecem pelo `meuAlcance` (um helper só em `TurmaRepository`, no padrão do `souLider` que já existe). O servidor decide de verdade; permissão velha no app só vira 403 com mensagem.
- **Cards:** selo na autoria e linha "editado por". Componentes em `shared/` ganham input `selo` — **trabalho do Claude** (pasta proibida ao Codex). Selo é texto + forma, nunca só cor (mesma lógica do não-negociável 7), e não pode parecer chip de matéria: chip é preenchimento sólido; selo é contorno 1px. "Professor" em tinta; "Coordenação" em `--accent`. O `.selo` do perfil (admin) é o ponto de partida.
- **Admin** (`/tabs/admin`, só se `perfil.adminPlataforma`; outros caem fora pela 404 da API): duas listas, Pendentes e Aprovados, com nome, e-mail, tipo, data; botões Aprovar / Recusar / Revogar. Sem paginação (ponytail: o dono aprova dezenas, não milhares).
- **App (core):** `AuthService.ehDocente = computed(usuario.tipoConta !== 'ALUNO')` — tipo, não status (2.9); o bootstrap chama `GET /eu` para atualizar o status guardado na sessão (só muda o aviso). O interceptor manda `X-Turma-Id` **só quando `ehDocente()`**. Abas e redirect inicial (`/tabs/painel` vs `/tabs/home`) saem do mesmo `ehDocente`.

## 9. Impacto no aluno

**Nada muda para quem é aluno.** Mesmas abas, mesma Home, mesmas rotas, nenhum cabeçalho novo (o interceptor só manda `X-Turma-Id` para conta docente), e a guarda "um vínculo por pessoa" continua valendo para ele. O que ele passa a **ver**: selo em registros de professor/coordenação, "editado por" quando um docente corrigiu algo dele, e o selo na lista de membros. Teste de aceite: a suíte atual passa **sem alteração** depois de PC4 e PC6, exceto os testes que afirmam "PROFESSOR = ALUNO" (A5), que são invertidos de propósito.

## 10. Testes — asserções novas (viram teste, uma ou mais cada)

| # | Asserção |
|---|---|
| P1 | `registrar` com `tipoConta=PROFESSOR` → `docente_status=PENDENTE`; sem `tipoConta` → `ALUNO`/`NULL`. CHECK recusa ALUNO com status |
| P2 | Professor PENDENTE, matéria declarada: PATCH de evento alheio → 403; ocultar → 403; selo nulo |
| P3 | Após aprovar: mesmo PATCH → 200; `evento.autor_id` intacto; `atualizado_por` = professor; `revisao` com snapshot anterior e `autor_id` = professor; resposta com `editadoPorNome` e `editadoPorSelo=PROFESSOR` |
| P4 | Professor aprovado: PATCH alheio em matéria não declarada → 403; mover evento da matéria dele para outra não declarada → 403 |
| P5 | Professor e coordenador: DELETE de evento/material alheio → 403, mesmo dentro do alcance |
| P6 | Professor: ocultar evento/material da matéria → 204; fora → 403; nota TURMA → 403 |
| P7 | Coordenador: PATCH/ocultar em qualquer matéria da turma → OK; ocultar nota TURMA → 204; nota PESSOAL alheia → 404 |
| P8 | Docente em turma onde não é membro: qualquer leitura/escrita → 404 |
| P9 | `X-Turma-Id` sem vínculo ou malformado → 404; sem cabeçalho → vínculo mais recente (comportamento atual) |
| P10 | Docente com turmas A e B: `/home`, `/eventos`, `/materias`, `/sync` com `X-Turma-Id` de cada uma devolvem só a turma pedida |
| P11 | Selo: professor na matéria dele → `PROFESSOR`; em outra → nulo; coordenador → `COORDENACAO` em qualquer matéria; pendente/recusado/contestado → nulo |
| P12 | Líder contesta → PATCH do professor 403 e selo nulo; `POST /turmas/entrar` de novo não limpa; restaurar → poderes voltam. Não-líder contestando → 403 |
| P13 | Transferir liderança (líder ou admin) para membro PROFESSOR/COORDENADOR → 409 |
| P14 | Conta docente `POST /turmas` → 200, vínculo com papel = `tipoConta` e turma sem LIDER; primeiro ALUNO a entrar → LIDER, segundo → ALUNO; dois alunos entrando ao mesmo tempo → exatamente um LIDER; `entrar` cria vínculo com papel = `tipoConta` e aceita segunda turma (200); conta ALUNO na segunda turma continua 409 (`UmaTurmaPorPessoaTest` verde, sem edição) |
| P15 | `/admin/docentes*` por não-admin → 404; aprovar/recusar grava `decidido_por/em` |
| P16 | Recusar um aprovado → próxima requisição dele já sem poder (sem novo login) |
| P17 | `PUT lecionadas` com matéria de outra turma → 404; por ALUNO → 403 |
| P18 | R11 continua: LIDER PATCH/DELETE alheio → 403. R10 continua: ALUNO cria → 201 sem etapa |
| P19 | Preflight `OPTIONS` com `Access-Control-Request-Headers: x-turma-id` → permitido |
| P20 | `/painel`: professor só vê eventos das matérias declaradas, teto 6 por turma, ordem da Home; pendente → 200 com `selo` nulo; conta ALUNO → 403 |

Front: interceptor manda `X-Turma-Id` só para docente; helper de alcance (`MATERIAS` com e sem a matéria, `TURMA`, `NENHUM`); guarda de início manda docente ao painel.

## 11. Emendas a documentos (texto exato — PC0)

- **AGENTS.md, não-negociável 10** → *"Só o autor exclui o próprio registro. Editar registro alheio é permitido apenas a docente aprovado (professor na matéria que declarou, coordenador na turma), sempre com revisão e com 'editado por' visível. O líder nunca edita: só muda visibilidade."*
- **AGENTS.md, "Proibido implementar"** → *"Múltiplas turmas para ALUNO. Conta docente escolhe a turma ativa pelo cabeçalho `X-Turma-Id`, validado no `TurmaScopeResolver` (spec 2026-10-06)."*
- **HANDOFF-v2 §4** (emenda datada, como a de 2026-07-29) e **§5** (mesma ressalva de multi-turma).
- **PERGUNTAS-ABERTAS:** A5 vai para "Respondidas" (2026-10-06: substituída por esta spec); entram A24–A26 (Seção 15).
- **`PapelMembro.java`** e o javadoc de `AdminController` ("uma rota só") são atualizados na tarefa que os toca.

## 12. Plano de tarefas, em ordem

Uma por vez, regra número zero. "Aceite" = comando + saída colada no LOG.

| # | Quem | Tarefa | Aceite |
|---|---|---|---|
| PC0 | Claude | Emendas da Seção 11 | Diff só em docs; dono leu |
| PC1 | Codex | V8 + `TipoConta`, `DocenteStatus`, `Selo`, `PapelMembro.COORDENADOR`, campos em `Usuario`/`Membro`, entidade/repo `ProfessorMateria`, guarda em `Membro.mudarPapel` | `./mvnw test` verde; P1 (parte do CHECK) e P13 |
| PC2 | Codex | `tipoConta` no `registrar`; DTOs `UsuarioDto`/`PerfilResponse`; `TurmaService.criar` 403; `entrar` com papel por tipo; `exigirSemTurma` só para ALUNO | P1, P14 |
| PC3 | Codex | `AdminService.listar/aprovar/recusar` + 3 rotas | P15 |
| PC4 | Codex | `X-Turma-Id` no `TurmaScopeResolverJpa`; `exigirMesmaTurma` por vínculo; `papelNaTurma`; CORS | P8, P9, P10, P19; suíte antiga verde sem edição |
| PC5 | Codex | `PoderNaTurma`; `PUT lecionadas`; contestar/restaurar; `meuAlcance`, `selo`, `contestado`, `lecionadas` em `/turmas/minha`; moderação por alcance | P2 (ocultar), P6, P7, P12, P16, P17 |
| PC6 | Codex | V9; edição alheia em `EventoService`/`MaterialService`; desvincular; `atualizado_por` | P2, P3, P4, P5, P18 |
| PC7 | Codex | `AutoriaResponse` com selo e editado-por via `Autorias`; Home, sync, matéria, não-listados, nota | P11 + R1 continua |
| PC8 | Claude | Mockup (painel, selos, editado-por, tela de admin, minhas matérias, contestar, cadastro); depois de aprovado, input `selo`/`editadoPor` em `EventoCard`, `MaterialLinha`, `Nota` | Dono aprova o mockup; selos distinguíveis em escala de cinza |
| PC9 | Codex | `GET /painel` | P20 |
| PC10 | Codex | Front: models, cadastro, `ehDocente` + `/eu` no bootstrap, interceptor, abas/início do docente, painel, turma ativa, minhas matérias, contestar, botões por alcance, admin | testes de front da Seção 10; `ng build` limpo |
| PC11 | dono | E2E em dois aparelhos: professor se cadastra → admin aprova → entra em 2 turmas → corrige data de prova de aluno → aluno vê "editado por Prof." → líder contesta → poder some | checklist assinado no LOG |

PC8 pode correr em paralelo a PC1–PC7 assim que o contrato da Seção 6 estiver fechado.

## 13. Riscos

| Risco | Mitigação / status |
|---|---|
| Rota de aprovação vira alvo (falha de autorização aprova qualquer um) | Mesmo `exigirAdmin` (404) da V6. Estrago limitado: o poder só vale onde a pessoa já entrou por código, e o líder contesta. Aceito |
| Professor real e mal-intencionado muda datas | Revisão + "editado por" visível + contestação + revogação imediata. Aceito |
| Pingue-pongue líder × docente em ocultar/reexibir | Tudo em `acao_moderacao`. Gente que se conhece. Aceito |
| Fila de pendentes cheia de alunos que marcaram "professor" | Sem poder, sem dano; admin recusa. O recusado fica com o painel sem poderes e sem Home; se era aluno de verdade, admin troca `tipo_conta` por SQL. Aceito |
| Professor criou a conta pelo Google (vira ALUNO) | Admin corrige por SQL (`tipo_conta`, `docente_status`). Fora do produto. Aceito |
| `X-Turma-Id` esquecido no CORS | P19 trava no teste |
| Selo some de registros antigos ao contestar/revogar | Selo é "poder agora", não histórico. Decisão 2.6 |
| Notificação da véspera só cobre a turma ativa do docente | `/sync` e snapshot são por turma ativa. Ver Fora |
| Permissão desatualizada no app | Servidor decide; app mostra o 403 com mensagem e recarrega `/turmas/minha` |

## 14. Fora desta spec

- Multi-turma para aluno; seletor de turma para aluno.
- Notificação da véspera de todas as turmas do docente (hoje: só a ativa).
- Avisar o autor quando um docente edita ou oculta o registro dele (mesma lacuna da A21).
- Docente excluir registro alheio; docente editar nota alheia.
- Nota da turma com matéria (daria selo de professor a nota) — ver A26.
- Trocar o tipo de conta depois do cadastro; tipo de conta no login com Google.
- Aprovação por turma; admin ver ou contestar declarações de matéria.
- Preencher `materia.professor` (texto) a partir de `professor_materia`.
- Instituição/faculdade, domínio de e-mail institucional para aprovar sozinho.

## 15. Perguntas abertas novas (default aplicado)

- **A24. Conta docente espera o admin?** Default: **sim**, nasce PENDENTE: tem painel e várias turmas, mas nenhum poder nem selo até a aprovação (2.1). Custo de mudar para "vale na hora": remover a checagem de status em `PoderNaTurma` — uma linha — e a turma passa a depender só da contestação do líder.
- **A25. Professor edita MATERIAL alheio?** O dono falou em "corrigir datas" (evento). Default: **sim**, mesma regra do evento — link quebrado e data de aula errada são a mesma correção, e é o mesmo código. Custo de mudar: tirar a troca em `MaterialService.atualizar` e inverter um teste.
- **A26. Nota da turma escrita por professor sai sem selo.** Nota não tem matéria, então o professor não tem poder nela e o selo segue o poder (2.6). Default: **sem selo**. Custo de mudar: `nota.materia_id` opcional (migration) ou selo de identidade separado do poder.
