# Guia de apresentação — projetoFans

Para 21/10/2026. Otávio de Pádua Rodrigues Ribeiro.
Disciplinas: Trabalho Interdisciplinar I (Prof. César Augusto Oliveira Soares) e Laboratório de
Desenvolvimento de Aplicações Móveis e Distribuídas (Prof. Daniel Lucas de Souza Lelis).

O roteiro abaixo é para **15 minutos**. O professor não definiu o tempo; se for menos, a seção
"o que cortar" no fim diz exatamente o que sai.

---

## Antes de sair de casa

Sete minutos de preparo que evitam os três jeitos de a apresentação dar errado.

1. **Acordar o servidor.** Abra o app no celular uma vez. O plano gratuito suspende a aplicação
   depois de 15 minutos sem uso, e a primeira chamada depois disso pode levar até dois minutos —
   na frente da sala, isso parece um app quebrado.
2. **Conferir que a Home não está vazia.** Precisa ter pelo menos uma prova ou entrega dentro dos
   próximos 14 dias. Se não tiver, cadastre uma.
3. **Olhar as anotações da turma real.** Anotação é texto livre, e é o único lugar do app onde
   pode haver algo pessoal de colega. Se tiver qualquer coisa que você não projetaria, não abra
   essa aba na demonstração.
4. **Tirar quatro prints** no celular: Home, uma prova com material vinculado, Matérias e Meu
   quadro. É o plano B se a internet da sala falhar.
5. **Baixar o deck em PDF ou PPTX.** Não dependa de abrir o link na hora.
6. **Levar o APK** num pendrive ou com link curto, para quem quiser instalar.
7. **Conferir o código da turma de demonstração** — ele está no último slide e precisa estar certo.

---

## Roteiro, minuto a minuto

### 0:00 – 1:30 · Capa e problema (slides 1–2)

Abra com o problema, não com a tecnologia. A sala inteira reconhece a situação, e é isso que
compra a atenção para os dez minutos seguintes.

> "Boa noite. Esse é o projetoFans, um app que a minha turma usa para saber o que cai na semana.
> Ele já está no ar e já tem gente da turma usando — eu vou mostrar funcionando daqui a pouco.
>
> Mas antes: quantos de vocês já perderam o prazo de uma entrega que foi avisada no grupo?
> Porque o aviso normalmente existe. O que não existe é como achar ele de novo na quinta-feira,
> depois de 400 mensagens."

Passe pelos três cartões do slide 2 sem lê-los. Pause depois de "na quinta ninguém acha".

### 1:30 – 3:00 · Objetivo, público e escopo (slides 3–4)

> "O objetivo é responder duas perguntas em cinco segundos: o que vem aí, e o que foi dado.
>
> E tem uma frase que governa o projeto inteiro: o app vende **o que foi dado no período**, nunca
> **o que vai cair na prova**. Ele não tem como saber o conteúdo da prova, e prometer isso faria a
> turma confiar em algo que ele não entrega."

No slide 4, sobre o escopo recusado:

> "Essa lista toda está num documento, escrita como 'fora do escopo', desde o começo. Não é que
> não deu tempo — é que eu escrevi que não entraria, e não entrou."

### 3:00 – 7:00 · Demonstração ao vivo (slide 5)

Quatro minutos, não mais. Narre o que está fazendo.

1. **Home** — "próximos 14 dias, no máximo 6 itens, ordenados por data. Repare que embaixo de cada
   um tem o nome de quem cadastrou e quando."
2. **Cadastrar uma entrega ao vivo** — "eu não pedi autorização pra ninguém. Qualquer pessoa da
   turma faz isso, e aparece pros outros na hora."
3. **Abrir uma prova** — "aqui só aparece o material que alguém ligou *nessa* prova. Não é a
   matéria inteira despejada."
4. **Meu quadro** — marcar algo como resolvido. "Isso é só meu. Se vocês abrirem o app agora,
   continua pendente aí."

**Se a internet falhar:** passe para os prints e diga "o servidor é gratuito e dorme; isso é do
plano de hospedagem, não do app". Siga em frente. Não fique recarregando na frente da sala.

### 7:00 – 9:00 · Arquitetura e níveis de acesso (slides 6–7)

> "O celular não decide nada. Toda regra vive no servidor — inclusive o limite de 6 itens e a
> janela de 14 dias. Se isso fosse decidido no celular, cada tela poderia divergir com o tempo e
> ninguém perceberia, até a turma perder uma prova."

Na tabela de papéis, aponte a coluna **Não pode**:

> "Repare que nem o líder edita registro dos outros. Ele pode ocultar, e isso fica registrado com
> data e autor, mas não pode mudar o que está escrito. Se ele pudesse reescrever a prova que eu
> cadastrei mantendo o meu nome embaixo, o meu nome deixaria de significar alguma coisa."

### 9:00 – 11:00 · Segurança e auditoria (slides 8–9)

O slide 9 é o mais forte da apresentação. Fale devagar.

> "Eu fiz uma auditoria no meu próprio sistema e achei três falhas que eram exploráveis de verdade.
> Uma delas permitia tomar a conta de outra pessoa pelo login do Google.
>
> E tem uma coisa que eu quero destacar sobre como eu verifiquei. Um teste que passa não prova que
> a proteção funciona. Prova que ou ela funciona, ou o teste não exercita ela — e são coisas muito
> diferentes. Então para cada falha eu **desliguei a correção de propósito** e rodei o teste de
> novo. Se continuasse verde, o teste era inútil. Os três ficaram vermelhos. Aí eu soube que a
> falha era real e que o teste morde."

### 11:00 – 12:30 · Obstáculos (slide 10)

> "O Docker da minha máquina parou de funcionar em 3 de agosto e não voltou. Como os testes de
> banco dependiam dele, por 27 dias eu não conseguia provar que nada estava pronto — o critério de
> pronto era 'os testes passam'.
>
> Eu podia ter continuado escrevendo código e torcido. Escolhi trocar a infraestrutura de teste
> por um Postgres embutido. E recusei usar um banco leve 'quase compatível', porque um banco que
> mente num teste é pior que um teste que não roda."

### 12:30 – 14:00 · Recursos, números e benefícios (slides 11–13)

Rápido. Não leia as tabelas.

> "São 413 testes automatizados no servidor. Eles não são enfeite: são o que me deixou mexer no
> sistema em outubro sem medo de quebrar o que funcionava em agosto."

Nos benefícios, use o presente, não o futuro:

> "Esses não são benefícios que eu espero ter. Alguns já aconteceram, porque o app está no ar."

### 14:00 – 15:00 · Limites, canal e perguntas (slides 14–15)

> "Nenhum sistema está pronto. Esses são os limites que eu conheço e consigo nomear — e conhecer o
> limite é diferente de não ter limite.
>
> O código da turma de demonstração está na tela. Quem quiser instalar agora e cadastrar uma prova,
> pode — e eu vejo aparecer aqui no meu celular na hora. É uma turma separada, então os dados da
> minha turma não ficam expostos.
>
> Sugestão de melhoria: abre uma issue no repositório. Perguntas?"

Fique **neste slide** durante todo o Q&A. Ele responde três itens da lista do professor ao mesmo
tempo: abrir para perguntas, deixar canal de comunicação e dar acesso para teste.

---

## Perguntas prováveis, com resposta curta

**Por que não usou Firebase? Seria mais rápido.**
Porque o modelo de dados é relacional de verdade. Material e prova têm relação muitos-para-muitos,
e o histórico de edição precisa ser auditável. Banco relacional faz as duas coisas naturalmente;
banco de documentos te empurra a duplicar dado, e aí o isolamento entre turmas fica frágil. Além
disso, o push do Firebase é separável do banco dele — dava para usar só a notificação.

**Como você garante que um aluno não edita a prova do outro?**
A checagem é no servidor, não na tela. E tem teste automatizado que falha se alguém remover a
guarda — eu verifiquei desligando a guarda de propósito e confirmando que o teste fica vermelho.

**E se duas pessoas cadastrarem a mesma prova?**
Ficam as duas. O sistema não bloqueia, porque bloquear exigiria uma etapa de aprovação, e aprovação
é exatamente o que o app recusa ter. O cliente avisa quando já existe algo parecido na mesma data,
e aí a pessoa decide.

**Por que o líder não pode editar?**
Porque autoria é o mecanismo de confiança. Se o líder reescrevesse o registro mantendo o nome do
autor original, o nome deixaria de valer. Ele muda visibilidade, e a ação fica registrada.

**Como funciona o aviso da véspera se o servidor dorme?**
O alarme é agendado no próprio celular, não disparado pelo servidor. O servidor só avisa o aparelho
quando algo muda, e o aparelho reagenda. Se o servidor estiver suspenso às 19h, a notificação sai
assim mesmo.

**Por que Java 17 e não a versão mais nova?**
Porque a variável de ambiente desta máquina aponta para o 17, e mudá-la quebra o empacotamento
Android, que exige 21. Nada no projeto usa recurso exclusivo de versão mais nova. Subir a versão
sem ajustar o ambiente já quebrou o build uma vez — está documentado.

**Quantas pessoas usam?**
Integrantes da turma, em aparelho próprio, desde setembro. É turma piloto, não produto de mercado.

**Você usou inteligência artificial para programar?**
Sim, e está registrado. O repositório tem um diário com 38 entradas datadas, cada uma dizendo o que
foi decidido e por quê — inclusive as decisões que foram revertidas. As decisões de arquitetura são
minhas e eu defendo cada uma.

**O que você faria diferente?**
Teria trocado a infraestrutura de teste no primeiro dia em que o Docker parou, em vez de esperar.
Perdi quase quatro semanas sem conseguir provar que o que eu escrevia estava certo.

---

## O que cortar, se o tempo for menor

| Tempo | O que sai |
|---|---|
| 12 min | Slide 10 (obstáculos) inteiro |
| 10 min | Slide 10, e o slide 12 (números) vira uma frase |
| 7 min | Slides 10, 11 e 12. Mantenha problema, demo, segurança e canal |

Nunca corte a **demonstração** nem o slide de **auditoria**. São os dois que diferenciam o
trabalho.

---

## Itens do professor e onde cada um é atendido

| Item pedido | Onde |
|---|---|
| Objetivo do projeto | Slide 3 · documento seção 2 |
| Público-alvo | Slide 3 · documento seção 3 |
| Benefícios pós-implantação | Slide 13 · documento seção 9 |
| Obstáculos e dificuldades | Slide 10 · documento seção 8 |
| Recursos utilizados | Slide 11 · documento seção 4 |
| Projeto e funcionalidades, com BD alimentado | Slides 5 e 6 · demonstração ao vivo |
| Níveis de acesso e segurança | Slides 7, 8 e 9 · documento seção 7 |
| Abrir para questionamentos | Slide 15 |
| Canal para sugestões | Slide 15 — issues do repositório |
| Acesso ao sistema para teste | Slide 15 — código da turma de demonstração + APK |
| PDF normalizado ABNT | `projetoFans-documentacao-ABNT.pdf` |

---

## Turma de demonstração — criada e verificada

Separada da turma real de propósito: o código vai para o slide final e para a plateia, então
ninguém que entrar por ali enxerga os dados dos seus colegas.

| | |
|---|---|
| **Código de convite** | `65722528` |
| Login (só se você precisar entrar como dono) | `demo.apresentacao@projetofans.app` |
| Senha | `demo-apresentacao-2026` |

Conteúdo plantado — datas relativas ao dia 21, para caírem dentro da janela de 14 dias da Home:

| Data | Tipo | Matéria | Título |
|---|---|---|---|
| 22/10 | Entrega | MOBILE | Entrega do protótipo navegável |
| 24/10 | Prova | BD | Prova 2 — normalização e consultas SQL |
| 27/10 | Entrega | TI1 | Documentação ABNT do projeto |
| 29/10 | Prova | ESOFT | Prova 1 — requisitos e casos de uso |
| 01/11 | Entrega | MOBILE | Relatório de testes em dispositivo real |
| 03/11 | Entrega | BD | Lista 4 — modelagem relacional |

**Verificado em 18/10** contra o servidor no ar: a Home devolve os itens ordenados por data, dentro
do teto de 6, e o primeiro item é uma **entrega** que vem antes de uma **prova** — o que demonstra
ao vivo o não-negociável "ordem é urgência, nunca tipo". O sexto evento entra na janela no dia 21.

Para recriar ou completar: `node docs/apresentacao/criar-turma-demo.mjs` (é idempotente, não
duplica o que já existe).

---

## Como regerar o PDF ABNT

```
node docs/apresentacao/gerar-pdf.mjs       # gera o PDF a partir do HTML
node docs/apresentacao/mapear-paginas.mjs  # confere se o sumário bate com o documento
```

O segundo script falha de propósito se as páginas saírem fora de ordem — foi assim que se descobriu
que o sumário havia crescido para duas páginas e deslocado a numeração de todas as seções.

**Ressalva conhecida:** o Chrome aplica a numeração em todas as páginas, inclusive na capa. A ABNT
quer a contagem a partir da folha de rosto, mas a numeração visível só da introdução em diante. Para
corrigir, apague o número das três primeiras páginas num editor de PDF, ou gere sem numeração
removendo `displayHeaderFooter` do script.
