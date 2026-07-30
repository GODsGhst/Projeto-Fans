# HANDOFF v2 — projetoFans (MVP)

> **Versão 2 — 2026-07-29.** O original está preservado em `HANDOFF-v1-original.md`.
>
> **O que mudou da v1:** as sete decisões abertas da Seção 6 foram fechadas com o dono do projeto e movidas para as seções correspondentes. Uma cláusula da Seção 4 foi emendada — está marcada e justificada. Nada mais mudou.
>
> **Para o agente que lê este arquivo:**
> Este documento é a fonte de verdade **do produto**. `superpowers/specs/2026-07-29-projetofans-design.md` é a fonte de verdade **técnica**.
>
> Regras de execução:
> 1. Não expanda escopo. O que está na Seção 5 fica fora, mesmo que pareça fácil.
> 2. Ao delegar tarefas pro Codex, passe a Seção relevante inteira + os não-negociáveis (Seção 4).
> 3. Se algo aqui contradiz algo que você assumiu antes, este arquivo ganha.
> 4. Perguntas novas vão para `PERGUNTAS-ABERTAS.md`. Não invente resposta e não pare o trabalho por causa delas — aplique o default documentado e siga.

---

## 1. O que é / o que não é

**É:** app onde a turma mantém, junta, o que precisa saber sobre a semana — provas, entregas e o material que caiu em cada aula.

**Não é:** Google Classroom. Não tem envio de trabalho, correção nem nota. Professor é contribuidor **opcional**, nunca requisito de funcionamento.

**Proposta de valor exata:** vende *"o que foi dado no período"*. Nunca *"o que vai cair na prova"*.

---

## 2. Telas (4 no MVP)

### 2.1 Home — entrada do app
- Lista de provas/entregas dos **próximos 14 dias**, teto de **~6 itens**.
- Ordenada por **urgência (data crescente)**. O que vence amanhã vem primeiro, seja prova ou entrega.
- **Proibido agrupar por tipo.** Não empilhar provas em cima.
- Semana vazia mostra pouca coisa — isso é informação útil, não bug. Não preencher com nada.
- Cada item: **sigla da matéria + cor da matéria + data**. Prova é visualmente mais pesada que entrega (peso/forma/ícone, não só cor).

### 2.2 Calendário — consulta opcional
- Visão mensal e semanal.
- Não é a entrada do app. Quem só quer saber "o que tem essa semana" resolve na Home.
- Mesma linguagem visual: cor = matéria, forma/ícone = tipo.

### 2.3 Matérias — hub por disciplina
- Uma matéria por card/entrada, com sua cor e sigla.
- Dentro: materiais de aula e materiais adicionais, separados por tipo.
- Eventos daquela matéria aparecem aqui também.

### 2.4 Meu quadro — kanban pessoal
- Duas colunas: **a fazer / feito**.
- Estado é **só do usuário**. Marcar "feito" não muda nada pra mais ninguém.
- **[v2]** Abaixo do kanban, uma seção recolhida **"Não listados"**, que só aparece se o usuário tiver registro próprio oculto pela moderação. Não é uma terceira coluna — as duas colunas da regra acima continuam sendo duas.

---

## 3. Modelo de dados — regras (fechadas)

Estas regras são decisões de produto, não sugestão de schema:

1. **Todo registro guarda autor + timestamp, e isso é visível na UI.** Sem registro anônimo.
2. **Edição não apaga histórico.** Quem editou e quando fica registrado.
3. **Separação rígida:** *fato compartilhado* (prova, entrega, material) ≠ *estado pessoal* (feito, visto). Nunca gravar estado pessoal dentro do fato compartilhado.
4. **Material tem tipo:** `aula` ou `adicional`.
5. **Evento ↔ materiais vinculados.** É desse vínculo que sai a resposta "o que estudar pra essa prova".
6. Na tela de prova, mostrar **apenas os materiais vinculados ao evento** — nunca despejar o semestre inteiro.
7. **[v2]** Exclusão é sempre lógica, nunca física. A regra 2 exige que o histórico sobreviva.
8. **[v2]** `data` de evento é **dia obrigatório + hora opcional**. Ver Seção 6.6.

O schema final está no spec técnico, Seção 5. O esboço da v1 foi validado e sobrevive quase intacto; as diferenças são UUID como chave, `turma_id` em todo fato compartilhado, e as tabelas de moderação e device token.

---

## 4. Não-negociáveis

- **Push avisando na véspera** de prova/entrega. Sem isso o app não pega. (Resolvido — ver 6.3.)
- **Cor + sigla sempre.** Nunca só bolinha colorida — em duas semanas ninguém lembra qual cor é qual matéria.
- **Prova mais pesada visualmente que entrega.**
- **Ordem = urgência**, nunca tipo.
- **Qualquer aluno posta.** Sem gatekeeper e sem aprovação: nenhum registro passa por fila ou revisão antes de existir e ficar visível.
  - **[EMENDADO NA v2]** Moderação existe apenas **posterior ao fato**: o líder da turma pode ocultar um registro já publicado e pedir exclusão ao autor. Ele **não** pode editar registro alheio nem impedir a criação de nada.
- Autoria visível em tudo. É o único mecanismo de confiança do app.

> ### Nota de emenda — 2026-07-29
>
> A v1 dizia: *"Qualquer aluno posta. Sem gatekeeper, sem aprovação, sem 'líder de turma'."*
>
> A cláusula "sem 'líder de turma'" foi removida por **decisão explícita do dono do projeto**, após ele ser alertado de que a v1 vetava esse papel pelo nome. A decisão foi reafirmada e é dele.
>
> O que foi preservado, e virou teste automatizado (asserções R10 e R13 do spec): **nada é aprovado antes de existir**, o fluxo de publicação continua livre, e o líder não pode alterar conteúdo alheio — só visibilidade.
>
> Todo o resto da Seção 4 permanece intocado.

---

## 5. Fora do MVP (não implementar)

- Assinatura / monetização
- Resumo por IA
- Notas / boletim
- Integração com sistema da faculdade
- Suporte a múltiplas turmas
- Envio e correção de trabalho

**Sobre múltiplas turmas:** a tabela `membro` suporta N turmas por construção, porque a entrada por convite já exige um registro de vínculo. Mas a **API resolve exatamente uma turma por usuário** e **não existe seletor de turma na UI**. A tabela está pronta; a feature não está, e não deve ser construída.

---

## 6. Decisões — FECHADAS em 2026-07-29

### 6.1 Stack — Rota B enxuta
Spring Boot 3.x / Java 21 / Maven + Postgres gerenciado + FCM via Firebase Admin SDK.
Front: Ionic 8 + Angular 20 (standalone + signals) + Capacitor.

Razão principal, e não é currículo: **o modelo de dados da Seção 3 é relacional**. `EventoMaterial` é N:N real, `Revisao` é append-only auditável, e a regra 3 proíbe embutir estado pessoal no fato compartilhado — que é justamente o idioma do Firestore. Somado a isso, **FCM é separável do resto do Firebase**, o que neutraliza a única vantagem real da Rota A.

**Restrição adicional:** a arquitetura deve permitir expansão para faculdades depois, sem que isso mude o escopo do MVP. Resolvido com UUID como PK, `turma_id` em todo fato compartilhado, `membro` como N:N, e escopo de turma resolvido num componente único. O nível `Instituicao` **não** é construído agora.

### 6.2 Backend é obrigatório — sim
Confirmado, sem ressalva. O dado é compartilhado entre dispositivos.

### 6.3 Push — data-push no cadastro + reagendamento local
O furo da v1 era real. Solução:

1. Alguém cadastra/edita/apaga evento → backend envia **data-message** via FCM para os aparelhos da turma.
2. O app recebe em background, sincroniza e **recalcula os agendamentos locais**.
3. A notificação em si é **local**, às **19:00** do dia anterior.

O alerta é local de propósito: hibernação do servidor não pode quebrá-lo, e funciona offline. O servidor só precisa estar acordado quando alguém está usando o app — que é exatamente quando ele está.

**Furo residual, aceito e documentado:** Android em force-stop ou sob restrição de bateria pode não receber o data-message; o sync no foreground cobre com atraso. iOS em background é best-effort.

### 6.4 Entrada na turma e identidade
Duas coisas separadas:
- **Conta:** Google Sign-In **ou** e-mail + senha. Livre.
- **Entrar na turma:** exige **código de convite**.

O código de convite é a fronteira de confiança, não o provedor de login. Por isso nome autodeclarado deixa de ser furo: só quem tem o código está dentro.

Backend valida o ID token do Google e emite **JWT próprio** — os endpoints só conhecem uma forma de autenticação. Recuperação de senha por token de uso único via SMTP é obrigatória, não opcional.

### 6.5 Edição e moderação
- **Só o autor edita ou exclui o próprio registro.** Nem o líder edita registro alheio.
- **O líder pode ocultar da turma** e **pedir exclusão ao autor**.
- Pedido não acatado → registro fica oculto para a turma e **visível apenas para o autor**, em "Não listados".
- Exclusão é sempre lógica.
- Edição simultânea usa controle de versão: conflito devolve 409, nunca sobrescreve em silêncio.

**Líder:** quem cria a turma. **Um por turma** (garantido por índice no banco), **transferível** para evitar turma órfã. Transferência registrada.

Ver a nota de emenda na Seção 4.

### 6.6 Hora do evento
Dia **obrigatório**, hora **opcional**.

Obrigar hora faria o aluno inventar dado, e dado inventado corrói a única coisa que o app tem: confiança.

- Notificação dispara **19:00 local**, tenha hora ou não.
- Hora, quando existe, aparece na UI e desempata a ordenação.
- Timezone fixo: `America/Sao_Paulo`.

**Ordem completa da Home:** data crescente → hora crescente (nulos por último) → prova antes de entrega → criação crescente.
O terceiro critério é desempate **dentro do mesmo dia e hora**. Não é agrupamento por tipo, que continua proibido.

### 6.7 Nome
`projetoFans`, provisório. Package `com.projetofans.app`. Nome definitivo não bloqueia nada.

---

## 7. Divisão Claude ↔ Codex

**Claude:** arquitetura, modelo de dados, spec, plano, **todo o design visual e os componentes de apresentação**, e review do que o Codex produzir contra a Seção 4.

**Codex:** backend inteiro + wiring das telas. Recebe componentes visuais prontos e **não inventa UI**.

O design saiu da lista do Codex por decisão do dono do projeto: Codex é competente em plumbing e ruim em julgamento visual — ele geraria o card genérico do framework e passaria por cima dos não-negociáveis visuais.

Plano com as tarefas ordenadas e critérios de aceite: `superpowers/plans/2026-07-29-projetofans-mvp.md`.
Regras que o Codex lê antes de qualquer tarefa: `../AGENTS.md`.

---

## 8. Aceite do MVP

O MVP está pronto quando, num aparelho real:
- [ ] Aluno A cadastra uma prova; aluno B vê ela na Home em outro aparelho.
- [ ] A Home mostra só os próximos 14 dias, ordenada por data, no máximo ~6 itens.
- [ ] Cada item mostra sigla + cor, e prova é distinguível de entrega **sem ler o texto**.
- [ ] Autor e data de criação aparecem em todo registro.
- [ ] Aluno A marca "feito"; aluno B continua vendo como pendente.
- [ ] Material vinculado a uma prova aparece na prova; material não vinculado não aparece.
- [ ] Notificação chega na véspera de um evento cadastrado.
- [ ] **[v2]** Aluno A tenta editar registro do aluno B e é recusado.
- [ ] **[v2]** Líder oculta um registro; ele sai da Home de todos e aparece só em "Não listados" do autor.
- [ ] Nenhum item da Seção 5 foi implementado.

---

## 9. Pendência de fora do código

Confirmar com a coordenação/professores o que o diário eletrônico da faculdade já entrega. Se ele já resolve "o que foi dado no período", o app perde a razão de existir para a turma. Isso não bloqueia o scaffold, mas bloqueia investir semanas.

**Status:** aberto. Registrado em `PERGUNTAS-ABERTAS.md`.
