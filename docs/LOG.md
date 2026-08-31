# Log de progresso — projetoFans

Ordem cronológica. **Blocos são anexados ao fim, nunca reescritos.** Quem lê de baixo pra cima vê o estado atual; quem lê de cima pra baixo vê como chegou aqui.

Formato para o Codex está em `../AGENTS.md`, seção "Como registrar no log".

---

### [2026-07-29] Tarefa 0 — Planejamento (Claude)

**Status:** concluída

**O que foi feito:**
Fechadas as sete decisões abertas da Seção 6 do handoff com o dono do projeto. Escrito o spec técnico, emendado o handoff para v2, e criados os arquivos que o Codex lê direto. Repo git inicializado dentro de `Projeto Fans` — a pasta estava dentro do repo que ficou por acidente em `C:\Users\gh0st`, e commitar ali varreria a home inteira.

**Arquivos principais:**
- `AGENTS.md` — não-negociáveis e regras de código, leitura obrigatória do Codex
- `docs/HANDOFF-v2.md` — fonte de verdade de produto, com a Seção 6 fechada
- `docs/HANDOFF-v1-original.md` — original preservado
- `docs/superpowers/specs/2026-07-29-projetofans-design.md` — spec técnico
- `docs/PERGUNTAS-ABERTAS.md` — o que sobrou, com default aplicado em cada item
- `docs/LOG.md` — este arquivo

**Decisões que eu tomei:**

*Stack (6.1) — Rota B enxuta: Spring Boot + Postgres gerenciado + FCM.* O argumento decisivo não foi portfólio, foi o modelo de dados: `EventoMaterial` é N:N real, `Revisao` é append-only auditável, e a regra 3 proíbe embutir estado pessoal no fato compartilhado — que é o idioma do Firestore. Somado a isso, FCM é separável do resto do Firebase, o que neutraliza a única vantagem real da Rota A.

*Restrição nova do dono: arquitetura expansível para faculdades.* Não mudou escopo. Mudou quatro coisas baratas: UUID como PK, `turma_id` em todo fato compartilhado, `membro` como N:N, e escopo de turma num componente único. `Instituicao` não foi construído — adicioná-lo depois é uma tabela e uma FK, sem tocar em query.

*Push (6.3) — data-push no cadastro + notificação local.* O alerta é local de propósito: hibernação de free tier não pode quebrá-lo. Se fosse job `@Scheduled` no servidor, o não-negociável falharia em silêncio num host dormindo.

*Emenda ao handoff.* O dono pediu líder de turma com poder de ocultar. A Seção 4 da v1 vetava esse papel **pelo nome**. Alertei, ele reafirmou, e é decisão dele. Emendei a cláusula com data e justificativa. O que preservei e virou teste: nada é aprovado antes de existir, e o líder não altera conteúdo alheio, só visibilidade.

*Design saiu do Codex.* Decisão do dono. Eu entrego paleta, tokens e os componentes de apresentação; Codex faz só o wiring. `app/src/app/shared/` é zona proibida para ele.

*Home calculada no servidor.* Teto de 6, janela de 14 dias e ordenação vivem em `HomeService`, não no cliente. Três não-negociáveis com uma implementação e uma suíte de teste, em vez de espalhados por componente Angular onde divergiriam sem ninguém notar.

*Upload de arquivo ficou fora.* Registrado em `PERGUNTAS-ABERTAS.md` A4. Material aceita só link no MVP. Upload exige storage de objeto, política de tamanho e limpeza de órfãos — é subsistema, não campo. Pode ser que seja o caso de uso principal (foto do quadro); se for, vira tarefa própria depois do aceite.

**Travas / dúvidas:**
Nenhuma que bloqueie código. Todas as credenciais externas (Google OAuth, FCM, SMTP, Postgres) saíram como variável de ambiente com fake em dev, então o Codex trabalha e testa sem nenhuma conta criada.

A única pergunta que pode invalidar o projeto é de fora do código: Seção 9 do handoff — confirmar com a coordenação se o diário eletrônico da faculdade já resolve "o que foi dado no período". Não bloqueia scaffold; bloqueia investir semanas. Vale perguntar antes da tarefa 6.

---

### [2026-07-29] Design fase 1 — mockup navegável (Claude)

**Status:** concluída, aguardando aprovação do dono

**O que foi feito:**
Design system com paleta de 12 matérias, tokens de tema claro/escuro, o par prova/entrega, as 4 telas do MVP e os estados vazios. Publicado como página navegável e versionado no repo. A página **calcula** o contraste de cada cor em vez de afirmá-lo, e tem um interruptor de escala de cinza que roda o critério de aceite visual da Seção 8 ao vivo.

**Arquivos principais:**
- `docs/design/design-system-v1.html` — fonte versionada
- `docs/design/validar-paleta.mjs` — validador de contraste, roda com `node`
- Mockup publicado: https://claude.ai/code/artifact/bb733f0c-5ae3-4ca8-bf3e-30830f0bdcc3

**Critério de aceite:**
`node docs/design/validar-paleta.mjs` → `OK: 12/12 passam`.
Verificação estrutural da página: tags balanceadas, 5 ids referenciados existem, 30 custom properties todas declaradas, JS executa e produz 12 swatches e 44 células de calendário.

**Decisões que eu tomei:**

*O cromo do app é acromático de propósito.* Os dados já usam a roda de cores inteira — uma hue por matéria, 6 a 12 por turma. Se a UI também fosse colorida, competiria com a informação. Ground é cinza-papel com viés verde, tinta quase preta, e **um** acento teal reservado ao que é interativo.

*Prova vs entrega mudou de borda-grossa para sólido vs contorno.* Contradiz o que eu mesmo havia escrito no spec, e corrigi o spec. Duas razões que só apareceram ao desenhar: borda grossa é diferença pequena demais para uma olhada de dois segundos, e é o clichê de card com trilho de acento. Bloco sólido contra contorno é a maior diferença de tinta disponível e atravessa daltonismo, sol na tela e screenshot em preto e branco.

*Chip é uma regra só:* preenchimento sólido da hue + texto branco, em qualquer ground e qualquer tema. Sem variante por tema, o que elimina uma classe de bug inteira.

*Tipografia é da plataforma* (`system-ui` → Roboto no Android, SF no iOS). Num app Capacitor é o certo, e o CSP da página publicada bloqueia CDN de fonte — linkar webfont daria fallback silencioso.

**Travas / dúvidas:**

Eu afirmei no spec que as 12 cores ficariam "na mesma luminosidade". O cálculo desmentiu: elas ficam entre **L\* 37 e 47**. Igualdade perfeita não é alcançável na roda de cores mantendo hue reconhecível e 4.5:1 — âmbar e violeta não coexistem no mesmo L\*. Corrigi a afirmação em vez de forçar as cores, e a página mostra o L\* de cada uma. Dez pontos é estreito o bastante para que nenhuma matéria pareça mais urgente por acidente.

O navegador embutido travou em `navigate` (timeout de 300s), então a validação visual foi feita por parse estrutural e execução do JS em Node, não por screenshot. A página abre normalmente no link publicado.

**Próximo passo:** aprovada a fase 1, converter em componentes Ionic/Angular reais em `app/src/app/shared/` — o que desbloqueia as tarefas 10-12 do Codex.

---

### [2026-08-03] Tarefas 1 e 2 — backend escrito, TESTES NÃO RODARAM (Claude)

**Status: parcial.** Código escrito e compilando. Nenhum teste executado — Docker travado, detalhe abaixo.

**O que foi feito:**
Scaffold do backend (pom, docker-compose, application.yml com três perfis, classe de aplicação), migration V1 completa, 12 entidades JPA, 12 repositories, seed de dev e a suíte `SchemaTest` com 6 testes.

**Arquivos principais:** `backend/pom.xml`, `backend/src/main/resources/db/migration/V1__schema_inicial.sql`, `backend/src/main/java/com/projetofans/{domain,repo,config}/`, `backend/src/test/java/com/projetofans/`

**Critério de aceite: NÃO ATINGIDO.** `./mvnw test-compile` passa; `./mvnw test` não foi executado.

**Trava — Docker Desktop não sobe.**
O daemon não responde: `docker info` estoura timeout e o named pipe `dockerDesktopLinuxEngine` não existe. Os processos do Docker Desktop estão no ar e a distro WSL `docker-desktop` fica em `Stopped`. Sintoma típico de app parado em tela de onboarding/login esperando interação humana. Tentei iniciar o app duas vezes e forçar `DockerCli.exe -SwitchLinuxEngine`; nada.

**Para destravar:** abrir o Docker Desktop manualmente, passar por qualquer tela de aceite/login, e confirmar com `docker run --rm hello-world`. Depois disso `cd backend && ./mvnw test` deve rodar sem mais nada.

**Decisões que eu tomei:**

*Java 17, não 21.* O `JAVA_HOME` desta máquina aponta para `dev-tools\jdk-17`; há zulu-25 e jdk-24 instalados, mas mudar `JAVA_HOME` global afetaria os outros projetos Java daqui. 17 é a baseline do Spring Boot 3.x e nada aqui usa recurso exclusivo do 21. Spec e plano diziam 21 — corrigido no `pom` com o motivo escrito.

*Enums viraram `TEXT` + `CHECK`, não `CREATE TYPE ... AS ENUM`.* Enum nativo do Postgres com `ddl-auto: validate` do Hibernate é atrito conhecido de mapeamento, e adicionar valor depois vira `ALTER TYPE` em vez de trocar uma constraint.

*O seed virou componente Java com `@Profile("dev")`, não migration SQL.* Usuário de seed precisa de hash BCrypt válido e SQL não computa hash — em migration eu teria de colar um literal e torcer para conferir.

*Container do Testcontainers é singleton de JVM* (`TesteComPostgres`), não `@Container` por classe. Com ~10 classes de teste, o padrão idiomático subiria dez Postgres em vez de um.

*`SegurancaConfig` está com `permitAll`.* Deliberado neste estágio — trancar antes de existir emissão de JWT tornaria o scaffold impossível de exercitar. **Não pode chegar a produção assim**; a Task 3 substitui.

*Dois testes a mais do que o plano pedia:* `naoPermiteCorForaDoFormatoHex` e `eventoNaoTemColunaFeito`. O segundo consulta `information_schema` e cai se alguém adicionar uma coluna de estado pessoal em `evento` — é o não-negociável 3 virando teste em vez de comentário.

**Travas / dúvidas:** só o Docker.

---

### [2026-08-21] Design system e telas no Figma — 3 de 5 telas (Claude)

**Status: parcial.** Sistema completo, 3 telas prontas, 2 bloqueadas por cota do Figma.

Criado o arquivo **projetoFans — Design System e Telas**
(`2y3DwZteuQfOFQxoj7o1fd`), convertido de `docs/design/design-system-v1.html`. Nada foi
redesenhado — o mockup da fase 1 é a fonte, e os hexes foram reconferidos rodando
`validar-paleta.mjs` antes de gravar: 12/12 passam, mínimo 4.92:1.

**Pronto:** 26 variáveis de cor (13 tokens × 2 temas), 12 hues de matéria, 3 raios,
14 estilos de texto, e 5 componentes — Chip de materia, Card de evento, Barra de abas,
Mini card, Linha de material. Telas Home, Matérias e Meu quadro.

**Pendente:** Calendário, Home vazia e Home offline. Os scripts estão escritos e prontos
em `docs/design/figma/README.md`, junto com o mapa de IDs necessário para rodá-los.

**Trava — cota de chamadas MCP do plano Starter do Figma.** Não é limite de tempo
conhecido; a mensagem do servidor só oferece upgrade. Tentei duas vezes com intervalo.
Para destravar: esperar a janela virar ou subir o plano, e rodar os dois scripts do README.

**Decisões que eu tomei:**

*Fonte Roboto, não Inter.* O mockup usa a stack `system-ui`, que no Android via Capacitor
resolve para Roboto. Inter seria a escolha automática e estaria errada.

*Telas em 390×844, não nos 274px do mockup.* O `.screen` do HTML é uma miniatura de
preview, com proporção que não é de aparelho nenhum. Reinterpretei a escala tipográfica
para tamanho real de telefone preservando as relações — título 16, barra 21, mono 11.

*Temas viraram grupos de nome, não modos.* O plano Starter limita a 1 modo por coleção.
`claro/paper` e `escuro/paper` na mesma coleção dão o mesmo acesso sem depender do plano.
Custo: trocar tema exige religar variáveis em vez de um toggle. Num plano pago, converter
é meia hora.

*Chip virou variant set de 12, não um componente com fill sobrescrito.* Mais caro de
construir, mas faz o Figma recusar cor fora da paleta — que é o mesmo raciocínio do spec
ao dizer que a regra deve depender da API do componente, não de disciplina.

*Card de evento ganhou `Mostrar chip` e `Mostrar rodape` como booleanos.* A tela de
Matérias precisa de card sem chip (você já está dentro da matéria). Esconder o filho por
override resolveria, mas ficaria invisível na API — ninguém montando tela nova saberia
que é permitido.

*Estado vazio e offline são duas telas separadas.* O mockup já as separa e o spec diz por
que: confundir *não tem prova* com *falhei ao buscar* é o pior bug que este app pode ter.

**Próximo passo inalterado:** converter o mockup aprovado em componentes Ionic/Angular
reais em `app/src/app/shared/`, o que desbloqueia as tarefas 10-12 do Codex. O Figma é
referência e superfície de ajuste barato — não substitui essa conversão.

---

### [2026-08-21] Telas v2 — grade de aulas, calendário expansível e anotações (Claude)

**Status: entregue como mockup navegável.** `docs/design/telas-v2.html`, publicado como Artifact.

O dono pediu telas novas: Home com as próximas 3 aulas e o que há para entregar, com um
quadrado pequeno e uma ilustração vetorial de sala de aula; calendário que expande o dia
mostrando matéria, sala e atividade; e anotações — lembrete do líder visível para a turma
inteira, mais uma anotação pessoal de cada um.

Entregue em mockup e não no Figma porque a cota MCP do plano Starter do Figma segue
estourada (ver entrada anterior). Mockup navegável é o formato preferido da fase de design
neste projeto de qualquer forma; a conversão para Figma fica pendurada na cota.

**Telas:** Home, Calendário (com dia expansível), Anotação (compor), Matérias. Navega de
verdade — abas trocam de tela, dias do calendário abrem, e o seletor de alcance da anotação
troca o texto do aviso e do botão.

**Decisões que eu tomei:**

*O quadrado virou informação, não enfeite.* Ele pediu "um pequeno quadrado" com "imagem
tipo sala de aula do tipo vetor". Em vez de decoração, o quadrado carrega o código da sala
sob o vetor — vira o marcador de "isto é uma aula", função equivalente à do glifo
cheio/vazado para prova e entrega. Monocromático, porque a cor já identifica matéria.

*Nota da turma e nota pessoal se distinguem por forma, não por cor.* Régua sólida no accent
com rótulo "da turma · todos veem" contra régua tracejada com "pessoal · só você". Mesma
lógica do par prova/entrega: sobrevive à escala de cinza. Confundir as duas é pior que bug
de layout — alguém deixa de estudar por causa de rabisco alheio.

*Só a aula em andamento tem trilho de accent.* Se tudo destacasse, nada destacaria.

**Verificado:** JS passa em `node --check`, tags HTML balanceadas, e a matemática de dia da
semana de agosto/2026 confere com `Date` real em 6 datas testadas — 21/ago é sexta (dia de
BD e ESOFT na grade) e 25/ago é terça (dia de CALC2, matéria da prova). O screenshot do
navegador embutido estourou timeout de novo, mesmo sintoma da v1; a validação visual foi
feita numa captura da Home antes do travamento.

**O que isto exige do backend e ainda NÃO existe no schema:**

| falta | tabela | por quê |
|---|---|---|
| Grade de aulas | `aula` — turma_id, materia_id, dia_semana, hora_inicio, hora_fim, sala | Provas e entregas são pontuais; aula é recorrente e precisa de exceção (feriado, cancelamento, troca de sala), senão a Home mente no primeiro feriado |
| Sala | coluna em `aula`, não em `materia` | A mesma matéria cai em salas diferentes por dia; pendurar em `materia` quebra na primeira aula de laboratório |
| Anotação da turma | `anotacao` — turma_id, autor_id, data, texto | Amplia o papel do líder: hoje ele só modera, aqui passa a emitir |
| Anotação pessoal | `anotacao_pessoal` — usuario_id, data, texto | Tabela separada, não coluna — o não-negociável 3 proíbe estado pessoal dentro do fato compartilhado |

**Pergunta aberta que pode invalidar parte disto:** o handoff vende *"o que foi dado no
período"*. Grade de aulas empurra o produto para *"grade horária"*, que é outra coisa. Se a
faculdade já publica a grade, replicá-la é trabalho duplicado com risco de divergir — a
mesma dúvida que já está pendente sobre o diário eletrônico. Vale conferir antes de
construir o backend disto.

---

### [2026-08-22] Envio de material com arquivo — A4 revertida (Claude)

**Status: telas prontas.** `docs/design/telas-v2.html`, mesmo Artifact de ontem.

O dono perguntou se professor ou líder poderiam subir os PDFs e arquivos. A resposta estava
em dois lugares do repo e vale repetir porque contraria a intuição da pergunta:

- **Não é privilégio de ninguém.** Qualquer membro posta material — não-negociável 1. O papel
  `PROFESSOR` já existe (A5) mas com as mesmas permissões de aluno; ele serve só ao badge de
  autoria, porque dar poder ao papel tornaria o professor requisito de funcionamento, e o
  handoff diz que ele é contribuidor opcional.
- **Mas ninguém conseguia subir arquivo nenhum.** A A4 tinha reduzido o escopo para só link,
  com `arquivo_ref` sempre NULL. A própria A4 previa que isso mudaria se foto do quadro fosse
  o caso de uso principal. O pedido do dono é esse gatilho, então **A4 foi revertida** e
  documentada como resolvida.

**Telas:** nova tela "Enviar material" (origem foto/arquivo/link, título, matéria, tipo,
vínculo opcional com prova) alcançada por botão dentro de Matérias — não virou aba, porque as
quatro abas são fixas. Matérias ganhou os estados de envio: enviando com barra de progresso, e
falhou com "sem conexão · fica na fila" e botão de refazer.

**Decisões que eu tomei:**

*Falha de envio usa forma e palavra, nunca cor.* Contorno tracejado, glifo cheio e o texto
dizendo o que houve. Vermelho seria o reflexo automático, mas `--m-alg` é uma hue de matéria —
pintar erro de vermelho quebraria a regra de que cor identifica matéria e nada mais. Também
sai de graça para daltônico.

*O envio nunca some quando falha.* Mesmo princípio da tela offline: lista vazia disfarçando
falha é o pior bug possível aqui. O arquivo que falhou continua visível, na fila, com botão.

*Sem fila de aprovação.* Publica direto, com o aviso de que a turma toda vai ver com o seu
nome. Moderação continua posterior ao fato, como manda a decisão 2.5.

**Storage recomendado (registrado na A4):** Cloudflare R2 com URL pré-assinada. Egress grátis
é o argumento decisivo — 30 pessoas rebaixando o mesmo PDF é exatamente o padrão que faz egress
cobrado doer. Limpeza de órfãos por *lifecycle rule* do R2, não por `@Scheduled`, porque host
de tier gratuito hiberna e job agendado em host dormindo falha em silêncio — mesmo raciocínio
da decisão 2.3.

**Verificado:** `node --check` no JS, tags balanceadas, 5 telas, e todos os `data-ir` apontam
para uma tela existente. Sem validação visual — o navegador embutido segue estourando timeout
no screenshot.

**Fica aberto:** cota de storage por turma. Sem teto, uma turma come os 10 GB gratuitos
sozinha. Sugeri 2 GB com aviso em 80%, mas é decisão de produto, não implementei.

---

### [2026-08-22] Telas v2 completas — quadro, estados e a aba que sobrava (Claude)

**Status: conjunto fechado.** Seis telas navegáveis mais os dois estados da Home.

Faltavam Meu quadro, Home vazia e Home offline — existiam só na v1. Portadas para a v2.

**Correção de estrutura.** Com "Anotar" virando aba, ficaram cinco destinos para quatro abas.
Anotar não é destino, é ação de compor, e é sempre sobre um dia — então virou botão dentro do
dia expandido do calendário, com seta de voltar. As abas voltaram às quatro canônicas da v1:
Home, Cal, Matérias, Quadro. Mesmo padrão que já valia para "Enviar material", que mora dentro
de Matérias.

**Estados da Home ficaram lado a lado**, em frames menores fora do aparelho navegável, em vez
de escondidos atrás de um seletor. Vazio e offline só são revisáveis quando dá para comparar
os dois de relance — que é o ponto inteiro de eles não poderem se parecer.

**Verificado:** `node --check`, tags balanceadas, seis `data-tela` únicos, quatro abas, nenhum
`data-ir` apontando para tela inexistente.

**Nota sobre o Figma:** ele agora está atrasado em relação a isto. Tem três telas, todas na
versão v1 — sem grade de aulas, sem sala, sem anotações, sem envio. Os scripts em
`docs/design/figma/README.md` cobrem só o que faltava da v1; a v2 inteira ainda não tem script.
Enquanto a cota do Starter não voltar, o mockup é a fonte de verdade visual.

---

### [2026-08-22] Componentes Ionic/Angular reais — tarefas 10-12 desbloqueadas (Claude)

**Status: entregue e verificado.** Lint limpo, 11/11 testes, build passa.

Fase 2 do design: o mockup aprovado virou componente de verdade em
`app/src/app/shared/`, que era a condição escrita no `AGENTS.md` para destravar as
tarefas 10 a 12 do Codex.

**Entregue:**

- `src/theme/variables.scss` — os tokens do design system, com os nomes idênticos aos do
  mockup para não precisar de tradução ao comparar. Mapeia as variáveis do Ionic por cima,
  o que funciona porque este arquivo carrega depois do `global.scss` no build.
- `shared/` — `MateriaChip`, `EventoCard`, `AulaCard`, `MiniCard`, `MaterialLinha`, `Nota`.
- `shared/design-system.spec.ts` — 11 asserções sobre os não-negociáveis visuais.
- `global.scss` — três utilitários de página (`.pf-rotulo`, `.pf-pilha`, `.pf-vazio`).
- Páginas `home` e `quadro` renderizando, com dados de exemplo em signal.

**Bug pré-existente encontrado: o app não compilava.** `tabs.routes.ts` importava
`features/quadro/quadro.page`, mas a pasta `quadro/` estava vazia — o scaffold criou a rota
e o diretório e nunca a página. Nenhum build tinha sido rodado desde então. Criei a página,
que é justamente onde o `MiniCard` vive.

**Decisões que eu tomei:**

*A regra virou tipo, não comentário.* `MateriaChip` tem `cor` e `sigla` como `input.required`,
e `Materia` é um par indivisível em `tipos.ts`. "Cor + sigla sempre juntas" deixa de depender
de disciplina: quem tentar renderizar só a cor não compila.

*O tipo do evento também virou texto.* Prova e entrega se distinguiam só por tinta e forma,
o que deixava leitor de tela de fora — a distinção existia para quem enxerga e não existia
para quem ouve. Agora vai um rótulo visualmente escondido e anunciado.

*Prefixo `app-`, não `pf-`.* Eu tinha escolhido `pf-`; o eslint do projeto exige `app`.
Segui a convenção que já estava configurada em vez de afrouxar a regra.

*Nada de sombra nem de estado de pressão inventado.* "Melhorar o design" aqui não é
acrescentar profundidade — o sistema é chapado de propósito. O que melhorou foi o que estava
faltando de fato: acessibilidade do tipo de evento, quebra de título longo sem estourar
coluna, numeral tabular nas datas, e `OnPush` em tudo.

**Verificado:** `ng lint` limpo, `ng test` 11/11 em Chrome headless, `ng build` completa.

**Arquivos mortos encontrados, não apagados:** `tabs.page.html`, `tabs.page.scss` e
`app.component.scss` são restos do starter do Ionic — nenhum componente usa `templateUrl`
ou `styleUrl`. Deixei para decisão de quem toca no app.

---

### [2026-08-26] Planejamento V2 — tarefas 13 a 16 (Claude)

**Status:** concluída.

**O que foi feito:**
O design tinha passado na frente do plano. Desde 21/08 existem componentes, telas aprovadas e
tipos congelados para grade de aulas, anotações e envio de arquivo — e nenhuma tarefa, nenhuma
tabela e nenhum endpoint para nada disso. Três dos seis componentes de `shared/` não tinham de
onde puxar dado. Escrevi as Tasks 13 a 16 fechando esse buraco, na mesma densidade das 1-12:
caminho de arquivo, assinatura, nome de teste e comando de aceite.

**Arquivos principais:** `docs/superpowers/plans/2026-07-29-projetofans-mvp.md` (Tasks 13-16,
grafo de dependências, self-review V2), `docs/PERGUNTAS-ABERTAS.md` (A8, A9, A10), `AGENTS.md`

**Critério de aceite:** documental — o plano agora cobre todo componente entregue. Nenhum código
tocado, nenhum teste a rodar.

**Decisões que eu tomei:**

*Uma tabela `anotacao`, não duas.* O log de 21/08 propôs `anotacao` + `anotacao_pessoal` citando o
não-negociável 3. É leitura errada dele: o não-negociável proíbe estado pessoal **dentro de fato
compartilhado** — `feito` como coluna de `evento`. Anotação pessoal não é estado sobre fato alheio,
é registro próprio com autor próprio. E `shared/tipos.ts` já congelou `AlcanceNota` como um tipo
só, com `alcance` de input; duas tabelas contradiriam o componente entregue.

*Nota da turma não é privilégio do líder.* O log de 21/08 escreveu que ela "amplia o papel do
líder: hoje ele só modera, aqui passa a emitir". Isso colide com o não-negociável 9 e com a A5.
Mantive o não-negociável e virei o rótulo do mockup em descrição, não em permissão — com teste
nomeado na Task 14 para a regra não voltar por descuido.

*`agora` não vai no DTO da aula.* Flag de "aula em andamento" calculada no servidor chega velha:
resposta cacheada, app aberto, e às 10h05 ele ainda destaca a aula das 9h. O servidor manda
`horaInicio`/`horaFim` e a página compara com o relógio. Comparar relógio é apresentação. O teto
de 6 e a janela de 14 dias continuam no servidor — esses são regra de negócio de verdade.

*Exceção de aula virou tabela, não fui pela versão mais curta.* `aula_excecao` com feriado,
cancelamento e troca de sala é uma tabela a mais que eu preferiria não escrever. Escrevi porque
grade recorrente sem exceção mente no primeiro feriado, e a tela existe justamente para dizer
onde a pessoa precisa estar agora.

*Construí a grade mesmo com a dúvida aberta.* A A8 pode invalidar as Tasks 13, 14 e 16 inteiras.
Planejei assim mesmo porque travar deixaria `AulaCard` sem origem de dado por tempo indeterminado
— e plano não gasta nada até virar código. Está escrito no plano e na A8 que a pergunta vale
**antes** de começar a 13.

**Correções que encontrei no caminho:**

- Task 10 mandava consumir `EventoItemComponent`. Esse componente nunca existiu; o entregue é
  `EventoCardComponent`, seletor `app-evento-card`. O Codex teria travado na primeira linha.
- O grafo de dependências ainda dizia que 10-12 estavam bloqueadas, dez dias depois de terem sido
  desbloqueadas. Corrigido, com a tabela de seletores e inputs reais dos seis componentes.
- `AGENTS.md` não registrava que a Task 2 continua parcial. Registrado, com a regra explícita de
  não marcar tarefa como pronta sem Testcontainers rodando.

**Travas / dúvidas:**

1. **A8 / C4 — grade e diário eletrônico.** Uma conversa com a coordenação responde as duas, e a
   resposta decide se a Task 13 custa uma semana ou some.
2. **Docker.** A Task 2 nunca fechou. Enquanto não fechar, nenhuma tarefa de backend consegue
   atingir critério de aceite.
3. **`backend/pom.xml` está modificado e não commitado** — alguém subiu `java.version` de 17 para
   25 e apagou o comentário que explicava a escolha do 17. Não commitei nem revertí: é decisão de
   quem mudou. Se o `JAVA_HOME` da máquina ainda aponta para o JDK 17, o build quebra.

---

### [2026-08-26] Protótipo no Figma — parcial, cota estourou de novo (Claude)

**Status: parcial.** Arquivo criado e Home pronta; navegação entre telas **não** foi ligada.

Arquivo: https://www.figma.com/design/dj58VB52MRck2VoEQifptB

**O que entrou:** as 6 telas como frames de 390×844 (Home, Calendário, Matérias, Meu quadro,
Nova anotação, Enviar material), cada uma com barra de título, corpo e barra de abas, em Roboto
e nos tokens do `design-system-v1`. A Home está completa — aulas com o quadro de sala, prova em
bloco sólido, entrega em contorno de 1px.

**O que faltou:** o corpo de cinco telas e, principalmente, as reactions de protótipo. Era a
última chamada da sequência e é justamente o que o dono pediu — clicar na aba e ir para a tela.

**Trava: cota MCP do plano Starter do Figma.** Mesma parede de 21/08. Ela reseta — hoje liberou
três chamadas de escrita antes de cortar — mas o orçamento é pequeno demais para fechar o
protótipo numa sessão. Retomar custa ~3 chamadas e não exige refazer nada: os IDs das telas são
`home 1:2 · cal 1:22 · materias 1:42 · quadro 1:62 · nota 1:82 · material 1:105`.

**Decisões que eu tomei:**

*`setReactionsAsync` é o caminho, e foi verificado antes de começar.* Botão navegável em Figma é
`{trigger:{type:'ON_CLICK'}, actions:[{type:'NODE', destinationId, navigation:'NAVIGATE'}]}`. Os
nós já estão nomeados para isso — `aba-home`, `aba-cal`, `aba-materias`, `aba-quadro`,
`btn-voltar`, `btn-anotar` — então religar é achar por nome, não reconstruir.

*Agente não resolve isso, e eu disse isso em vez de tentar.* O dono pediu para distribuir o
trabalho entre agentes. A cota é da conta Figma, não da sessão: dez agentes batem no mesmo limite.
Registrado aqui para ninguém tentar de novo achando que é paralelizável.

**Travas / dúvidas:** decisão do dono entre esperar a cota, fazer upgrade, ou ficar com
`telas-v2.html`, que já navega e não custa cota nenhuma.

---

### [2026-08-26] Telas v3 — profundidade, e dois bugs que a v2 escondia (Claude)

**Status: entregue e verificado.** `docs/design/telas-v3.html`. A v2 fica no repo para comparar.

O dono olhou a v2 e disse que estava seca demais, que não parecia aplicativo. Isso veta em cheio
a decisão escrita em 21/08 — *"nada de sombra nem de estado de pressão inventado, o sistema é
chapado de propósito"*. Ele é o dono do produto; a decisão dele ganha.

**Diagnóstico — cinco coisas faziam aquilo ler como documento impresso, e nenhuma era a paleta:**

1. Zero elevação dentro da tela. Todo cartão era contorno de 1px no mesmo plano do fundo.
2. Rótulo mono em caixa alta com tracking largo em tudo — tique de revista, não de app.
3. Barra de abas sem ícone: quadradinhos de 15px com legenda mono.
4. Nenhuma resposta ao toque. Nada de `:active`, nada de transição.
5. Raios apertados (6/10/18) e barras coladas ao conteúdo, sem chrome que flutue.

**O que a v3 mudou:**

- **Escada de três superfícies** — `--paper` rebaixado, `--surface` para cartão, `--surface-2`
  para o que sobe mais. Com `--e1/--e2/--e3` de sombra real, cartão fica **acima** do fundo em
  vez de desenhado sobre ele. É a correção principal; as outras quatro são consequência.
- **Chrome que flutua:** barra de cima e barra de abas com `backdrop-filter` e sombra própria.
- **Ícones de verdade** na barra de abas, com pílula no accent marcando a aba ativa.
- **Toque responde:** `:active` com escala e colapso de sombra em tudo que se toca; hover
  levanta 1px onde há mouse. Transição de entrada nas telas.
- **Mono só onde ganha o lugar:** hora, data, código de sala, tipo de arquivo. Rótulo de seção
  virou caixa baixa com peso, e a régua tipográfica do `.rotulo::after` saiu.

**Não mudou nada do que é não-negociável:** as 12 hues, cor+sigla juntas no chip, prova em bloco
sólido contra entrega em contorno, nota da turma em régua sólida contra pessoal tracejada, estado
vazio sem preenchimento inventado.

**Dois bugs pré-existentes que apareceram na verificação:**

*A v2 não declarava encoding nem doctype.* Sem `<meta charset>`, servida por HTTP ela renderiza
`Ã¡` e `â€"` no lugar dos acentos, e o navegador entra em quirks mode. Corrigido nas **duas**
versões — a v2 carregava isso desde 21/08 e ninguém tinha aberto ela por servidor.

*O cinza secundário nunca passou no próprio teste do projeto.* `--ink-3` da v2 dava **3.58:1**
sobre o painel, contra os 4.5:1 que o design system promete. A v3 tinha herdado o problema
(3.92:1). Agora `#626A6C` no claro e `#878F91` no escuro, e validei os três níveis de texto
contra as três superfícies nos dois temas: **tudo ≥ 4.5:1**, chips inclusive.

**Decisões que eu tomei:**

*Profundidade sutil, não Material Design.* A crítica era "não parece app", não "quero outro
app". Sombra curta e de opacidade baixa, elevação em três degraus e nada de gradiente colorido —
o que muda é o plano, não a identidade.

*Não mexi na tipografia.* Roboto continua. Trocar a fonte seria mudar identidade, o que ele não
pediu, e ela já está nos tokens do Angular e no arquivo do Figma.

*Prova continua em bloco sólido.* Foi tentador suavizar junto com o resto, mas é o não-negociável
8 e o teste de escala de cinza depende dele. Verifiquei na página rodando: luminância 0.823
contra 0.011 entre prova e entrega — a distinção sobrevive sem cor.

**Verificado, na página servida em localhost:** as 4 abas navegam; clique no dia abre o painel;
"Anotar neste dia" vai para a anotação e o voltar retorna ao calendário; 4 ícones SVG na barra;
prova e entrega distinguíveis em escala de cinza; nota da turma sólida contra pessoal tracejada;
`node --check` limpo no script; todas as tags balanceadas; contraste validado por cálculo.

**Travas / dúvidas:** screenshot do navegador embutido continua estourando timeout — terceira
sessão seguida com o mesmo sintoma. A verificação foi feita por DOM e estilo computado, que para
estas asserções é mais forte que olhar imagem, mas ninguém ainda validou a v3 **visualmente**.

---

### [2026-08-30] Tarefa 2 fechada — o build quebrado e os 27 dias de Docker (Claude)

**Status:** concluída. **7/7 testes verdes**, pela primeira vez desde que a suíte foi escrita.

O pedido era "acelerar e fazer o planejamento e a stack". O planejamento já existia — 16 tarefas
escritas, com critério de aceite em cada uma. Não era ele que segurava nada. Fui olhar o que
segurava de verdade e eram duas coisas concretas.

**1. O backend não compilava.** Alguém subiu o `pom.xml` para `<java.version>25</java.version>` e
apagou o comentário que explicava a escolha do 17. O `JAVA_HOME` desta máquina aponta para o
jdk-17, e o Maven roda no `JAVA_HOME`, não no `java` do PATH — que é o Zulu 25. Resultado:
`error: release version 25 not supported`. Revertido para 17, com o comentário de volta e o aviso
de como usar 25 de verdade se alguém quiser.

**2. O Docker estava morto há 27 dias e levava a suíte junto.** O sintoma é o mesmo de 03/08: o
named pipe `dockerDesktopLinuxEngine` não existe. Testcontainers exige daemon, então
`SchemaTest` nunca rodou uma única vez — e como o critério de aceite de *toda* tarefa de backend
é a suíte passar, o plano inteiro estava formalmente travado num app de GUI esperando um clique.

Troquei Testcontainers por `io.zonky.test:embedded-postgres`, que executa um binário real do
Postgres 16 sem daemon nenhum.

**Arquivos principais:** `backend/pom.xml`, `backend/src/test/java/com/projetofans/support/TesteComPostgres.java`,
`backend/src/test/java/com/projetofans/SmokeTest.java`, `docs/STACK.md` (novo)

**Critério de aceite — ATINGIDO.** `cd backend && ./mvnw test`:

```
[INFO] iniciando PostgreSQL 16.2, compiled by Visual C++ build 1937, 64-bit
[INFO] Migrating schema "public" to version "1 - schema inicial"
[INFO] Successfully applied 1 migration to schema "public", now at version v1
[INFO] Tests run: 6, Failures: 0, Errors: 0, Skipped: 0 -- in com.projetofans.domain.SchemaTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0 -- in com.projetofans.SmokeTest
[INFO] Tests run: 7, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

**Decisões que eu tomei:**

*Postgres embutido, não H2 em modo de compatibilidade.* H2 seria mais leve e teria sido a escolha
preguiçosa errada. Este schema depende de `CHECK`, índice parcial com `WHERE`, `TIMESTAMPTZ` e de
consulta a `information_schema` — o `eventoNaoTemColunaFeito` lê o catálogo do banco para provar o
não-negociável 3. Um banco quase-compatível aprovaria o que o Postgres reprova. Suíte que mente é
pior que suíte que não roda.

*Voltar o pom para 17 em vez de mudar o `JAVA_HOME`.* Mexer no `JAVA_HOME` global afeta os outros
projetos Java desta máquina, e foi exatamente esse o raciocínio de 03/08 que a mudança para 25
apagou. Deixei escrito no pom que, para usar 25, aponta-se o `JAVA_HOME` **antes** de mexer no
número.

*O `SmokeTest` virou um teste melhor por acidente.* Ele perguntava ao Testcontainers se o container
estava de pé — provava que um processo existia, não que a aplicação falava com ele. Agora consulta
`select version()` pela conexão do Spring e exige `PostgreSQL 16`. Isso protege contra o risco que
a própria troca criou: cair sem perceber num banco diferente do de produção.

*Não toquei em `docker-compose.yml`.* Ele continua sendo o Postgres de desenvolvimento e continua
dependendo do Docker. Não bloqueia nada, porque nenhuma tarefa fecha por `dev` — todas fecham por
`./mvnw test`.

**Documentado:** `docs/STACK.md` é novo e reúne o que antes estava espalhado entre plano, spec e
perguntas abertas — camada por camada, com versão, motivo, estado e comando de execução, mais o
histórico de mudanças de stack. `AGENTS.md`, o plano e `PERGUNTAS-ABERTAS.md` foram atualizados
para refletir que Docker deixou de ser pré-requisito.

**Travas / dúvidas:**

1. **A8 / C4 continuam abertas** e agora são o único bloqueio de verdade. A grade de aulas pode ser
   trabalho duplicado se a faculdade já publica a grade; a Task 13 é a mais cara de refazer.
2. **Nada foi commitado desde 2026-08-22.** São 8 arquivos modificados e 2 novos parados na árvore.

---

### [2026-08-30] Tarefa 9 — Core do app: http, auth, storage e repositories

**Status:** concluída

**O que foi feito:** a camada que as telas vão consumir, sem nenhuma tela. `core/` ganhou
`ApiService` (único lugar que sabe o prefixo `/api/v1` e monta `If-Match`), `AuthService`
(sessão em signal, persistida em Preferences), `StorageService` (snapshot local) e os dois
interceptors. `data/` ganhou `models.ts` — espelho dos DTOs das Tasks 4-8 — e os seis
repositories: home, evento, materia, material, quadro e sync. Os testes vieram primeiro e a
primeira execução falhou na compilação, porque nada do que eles importam existia.

**Arquivos principais:**
`app/src/app/core/api.service.ts`, `auth.service.ts`, `storage.service.ts`,
`auth.interceptor.ts`, `http-error.interceptor.ts`;
`app/src/app/data/models.ts`, `home.repository.ts`, `evento.repository.ts`,
`materia.repository.ts`, `material.repository.ts`, `quadro.repository.ts`,
`sync.repository.ts`;
testes em `app/src/app/data/home.repository.spec.ts`, `app/src/app/core/storage.service.spec.ts`,
`app/src/app/core/http-error.interceptor.spec.ts`;
`app/src/main.ts` e `app/src/environments/*` modificados.

**Critério de aceite:**

```
cd app && npx ng test --watch=false --browsers=ChromeHeadless && npx ng lint && npx ng build

Chrome Headless 152.0.0.0 (Windows 10): Executed 18 of 18 SUCCESS (0.206 secs / 0.174 secs)
TOTAL: 18 SUCCESS

Linting "app"...
All files pass linting.

Initial total | 1.26 MB | 250.69 kB
Build at: 2026-08-30T18:21:22.342Z - Hash: 770794f6bbc8496d - Time: 36447ms
```

18 no total: os 11 do design system que já existiam mais os 7 desta tarefa (os 6 nomes que o
plano lista, mais um sétimo explicado abaixo).

**Decisões que eu tomei:**

*Um sétimo teste, `offline com snapshot serve o cache com a hora do ultimo sync`.* O plano lista
seis nomes, e o sexto (`erro de rede NAO devolve lista vazia como sucesso`) cobre o caso **sem**
snapshot. O caso **com** snapshot é um ramo diferente do mesmo `catch` e é onde mora a regra da
Seção 10 do spec — servir o cache com a hora, nunca como se fosse fresco. Ramo sem teste é ramo
que ninguém percebe quebrar.

*Verifiquei os dois testes-guarda com uma mutação, não só com a compilação vermelha.* Coloquei um
`.sort(...).slice(0, 6)` dentro do `HomeRepository` e rodei: `TOTAL: 1 FAILED, 17 SUCCESS`. Desfiz.
Teste que protege o não-negociável mais provável de ser violado precisa provar que morde.

*`models.ts` reexporta `TipoEvento` de `shared/tipos.ts` em vez de redeclarar.* O plano escreve
`export type TipoEvento = 'PROVA' | 'ENTREGA'` nos dois arquivos. Duas declarações idênticas hoje
são duas declarações que divergem depois, e a divergência apareceria como um erro de template
incompreensível no wiring. Reexportar mantém a superfície que o plano pede e torna a divergência
impossível.

*`ErroApi` mora dentro de `http-error.interceptor.ts`, sem arquivo novo de erros.* É o interceptor
que produz o tipo; separá-lo criaria um arquivo com uma classe e nada mais.

*Instalei `@capacitor/preferences@8.0.1`* — a Seção 8 do spec escolhe Preferences explicitamente, e
o pacote não estava no `package.json`. `localStorage` teria evitado a dependência, mas no WebView do
Android ele é despejável, e o snapshot é o que impede tela branca offline.

*`StorageService` ganhou `mesclar()` e os três métodos de sessão, além dos três que o plano lista.*
Home e Matérias gravam pedaços diferentes do mesmo snapshot; sem a mescla, a última a gravar apagaria
a outra. A sessão (jwt + usuário) fica na mesma classe porque ela é o wrapper de Preferences, e não
valia uma segunda.

*Chave de snapshot única, não uma por turma.* A Seção 8 diz "um snapshot por turma", mas a API
resolve **uma** turma por usuário e não existe seletor de turma na UI — a assinatura que o plano
congela, `ler(): Promise<SnapshotLocal | null>`, nem aceita turma. A sessão é o que identifica a
turma, então `sair()` apaga snapshot e sessão juntos. Se múltiplas turmas um dia entrarem no escopo,
este é um dos arquivos a mexer.

*`MaterialRepository` não tem listagem por matéria, e isso é deliberado.* Material chega pela tela da
matéria (`MateriaRepository.detalhe`) ou pelos vínculos de um evento (`EventoRepository.detalhe`). Um
`GET /materiais?materia=` daria a alguém, na Task 11, o caminho fácil de despejar a matéria inteira na
tela de uma prova — exatamente o não-negociável 11.

*O `HomeRepository` degrada, os outros relançam.* Só a Home tem snapshot para servir offline, então só
ela absorve o erro — e mesmo assim marcando `erro()` e `offline()`. Os outros repositories marcam
`erro()` e relançam: não existe `catch` neste diretório que devolva lista vazia como sucesso, e
nenhum deles esvazia a lista que já estava na tela por causa de uma falha.

*`environment.apiUrl` em prod é um placeholder* (`https://api.projetofans.app/api/v1`). O host real
depende da B3, que continua aberta.

**Travas / dúvidas:**

1. **A rota `/login` ainda não existe.** O interceptor de 401 limpa a sessão e chama
   `router.navigateByUrl('/login')`, como a Seção 10 manda; hoje essa navegação falha e cai num
   `console.error` (que loga, não engole). A tela de login não é desta tarefa nem das 10-12 — o
   plano não a lista em lugar nenhum. **Vale uma decisão do dono:** ou entra uma tarefa de tela de
   entrada, ou o app assume que só roda autenticado e o 401 vira outra coisa. A constante está
   isolada em `ROTA_LOGIN`, então mudar é uma linha.
2. **Nenhum repository foi exercitado contra o backend de verdade** — as Tasks 3 a 8 não existem
   ainda nesta árvore (`backend/` tem só domain e repo). Os nomes de campo de `models.ts` saíram do
   spec e do plano, não de um DTO compilado. Quando as Tasks 4-8 fecharem, vale conferir campo a
   campo antes de acreditar no wiring.
3. **Não commitei nada**, conforme instrução desta execução — há outro agente trabalhando em
   `backend/` na mesma árvore.


---

### [2026-08-30] Tarefa 3 — Autenticacao, entrada na turma e escopo

**Status:** concluida

**O que foi feito:** TDD nos dois blocos, na ordem do plano. `TurmaScopeTest` primeiro (falhou por
`TurmaScopeResolver` inexistente), depois o resolver; `AuthFlowTest` depois (falhou por
`GoogleTokenVerifier` inexistente), depois auth por senha, auth por Google, reset de senha e
entrada na turma por convite. Nasceu aqui o `TurmaScopeResolver`, unico lugar do sistema que
resolve turma — as tarefas 4 a 8 dependem dele para nao vazar dado entre turmas. A API deixou de
estar aberta: so `/api/v1/auth/**` e publico.

**Arquivos principais:**
`security/` — `TurmaScopeResolver` (interface) + `TurmaScopeResolverJpa`, `JwtService`, `JwtFilter`,
`UsuarioAtual`, `GoogleTokenVerifier` + `GoogleIdentidade` + `GoogleTokenVerifierImpl`.
`erro/` — `ErroDeNegocio`, `AcessoNegadoException`, `TokenInvalidoException`.
`service/` — `AuthService`, `TurmaService`, `EmailSender` + `LogEmailSender` + `SmtpEmailSender`.
`web/` — `ProblemDetailHandler`, `controller/AuthController`, `controller/TurmaController`, 11 DTOs.
`config/SegurancaConfig` (reescrito), `application.yml`.
Testes: `security/TurmaScopeTest`, `auth/AuthFlowTest`, `support/FakeGoogleTokenVerifier`.

**Criterio de aceite — ATINGIDO.** 13 testes novos verdes (4 de escopo + 9 de auth), suite inteira
em 20/20. `cd backend && ./mvnw test`:

```
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 21.79 s -- in com.projetofans.auth.AuthFlowTest
[INFO] Tests run: 6, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.567 s -- in com.projetofans.domain.SchemaTest
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.196 s -- in com.projetofans.security.TurmaScopeTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.039 s -- in com.projetofans.SmokeTest
[INFO] Results:
[INFO] Tests run: 20, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

Nenhuma credencial real usada: Google entra pelo `FakeGoogleTokenVerifier` e o link de reset sai no
console pelo `LogEmailSender`.

**Decisoes que eu tomei:**

*Pacote `erro/` novo, que o plano nao listava.* O plano cita `AcessoNegadoException(404)` e
`TokenInvalidoException` sem dizer onde moram. Coloquei-as em `com.projetofans.erro`, junto de uma
base `ErroDeNegocio` que carrega o `HttpStatus`. O ganho e o `ProblemDetailHandler` ser **um**
metodo em vez de um `@ExceptionHandler` por excecao: quem sabe o que aconteceu escolhe o status na
hora de lancar, e a tabela de status do plano nao precisa ser mantida em dois lugares. Poe-las em
`web/` faria `security/` depender de `web/`; poe-las em `security/` nao serviria para erro de
auth. Se o review preferir outro pacote, e um move de tres arquivos.

*O unico `catch` do projeto que nao relanca esta em `AuthService.esqueciSenha`, e e deliberado.*
Falha de SMTP subindo viraria 500 para quem tem conta e 204 para quem nao tem — ou seja, o endpoint
voltaria a ser enumeravel, que e exatamente o que o setimo teste existe para impedir. Ele loga em
ERROR (nao e `catch` vazio) e responde 204 assim mesmo. Registrado aqui porque contraria a leitura
literal da regra "nenhum catch que nao relance", e o review precisa saber que foi escolha, nao
descuido.

*Token de reset guardado como SHA-256, nao BCrypt.* BCrypt e salgado e nao permitiria achar a linha
pelo hash. O token e um UUID aleatorio, nao senha escolhida por gente, entao nao ha dicionario a
temer. O valor em claro so existe no e-mail.

*Login por Google em conta que ja existia por e-mail+senha liga o `google_sub` na conta existente*
em vez de criar uma segunda. Criar a segunda esbarraria no UNIQUE de `email` e daria 500 numa
situacao comum (aluno que se cadastrou por senha e depois toca em "entrar com Google"). A entidade
`Usuario` ja tinha `vincularGoogle` prevendo isso.

*`entrar` na turma e idempotente.* Tocar duas vezes no botao devolve o membro que ja existe em vez
de estourar o UNIQUE `(usuario_id, turma_id)`.

*`TurmaScopeResolver` responde 404 tambem para usuario sem vinculo nenhum*, nao so para registro de
outra turma. Quem nao esta em turma alguma nao tem registro algum a ver; devolver `null` so
empurraria NullPointerException para o proximo metodo.

*Duas chaves novas em `application.yml`:* `spring.mvc.problemdetails.enabled: true` (para que erro
do proprio Spring MVC tambem saia em RFC 7807, e o contrato de erro nao tenha duas formas) e
`app.reset-senha-url-base`, com default de dev e `${RESET_SENHA_URL_BASE}` em prod. Essa variavel
nao esta na tabela da Secao 11 do spec — nao bloqueia nada, mas vale acrescentar la quando alguem
mexer no spec.

*O aviso de multiplos vinculos virou requisito testado.* O plano dizia "e loga aviso"; o teste
`comDoisVinculosPegaOMaisRecente` captura o log e exige o WARN. Sem isso o aviso poderia ser
apagado sem nada ficar vermelho — e ele e o sensor de "alguem implementou multiplas turmas por
engano".

**Nao fiz o Step 8 (commit) de proposito.** Ha outro agente trabalhando na mesma arvore nesta
execucao; `git add -A` levaria o trabalho dele pela metade. Quem commita e o orquestrador.

**Travas / duvidas:** nenhuma. `GoogleTokenVerifierImpl` e `SmtpEmailSender` sao os dois arquivos
que nunca rodam em teste (`@Profile("!test")` e `@Profile("prod")`); eles compilam e as libs estao
no classpath, mas so serao exercitados de verdade no aceite da Secao 8, com conta no Google Cloud e
SMTP de verdade. Isso e o esperado pelo desenho, nao uma pendencia desta tarefa.

---

### [2026-08-30] Tarefa 4 — CRUD de evento e material, vinculo, locking e historico

**Status:** concluida

**O que foi feito:** TDD nos tres blocos, na ordem do plano. Escrevi `EventoCrudTest` (11),
`VinculoMaterialTest` (6) e `MaterialCrudTest` (8) primeiro; a primeira execucao deu 25/25
vermelhos com 404 em toda rota, porque nenhum controller existia. So entao vieram `EventoService`,
`MaterialService`, `RevisaoService`, os dois controllers, os 8 DTOs e as tres excecoes novas
(`NaoAutorException` 403, `ConflitoVersaoException` 409, `IfMatchAusenteException` 428). Os
predicados de visibilidade ja existiam no repository desde a Task 2 e foram reusados como estao —
nenhum controller ou service reescreve aquelas condicoes.

**Arquivos principais:**
`service/EventoService.java`, `service/MaterialService.java`, `service/RevisaoService.java`;
`web/controller/EventoController.java`, `web/controller/MaterialController.java`;
`web/dto/` — `AutoriaResponse`, `CriarEventoRequest`, `AtualizarEventoRequest`, `EventoResponse`,
`EventoDetalheResponse`, `CriarMaterialRequest`, `AtualizarMaterialRequest`, `MaterialResponse`;
`erro/NaoAutorException.java`, `erro/ConflitoVersaoException.java`, `erro/IfMatchAusenteException.java`;
testes em `evento/EventoCrudTest.java`, `evento/VinculoMaterialTest.java`,
`material/MaterialCrudTest.java`, mais a base nova `support/TesteDeApi.java`.

**Criterio de aceite — ATINGIDO.** 25 testes novos verdes, suite inteira em 45/45.
`cd backend && ./mvnw test`:

```
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 13.57 s -- in com.projetofans.auth.AuthFlowTest
[INFO] Tests run: 6, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.365 s -- in com.projetofans.domain.SchemaTest
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.524 s -- in com.projetofans.evento.EventoCrudTest
[INFO] Tests run: 6, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.394 s -- in com.projetofans.evento.VinculoMaterialTest
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.238 s -- in com.projetofans.material.MaterialCrudTest
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.065 s -- in com.projetofans.security.TurmaScopeTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.015 s -- in com.projetofans.SmokeTest
[INFO] Results:
[INFO] Tests run: 45, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

Nenhum `DELETE` fisico em `evento` nem em `material`: as duas exclusoes chamam
`excluirLogicamente`. O unico `delete` do codigo e o do vinculo `evento_material`, que e uma linha
de ligacao — desvincular precisa de fato desvincular, e o historico do evento continua intacto.

**Decisoes que eu tomei:**

*`PATCH` substitui os campos editaveis por inteiro; nao e merge parcial.* O plano nao diz qual das
duas semanticas vale, e `models.ts` (Task 9) declara `AtualizarEventoRequest = Partial<...>`, que
sugere merge. Escolhi substituicao por causa de `hora`: num merge, "ausente ou nulo mantem o atual"
tornaria **impossivel apagar** a hora de um evento, e o aluno que corrige "na verdade nao tem
horario" ficaria preso a um dado errado, em silencio. Com substituicao, `hora: null` significa uma
coisa so. O custo e que o app precisa mandar o objeto inteiro; se mandar parcial, recebe 400 —
erro barulhento, que e melhor que o bug silencioso. **Isso precisa de um ajuste em `models.ts` na
Task 11** (ver Travas).

*Services concretos, sem interface + impl.* O plano escreve `public interface EventoService`. Fiz
classe `@Service` concreta com exatamente as assinaturas que ele congela. Interface com uma unica
implementacao nao ganha nada aqui, e o precedente do projeto e esse: `AuthService` e `TurmaService`
sao concretos. `TurmaScopeResolver` tem interface por um motivo documentado — e o ponto de troca
para suportar instituicoes. Se o review preferir a interface, sao tres arquivos de extracao.

*O snapshot da revisao e a entidade serializada pelo `ObjectMapper` do app, nao um DTO proprio.*
E o snapshot mais fiel possivel (todos os campos, inclusive `version` e `visivel_turma`) e nao
custa codigo nenhum. `Evento` e `Material` nao tem associacao JPA, entao nao ha proxy a serializar.
Nenhum endpoint le `revisao` no MVP, entao o formato ainda nao e contrato com o cliente.

*So `EDITAR` e `EXCLUIR` gravam revisao; `CRIAR` nao.* Criar nao tem estado anterior, e a coluna
`snapshot` e `NOT NULL` — gravaria `{}` para nada. A linha de criacao ja existe: e o proprio
registro, com `criado_em` e `autor_id`.

*`RevisaoService.registrar` recebe `RegistroTipo`, nao `String`.* O plano escreve `String
registroTipo`, mas o enum ja existe desde a Task 2 e e o tipo da coluna na entidade. String ali so
adicionaria uma conversao e a chance de escrever "evento" minusculo e descobrir no runtime.

*`DELETE` tambem exige `If-Match`, nao so o `PATCH`.* A tabela de status do plano so cita `PATCH`,
mas a assinatura `excluirLogicamente(usuario, eventoId, versionEsperada)` exige a version vinda de
algum lugar, e o `EventoRepository` do app ja a manda (`api.delete(rota, version)`). Excluir sem
checar version teria o mesmo furo que editar sem checar.

*`GET /eventos?de=&ate=` entrou aqui.* Nenhuma tarefa do plano cria esse endpoint explicitamente,
mas ele esta na Secao 6.2 do spec, alimenta o Calendario (Task 10) e o `EventoController` so nasce
nesta tarefa. Sao seis linhas reusando `visiveisDaTurmaNoPeriodo`, que ja existia. Deixar o buraco
significaria a Task 10 travar por falta de rota.

*`support/TesteDeApi.java` novo, base das tres suites.* As tres montavam o mesmo cenario (turma,
usuario, vinculo, materia, Bearer). O JWT sai do `JwtService` real e passa pelo filtro de verdade,
porque testar com principal falso nao provaria que o `UsuarioAtual` do controller e o de producao.

*`em.refresh` depois de `saveAndFlush` no criar.* `criado_em` tem `DEFAULT` no banco e e
`insertable=false`; sem o refresh, a resposta de criacao sairia com `criadoEm` nulo e violaria R1
justamente no caminho mais comum. Descobri isso porque `save()` com id atribuido a mao vira
`merge`, e a instancia gerenciada e a **devolvida**, nao a local — o primeiro `refresh` estourou
`Entity not managed`.

*Verifiquei que os testes-guarda mordem, com mutacao.* Anulei o `exigirAutor` e troquei
`vinculadosAoEvento` por "todos os materiais da materia" (que e exatamente a violacao da regra 11)
e rodei: `liderTambemRecebe403AoEditarEventoAlheio`, `naoAutorRecebe403AoAtualizar`,
`buscarEventoDevolveApenasMateriaisVinculados`, `materialNaoVinculadoNaoApareceNoEvento` e
`desvincularRemoveDoEvento` ficaram vermelhos. Desfiz a mutacao e a suite voltou a 45/45.

**Nao fiz o Step 6 (commit) de proposito**, conforme a instrucao desta execucao: quem commita e o
orquestrador, depois de verificar.

**Travas / duvidas:**

1. **`models.ts` do app precisa deixar de declarar `AtualizarEventoRequest` e
   `AtualizarMaterialRequest` como `Partial<>`.** O servidor exige o objeto inteiro (decisao acima).
   Nao mexi em `app/` nesta execucao. Enquanto isso nao for ajustado, um PATCH parcial vindo do app
   recebe 400 com `ProblemDetail` — falha visivel, nao corrupcao de dado.
2. **`GET /eventos/{id}` nao filtra visibilidade nesta tarefa.** Um evento oculto ou logicamente
   excluido ainda responde 200 para qualquer membro da turma que saiba o id. R14 cita `/home`,
   `/eventos` e `/materias/{id}` — todos por lista, e todos ja usam os predicados nomeados — mas
   nao o detalhe por id. Se a Task 7 (moderacao) entender que o detalhe tambem deve sumir para quem
   nao e o autor, e uma linha no `buscar` e um teste; deixei sem porque nenhuma assercao da Secao 7
   pede, e adivinhar aqui mudaria o comportamento de "Nao listados".
3. **Nenhuma chamada ao `Notifier` em `POST /eventos`** (R20). E a Task 8 que cria a interface; o
   ponto de insercao e `EventoService.criar`.

---

### [2026-08-30] Tarefa 5 — A Home: teto, janela e ordenacao no servidor

**Status:** concluída

**O que foi feito:** `GET /api/v1/home` devolve a lista pronta — janela de hoje a hoje+14, teto de
6 e ordenacao por urgencia — tudo em um unico SQL nativo em `EventoRepository.home`. O `LIMIT 6`
esta na query, nao num `subList` em Java, e o criterio de tipo e o **terceiro** do `order by`
(atras de data e de hora com nulos por ultimo), justamente para nao virar agrupamento por tipo.
`feitoPeloUsuario` sai do `left join estado_pessoal` filtrado pelo usuario autenticado; nao existe
coluna `feito` em `evento` e nenhuma foi criada. `HomeService` nao ordena, nao filtra data e nao
corta lista: se essas regras aparecessem tambem em Java, passariam a ter duas implementacoes.

**Arquivos principais:**

- `backend/src/main/java/com/projetofans/service/HomeService.java` (novo)
- `backend/src/main/java/com/projetofans/web/controller/HomeController.java` (novo)
- `backend/src/main/java/com/projetofans/web/dto/ItemHomeResponse.java` (novo)
- `backend/src/main/java/com/projetofans/repo/EventoRepository.java` (metodo `home`)
- `backend/src/test/java/com/projetofans/home/HomeServiceTest.java` (novo, 9 testes)

**Critério de aceite:** `cd backend && ./mvnw test -Dtest=HomeServiceTest`

```
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 15.40 s -- in com.projetofans.home.HomeServiceTest
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

Suite inteira (`./mvnw test`), para garantir que nada das tarefas anteriores quebrou:

```
[INFO] Tests run: 54, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

*O vermelho antes do verde:* com o teste escrito e `HomeService` ainda lancando
`UnsupportedOperationException`, a rodada deu `Tests run: 9, Failures: 0, Errors: 9`. So depois
disso a query entrou.

**Decisões que eu tomei:**

1. **`HomeService` e classe concreta, nao interface.** O plano escreve
   `public interface HomeService` mas lista **um** arquivo em "Files" — nao existe arquivo de
   implementacao no plano. Interface com uma unica implementacao so adiciona um arquivo para
   navegar. A assinatura publica (`List<ItemHomeResponse> home(UsuarioAtual usuario)`) e
   exatamente a do plano, entao trocar para interface depois e uma extracao mecanica se algum dia
   houver uma segunda implementacao.
2. **Conversores defensivos de tipo na leitura do `Object[]`.** Query nativa devolve o que o driver
   entregar, e `DATE`/`TIME`/`TIMESTAMPTZ` mudam de tipo Java conforme a versao do Hibernate/PgJDBC.
   `data()`, `hora()` e `instante()` aceitam tanto `java.time` quanto o `java.sql` legado — um cast
   direto quebraria numa troca de versao como `ClassCastException` em runtime.
3. **Nao escrevi um decimo teste para `feitoPeloUsuario`.** O criterio de aceite da tarefa e
   "9 testes verdes" e o plano lista os nove nomes. O `left join` esta implementado e o campo sai
   na resposta, mas quem **escreve** em `estado_pessoal` e a Task 6 — e o teste natural desse campo
   e o dela. Ver trava 1.
4. **`HomeServiceTest` estende `TesteDeApi`, nao `TesteComPostgres` direto.** Ele nao usa MockMvc,
   mas reusa `novaTurma`/`novaMateria`/`membroDe` — montar de novo o mesmo cenario seria copia.
5. **Datas do teste sao todas relativas a `LocalDate.now()`.** A janela usa `current_date` no banco;
   o PgJDBC ajusta o `TimeZone` da sessao pelo default da JVM, entao os dois concordam. Data fixa
   no teste quebraria sozinha amanha.

**Travas / dúvidas:**

1. **`feitoPeloUsuario` sai sempre `false` hoje**, porque nada grava em `estado_pessoal` ainda —
   `PUT /eventos/{id}/estado-pessoal` e a Task 6. O `left join` esta no lugar e o `coalesce` cobre a
   ausencia de linha; quando a Task 6 entrar, vale um teste que marca feito e confere que a Home
   reflete. Nao e bloqueio: hoje o valor esta correto, so nao ha como ser `true`.
2. **Nao rodei o Step 5 (commit) de proposito**, conforme a instrucao desta execucao: quem commita e
   o orquestrador, depois de verificar.

---

### [2026-08-30] Tarefa 6 — Estado pessoal, Meu quadro e Nao listados

**Status:** concluída

**O que foi feito:** TDD na ordem do plano. `EstadoPessoalTest` primeiro, com os seis nomes exatos
que o plano lista; a primeira rodada deu 6/6 vermelhos (1 falha de status 500 no endpoint e 5
`UnsupportedOperationException`). So entao veio `EstadoPessoalService`, o `QuadroController` com as
tres rotas e os tres DTOs. O service escreve em **uma** tabela, `estado_pessoal`, e nenhum caminho
dele toca em `evento` — e esse o nao-negociavel 3 virando codigo. "Nao listados" nao reescreve
predicado nenhum: chama `naoListadosDoAutor` dos dois repositories, que existem desde a Task 2.
Nada aqui filtra `turma_id` a mao; quem resolve turma continua sendo o `TurmaScopeResolver`.

**Arquivos principais:**

- `backend/src/main/java/com/projetofans/service/EstadoPessoalService.java` (novo)
- `backend/src/main/java/com/projetofans/web/controller/QuadroController.java` (novo)
- `backend/src/main/java/com/projetofans/web/dto/MeuQuadroResponse.java` (novo)
- `backend/src/main/java/com/projetofans/web/dto/NaoListadosResponse.java` (novo)
- `backend/src/main/java/com/projetofans/web/dto/EstadoPessoalRequest.java` (novo, ver decisao 3)
- `backend/src/test/java/com/projetofans/quadro/EstadoPessoalTest.java` (novo, 6 testes)

**Critério de aceite — ATINGIDO.** `cd backend && ./mvnw test -Dtest=EstadoPessoalTest`:

```
[INFO] Tests run: 6, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 14.13 s -- in com.projetofans.quadro.EstadoPessoalTest
[INFO]
[INFO] Results:
[INFO]
[INFO] Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
[INFO]
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
```

Suite inteira (`cd backend && ./mvnw test`), para garantir que nada das tarefas anteriores quebrou:

```
[INFO] Tests run: 60, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

*O vermelho antes do verde:* com os seis testes escritos e o service ainda lancando
`UnsupportedOperationException`, a rodada deu `Tests run: 6, Failures: 1, Errors: 5`.

*Os testes-guarda mordem, verificado com mutacao.* (a) Fiz o `marcar` chamar `evento.editar` +
`saveAndFlush` depois de gravar o estado — a violacao literal do nao-negociavel 3 — e
`marcarFeitoNaoAlteraNenhumaColunaDeEvento` ficou vermelho. (b) Troquei `findByChaveUsuarioId` por
`findAll` no quadro e `estadoDeAdoNaoApareceNoQuadroDeB` ficou vermelho (R16). (c) Troquei
`naoListadosDoAutor` por um filtro em `findAll` sem autor e `naoListadosDeOutroAutorNaoAparece`
ficou vermelho (R15). Desfiz as tres e a suite voltou a 60/60.

**Decisões que eu tomei:**

1. **O quadro nao tem teto de 6 nem janela de 14 dias.** O plano nao diz qual e o conjunto de
   origem do kanban; diz so que `MeuQuadroResponse` e feito de `ItemHomeResponse`. Reusar a query da
   Home traria o teto e a janela junto, e um quadro cortado em 6 esconderia entrega atrasada — que e
   exatamente o que o aluno vem procurar aqui. O conjunto e `visiveisDaTurma`, o predicado nomeado
   que ja existia, ordenado por data. Teto e janela continuam sendo regra **da Home**, com uma
   implementacao so, no SQL dela (nao-negociavel 5).
2. **O quadro monta `ItemHomeResponse` em Java, sem SQL novo.** A alternativa era clonar a query
   nativa da Home sem o `limit` e sem a janela, o que reescreveria a condicao de visibilidade uma
   terceira vez em SQL — justamente o que a Secao 5.1 do spec proibe. O custo e um `findById` de
   materia e de autor por item, mesmo padrao (e mesmo teto documentado) do `EventoService`; o cache
   de primeiro nivel do Hibernate absorve as repeticoes dentro da transacao.
3. **`EstadoPessoalRequest` e um record novo que o plano nao lista, com `Boolean` + `@NotNull`.** O
   plano da a assinatura do service (`boolean feito`) mas nao o corpo do PUT. Usei `Boolean` em
   caixa alta de proposito: com `boolean` primitivo, um corpo sem o campo viraria `false` em
   silencio e desmarcaria a tarefa de quem so queria salvar. Ausente agora vira 400.
4. **`EstadoPessoalService` e classe concreta, nao interface.** Mesmo precedente das tarefas 4 e 5,
   pelo mesmo motivo: interface com uma unica implementacao so adiciona arquivo. As tres assinaturas
   publicas sao exatamente as do plano.
5. **Marcar feito exige turma, mas nao exige autoria.** Escopo de turma passa pelo
   `TurmaScopeResolver` (evento de outra turma vira 404). Autoria nao entra: o quadro e de quem le, e
   qualquer membro marca qualquer evento da propria turma como feito. Exigir autoria aqui faria so o
   autor da prova poder marca-la como estudada.
6. **`PUT /eventos/{id}/estado-pessoal` nao exige `If-Match`.** Nao ha `version` a conflitar porque
   nenhuma coluna do fato compartilhado e tocada. E a razao de a rota ser um PUT no sub-recurso e nao
   um PATCH no evento.
7. **`naoListados` usa `usuario.nome()` como nome do autor em vez de reconsultar `usuario`.** Por
   definicao so devolve registro do proprio usuario autenticado, entao o nome ja esta no principal.
8. **O teste central compara a linha inteira de `evento` lida com `select *`, nao campos
   escolhidos.** E o que faz ele continuar valendo quando a tabela ganhar coluna nova — inclusive uma
   coluna `feito`, que e a violacao que ele existe para pegar. O teste tambem afirma explicitamente
   que a linha nao tem chave `feito`.
9. **Um dos seis testes passa pelo HTTP de verdade (MockMvc + JWT real), os outros cinco chamam o
   service.** O plano lista seis testes e o criterio de aceite e "6 testes verdes", entao nao
   acrescentei um setimo so para cobrir o controller; em vez disso o teste central faz o PUT pela
   rota e exige 204, o que cobre rota, desserializacao e filtro de auth sem inflar a contagem.

**Travas / dúvidas:**

1. **`GET /meu-quadro` inclui evento passado nao marcado.** Uma entrega de tres meses atras que
   ninguem marcou fica em "a fazer" para sempre. E o comportamento correto para "atrasado", mas com
   um semestre inteiro a coluna cresce. Isso e decisao de produto (esconder depois de N dias? mover
   para uma terceira secao? nao ha terceira coluna, ver Secao 9.2 do spec), entao nao inventei corte.
   Se o dono quiser um limite, e um `where` no predicado do quadro e um teste.
2. **`naoListadosDoAutor` filtra so por autor, nao por turma** — e o predicado literal da Secao 5.1
   do spec. Consequencia: alguem que trocasse de turma continuaria vendo os proprios registros
   ocultos da turma anterior. Hoje isso e inalcancavel (nao ha troca de turma na UI, e o app resolve
   uma turma so), mas registro porque a leitura muda se instituicoes entrarem.
3. **`feitoPeloUsuario` na Home agora tem como ser `true`** — a trava 1 da Task 5 esta destravada. Nao
   escrevi o teste de integracao "marca feito e a Home reflete" porque ele nao esta em nenhuma das
   duas tarefas; o `left join` da Home e o `estado_pessoal` que este service grava sao a mesma linha,
   e os dois lados tem teste proprio. Vale uma linha em `HomeServiceTest` quando alguem passar por la.
4. **Nao rodei o Step 3 (commit) de proposito**, conforme a instrucao desta execucao: quem commita e
   o orquestrador, depois de verificar.
