# Perguntas abertas

Regra deste arquivo: **nenhuma pergunta bloqueia trabalho.** Cada item tem um **default aplicado** que já está no código ou no spec. Quando você responder, se a resposta divergir do default, a mudança está anotada como custo.

Ordem: as que mais mudam trabalho primeiro.

---

## A. Decisões de produto — default já aplicado

### A1. "Feito" numa prova significa o quê?

Para entrega, `feito` é óbvio: entreguei. Para prova é ambíguo — estudei? já fiz a prova?

**Default aplicado:** `feito` é um marcador livre do usuário, sem semântica imposta. A UI diz "marcar como resolvido", não "entreguei".

**Custo se mudar:** só texto de UI. Barato.

### A2. Evento marcado "feito" sai da Home?

**Default aplicado: não sai.** Ele continua na lista com um marcador discreto de concluído.

Razão: se saísse, o teto de 6 itens passaria a se comportar diferente para cada usuário, e duas pessoas olhando o mesmo app veriam listas diferentes de fatos compartilhados. Além disso, a prova continua existindo depois de eu estudar.

**Custo se mudar:** um filtro no `HomeService` e ajuste nos testes de teto. Meia hora.

### A3. Evento atrasado (data passada, não resolvido) desaparece da Home?

**Default aplicado: desaparece.** A Home é "próximos 14 dias" por especificação — `data_evento >= CURRENT_DATE`.

**Risco real que isso cria:** o aluno que não abriu o app perde a entrega atrasada de vista exatamente quando mais precisava dela. O item continua visível no Calendário e em Meu quadro, mas não na tela de entrada.

**Alternativa se você quiser:** uma faixa "atrasados" acima da lista, fora do teto de 6. Custa um bloco na Home e uma query. Não fiz porque a Seção 2.1 do handoff é explícita sobre o que a Home mostra, e eu não invento regra de produto.

### A4. Material aceita upload de arquivo ou só link?

**Default aplicado: só link (`url`) no MVP.** A coluna `arquivo_ref` existe no schema, mas **upload não está implementado**.

Razão: upload exige storage de objeto (S3, R2, Supabase Storage), política de tamanho, limpeza de órfãos e uma superfície de segurança nova. É um subsistema, não um campo — e o handoff não pede upload em lugar nenhum, fala de "link_ou_arquivo".

**Isto é uma redução de escopo que eu decidi.** Se a turma precisa subir foto do quadro (o que é plausível e talvez seja o caso de uso principal), isso muda: passa a ser tarefa própria, depois do aceite da Seção 8.

### A5. O papel `PROFESSOR` faz o que de diferente?

**Default aplicado: nada.** Mesmas permissões de `ALUNO`. O papel existe só para exibição no badge de autoria.

Razão: a Seção 1 do handoff diz que professor é contribuidor **opcional, nunca requisito de funcionamento**. Dar poder ao papel o tornaria requisito.

### A6. Quem cria matéria, e escolhe a cor?

**Default aplicado:** qualquer membro cria matéria e escolhe uma das 12 cores da paleta. Não precisa ser o líder.

Razão: coerente com "qualquer aluno posta, sem gatekeeper".

**Efeito colateral:** dois alunos podem criar a mesma matéria com siglas diferentes. Mitigado por `UNIQUE (turma_id, sigla)` e por checagem de duplicata no cliente antes de criar. Não bloqueado no servidor, para não virar gate.

### A7. iOS entra no escopo do MVP?

**Default aplicado: Android primeiro.** O código é Capacitor, então iOS compila, mas eu não desenhei em torno das restrições dele.

**Por que importa:** entrega de data-message em background no iOS é best-effort. Se iOS for alvo real, o furo do push volta parcialmente e a mitigação é somar uma notificação **visível** no cadastro ("nova prova de CALC cadastrada por Ana") — o que é uma feature além da letra do não-negociável, e por isso eu não incluí sem você decidir.

---

## B. Contas e credenciais — você precisa criar, mas nada está travado

Todas têm fake ou fallback, então **o Codex trabalha e testa sem nenhuma delas**. Elas viram necessárias só no momento de rodar em dois aparelhos reais, que é o aceite da Seção 8.

| # | O que | Para que | Fallback ativo hoje |
|---|---|---|---|
| B1 | Projeto no Google Cloud + OAuth Client ID (Android + Web) | Google Sign-In | validador de token fake injetado |
| B2 | Projeto Firebase + service account JSON | FCM data-push | `FakeNotifier` |
| B3 | Postgres gerenciado (Neon, Supabase ou Railway) + host da API | rodar em aparelho real | `docker-compose` local |
| B4 | Conta SMTP (Brevo tem 300/dia grátis) | reset de senha | logger imprime o link no console |

**B3 tem uma escolha embutida** que eu não fiz porque depende de conta sua: onde a API roda. Se for free tier que hiberna, está tudo bem — o design já assume isso, e é por isso que a notificação é local. Só evite host que hiberne **e** cobre cold start de 30s, porque aí cadastrar evento fica desagradável.

---

## C. Coisas que só você sabe

### C1. Nome definitivo do app

Hoje: `projetoFans`, package `com.projetofans.app`. Rebranding depois é cosmético — trocar nome de exibição e ícone. Trocar o **package** depois é mais chato (Google/Firebase amarram credencial ao package), então se você tem um nome em mente, dizer antes de B1/B2 economiza retrabalho.

### C2. Paleta de 12 cores e o design system

**Mockup navegável:** https://claude.ai/code/artifact/bb733f0c-5ae3-4ca8-bf3e-30830f0bdcc3
Fonte versionada: `docs/design/design-system-v1.html`. Validador: `node docs/design/validar-paleta.mjs`.

Escolhi as 12 e validei contraste de verdade — a página calcula os números em vez de afirmá-los.
Todas passam ≥ 4.5:1 com texto branco. Você veta o que não gostar; é troca de token, minutos.

**Uma correção que o cálculo me forçou:** eu queria dizer "as 12 na mesma luminosidade". Falso — elas
ficam entre **L\* 37 e 47**, uma faixa de dez pontos. Igualdade perfeita ao longo da roda de cores não
é alcançável mantendo hue reconhecível e 4.5:1 com texto branco; âmbar e violeta não coexistem no
mesmo L\* sem que um deles pare de parecer âmbar ou violeta. Dez pontos é estreito o bastante para
que nenhuma matéria pareça mais urgente que a outra, e é o que dá para prometer sem mentir.

**Uma decisão visual que eu mudei em relação ao que estava no spec:** prova vs entrega **não** usa
borda-esquerda-grossa. Virou **bloco sólido vs contorno de 1px** — prova é preenchida no valor oposto
ao da página. Duas razões: borda grossa é uma diferença pequena demais para sobreviver a uma olhada
de dois segundos, e é o clichê de card com trilho de acento. Bloco contra contorno é a maior diferença
de tinta disponível, e atravessa daltonismo, sol na tela e screenshot em preto e branco. A página tem
um interruptor de escala de cinza para você conferir.

### C3. Quantas pessoas na turma, e quantas topariam instalar?

Não muda arquitetura. Muda se vale fazer o teste de aceite com 2 aparelhos ou com 8.

### C4. Seção 9 do handoff — o diário eletrônico da faculdade já resolve isso?

Esta é a única pergunta que pode invalidar o projeto inteiro, e ela é de fora do código: **confirmar com a coordenação o que o diário eletrônico já entrega**.

Se ele já responde "o que foi dado no período", o app perde a razão de existir para a turma. Não bloqueia o scaffold nem as primeiras tarefas do Codex. **Bloqueia investir semanas.** Vale perguntar antes da tarefa 6.

---

## D. Respondidas — histórico

| Data | Pergunta | Resposta |
|---|---|---|
| 2026-07-29 | 6.1 Stack | Rota B enxuta: Spring Boot + Postgres gerenciado + FCM |
| 2026-07-29 | 6.2 Backend obrigatório | Sim |
| 2026-07-29 | 6.3 Furo do push | Data-push no cadastro + reagendamento local |
| 2026-07-29 | 6.4 Identidade | Google Sign-In ou e-mail+senha; entrar na turma exige código de convite |
| 2026-07-29 | 6.5 Edição | Só autor edita; líder oculta e pede exclusão; recusado vira "Não listados" |
| 2026-07-29 | 6.5b Quem é líder | Criador da turma, um por turma, transferível |
| 2026-07-29 | 6.6 Hora do evento | Dia obrigatório + hora opcional; véspera às 19h |
| 2026-07-29 | 6.7 Nome | `projetoFans`, provisório |
| 2026-07-29 | Quem faz o design | Claude, não Codex. Mockup navegável primeiro, depois componentes reais |
