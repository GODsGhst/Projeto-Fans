# AGENTS.md — leia isto antes de qualquer tarefa

Projeto: **projetoFans** — app onde uma turma mantém, junta, o que cai na semana e o que foi dado em cada aula.

## Ordem de leitura

1. Este arquivo.
2. `docs/superpowers/plans/2026-07-29-projetofans-mvp.md` — o plano. Pegue **a próxima tarefa não concluída**, uma só.
3. `docs/HANDOFF-v2.md` — fonte de verdade do **produto**.
4. `docs/superpowers/specs/2026-07-29-projetofans-design.md` — fonte de verdade **técnica** (schema, endpoints, asserções).
5. `docs/STACK.md` — o que roda, com qual versão, e como rodar. Leia antes de tocar em `pom.xml` ou em dependência.

As tarefas **1 a 9 não dependem de nada externo** — nenhuma conta no Google, Firebase, SMTP ou Postgres gerenciado. Execute-as em sequência sem parar para perguntar.

As tarefas **10 a 12 foram desbloqueadas em 2026-08-22**: `app/src/app/shared/` existe, com `MateriaChip`, `EventoCard`, `AulaCard`, `MiniCard`, `MaterialLinha` e `Nota`. A pasta continua sendo zona proibida (ver "Proibido implementar") — sua tarefa é ligar os dados nos componentes, não alterá-los.

As tarefas **13 a 16 entraram em 2026-08-26**. Elas cobrem o que o design abriu depois do plano
original — grade de aulas, anotações e envio de arquivo — e também não dependem de conta nenhuma:
`FakeArmazenamento` cobre o R2 em dev e teste. Vêm depois da 12 na ordem, com uma ressalva escrita
na A8: **a Task 13 vale uma pergunta ao dono antes de começar**, porque é a que mais custa se a
faculdade já publicar a grade.

**A Task 2 fechou em 2026-08-30**, 27 dias depois de escrita. Ela estava parcial porque a suíte
dependia de Docker e o Docker desta máquina não sobe desde 03/08. Trocamos Testcontainers por
Postgres embutido (binário real, sem daemon) e a suíte roda: **7/7 verdes**. Detalhe em
`docs/STACK.md`.

**Você não precisa de Docker para nada.** Toda tarefa de backend fecha com `cd backend && ./mvnw test`.
Se algum dia você escrever um teste que precise de container, pare e registre no log — não é assim
que este projeto testa.

As páginas `home` e `quadro` já renderizam com dados de exemplo em `signal`. Troque a origem por serviço mantendo o mesmo shape; o comentário `PARA O CODEX` em cada página diz qual endpoint. Não mude a ordem de renderização nem o estado vazio.

Se algo neste arquivo contradiz o que você assumiu, este arquivo ganha. Se o handoff contradiz o spec numa regra de negócio, o handoff ganha. Se o spec contradiz o handoff numa questão de implementação, o spec ganha.

## Regra número zero

**Uma tarefa por vez, na ordem do plano.** Não comece a tarefa N+1 porque "já estava ali". Não refatore o que a tarefa anterior entregou. Ao terminar, registre no log (última seção deste arquivo) e pare.

## Os não-negociáveis

Estes não são preferências. Código que viola qualquer um deles é rejeitado no review, mesmo que funcione.

1. **Autoria visível em tudo.** Todo `evento` e `material` tem autor e timestamp, e a API os devolve. Não existe registro anônimo. Autoria é o único mecanismo de confiança do app.
2. **Edição não apaga histórico.** Todo `PATCH` grava linha em `revisao` com o snapshot anterior. Exclusão é **sempre lógica** (`excluido_em`) — nenhum `DELETE` físico em `evento` ou `material`.
3. **Fato compartilhado nunca guarda estado pessoal.** `feito` vive só em `estado_pessoal`. Se você sentir vontade de adicionar uma coluna `feito` em `evento` para simplificar uma query, pare: é exatamente a violação que o schema foi desenhado para impedir.
4. **Ordem é urgência, nunca tipo.** A Home ordena por data. Agrupar provas no topo é proibido.
5. **Teto de 6 itens e janela de 14 dias na Home** — calculados **no servidor**, em `HomeService`. Não replique essa lógica no cliente.
6. **Semana vazia mostra pouca coisa.** Lista vazia é resposta correta e informativa. Não preencha com sugestão, dica, card promocional ou skeleton permanente.
7. **Cor + sigla sempre juntas.** Nunca renderize só a cor. Use `MateriaChipComponent`; não crie outro caminho para exibir matéria.
8. **Prova é visualmente mais pesada que entrega**, por peso de tinta: prova é **bloco sólido**, entrega é **contorno de 1px**. A cor **não** participa dessa distinção — ela já identifica a matéria. Teste: em escala de cinza os dois ainda se distinguem. Ver `docs/design/design-system-v1.html`.
9. **Qualquer membro posta, sem aprovação.** Nenhuma fila, nenhum gate, nenhum status "pendente de revisão" na criação.
10. **Só o autor edita ou exclui o próprio registro.** Nem o líder edita registro alheio — o líder só muda visibilidade.
11. **Tela de prova mostra apenas os materiais vinculados** àquele evento. Nunca despeje a matéria inteira.

## Proibido implementar

Mesmo que pareça fácil, mesmo que caiba em 10 linhas, mesmo que "seria útil":

- Assinatura ou monetização
- Resumo por IA
- Notas ou boletim
- Integração com sistema da faculdade
- **Suporte a múltiplas turmas** — a tabela `membro` é N:N por construção, mas a API resolve **uma** turma por usuário e **não existe seletor de turma na UI**
- Envio ou correção de trabalho

Se uma tarefa parecer exigir algo desta lista, pare e registre no log em vez de implementar.

## Regras de código

**Backend**

- Entidade JPA **nunca** cruza a fronteira do controller. Sempre DTO. Isso evita vazar `senha_hash` por acidente.
- `turma_id` **nunca** é filtrado à mão num controller. Use `TurmaScopeResolver`. É o único lugar que conhece essa regra, e é o arquivo que se alteraria para suportar instituições depois.
- Acesso a registro de outra turma retorna **404, não 403**. 403 confirmaria que o registro existe.
- `PATCH` exige `If-Match: <version>`. Ausente → 428. Divergente → 409. Nunca sobrescreva em silêncio.
- Erro sai como `ProblemDetail` (RFC 7807) pelo `@ControllerAdvice`. Sem formato de erro ad-hoc por endpoint.
- Notificação sempre via a interface `Notifier`. Nunca chame o Firebase SDK direto de um service.

**Frontend**

- Componentes standalone, signals para estado. Sem `NgModule` novo.
- Nenhuma regra de negócio no componente. Ordenação, teto e janela vêm prontos da API.
- **Não crie nem altere componente visual em `app/src/app/shared/`.** Essa pasta é entregue pronta; sua tarefa é ligá-la nos dados. Se um componente visual estiver faltando algo, registre no log em vez de improvisar.
- Todo erro de HTTP passa pelo interceptor central.

**Proibido em qualquer lugar**

- `catch` vazio, ou `catch` que devolve lista vazia como se fosse sucesso. Neste app, confundir "não há provas" com "falhou ao buscar provas" é o pior bug possível. Se não puder tratar, relance.
- Segredo hardcoded. Tudo por variável de ambiente (tabela na Seção 11 do spec).
- Migration Flyway já aplicada sendo editada. Crie a próxima.

## Credenciais: nada bloqueia

Você **não** precisa de conta no Google, Firebase, SMTP ou Postgres gerenciado para completar nenhuma tarefa. Tudo externo tem fake ou fallback de desenvolvimento:

| Precisa de | Use em dev/teste |
|---|---|
| Postgres | `docker-compose.yml` local |
| Validação de ID token do Google | validador fake injetado |
| FCM | `FakeNotifier` |
| SMTP | logger que imprime o link de reset |

Se uma tarefa parecer travada por falta de credencial, ela não está: implemente contra a interface e teste com o fake.

## Definição de pronto

Uma tarefa está pronta quando:

- O critério de aceite escrito nela passa, verificado por você, com a saída colada no log.
- Os testes que a tarefa pede existem e passam.
- Nenhum não-negociável acima foi violado.
- `docs/LOG.md` foi atualizado.

Não marque como pronto com teste vermelho, implementação parcial ou erro não resolvido. Se travou, registre o que travou — isso é mais útil que uma entrega parcial anunciada como completa.

## Como registrar no log

Ao terminar (ou travar) uma tarefa, **anexe** um bloco ao fim de `docs/LOG.md`. Não reescreva o que já está lá.

```markdown
### [AAAA-MM-DD] Tarefa N — <título>
**Status:** concluída | travada | parcial
**O que foi feito:** <2-4 linhas>
**Arquivos principais:** <lista>
**Critério de aceite:** <comando rodado + resultado>
**Decisões que eu tomei:** <o que o plano não dizia e você resolveu — ou "nenhuma">
**Travas / dúvidas:** <o que precisa de resposta humana — ou "nenhuma">
```

O bloco **Decisões que eu tomei** é o mais importante do log. Se você resolveu uma ambiguidade sozinho, ela precisa aparecer ali para o review saber onde olhar.

Dúvida que precisa de resposta humana vai também para `docs/PERGUNTAS-ABERTAS.md`, com o default que você aplicou para não travar.
