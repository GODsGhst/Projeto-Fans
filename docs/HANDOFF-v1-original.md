# HANDOFF — App de Turma (MVP)

> **Para o agente que lê este arquivo (Claude Code):**
> Este documento é a fonte de verdade do produto. Ele descreve **o que** construir e **quais regras não podem ser violadas** — não descreve stack, pastas nem bibliotecas.
>
> Regras de execução:
> 1. **Não invente as decisões da Seção 6.** Elas estão abertas de propósito. Pergunte ao dono do projeto antes de escrever qualquer código que dependa delas.
> 2. Não expanda escopo. O que está na Seção 5 fica fora, mesmo que pareça fácil.
> 3. Ao delegar tarefas pro Codex, passe a Seção relevante inteira + os não-negociáveis (Seção 4). Codex sem contexto de regra inventa UI que quebra a regra.
> 4. Se algo aqui contradiz algo que você assumiu antes, este arquivo ganha.

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

---

## 3. Modelo de dados — regras (fechadas)

Estas regras são decisões de produto, não sugestão de schema:

1. **Todo registro guarda autor + timestamp, e isso é visível na UI.** Sem registro anônimo.
2. **Edição não apaga histórico.** Quem editou e quando fica registrado.
3. **Separação rígida:** *fato compartilhado* (prova, entrega, material) ≠ *estado pessoal* (feito, visto). Nunca gravar estado pessoal dentro do fato compartilhado.
4. **Material tem tipo:** `aula` ou `adicional`.
5. **Evento ↔ materiais vinculados.** É desse vínculo que sai a resposta "o que estudar pra essa prova".
6. Na tela de prova, mostrar **apenas os materiais vinculados ao evento** — nunca despejar o semestre inteiro.

### Esboço de entidades (sugestão minha, não decidido — valide antes)
```
Turma        (id, nome, semestre)
Materia      (id, turma_id, nome, sigla, cor)
Usuario      (id, nome)
Evento       (id, materia_id, tipo: prova|entrega, titulo, data, autor_id, criado_em)
Material     (id, materia_id, tipo: aula|adicional, titulo, link_ou_arquivo, autor_id, criado_em)
EventoMaterial (evento_id, material_id)            -- vínculo N:N
EstadoPessoal  (usuario_id, evento_id, feito: bool) -- NUNCA dentro de Evento
Revisao        (registro_tipo, registro_id, autor_id, em, snapshot) -- histórico de edição
```

---

## 4. Não-negociáveis

- **Push local avisando na véspera** de prova/entrega. Sem isso o app não pega. (⚠️ ver furo na Seção 6.3)
- **Cor + sigla sempre.** Nunca só bolinha colorida — em duas semanas ninguém lembra qual cor é qual matéria.
- **Prova mais pesada visualmente que entrega.**
- **Ordem = urgência**, nunca tipo.
- **Qualquer aluno posta.** Sem gatekeeper, sem aprovação, sem "líder de turma".
- Autoria visível em tudo. É o único mecanismo de confiança do app.

---

## 5. Fora do MVP (não implementar)

- Assinatura / monetização
- Resumo por IA
- Notas / boletim
- Integração com sistema da faculdade
- Suporte a múltiplas turmas
- Envio e correção de trabalho

---

## 6. Decisões abertas — PERGUNTE ANTES DE CODAR

### 6.1 Stack
Não foi decidida. Duas rotas, com trade-off real:

| | Rota A — rápida | Rota B — portfólio |
|---|---|---|
| Front | Ionic 8 + Angular 20 + Capacitor | igual |
| Backend | Firebase (Firestore + Auth) | Spring Boot + Postgres |
| Tempo até MVP | menor | maior |
| Valor pro currículo backend Java | ~zero | alto |

*Opinião, confiança alta:* se o objetivo é vaga júnior de backend Java, a Rota B é a única que gera artefato de portfólio. Se o objetivo é entregar trabalho de faculdade no prazo, Rota A.

### 6.2 Backend é obrigatório
O briefing diz "a turma mantém **junta**". Isso é dado compartilhado entre dispositivos — **não existe versão local-only deste app**. Se o plano era só local, o produto muda de natureza e o briefing precisa ser reescrito.

### 6.3 ⚠️ Furo no push local
"Push local" só dispara sobre dado que **já está no dispositivo**. Se um colega cadastra uma prova 12h antes e você não abriu o app nesse meio-tempo, o push local nunca acontece — o aparelho não sabe que o evento existe.

Opções:
- Push remoto (FCM) disparado pelo backend quando alguém cadastra → resolve, custa infra.
- Sync em background periódico + agendamento local → resolve parcialmente, sujeito a restrição de bateria do Android/iOS.
- Aceitar o furo no MVP e documentar.

**Precisa de decisão explícita.** Como o push está listado como não-negociável, tratar isso como bug de arquitetura, não detalhe.

### 6.4 Entrada na turma e identidade
Como alguém entra? Código de convite, link, e-mail institucional? Sem isso, "qualquer aluno posta" vira "qualquer pessoa da internet posta". Autoria visível só funciona se o nome for confiável.

### 6.5 Conflito de edição
Se dois alunos cadastram a mesma prova com datas diferentes, ou um edita o registro do outro — qual é a regra? Livre pra todos, só o autor edita, ou merge manual?

### 6.6 Hora do evento
`data` é só dia ou dia+hora? Isso define quando o push da véspera dispara e como a Home ordena empates.

### 6.7 Nome do app
Ainda não existe.

---

## 7. Divisão sugerida Claude Code ↔ Codex

**Claude Code fica com:** decisões de arquitetura, modelo de dados, resolução das pendências da Seção 6, revisão do que o Codex produzir contra os não-negociáveis da Seção 4.

**Delegar pro Codex, uma tarefa por vez, sempre com a Seção 4 anexada:**
1. Scaffold do projeto + navegação entre as 4 telas (telas vazias)
2. Camada de dados / entidades, depois que 6.1 e 6.2 estiverem fechadas
3. Home: query de 14 dias + ordenação por urgência + teto de 6
4. Componente de item de evento (cor + sigla + peso visual por tipo)
5. Tela Matérias + separação `aula` / `adicional`
6. Meu quadro (estado pessoal isolado)
7. Calendário
8. Agendamento de notificação

Não delegar 2 antes de 1 estar rodando. Não delegar 8 antes de 6.3 estar decidido.

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
- [ ] Nenhum item da Seção 5 foi implementado.

---

## 9. Pendência de fora do código

Confirmar com a coordenação/professores o que o diário eletrônico da faculdade já entrega. Se ele já resolve "o que foi dado no período", o app perde a razão de existir para a turma. Isso não bloqueia o scaffold, mas bloqueia investir semanas.
