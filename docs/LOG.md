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

---

### [2026-08-30] Revisao das tarefas 3 a 6 — uma tomada de conta e um knob que nao girava (Claude)

**Status:** concluída. Suíte de 60 para **62 testes**, todos verdes.

Os revisores adversariais das tarefas 3, 5 e 6 aprovaram sem violação que bloqueasse, mas
deixaram seis observações. Duas mereciam conserto agora; as outras viraram registro.

**1. Tomada de conta pelo Google Sign-In. Consertado.**

`GoogleTokenVerifierImpl` lia `dados.getEmail()` sem olhar a claim `email_verified`, e
`AuthService.entrarComGoogle` usa o e-mail para decidir que dois logins são a mesma pessoa —
vinculando o `google_sub` numa conta que já existia por senha. Um domínio Workspace pode emitir
ID token com e-mail não confirmado. Quem apresentasse esse token com o e-mail da vítima assumia
a conta dela.

A guarda ficou no `AuthService`, não no verificador, por dois motivos: a consequência mora ali
(é ali que "mesmo e-mail" vira "mesma pessoa"), e ali o teste alcança a regra pelo fake — dentro
do `GoogleTokenVerifierImpl`, que é `@Profile("!test")`, nenhum teste chegaria.

**Verificado por mutação, não só por teste verde:** desliguei a guarda (`if (false)`) e o teste
`googleComEmailNaoVerificadoNaoAssumeContaExistente` ficou vermelho com
`Status expected:<401> but was:<200>` — ou seja, a tomada de conta acontecia de verdade e o teste
morde. Restaurada, 62/62.

Entrou também um teste do caminho feliz (`googleComEmailVerificadoVinculaNaContaExistente`), para
que ninguém "conserte" isto virando bloqueio geral do login por Google.

De quebra, o `catch` do verificador passou a encadear a causa e logar em ERROR. Sem isso, uma
indisponibilidade do Google apareceria para todo mundo como "seu token é inválido", indistinguível
de credencial errada.

**2. `app.janela-home-dias` e `app.teto-home-itens` eram knobs que não giravam. Removidos.**

Estavam declarados no `application.yml` e nenhum código os lia — a janela de 14 dias e o teto de 6
estão literais no SQL de `EventoRepository.home`, que é onde o plano manda que estejam. Knob que
não gira é pior que knob nenhum: quem editasse acharia que mudou alguma coisa. Removi as duas
chaves e deixei escrito no lugar onde os valores realmente moram.

**3. Falso alarme que eu levantei e derrubei.** A query da Home tem
`case e.tipo when 'PROVA' then 0 else 1 end` no `order by`, o que parece violar o não-negociável 4
("ordem é urgência, nunca tipo"). Fui ao plano: é o terceiro critério, depois de data e hora, e o
critério de aceite da Task 5 diz literalmente *"o critério de tipo é o terceiro na cláusula order
by"*. Desempata dentro do mesmo dia e hora; não agrupa. Está correto.

**Observações que NÃO consertei, e por quê:**

- *`HomeController` não tem teste de ponta a ponta.* `HomeServiceTest` chama o service direto.
  Ninguém exercita `GET /api/v1/home` pelo HTTP — nem o 401 sem Bearer, nem a serialização do
  `LocalDate`/`LocalTime`. Não é violação de regra escrita e o plano pediu 9 testes de service,
  que existem. Vale uma suíte de controller quando alguém passar por lá.
- *`EstadoPessoalService.marcar` é find-then-insert, não upsert.* Sequencialmente é idempotente e
  o teste prova. Sob concorrência — duplo toque disparando dois PUT — as duas transações podem
  passar pelo `find` antes de qualquer `insert` e uma leva violação de unicidade. O resultado é
  500 numa ação repetida, não corrupção. Registrado; o conserto é `ON CONFLICT DO NOTHING`.

**Documentado:** a dúvida de produto que a Task 6 tinha deixado só no log virou **A12** em
`docs/PERGUNTAS-ABERTAS.md` (entrega atrasada fica em "a fazer" para sempre?), com o default
aplicado. O revisor tinha razão: decisão de produto não pode morar só no LOG.

**Travas / dúvidas:** a Task 4 continua **sem revisão** — o revisor dela morreu com erro de API.
É a maior tarefa do plano (45 testes, `If-Match`, revisão, exclusão lógica, autor-only) e a que
mais concentra não-negociáveis. Revisar antes de considerar o backend fechado.

---

### [2026-08-31] Tarefa 7 — Moderacao do lider

**Status:** concluída

**O que foi feito:** TDD na ordem do plano, com os 11 nomes exatos que ele lista. `ModeracaoTest`
primeiro: a primeira rodada deu **11/11 vermelhos**, todos com 404, porque nenhuma rota de
moderacao existia. So entao vieram `ModeracaoService`, `ModeracaoController`, a excecao
`NaoLiderException` (403) e dois DTOs. O service tem um unico ponto que escreve no registro
moderado, e ele so sabe chamar `definirVisibilidadeTurma` — que ja existia em `Evento` e
`Material` desde a Task 2. Nao ha caminho daqui que toque em titulo, data, materia ou autor.
A transferencia de lideranca rebaixa e promove na mesma transacao, com flush entre as duas, porque
o indice parcial `membro_um_lider_por_turma` e verificado a cada statement.

**Arquivos principais:**

- `backend/src/main/java/com/projetofans/service/ModeracaoService.java` (novo)
- `backend/src/main/java/com/projetofans/web/controller/ModeracaoController.java` (novo)
- `backend/src/main/java/com/projetofans/erro/NaoLiderException.java` (novo)
- `backend/src/main/java/com/projetofans/web/dto/MotivoRequest.java` (novo)
- `backend/src/main/java/com/projetofans/web/dto/TransferirLiderancaRequest.java` (novo)
- `backend/src/test/java/com/projetofans/moderacao/ModeracaoTest.java` (novo, 11 testes)

**Critério de aceite — ATINGIDO.** `cd backend && ./mvnw test -Dtest=ModeracaoTest`:

```
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 26.54 s -- in com.projetofans.moderacao.ModeracaoTest
[INFO]
[INFO] Results:
[INFO]
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0
[INFO]
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  35.502 s
```

Suite inteira (`cd backend && ./mvnw test`), de 62 para **73 testes**:

```
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.542 s -- in com.projetofans.moderacao.ModeracaoTest
[INFO] Results:
[INFO] Tests run: 73, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

*O vermelho antes do verde:* `Tests run: 11, Failures: 11` — cada rota respondendo 404 por nao
existir.

*Os testes-guarda mordem, verificado com tres mutacoes.*

(a) Troquei a condicao de `exigirLider` por `if (false)` — o papel deixou de valer.
`alunoRecebe403AoTentarOcultar` ficou `expected:<403> but was:<200>` e
`alunoRecebe403AoTentarTransferirLideranca` ficou `expected:<403> but was:<500>`. O 500 do segundo
e informativo: sem a guarda da aplicacao, quem barrou a promocao indevida foi o **indice unico do
banco**, o que confirma R19 nos dois niveis.

(b) Fiz o `ocultar` chamar tambem `evento.editar(...)` trocando o titulo — a violacao literal do
nao-negociavel 10, "o lider virou editor". `ocultarNaoAlteraAutorTituloNemData` ficou vermelho, e
junto dele `registroOcultoApareceEmNaoListadosDoAutor`, que procura o titulo original.

(c) Inverti a ordem da transferencia (promover antes de rebaixar).
`transferirLiderancaMantemExatamenteUmLider` e `todaAcaoDeModeracaoGravaLinhaEmAcaoModeracao`
ficaram `expected:<200> but was:<500>`: o indice parcial estourou no meio da transacao, exatamente
como o plano avisa. Desfiz as tres e a suite voltou a 73/73.

**Decisões que eu tomei:**

1. **A assinatura usa `RegistroTipo`, nao `String`.** O plano escreve `String registroTipo`, mas o
   enum ja existe desde a Task 2, e a Task 4 abriu esse precedente em `RevisaoService.registrar`
   pelo mesmo motivo: `String` ali so adiciona uma conversao e a chance de escrever "evento"
   minusculo e descobrir em runtime. A conversao acontece **uma vez**, no controller, num metodo
   de cinco linhas que aceita `evento` e `EVENTO` e devolve **400** para tipo desconhecido — 404
   ali faria parecer que o registro sumiu, quando quem esta errado e a rota.

2. **`ModeracaoService` e classe concreta, sem interface.** Mesmo precedente das tarefas 4, 5 e 6.
   As quatro assinaturas publicas sao as do plano, a menos do tipo do item 1.

3. **`ocultar` bumpa a `version` do registro, e o teste de R13 exclui essa coluna da comparacao.**
   O plano diz "compare a linha antes e depois: so `visivel_turma` muda". Na pratica sao duas
   colunas, porque `@Version` incrementa em qualquer update da linha. O teste compara a linha
   **inteira** e exige que as unicas diferencas sejam `visivel_turma` e `version` — `titulo`,
   `data_evento`, `autor_id`, `materia_id`, `tipo`, `hora_evento`, `criado_em`, `atualizado_em` e
   `excluido_em` continuam sob comparacao, entao a guarda contra "lider virou editor" fica intacta
   (mutacao (b) prova). Evitar o bump exigiria um `@Modifying` bulk update em cada um dos dois
   repositories, duplicando o caminho de escrita que `definirVisibilidadeTurma` ja e. **A
   consequencia visivel:** o autor com a tela de edicao aberta leva 409 no proximo PATCH depois de
   uma moderacao, com a mensagem "alguem editou antes de voce salvar" — que e enganosa, porque
   ninguem editou conteudo. Se isso incomodar, o conserto e o bulk update.

4. **`ocultar` nao toca em `atualizado_em`** — comportamento herdado de `definirVisibilidadeTurma`,
   que a Task 2 escreveu com o comentario "ocultar nao e edicao de conteudo". Mantive. Isso tem
   uma consequencia para a Task 8, registrada nas Travas.

5. **`pedirExclusao` nao oculta e nao exclui.** So grava a linha em `acao_moderacao`. Exclusao e do
   autor (nao-negociavel 10); um pedido que ja escondesse o registro seria uma exclusao com outro
   nome, e o autor perderia o registro sem ter concordado.

6. **Ordem das checagens: turma (404) antes de papel (403).** E a mesma ordem do `EventoService`,
   pela mesma razao — checar o papel primeiro faria um ALUNO distinguir, pelo status, um registro
   de outra turma de um id inexistente.

7. **`POST /turmas/lideranca/transferir` mora no `ModeracaoController`,** apesar do prefixo
   `/turmas` que o spec fixa. Ela e uma acao de moderacao, sai registrada em `acao_moderacao` junto
   das outras tres, e separa-la deixaria metade da regra do papel em outro arquivo. O
   `@RequestMapping` fica em `/api/v1` e cada metodo declara seu caminho — mesmo formato que o
   `QuadroController` ja usa.

8. **As quatro rotas devolvem 200 com corpo vazio.** O plano pede 200 (nao 204) no primeiro teste;
   nao ha DTO de resposta porque o cliente ja sabe o que pediu, e o registro atualizado chega na
   proxima leitura da Home ou de Nao listados.

9. **`motivo` e opcional, inclusive o corpo inteiro.** Exigi-lo faria o lider inventar texto, e
   motivo inventado nao informa ninguem. O que nao e opcional e a linha em `acao_moderacao`.

10. **`registroOcultoNaoApareceNaHome` passa pelo HTTP de verdade** (`GET /api/v1/home` com Bearer),
    o que de quebra cobre o `HomeController`, que a revisao de 30/08 apontou como sem teste de
    ponta a ponta. Nao foi teste extra: e um dos 11 do plano.

**Travas / dúvidas:**

1. **`GET /materias/{id}` nao e criado por tarefa nenhuma do plano, e R14 o cita.** O endpoint esta
   na Secao 6.2 do spec e a Task 11 (wiring de Materias) vai precisar dele, mas nenhuma tarefa de
   backend o cria — o mesmo buraco que a Task 4 encontrou em `GET /eventos?de=&ate=` e tapou.
   **Default aplicado:** nao criei o endpoint (a lista de Files da Task 7 tem tres arquivos, e
   inventar `MateriaController` aqui seria comecar a Task 11 pelo backend). O teste
   `registroOcultoNaoApareceNaTelaDeMateria` morde os dois predicados nomeados que a tela usaria —
   `EventoRepository.visiveisDaMateria` e `MaterialRepository.visiveisDaMateriaPorTipo`, ambos da
   Task 2. **Limite conhecido:** se alguem escrever o `MateriaController` sem usar esses dois
   metodos, este teste continua verde. Virou **A15** em `PERGUNTAS-ABERTAS.md` — a numeracao ja
   estava em A14, nao em A12 como a instrucao desta execucao supunha.

2. **Ocultar nao entra em `EventoRepository.alteradosDesde`, e a Task 8 depende disso.** O delta do
   `/sync` filtra por `atualizado_em > :desde`, e `ocultar` nao toca em `atualizado_em` (decisao 4,
   herdada da Task 2). O teste `syncIncluiEventoOcultoParaQueOAppOReMova`, que a Task 8 lista, nao
   passa com o predicado atual: o aparelho manteria a notificacao agendada para um evento que a
   turma nao ve mais. Sao duas saidas, e a escolha e da Task 8, nao desta: (a) `ocultar` passa a
   tocar `atualizado_em`, o que contraria o comentario da entidade e derruba uma das colunas
   comparadas no teste de R13; ou (b) `alteradosDesde` passa a olhar tambem `acao_moderacao.em`,
   que e o registro que a moderacao **sempre** grava. Recomendo (b): mantem "ocultar nao e edicao"
   de pe e usa a linha de auditoria que ja existe. Virou **A16** em `PERGUNTAS-ABERTAS.md`.

   Vizinho disto, e **nao consertado por esta tarefa**: a **A14** ja registrada — `GET /eventos/{id}`
   nao filtra visibilidade, entao o registro que o lider acabou de ocultar continua respondendo 200
   pelo id direto para qualquer membro da turma. Isso fura a moderacao que esta tarefa entrega. Nao
   mexi porque o conserto e no `EventoService` (Task 4) e a regra numero zero do `AGENTS.md` proibe
   refatorar o que a tarefa anterior entregou — mas quem revisar a Task 4 deve tratar isso como
   parte do mesmo furo.

3. **`pedirExclusao` ainda nao notifica o autor.** O spec diz "Notifica o autor" e o `Notifier` e a
   Task 8. Hoje a acao fica so registrada em `acao_moderacao`, e o registro continua visivel na
   Home (decisao 5, correta), entao **enquanto a Task 8 nao entra, pedir exclusao e uma acao
   invisivel para quem deveria receber o pedido.** O ponto de insercao e
   `ModeracaoService.pedirExclusao`, na linha seguinte ao `registrar`.

4. **Nao rodei o Step 3 (commit) de proposito**, conforme a instrucao desta execucao: quem commita
   e o orquestrador, depois de verificar.

---

### [2026-08-31] Dois furos de segurança fechados, e um bug que não existia (Claude)

**Status:** concluída. Backend de 73 para **76 testes**, app de 18 para **27**, tudo verde.

**1. Evento oculto respondia pelo id direto (A14). Consertado.**

`GET /eventos/{id}` checava escopo de turma mas não visibilidade. O líder ocultava uma prova e
qualquer colega que soubesse o id continuava lendo o registro inteiro — e os ids já estão em todo
aparelho que sincronizou, por causa do snapshot local da Seção 8. Isso furava a moderação que a
própria Task 7 acabou de entregar.

Agora exige autoria quando `estaExcluido()` ou `!isVisivelTurma()`. **404, não 403**: 403
confirmaria que o registro está lá e a moderação vazaria pelo status. O autor continua vendo o
próprio, coerente com "Não listados".

**2. Qualquer membro desvinculava material da prova alheia. Consertado.**

`desvincularMaterial` só checava turma. Dava para arrancar todos os materiais da prova de outra
pessoa, e sumia sem rastro: a linha do vínculo é apagada de verdade, e o CHECK de `revisao` só
aceita EVENTO e MATERIAL, então nem histórico ficava.

Agora exige autoria do evento. **A assimetria com `vincular` é deliberada** e tem teste próprio:
juntar material na prova de alguém é o espírito do app (qualquer membro posta, e a coluna
`vinculado_por` existe para isso); arrancar é alteração destrutiva de registro alheio, que o
não-negociável 10 proíbe.

**Os dois verificados por mutação, não por teste verde.** Com as guardas desligadas:

```
EventoCrudTest.eventoExcluidoSoRespondeParaOAutor      Status expected:<404> but was:<200>
VinculoMaterialTest.naoAutorNaoDesvinculaMaterialDeEventoAlheio  Status expected:<403> but was:<204>
```

Os dois furos eram reais e exploráveis. Restauradas, 76/76.

**3. O bug da Task 10 não existia — era cache do Angular.**

A Task 10 morreu no limite de sessão deixando `home.page.spec.ts` com 1 teste vermelho:
`falha sem cache nao vira estado vazio`. O código-fonte estava correto — `vazia()` checa
`erro() === null` — mas a tela renderizava o estado vazio junto com o aviso de erro.

Instrumentei os sinais do repository no momento exato da asserção: `erro = "Sem conexão."`,
`carregando = false`. Fonte e runtime discordando. `rm -rf .angular/cache` e a suíte foi para
**27/27**, lint limpo, build passa.

Ou seja: **a Task 10 estava completa**. Registrei a armadilha em `docs/STACK.md` — se um teste do
app falhar de um jeito que o código torna impossível, limpe o cache antes de investigar. Custa 40
segundos e já ia custando uma tarefa inteira refeita.

**4. Fluxo de entrada no mockup.** O app não tinha como alguém entrar — sem login, cadastro ou
código de turma, não há APK para mandar a ninguém. Quatro telas novas em `telas-v3.html`, sem token
novo nenhum: os mesmos campo, botão e superfície da v3. Navegação verificada por clique real.

**Decisões que eu tomei:**

*Vincular continua aberto, desvincular fechou.* O revisor sugeriu "autoria do evento ou de quem
vinculou". Fiquei só com o autor do evento: é a leitura estrita do não-negociável 10, e afrouxar
depois é seguro enquanto apertar depois quebra fluxo de quem já usava.

*Não coloquei `If-Match` no vínculo.* O revisor notou que desvincular não confere versão nem
incrementa a do evento. É real, mas mexe no contrato da API e no repository do app. Registrado
como limite conhecido, não consertado — a falha aqui é 500 em ação concorrente, não corrupção.

**Travas / dúvidas:** a Task 8 (push) e a revisão da Task 7 não rodaram — morreram no limite de
sessão. A Task 8 tem uma decisão herdada da Task 7 (A16): `ocultar` não toca `atualizado_em`,
então o `/sync` não avisa o aparelho de que o evento sumiu.

---

### [2026-08-31] Tarefa 11 — Wiring de Matérias e da tela de evento

**Status:** concluída

**O que foi feito:** três telas ligadas aos repositories da Task 9, sem tocar em `shared/`:
`MateriasPage` (lista de `GET /materias`), `MateriaPage` (`GET /materias/{id}`, material de aula e
material adicional **separados** por tipo mais os eventos da matéria) e `EventoPage`
(`GET /eventos/{id}`, **somente** os materiais vinculados). Duas rotas novas dentro das abas,
`materias/:id` e `eventos/:id`. Suíte do app de 27 para **38 testes**, lint limpo, build passa.

**Arquivos principais:**
- `app/src/app/features/materias/materias.page.ts` + `.spec.ts`
- `app/src/app/features/materias/materia.page.ts` + `.spec.ts`
- `app/src/app/features/evento/evento.page.ts` + `.spec.ts`
- `app/src/app/features/material-vm.ts` (novo), `app/src/app/features/evento-vm.ts` (`assinatura` exportada)
- `app/src/app/tabs/tabs.routes.ts`, `app/src/app/data/models.ts`

**Critério de aceite:**

```
cd app && npx ng test --watch=false --browsers=ChromeHeadless && npx ng lint && npx ng build

TOTAL: 38 SUCCESS
Linting "app"... All files pass linting.
Build at: 2026-08-31T17:52:53.288Z - Hash: 15a5b33bfc2f0336 - Time: 19288ms
```

**Verificado por mutação, não por teste verde.** Os três testes que carregam a tarefa foram
quebrados de propósito e acusaram:

```
MateriaPage material de aula e material adicional aparecem separados FAILED
  Expected $[0] = 'Formas normais' to equal 'Lista extra'.
EventoPage material nao vinculado nao aparece na tela do evento FAILED
EventoPage evento oculto ou excluido responde 404 e a tela diz que nao existe mais FAILED
  Expected null not to be null.
```

Restaurados, 38/38.

**Decisões que eu tomei:**

*A tela do evento nunca pergunta duas vezes.* O teste obrigatório não se contenta em conferir o
que apareceu: ele também exige `backend.expectNone(r => r.url.includes('/materia'))`. Assertar só
o DOM deixaria passar a tela que busca a matéria inteira e depois filtra no cliente — que é
exatamente o não-negociável 11, e sobreviveria a um teste de conteúdo.

*404 virou um estado próprio, não uma mensagem de erro.* Com a mudança do backend de hoje, evento
oculto ou excluído responde 404 para quem não é o autor. A tela mostra `.pf-sumiu` ("Isso não
existe mais.") e **não** mostra o aviso de falha nem o vazio — são quatro telas diferentes agora:
carregando, falhou, sumiu, e sem material vinculado.

*O rótulo de formato do material sai da extensão do arquivo.* `MaterialLinhaComponent` exige
`tipo` ("pdf", "slide", "foto", "link") e a API não manda esse campo — `material.tipo` é
AULA/ADICIONAL, que já é o agrupamento da tela. Deduzo da extensão de `arquivoRef ?? url`, e caio
em "LINK" quando não dá para saber, em vez de chutar "PDF". Fica em `features/material-vm.ts`,
fora do template, como o `evento-vm` da Task 10.

*Não mexi no `MateriaRepository` para degradar offline com snapshot.* A Home faz isso porque o
`HomeRepository` da Task 9 já traz a lógica; o de matérias não traz, e escrevê-la aqui seria
refatorar entrega anterior. Offline hoje cai no estado "falhou" com "Sem conexão." — honesto, mas
sem o "dados de <hora>" que a Home tem. O snapshot local **já guarda** `materias`, então o custo
de ligar depois é pequeno.

*Corrigi `AtualizarEventoRequest`/`AtualizarMaterialRequest` (A13).* Eram `Partial<>`; o backend
substitui o objeto inteiro e um parcial leva 400. Agora são alias dos `Criar*`, que têm exatamente
os campos dos records do backend. Nenhuma tela desta tarefa faz PATCH — a correção é para a
próxima não cair na armadilha.

*Wrapper de link em vez de componente clicável.* `EventoCardComponent` não emite clique e
`shared/` é zona proibida. Envolvi o cartão num `<a routerLink>` na tela da matéria. Não fiz o
mesmo na Home nem no Calendário: mexer neles seria refatorar a Task 10. Ver A17.

**Travas / dúvidas:**

1. **`GET /materias` e `GET /materias/{id}` não existem no backend.** Confirmei: não há
   `MateriaController`, e `grep "\"/materia"` em `src/main/java` não devolve nada. A A15 previu
   isso para `/materias/{id}`; na prática **a lista também** está sem endpoint. As duas telas
   desta tarefa estão corretas contra o contrato da Seção 6.2 do spec, e vão levar 404 contra o
   servidor de verdade até alguém escrever o controller. Não escrevi: seria backend dentro de uma
   tarefa de wiring, contra a regra número zero. Registrado na A15.

2. **Não há como chegar na tela de um evento a partir da Home nem do Calendário.** Só pela tela da
   matéria. Registrado como A17.

3. **Não rodei git.** Quem commita é o orquestrador, depois de verificar.

---

### [2026-08-31] O backend passa a subir nesta máquina — Postgres embutido também em dev (Claude)

**Status:** concluída, verificada por HTTP real.

O dono perguntou se já dava para instalar e rodar o app no celular. Fui verificar e achei um
bloqueio que ninguém tinha visto: **o backend não subia nesta máquina.**

Os testes rodavam desde 30/08 com Postgres embutido, mas o perfil `dev` continuava apontando para
`jdbc:postgresql://localhost:5432/projetofans`, que vem do `docker-compose` — e o Docker está morto
desde 03/08. Ou seja: dava para rodar a suíte, mas **não** para subir o servidor com que o celular
precisa conversar. O caminho inteiro até "APK na mão de um colega" estava travado nisso.

**Conserto:** `BancoDeDesenvolvimento`, um `@Configuration @Profile("dev")` que sobe o mesmo
binário do Postgres 16 e expõe o `DataSource`. Declarar o bean faz o autoconfigure do Boot recuar,
então o `spring.datasource.url` do perfil dev saiu do `application.yml` — duas fontes para a mesma
resposta divergem na primeira vez que alguém mexe numa e esquece a outra.

**Os dados persistem**, e isso não é detalhe: `setCleanDataDirectory(false)` com diretório fixo em
`backend/.dev-db`. Banco de dev que esquece tudo a cada restart seria pior que banco nenhum — o
testador cadastraria uma prova, fecharia o app, e ela sumiria sem explicação.

O bean tem `destroyMethod = "close"`. Sem isso o processo do Postgres sobreviveria ao Ctrl+C e a
próxima subida encontraria porta ocupada e diretório travado — falha confusa que custa meia hora.

**Verificado com o servidor rodando, não por teste unitário:**

```
Postgres de desenvolvimento embutido na porta 65456 — dados em ...\backend\.dev-db
Successfully applied 1 migration to schema "public", now at version v1
Tomcat started on port 8080 (http)
Started ProjetoFansApplication in 17.387 seconds

POST /api/v1/auth/registrar  -> 200, JWT + usuario criado
POST /api/v1/auth/login      -> 200, MESMO id (a persistencia funciona)
GET  /api/v1/home sem token  -> 401
```

**Decisões que eu tomei:**

*`embedded-postgres` saiu do escopo `test` e ganhou `<optional>true</optional>`.* Precisa existir em
runtime no perfil dev. `optional` impede que vaze como dependência transitiva. Em prod o
`DATABASE_URL` manda e a classe nem é instanciada.

*Não apaguei o `docker-compose.yml`.* Ele continua sendo a forma canônica em qualquer máquina onde
o Docker funcione. Para usar ele no lugar, apaga-se a classe nova.

**Travas / dúvidas:** faltam três coisas para o APK: (1) `capacitor.config.ts` ainda está com os
defaults do scaffold — `appId: io.ionic.starter`, `appName: app`. O spec já define
`com.projetofans.app`, e trocar package depois amarra credencial de Google/Firebase, então tem de
ser antes do `cap add android`. (2) o projeto Android nunca foi gerado. (3) o `apiUrl` do app
aponta para `localhost`, que do celular é o próprio celular — precisa do IP da LAN.

---

### [2026-08-31] Tarefa 12 fechada — e um teste que acusava a função de um erro dele mesmo (Claude)

**Status:** concluída. App de 38 para **51 testes**, lint limpo, build passa. Backend em 76.

A Task 12 morreu no limite de sessão deixando 7 testes vermelhos: 1 do reagendador e 6 do Quadro.
Ela tinha escrito os testes (TDD, vermelho primeiro) e não chegou a implementar.

**1. O teste do reagendador estava errado, não a função.**

`agenda 19h do dia anterior` falhava com `Cannot read properties of undefined`. Tracei a conta à
mão: o segundo caso testa a virada de mês — véspera de 01/09 é 31/08 — mas reusava o mesmo `agora`
do primeiro caso, `2026-09-01T15:00Z`. A véspera de 31/08 às 19h em São Paulo é
`2026-08-31T22:00Z`, ou seja **já passou** em relação àquele `agora`. O reagendador filtrava
corretamente e devolvia lista vazia; o teste é que se contradizia.

Corrigi o teste, não a função: `agora` próprio para o caso da virada. A intenção original (provar
que `dia - 1` não vira `"2026-09-00"`) fica preservada.

*Vale registrar porque é a segunda vez hoje que um teste acusa código correto.* A primeira foi o
cache do Angular. Nas duas, a saída certa foi instrumentar antes de "consertar" o código.

**2. O Quadro: seis testes, um repository com um defeito de desenho.**

O `QuadroRepository` da Task 9 tinha **um único** signal de erro compartilhado entre `/meu-quadro`
e `/nao-listados`. São duas chamadas independentes, e o teste
`falha so em nao-listados nao esconde o quadro` exige exatamente isso: falhar na seção que quase
ninguém vê não pode derrubar o quadro que carregou bem. Com um signal só, a segunda falha apagava
a primeira.

Separei em `erro` e `erroNaoListados`. E parei de relançar: o erro fica no signal, e ler o signal
**é** o tratamento — mesmo padrão que o `HomeRepository` já usava. O que a regra proíbe é `catch`
que devolve lista vazia como sucesso; aqui as listas ficam como estavam e a tela decide olhando o
erro.

**Decisões que eu tomei:**

*As colunas vêm prontas do servidor, e a página não as remonta.* O teste manda um item em `feito`
com `feitoPeloUsuario: false` de propósito — se a página separasse por conta própria, ele cairia na
coluna errada. Renderizo as duas listas como vieram.

*Sem kanban quando a busca falhou.* Colunas vazias diriam "você não tem nada pendente", que é o
oposto de "não consegui descobrir o que você tem pendente".

*Material oculto entra com `MaterialLinha`, não com `MiniCard`.* `MiniCard` exige `tipo` que é
`PROVA | ENTREGA`, e material é `AULA | ADICIONAL`. Passar um tipo de evento para desenhar material
seria mentir para o componente. O aviso de "por que sumiu" vai num `span` irmão, porque
`MaterialLinha` não tem esse input e `shared/` é zona proibida.

*"Excluído por você" ganha de "oculto pelo líder" quando as duas valem.* Registro excluído não
volta por reexibição, e quem lê precisa saber com quem falar.

**Travas / dúvidas:** o bloqueio que a Task 11 registrou continua de pé — **não existe
`MateriaController` no backend**. Nem `GET /materias`, nem `/materias/{id}`. As duas telas de
matéria estão corretas contra o contrato do spec e testadas contra `HttpTestingController`, mas
contra o servidor de verdade levam 404. É a próxima coisa a fazer.

---

### [2026-08-31] MateriaController e o deploy hospedado (Claude)

**Status:** concluída. Backend de 76 para **85 testes**, todos verdes.

**1. O `MateriaController` não existia — e a aba Matérias levava 404.**

A Task 11 fez o wiring das duas telas de matéria contra o contrato da Seção 6.2 do spec, testou
contra `HttpTestingController` e registrou: o outro lado não existe. Nem `GET /materias`, nem
`/materias/{id}`, nem `POST`. **Nenhuma tarefa do plano criou esse controller** — é um buraco do
plano, não de execução.

Escrito agora: `MateriaService`, `MateriaController`, três DTOs e duas exceções. Nove testes.

**Uma regra nova, e é de acessibilidade.** O `CHECK` do banco (`materia_cor_hex_valida`) valida só
o **formato** — qualquer `#RRGGBB` passa. `#FFFF00` passaria, e o chip da matéria usa texto branco:
amarelo com texto branco é ilegível. As 12 hues do design system foram medidas uma a uma para dar
≥ 4.5:1 com branco, então `Paleta.HUES` passa a ser regra de servidor.

Validar só no app não bastaria: o app é um cliente entre outros, e regra de acessibilidade não
pode morar num lugar que se contorna com `curl`. Cor de matéria também é escolhida uma vez e fica —
o dano seria permanente.

**Verificado por mutação.** Com as duas guardas desligadas:

```
corForaDaPaletaResponde400      Status expected:<400> but was:<201>   ← amarelo aceito
siglaRepetidaNaTurmaResponde409 Status expected:<409> but was:<500>
```

O segundo é informativo: sem a checagem explícita, sigla duplicada vira violação crua da constraint
e sai 500. A constraint continua sendo a garantia real — ela pega a corrida entre dois cadastros
simultâneos, que a checagem sozinha deixaria passar. A checagem existe para a mensagem ser legível.

**2. Deploy hospedado — a B3, aberta desde 29/07, agora tem resposta.**

O dono perguntou por que o backend estava no notebook dele, já que quem vai testar é um colega, no
celular do colega, e ninguém vai deixar máquina ligada 24h. Está certo, e o plano anterior servia
para ele testar, não para distribuir.

Não dá para rodar o backend no celular — é uma JVM servindo HTTP. E mesmo que desse, não adiantaria:
o app existe para a turma compartilhar dados. Backend por aparelho é cada um sozinho com o que
digitou.

Escolha dele: **Render + Neon**, ambos gratuitos e sem cartão.

- `backend/Dockerfile` — duas fases, imagem final só com JRE e o jar
- `render.yaml` — blueprint; o Render monta o serviço sozinho
- `GET /api/v1/saude` — health check público, sem expor nada
- `docs/DEPLOY.md` — passo a passo, com o que esperar e o que fazer quando der errado

**Perfil `teste`, e por que ele existe.** O `prod` não sobe sem `SMTP_*`, `GOOGLE_OAUTH_CLIENT_ID` e
`FCM_SERVICE_ACCOUNT_JSON` — sem default nenhum, o que é correto para produção de verdade. Mas
significaria **quatro contas** antes de um colega conseguir abrir o app. O `teste` mantém o Postgres
real e troca o resto por fallback: e-mail no log, Google desligado. Uma conta só.

**Armadilha de perfil que quase passou:** `GoogleTokenVerifierImpl` era `@Profile("!test")`, e
`teste` casa com `!test`. Ele carregaria no ambiente hospedado e exigiria um OAuth Client ID que
ninguém tem. Troquei para `@Profile({"dev","prod"})` — lista explícita, porque um `!alguma-coisa`
faz perfil novo cair ali por acidente, que é exatamente o que ia acontecer.

**Decisões que eu tomei:**

*O `GoogleTokenVerifierDesligado` recusa em vez de fingir.* Um verificador que aceitasse qualquer
token seria buraco de autenticação com cara de conveniência — e este perfil roda na internet aberta.

*Banco no Neon, não no Postgres do Render.* O gratuito do Render expira em 30 dias e leva os dados
junto. Num app que a turma usaria por um semestre, é armadilha com data marcada.

*`-DskipTests` no Dockerfile.* A suíte precisa do binário do Postgres embutido, e rodar 85 testes
dentro do build de deploy dobraria o tempo sem dizer nada novo. Build de deploy empacota; não é
onde se descobre regressão.

**Travas / dúvidas:** falta `npx cap add android`. Antes dele, o `capacitor.config.ts` precisa sair
de `appId: io.ionic.starter` / `appName: app` para `com.projetofans.app` — trocar package depois
amarra credencial de Google e Firebase.

---

### [2026-09-01] Tarefa 8 — Push: device tokens, notifier e sync

**Status:** concluída

**O que foi feito:** TDD na ordem do plano, com os 7 nomes exatos. `NotificacaoTest` primeiro: a
primeira rodada deu **7/7 vermelhos** — três com `Expected size: 1 but was: 0` (nenhum service
publicava nada) e quatro com 404 (`/devices` e `/sync` não existiam). Só então vieram a interface
`Notifier`, `PayloadSync`, as três implementações (`FcmNotifier` em prod, `NotifierDeLog` em
dev/teste, `FakeNotifier` em test), `SyncService`, `DeviceService` e os dois controllers. O
`EventoService` passou a avisar nos três caminhos de escrita — criar, editar e excluir.

**A16 fechada pela saída (b), como a Task 7 recomendou.** `EventoRepository.alteradosDesde` agora
inclui também o evento com linha em `acao_moderacao` mais nova que `desde`. `ocultar` continua sem
tocar em `atualizado_em`, o comentário da entidade continua verdadeiro, e o teste de R13 continua
comparando as mesmas colunas de antes.

**Arquivos principais:**

- `backend/src/main/java/com/projetofans/notify/Notifier.java` (novo)
- `backend/src/main/java/com/projetofans/notify/PayloadSync.java` (novo)
- `backend/src/main/java/com/projetofans/notify/FcmNotifier.java` (novo, `@Profile("prod")`)
- `backend/src/main/java/com/projetofans/notify/NotifierDeLog.java` (novo, `@Profile({"dev","teste"})`)
- `backend/src/main/java/com/projetofans/service/SyncService.java` (novo)
- `backend/src/main/java/com/projetofans/service/DeviceService.java` (novo)
- `backend/src/main/java/com/projetofans/web/controller/SyncController.java` (novo)
- `backend/src/main/java/com/projetofans/web/controller/DeviceController.java` (novo)
- `backend/src/main/java/com/projetofans/web/dto/SyncResponse.java` (novo)
- `backend/src/main/java/com/projetofans/web/dto/RegistrarDeviceRequest.java` (novo)
- `backend/src/main/java/com/projetofans/repo/EventoRepository.java` (A16: `alteradosDesde`)
- `backend/src/main/java/com/projetofans/service/EventoService.java` (publica no `Notifier`)
- `backend/src/test/java/com/projetofans/support/FakeNotifier.java` (novo)
- `backend/src/test/java/com/projetofans/notify/NotificacaoTest.java` (novo, 7 testes)

**Critério de aceite — ATINGIDO.** `cd backend && ./mvnw test`:

```
[INFO] Tests run: 7, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.330 s -- in com.projetofans.notify.NotificacaoTest
[INFO]
[INFO] Results:
[INFO]
[INFO] Tests run: 92, Failures: 0, Errors: 0, Skipped: 0
[INFO]
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  31.006 s
```

Suíte de 85 para **92 testes**, tudo verde. Nenhuma tarefa anterior quebrou.

*O vermelho antes do verde:*

```
[ERROR]   NotificacaoTest.criarEventoChamaNotifierUmaVez:128 Expected size: 1 but was: 0 in: []
[ERROR]   NotificacaoTest.editarEventoChamaNotifier:164 Expected size: 1 but was: 0 in: []
[ERROR]   NotificacaoTest.excluirEventoChamaNotifier:179 Expected size: 1 but was: 0 in: []
[ERROR]   NotificacaoTest.notifierNaoRecebeOTokenDoProprioAutor:139->registrarDevice:102 Status expected:<204> but was:<404>
[ERROR]   NotificacaoTest.registrarDeviceTokenDuasVezesNaoDuplica:222->registrarDevice:102 Status expected:<204> but was:<404>
[ERROR]   NotificacaoTest.syncDevolveEventosAlteradosDepoisDoTimestamp:189->sync:109 Status expected:<200> but was:<404>
[ERROR]   NotificacaoTest.syncIncluiEventoOcultoParaQueOAppOReMova:213->sync:109 Status expected:<200> but was:<404>
[ERROR] Tests run: 7, Failures: 7, Errors: 0, Skipped: 0
```

*Os testes-guarda mordem, verificado com três mutações.*

(a) Tirei o `EXISTS` sobre `acao_moderacao` de `alteradosDesde`, deixando só
`atualizado_em >= :desde` — que é exatamente o predicado de antes da A16.
`syncIncluiEventoOcultoParaQueOAppOReMova` ficou vermelho. **O fantasma era real**: o evento que o
líder acabou de ocultar não aparecia no delta, e o aparelho manteria a notificação da véspera
agendada para uma prova que sumiu da Home de todo mundo.

(b) Tirei o `d.usuarioId <> :autorId` de `DeviceTokenRepository.daTurmaExcetoAutor`.
`notifierNaoRecebeOTokenDoProprioAutor` ficou vermelho — quem cadastrou receberia push do próprio
cadastro. Esta mutação também mostra por que o `FakeNotifier` resolve os tokens de verdade em vez
de só contar chamadas: a regra mora na query, e um fake que guardasse apenas `(turmaId, autorId)`
passaria verde com a query furada.

(c) Fiz `DeviceService.registrar` sempre inserir, em vez de fazer upsert.
`registrarDeviceTokenDuasVezesNaoDuplica` ficou
`DataIntegrityViolation ... "device_token_fcm_token_key"` — o app que reabre e re-registra o mesmo
token levaria 500 na segunda vez.

Desfiz as três e a suíte voltou a 92/92.

**Decisões que eu tomei:**

1. **A16 pela saída (b), e a (a) descartada por dois motivos, não um.** Carimbar `atualizado_em` no
   ocultar apagaria a distinção entre "mudou conteúdo" e "mudou visibilidade" — que é o que impede
   o líder de aparecer como editor no histórico — **e** derrubaria uma das colunas que
   `ocultarNaoAlteraAutorTituloNemData` compara. Seria trocar uma guarda de não-negociável por
   conveniência de query. A linha de auditoria já existe, a moderação sempre a grava, e ler a
   mudança de visibilidade dali não inventa coluna nenhuma.

2. **`alteradosDesde` usa `>=`, não `>`.** O app manda de volta o `servidorEm` da resposta
   anterior. Num delta de notificação, reenviar um item já conhecido custa zero (o aparelho regrava
   a mesma linha do snapshot), enquanto pular um por empate de timestamp deixa notificação errada
   agendada. Em feed de sincronização, sobreposição é sempre mais barata que buraco.

3. **`SyncService` e `DeviceService` são classes concretas, sem interface.** O plano escreve
   `public interface SyncService`, mas o precedente das tarefas 4 a 7 é o contrário e o `AGENTS.md`
   é explícito: interface só quando há mais de uma implementação de verdade. O `Notifier` é a
   exceção porque tem três. Interface de implementação única é indireção que faz o leitor abrir
   dois arquivos para achar uma linha.

4. **`SyncResponse` mora em `web/dto`, não junto do service.** O plano o declara no bloco do
   `SyncService`; todo DTO de resposta deste projeto vive em `web/dto`, e o contrato do app
   (`app/src/app/data/models.ts`, linha 124) já estava escrito com estes três campos e estes nomes.
   Bati o record contra ele: `eventosAlterados`, `materias`, `servidorEm`.

5. **Existe um `DeviceService`, que o plano não lista.** A alternativa era o `DeviceController`
   falar com o repository e carregar `@Transactional`, e nenhum controller deste projeto decide
   nada. O upsert por `fcm_token` é lógica de verdade: o FCM devolve o mesmo token a cada abertura
   do app, a coluna é UNIQUE, e o token pode trocar de dono (aparelho emprestado) — por isso
   `renovar` regrava o `usuario_id`, senão o colega passaria a receber push endereçado a quem usou
   o celular antes.

6. **`DELETE /devices/{token}` só apaga token do próprio dono, e responde 204 nos dois casos.** Sem
   a checagem, qualquer autenticado calaria o push de qualquer pessoa mandando o token dela. Sem a
   resposta uniforme, o status diria se um token existe.

7. **`GET /sync` aceita `desde` ausente, tratando como `Instant.EPOCH`.** O aparelho recém-instalado
   não tem `ultimoSync` para mandar, e transformar a primeira sincronização da vida dele num 400
   seria uma pedra no caminho mais comum de todos: alguém que acabou de instalar o APK.

8. **O `Notifier` resolve os device tokens; o service não.** O `EventoService` sabe *que* algo mudou
   na turma, nunca em quais aparelhos isso vira push. É o que permite trocar o FCM por outra coisa
   sem tocar em service nenhum.

9. **O aviso sai DENTRO da transação, não depois do commit.** Um rollback depois do aviso manda um
   push a mais, e o pior que isso causa é um sync que não traz nada. Já um `afterCommit` nunca
   dispararia dentro de um teste transacional, e a guarda de R20 viraria decoração — teste que não
   pode falhar não é teste. Em prod, falha do FCM é registrada e engolida de propósito: quem chega
   lá já persistiu o evento, e transformar "o FCM está fora do ar" em "não consegui cadastrar sua
   prova" trocaria atraso de sync por perda de dado. Não é `catch` vazio — sai stacktrace no log.

10. **Data-message pura, sem bloco `notification`.** É a decisão 2.3 e não detalhe: um bloco de
    notificação faria o Android desenhar o aviso na hora do cadastro, e o aviso que importa é o da
    véspera às 19h, agendado localmente. Se alguém adicionar título e corpo no `FcmNotifier`, a
    notificação virou remota e volta a depender de o servidor estar acordado.

11. **`NotifierDeLog` é quem responde em dev e no perfil `teste`,** não o `FakeNotifier` — este vive
    em `src/test` e não existe fora dali. É o mesmo par que a Task 3 já usa no Google Sign-In
    (`GoogleTokenVerifierDesligado` em main, `FakeGoogleTokenVerifier` em test). Os perfis estão
    listados explicitamente (`{"dev","teste"}`, `"prod"`, `"test"`), nunca por `!alguma-coisa`: foi
    assim que `teste` quase carregou o verificador do Google em 31/08.

12. **`FakeNotifier` resolve os tokens de verdade,** pelo mesmo método de repository que o
    `FcmNotifier` usa. Guardar só a chamada deixaria "o autor não recebe o próprio cadastro" sem
    guarda nenhuma — ver mutação (b).

13. **Material não notifica; só evento.** É o que o plano pede, e é coerente: o reagendador local
    agenda em cima de `data_evento`, e material não tem data. O `SyncResponse` carrega `materias`
    (sigla e cor) porque sem elas o app não desenha o evento novo que acabou de receber.

**Travas / dúvidas:**

1. **Moderação não dispara push** — virou **A20**. O `/sync` já devolve o registro oculto, então o
   aparelho aprende a desagendar, mas só no próximo foreground, login ou pull-to-refresh. Não
   coloquei a chamada no `ModeracaoService` porque a lista de Files da Task 8 diz "Modify:
   `EventoService`", e mexer ali seria alterar a entrega da Task 7. **Custo de fechar: duas linhas e
   um teste.**

2. **`pedirExclusao` continua sem avisar o autor** — virou **A21**. O spec diz "Notifica o autor",
   mas o `Notifier` que o plano especifica tem um método só, e ele é broadcast *exceto uma pessoa*;
   não há como endereçar **exatamente** uma. Não inventei o segundo método: a assinatura está
   escrita no plano, e não existe tela onde um pedido recebido possa pousar. As duas saídas estão
   na A21.

3. **`FcmNotifier` não tem teste, e isso é o desenho, não pendência.** Ele é `@Profile("prod")` e
   exige `FCM_SERVICE_ACCOUNT_JSON`. Exercitá-lo pediria conta no Firebase, que o `AGENTS.md`
   garante que nenhuma tarefa precisa. O que está sob teste é a fronteira: R20 pelo `FakeNotifier` e
   a query de destino pela mutação (b). **O que fica sem cobertura é a chamada ao SDK** — a primeira
   vez que ela roda de verdade é no aceite da Seção 8, com dois aparelhos.

4. **A18 continua aberta e agora tem prazo.** O `android/` é ignorado pelo git e o FCM exige um
   `google-services.json` dentro de `android/app/`. Nada disso bloqueou esta tarefa, que é backend,
   mas bloqueia o wiring do push no app. A sugestão da própria A18 continua sendo a saída 3:
   versionar só o arquivo, com exceção no `.gitignore`.

5. **Não rodei o Step 3 (commit) de propósito**, conforme a instrução desta execução: quem commita é
   o orquestrador, depois de verificar.

---

### [2026-09-01] Task 8 revisada — o /sync reabria o furo que a Task 7 fechou (Claude)

**Status:** concluída. Backend de 92 para **97 testes**, todos verdes.

A Task 8 entregou push, device tokens e `/sync` com 92 testes. O revisor adversarial **reprovou**,
e tinha razão nos dois pontos.

**1. O `/sync` entregava o conteúdo de tudo que foi moderado, para qualquer membro.**

Ele mapeava todo evento alterado para o `EventoResponse` completo — título, data, matéria, autoria
— incluindo os ocultos pelo líder e os excluídos pelo autor. Isso reabria, por outra rota, o que
`EventoService.buscar` recusa com 404 desde 31/08. E era **pior**: lá era preciso saber o id; aqui
bastava `GET /sync?desde=1970-01-01`.

O item **tem** que continuar no delta — sem ele o aparelho nunca aprende que o evento sumiu e a
notificação da véspera vira fantasma. Mas precisar do item não é precisar do conteúdo: para
desagendar, o app usa `id`, `visivelTurma` e `excluidoEm`.

Entrou `EventoResponse.lapide()`. Como o projeto serializa com `default-property-inclusion:
non_null`, os campos nulos **somem do JSON** — nem o nome do campo viaja.

**2. `DeviceService.registrar` deixava tomar o token de outra pessoa.**

Fazia upsert por `fcm_token` e regravava o dono sem checar. Um `POST /devices` com o token da
vítima transferia a linha, e ela parava de receber os avisos da própria turma. O método irmão,
`remover()`, documenta exatamente essa guarda duas linhas abaixo — *"qualquer autenticado calaria
o push de qualquer pessoa mandando o token dela"*. Registrar dava o mesmo poder pela outra porta.

Agora responde **409**. O caso legítimo continua coberto: o app manda `DELETE /devices` no logout
(já estava em `sync.repository.ts` desde a Task 9), então o token fica livre antes do próximo
login.

**Cinco testes novos**, e cada furo tem o par positivo junto — a lápide não pode cegar o autor, e
a guarda de token não pode pegar o próprio dono renovando (o app faz `POST /devices` a cada
abertura).

**Decisões que eu tomei:**

*A observação 3 do revisor — token do FCM no path do `DELETE`, indo para log de acesso — não
consertei.* Ela era perigosa **combinada** com a 2: token vazado permitia sequestro. Com a 2
fechada, um token vazado não serve para nada — `remover()` filtra por dono, então mandar o token
alheio é no-op. Mudar o contrato HTTP agora mexeria nos dois lados por um risco que virou
informativo.

*Corrigi a região do `render.yaml`: Oregon → Ohio.* Descuido meu. O Neon cria em Ohio por padrão,
e deixar API e banco em pontas opostas dos EUA custa mais que os ~130 ms do Brasil até a costa
leste — uma tela sozinha faz várias queries.

**Travas / dúvidas:** A20 e A21 continuam abertas (moderação não dispara push; `pedirExclusao` não
avisa o autor). Nenhuma bloqueia o teste.

---

### [2026-09-01] A API está no ar, e o APK fala com ela (Claude)

**Status:** concluída. **B3 fechada** — a pergunta aberta desde 29/07 sobre onde a API roda.

O dono criou as contas (Neon + Render) e apontou o Blueprint para o branch `acelera-backend`. O
deploy subiu no commit `234ee42`.

**URL: `https://projetofans-api.onrender.com`**

**Verificado contra o servidor de verdade, não contra teste:**

```
GET  /api/v1/saude            -> 200 {"status":"ok"}
POST /api/v1/auth/registrar   -> 200, JWT + usuario criado   (o Flyway rodou, o Neon responde)
POST /api/v1/auth/login       -> 200, MESMO id                (os dados persistem)
GET  /api/v1/home sem token   -> 401                          (a seguranca esta ligada)
POST /api/v1/auth/login errada-> 401
```

O primeiro registro levou 7,9 s — cold start do free tier. Os seguintes, imediatos.

**Duas armadilhas evitadas no caminho, as duas na configuração do Neon:**

*Região.* O Neon oferece São Paulo, e a intuição diz para usar. Seria pior: o Render não tem
região na América do Sul, então a API fica nos EUA de qualquer jeito. O que importa é a distância
**API↔banco**, não celular↔API — o celular fala uma vez por tela, a API fala várias vezes com o
banco na mesma tela. Ohio para os dois dá ~140 ms por tela; banco em São Paulo daria ~490 ms.

*Connection pooling.* O Neon liga por padrão, e o host ganha `-pooler`. É PgBouncer em modo de
transação, que briga com duas coisas nossas: o Flyway pega *advisory lock* de sessão para rodar a
migration, e o Hikari usa prepared statements do lado do servidor. Nenhum dos dois sobrevive a
pooling de transação. Desligado antes de copiar a string.

**O APK agora fala com a API.** `environment.prod.ts` aponta para o Render, e a URL foi conferida
**dentro** do `.apk` — descompactei o bundle e procurei a string, em vez de confiar no build.

**Travas / dúvidas:** o app ainda não tem tela de entrada implementada (A11) — o fluxo existe no
mockup `telas-v3.html`, não em código. Quem instalar o APK abre direto nas abas e não tem como
criar conta pelo app. É o próximo passo para o teste com um colega valer.

---

### [2026-09-01] Fora do plano — telas de entrada (A11)

**Status:** concluída

**O que foi feito:** o app tinha as quatro abas mas nenhuma porta: sem login não havia token, toda
chamada voltava 401 e nenhuma tela mostrava dado. Entraram quatro páginas standalone em
`app/src/app/features/auth/` — login, cadastro, entrar na turma e esqueci a senha —, todas
**fora** das abas, mais a guarda `guardaSessao` nas rotas de tabs. `/login` passou a existir, o que
conserta de quebra o `console.error` do interceptor de 401, que já navegava para `ROTA_LOGIN` sem
destino. O `AuthService` não foi tocado: ele já expunha tudo.

O fluxo é o do mockup: login → abas; login → cadastro → **entrar-turma** → abas; login → recuperar
→ volta. Cadastro nunca cai direto nas abas — conta nova não tem vínculo, e o `TurmaScopeResolver`
responderia 404 em tudo sem a pessoa entender por quê.

**Arquivos principais:**

- `app/src/app/features/auth/{login,cadastro,entrar-turma,recuperar}.page.ts`
- `app/src/app/features/auth/auth.scss` — estilos das quatro telas, tirados de `telas-v3.html`
- `app/src/app/features/auth/erro.ts` — mensagem da tela sai de `ErroApi.message`, sem inventar texto
- `app/src/app/core/auth.guard.ts`
- `app/src/app/app.routes.ts` — quatro rotas públicas antes do `''` guardado
- specs: `login`, `cadastro`, `entrar-turma`, `recuperar` e `app/src/app/app.routes.spec.ts`

**Critério de aceite:**

```
cd app && npx ng test --watch=false --browsers=ChromeHeadless && npx ng lint && npx ng build

TOTAL: 65 SUCCESS          (eram 51; 14 testes novos)
All files pass linting.
Build at: 2026-09-01T18:04:33.257Z - Hash: 67e786ba41bc2bcd - Time: 5163ms
```

Os dois testes de guarda foram verificados por mutação, não só por ficarem verdes: tirar o
`canActivate` quebra `Expected '/tabs/home' to be '/login'`, e tirar o `restaurar()` de dentro da
guarda quebra `Expected '/login' to be '/tabs/home'`. As duas falhas possíveis são opostas e as
duas doem.

**Decisões que eu tomei:**

1. **A guarda chama `restaurar()` de novo em vez de esperar um sinal de "boot pronto".** `restaurar()`
   roda no `provideAppInitializer` e lê disco; uma guarda que só olhasse `autenticado()` poderia
   expulsar para `/login` quem tem sessão válida, e reabrir o app viraria um login. `restaurar()` é
   idempotente e lê a mesma chave, então chamar outra vez custa uma leitura e fecha a corrida — sem
   alterar o `AuthService`.
2. **O código de convite tem até 8 caracteres, não 6.** O mockup diz "6 caracteres" e põe
   `maxlength="6"`; o `TurmaService` gera 8 (`UUID` truncado, caixa alta) e o seed usa `TURMA01`,
   que tem 7. Com o campo do mockup ninguém conseguiria digitar um código real. Fui pelo backend:
   `maxlength="8"` e o texto virou "Ele tem até 8 caracteres e não expira". **O mockup está errado
   nesse ponto** — vale corrigir lá.
3. **"Criar uma turma nova" abre dois campos na própria tela.** `POST /turmas` exige `nome` e
   `semestre`, e o mockup tem só o botão, sem formulário. Revelar os dois campos ali custa menos que
   uma quinta tela e não muda a navegação desenhada.
4. **A tela de recuperar senha confirma na própria tela em vez de voltar para o login.** O
   `data-ir="login"` do mockup é o clique de demonstração; navegar de volta em silêncio faria a
   pessoa sair sem saber se o e-mail saiu. A confirmação não distingue conta existente de
   inexistente — isso continua igual ao backend (204 sempre).
5. **O texto de erro é sempre `ErroApi.message`, cru.** Código inválido mostra "Registro nao
   encontrado", que é a mensagem do servidor. Feio, mas a regra é não inventar texto por status; se
   incomodar, o conserto é no `ProblemDetail` do backend, não em cada tela.
6. **Sem `FormsModule`.** Os campos são lidos por referência de template (`#email.value`) no envio.
   Quatro formulários curtos não pagam `ngModel`, e nenhum deles valida em tempo real — quem valida
   é o backend, e a mensagem dele é a que aparece.

**O que ficou de fora, de propósito:** botão de sair (o `AuthService.sair()` existe, falta onde
tocar), tela de `resetarSenha(token, novaSenha)` — o link do e-mail ainda não abre o app —, e
mostrar o código de convite depois de criar a turma. Nenhum bloqueia o teste com um colega.

**Travas / dúvidas:** o mockup e o backend discordam no tamanho do código de convite (decisão 2).
Segui o backend porque o outro caminho não funciona; quem mantém o `telas-v3.html` decide se
corrige lá ou muda o gerador.

---

### [2026-09-01] Tela de entrada — e o beco sem saída que o revisor achou (Claude)

**Status:** concluída. Backend **103 testes**, app **67**, tudo verde.

O app ganhou login, cadastro, entrar na turma e recuperar senha. A A11 fecha aqui.

O agente entregou com 65 testes e o revisor **reprovou**. Estava certo, e o que ele achou é o tipo
de bug que não aparece em teste feliz nenhum.

**1. Beco sem saída permanente. BLOQUEAVA.**

`registrar()` grava a sessão em disco **antes** de a pessoa ter turma — e é assim que tem de ser,
o token vem da própria resposta do cadastro. A tela então navegava para `/entrar-turma`.

Se alguém fechasse o app nesse instante — trocar de app, botão de voltar, bateria acabando — o
disco ficava com token válido e nenhum vínculo. Na abertura seguinte a guarda via `autenticado()`,
liberava, e o app caía nas abas. Aí **toda** rota protegida responde 404 pelo `TurmaScopeResolver`,
as quatro telas viram erro, e não havia saída: `sair()` não tinha chamador na UI e nenhuma aba
linkava para `/entrar-turma`. Só reinstalando.

O revisor confirmou contra o backend rodando: `GET /home` → 404, `GET /materias` → 404.

Consertado em três lugares, porque um só não bastava:

- **O servidor passou a dizer.** `AuthResponse` ganhou `turmaId`, nulo para quem não tem turma —
  e nulo aqui é resposta legítima, não erro. Resolvido pelo `MembroRepository`, não pelo
  `TurmaScopeResolver`, que estoura 404 justamente no caso que interessa.
- **A guarda passou a fazer duas perguntas**, não uma: tem sessão? tem turma? Sem turma vai para
  `/entrar-turma`, nunca para as abas.
- **A tela ganhou saída.** "Sair desta conta" limpa a sessão e volta ao login. O botão de voltar do
  Ionic não servia: navega sem limpar, e a guarda traz a pessoa de volta.

Verificado por mutação: desligando a checagem de turma, o teste novo acusa
`Expected '/tabs/home' to be '/entrar-turma'`.

**2. O código de convite era descartado. Isso não era observação.**

`POST /turmas` devolve o `codigoConvite` no corpo, e a tela jogava a resposta fora e ia para as
abas. Quem criava a turma virava líder de uma turma que **não conseguia convidar ninguém**: o
código existia no banco, passou pela mão do app, e a pessoa nunca o via.

O revisor classificou como observação porque o log declarava fora de escopo. Mas o objetivo do
dono é um colega entrar na turma dele — sem o código, o teste inteiro não acontece. Agora a tela
mostra o código em destaque, com botão de copiar, e **não navega sozinha**: sair dali sem ler é
perdê-lo.

**3. Mensagens que colapsavam.** Toda falha de validação do backend devolve o mesmo
`"Invalid request content."`, em inglês, num app em português. Cinco erros diferentes viravam uma
frase que não nomeia campo nenhum. Resolvido no cliente, onde dói: campo vazio agora é barrado
antes de enviar, com texto que diz o que falta. Os erros que já eram distintos (401, 409, 404,
offline) continuam vindo do servidor.

**Decisões que eu tomei:**

*Não mexi na precedência do `ProblemDetailHandler` para traduzir as mensagens de validação.* Seria
o conserto de raiz e serviria a todo cliente, mas o `ProblemDetailsExceptionHandler` do Boot tem
ordem 0, e elevar a minha advice acima dele faria o meu `@ExceptionHandler(Exception.class)`
passar a capturar as exceções de MVC que o Boot formata bem hoje — 405, 415, 404 sem handler
viravam 500. Troca ruim. Validar no cliente resolve os cinco casos reais sem esse risco.

*Dois testes existentes foram REESCRITOS, não consertados.* Eles afirmavam o comportamento antigo:
"criar turma leva para as abas" e "sessão restaurada entra nas abas". Os dois descreviam o bug.

**Travas / dúvidas:** o código de convite só aparece no momento em que a turma é criada. Quem
fechar o app nessa tela não tem onde vê-lo de novo — não há tela de "minha turma". Não bloqueia o
teste (o líder anota), mas é a próxima coisa que alguém vai pedir.

---

### [2026-09-01] O botão que parecia travado — e não existia timeout em lugar nenhum (Claude)

**Status:** concluída. App de 67 para **73 testes**, verdes.

O dono instalou o APK, foi criar a conta, e o botão ficou em **"Criando…" para sempre**.

**O código estava certo.** `cadastro.page.ts` tem `try/catch/finally` com `enviando.set(false)` no
`finally` — o botão destravaria sozinho quando a resposta chegasse. O problema era que ela não
chegava, e nada limitava a espera.

**Medido contra a API no ar, no momento do relato:**

```
GET /api/v1/saude       HTTP 200 em 45,6 s   <- servidor dormindo
POST /auth/registrar    HTTP 200 em  7,5 s   <- ja acordado
```

O plano gratuito do Render hiberna depois de 15 minutos parado. A primeira chamada paga o cold
start, e **45 segundos olhando para um rótulo que não muda lê como app travado**. A pessoa fecha o
app antes de a resposta chegar — e nunca descobre que teria funcionado.

**Dois defeitos, e o segundo é o que doía:**

*Não havia timeout nenhum.* `firstValueFrom(http.post(...))` espera para sempre. Uma requisição que
nunca responde prende a tela indefinidamente, sem erro e sem saída. Entrou o `timeoutInterceptor`,
com teto de **75 s** — número escolhido a partir da medição, não por palpite: 30 s, que seria o
chute natural, abortaria requisição legítima durante o cold start e ensinaria a pessoa que o app
não funciona. O `TimeoutError` que ele produz é traduzido pelo interceptor de erro em mensagem que
diz o que houve e que vale tentar de novo — timeout mudo seria só outra forma de travar.

*O botão mentia por omissão.* Agora, passados 4 s, ele troca para **"Acordando o servidor…"**. A
espera continua a mesma; o que muda é que ela deixa de parecer defeito. A classe `Espera` só marca
a passagem do tempo — quem decide o texto é a tela, e o texto diz a verdade.

**Verificado por mutação:** desligando o `espera.comecar()`, o teste acusa
`Expected 'Criando…' to be 'Acordando o servidor…'`.

**Decisões que eu tomei:**

*O aviso entrou só no login e no cadastro.* São as duas telas onde alguém encontra o app pela
primeira vez, e onde o servidor tem mais chance de estar dormindo. As telas de dentro herdam o
timeout, que é a parte que impede o travamento; o rótulo explicativo pode esperar por evidência de
que incomoda lá também.

*Não medi o caminho de 75 s em teste automatizado.* O que está sob teste é a tradução do erro e a
troca de rótulo — o teto em si é uma constante, e um teste que esperasse 75 s de relógio falso
provaria menos do que custa. Registrado aqui para ninguém supor cobertura que não existe.

**Travas / dúvidas:** o cold start continua de pé, e é do plano gratuito, não do app. Quem abrir o
app primeiro no dia espera ~45 s; os outros não. Sair disso custa dinheiro — um host que não
hiberne. Para um teste de turma, o aviso honesto resolve.

---

### [2026-09-01] As telas de cadastro — o buraco que o plano nunca teve (Claude)

**Status:** desenho pronto e navegável. Implementação em código é a próxima leva.

O dono instalou o APK, criou a conta, entrou na turma — e não conseguiu **fazer nada**. Sem tela
para criar matéria, sem tela para cadastrar prova, sem saber quem está na turma nem quem é o líder.

**A causa não é execução, é o plano.** As 16 tarefas são backend mais *wiring de leitura*:
"Wiring da Home", "Wiring de Matérias", "Wiring de Meu quadro". **Nenhuma cria nada.** E o critério
de aceite do próprio handoff diz:

> "Aluno A **cadastra** uma prova; aluno B vê ela na Home em outro aparelho."

O lado "vê" foi construído inteiro. O lado "cadastra" não existe em tarefa nenhuma. É o mesmo tipo
de buraco do `MateriaController` que faltava — e é o segundo desta natureza, o que sugere olhar o
plano com desconfiança onde ele fala em "wiring".

**Levantamento, contra o código:**

| | |
|---|---|
| Telas no app | 10 |
| Telas que criam evento, matéria ou material | **zero** |
| Único `POST` disparado por tela | criar turma |
| Endpoint que lista membros | **não existe** |

O calendário vazio **não é bug**: sem matéria não há evento, sem evento não há o que mostrar. Ele
está correto; o que falta é poder criar.

**Três telas novas em `telas-v3.html`**, sem token novo nenhum — só arranjo do que já existia:

- **Nova matéria** — nome, sigla e as 12 cores em grade. A escolhida ganha **anel**, não brilho:
  em escala de cinza o anel sobrevive e o brilho não, que é a mesma regra do resto do sistema. Tem
  prévia do chip, porque cor de matéria se escolhe uma vez e fica.
- **O que vai cair** — prova ou entrega no segmentado, matéria por chip, título, data, e hora
  **opcional** com o aviso de que a véspera continua às 19h sem ela.
- **A turma** — o código de convite em destaque com botão de copiar, e quem está, com o líder
  marcado. Responde de uma vez três perguntas que o dono fez separadas.

**Decisões que eu tomei:**

*O líder recebe marca discreta, não coroa.* Um selo pequeno no accent, sem destaque de cor nem
ícone de hierarquia. Líder aqui é papel, não posto — ele não edita registro de ninguém, e a tela
não pode sugerir que edita.

*A grade de cores não é livre.* As 12 foram medidas para dar ≥ 4.5:1 com o texto branco do chip, e
o backend já recusa qualquer outra. Um seletor livre na tela prometeria o que o servidor nega.

**Verificado por clique, não por leitura:** Home → cadastrar prova → voltar; Matérias → nova
matéria → voltar; Meu quadro → a turma → voltar. 12 cores na paleta, prova e entrega no
segmentado, campos de data e hora presentes, 4 membros com o líder marcado, código visível.

**Travas / dúvidas:** falta o endpoint que a tela da turma consome — não existe nada que liste
membros. É backend, e entra na leva de implementação junto das telas.

---

### [2026-09-01] Fora do plano — `GET /api/v1/turmas/minha`

**Status:** concluída

**O que foi feito:** o endpoint que a tela `data-tela="turma"` do `telas-v3.html` consome. Responde
de uma vez quem está na turma, quem é o líder e qual é o código de convite — o código, que antes só
existia na resposta do `POST /turmas` e sumia para sempre quando alguém fechava o app naquela tela.
Escopo pelo `TurmaScopeResolver`, sem nenhum filtro de `turma_id` à mão; quem não é membro leva
**404**, nunca 403. Os nomes saem resolvidos em DTO — a entidade `Usuario` não cruza o controller,
e ela carrega `senhaHash`.

**Arquivos principais:**
- `backend/src/main/java/com/projetofans/web/controller/TurmaController.java` (+ `GET /minha`)
- `backend/src/main/java/com/projetofans/service/TurmaService.java` (+ `minha`)
- `backend/src/main/java/com/projetofans/web/dto/MinhaTurmaResponse.java` (novo)
- `backend/src/main/java/com/projetofans/web/dto/MembroDaTurmaResponse.java` (novo)
- `backend/src/main/java/com/projetofans/domain/Membro.java` (`@Generated` em `entrouEm`)
- `backend/src/test/java/com/projetofans/turma/MinhaTurmaTest.java` (novo, 6 testes)

**Critério de aceite:** `cd backend && ./mvnw test`

```
[INFO] Tests run: 13, Failures: 0, Errors: 0, Skipped: 0 -- in com.projetofans.auth.AuthFlowTest
[INFO] Tests run:  6, Failures: 0, Errors: 0, Skipped: 0 -- in com.projetofans.domain.SchemaTest
[INFO] Tests run: 12, Failures: 0, Errors: 0, Skipped: 0 -- in com.projetofans.evento.EventoCrudTest
[INFO] Tests run:  8, Failures: 0, Errors: 0, Skipped: 0 -- in com.projetofans.evento.VinculoMaterialTest
[INFO] Tests run:  9, Failures: 0, Errors: 0, Skipped: 0 -- in com.projetofans.home.HomeServiceTest
[INFO] Tests run:  9, Failures: 0, Errors: 0, Skipped: 0 -- in com.projetofans.materia.MateriaTest
[INFO] Tests run:  8, Failures: 0, Errors: 0, Skipped: 0 -- in com.projetofans.material.MaterialCrudTest
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0 -- in com.projetofans.moderacao.ModeracaoTest
[INFO] Tests run: 12, Failures: 0, Errors: 0, Skipped: 0 -- in com.projetofans.notify.NotificacaoTest
[INFO] Tests run:  6, Failures: 0, Errors: 0, Skipped: 0 -- in com.projetofans.quadro.EstadoPessoalTest
[INFO] Tests run:  4, Failures: 0, Errors: 0, Skipped: 0 -- in com.projetofans.security.TurmaScopeTest
[INFO] Tests run:  4, Failures: 0, Errors: 0, Skipped: 0 -- in com.projetofans.seguranca.CorsTest
[INFO] Tests run:  1, Failures: 0, Errors: 0, Skipped: 0 -- in com.projetofans.SmokeTest
[INFO] Tests run:  6, Failures: 0, Errors: 0, Skipped: 0 -- in com.projetofans.turma.MinhaTurmaTest
[INFO] Tests run: 109, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

103 → **109**, os 6 novos são desta tarefa. Nada no `app/` foi tocado.

**Decisões que eu tomei:**

*O código de convite é visível para TODO membro, não só para o líder.* É o não-negociável 9 levado
até o fim: se qualquer membro posta sem aprovação, qualquer membro convida. Esconder o código do
aluno faria a entrada de um calouro depender de o líder estar por perto com o celular na mão — um
gate de fato, montado com outro nome. O teste `alunoComumVeCodigoDeConvite` prende essa decisão,
para que ela precise ser desfeita de propósito, e não por descuido.

*Quem não é membro leva 404, nunca 403.* Não é só coerência com o resto: aqui o corpo da resposta
**é** o segredo. 403 diria "esta turma existe" a quem só tem um palpite, e o código de convite é a
única coisa que separa a turma de qualquer pessoa com o link.

*Ordem por `entrouEm`, com nome e id desempatando.* O desempate não é enfeite. `entrou_em` tem
`DEFAULT now()`, e no Postgres `now()` é o instante da **transação** — dois membros gravados na
mesma transação empatam. Sem o segundo critério a ordem viria do plano de execução do banco e
mudaria a cada abertura; lista que se reordena parece lista que mudou de conteúdo.

*`@Generated` em `Membro.entrouEm`.* O campo saía **nulo** no JSON com a coluna preenchida no
banco: `insertable = false` impede o Hibernate de escrever a coluna, mas não o manda relê-la depois
do INSERT. Corrigi na entidade em vez de remendar no service, porque o remendo protege só a chamada
remendada. As outras nove colunas com o mesmo padrão ficaram como estavam — são A22.

*Membro sem usuário estoura, não vira nome em branco.* A FK torna isso impossível; se acontecer, o
banco está corrompido, e uma pessoa sem nome na lista é pior que um erro visível.

**Travas / dúvidas:** nenhuma para este endpoint. Uma dívida vizinha virou **A22** em
`docs/PERGUNTAS-ABERTAS.md`: nove entidades ainda leem `null` na coluna que o banco preenche
sozinho, e o `EventoService` contorna a sua à mão.

---

## As telas de cadastro, as rotas, e o Figma que quebrava no reimport

**O que estava faltando:** a turma não tinha como cadastrar matéria nem evento pelo app, e o
código de convite só existia no instante em que a turma era criada. Quem fechasse o app naquela
tela virava líder de uma turma que não conseguia convidar ninguém.

*A ordem das rotas é comportamento, não estilo.* `materias/nova` e `eventos/novo` foram
registradas **acima** de `materias/:id` e `eventos/:id`. Fora dessa ordem o router casa na rota com
parâmetro, o app pede ao servidor uma matéria chamada "nova", e a tela nova simplesmente nunca
abre — sem erro de build, sem teste vermelho.

*O teste de ordem que já existia aprovava rota ausente.* Ele comparava `indexOf(criar) <
indexOf(detalhe)`, e `indexOf` devolve `-1` para o que não existe: `-1` é menor que qualquer
índice, então a rota podia sumir do app inteiro com a suíte verde. Entrou um teste de presença
antes dele. Verificado por mutação: removida a rota da turma, 1 falha; invertida a ordem, 2.

*O botão que não podia ser botão.* Na tela de novo evento sem matéria cadastrada, o link "Cadastrar
matéria" usava `class="botao"` — e o teste exige que **não exista botão de cadastrar** ali, porque
não há o que cadastrar. Ele leva embora da tela, não envia nada dela. Virou `botao-vazio`:
visualmente igual, semanticamente o oposto.

**O Figma.** O mockup navegável não serve para importar: uma casca de celular só, telas alternando
com `display:none`. Todo importador renderiza o DOM como ele está, então 12 das 13 telas chegariam
vazias — e o import *pareceria* ter funcionado. `gerar-telas-figma.py` monta a folha de contato,
cada tela um quadro de 390px visível.

*`figma-fluxo.js` foi reescrito porque a versão anterior funcionava exatamente uma vez.* Ela tinha
os ids literais (`24:152`). Todo id muda no reimport, e reimportar é justamente o que se faz ao
adicionar tela: o script inteiro viraria uma lista de nós inexistentes. Agora acha tudo pelo texto
desenhado, que sobrevive.

*Rodar a lógica contra o DOM pegou três bugs antes de qualquer chamada ao Figma:* o rótulo da aba é
"Cal" e não "Calendário"; a barra de título também tem 390 de largura, então largura sozinha não
identifica tela e a subida parava no cabeçalho; e a barra de abas é **irmã** do corpo da tela, não
filha — subindo até o primeiro ancestral de 390, 34 das 36 abas ficavam de fora.

**Travas / dúvidas:** `calendário → nova anotação` ficou de fora do fluxo. Aquele botão é montado
por JavaScript depois de tocar num dia, não existe no HTML estático e não chega no import; para
ligá-lo, precisa primeiro ser desenhado. E o script **não foi rodado no Figma** — a árvore de nós
de lá não é idêntica à do DOM.

---

### [2026-10-05] Fora do plano — correções da auditoria de segurança (Claude)
**Status:** concluída no código; **não commitada nem publicada**.
**O que foi feito:** corrigidos os achados A1, A2, A3, B1, B2, C1 e C2 de
`docs/security-audit/relatorio-auditoria-seguranca.pdf` (fora do git, é confidencial). A4 e D1 ficaram como estavam (ver decisões).
**Arquivos principais:** `LogEmailSender`, `application.yml`, `JwtService`, `docker-compose.yml`,
`Evento`/`Material` (`visivelPara`), `EventoService`, `EstadoPessoalService`, `MaterialService`,
`ModeracaoService`, `NotaService`, `Criar/AtualizarMaterialRequest`, `material-vm.ts`, `angular.json`,
`render.yaml`. Testes novos: `OraculoDeExistenciaTest`, `SegredoVersionadoTest`, casos novos em
`EscolhaDoEmailSenderTest`, `MaterialCrudTest`, `NotaTest` e `material-vm.spec.ts`.
**Critério de aceite:** `./mvnw test` → 175/175 verdes. `ng test` → 210/210. Mutação: com as
checagens de B1/B2 desligadas, os 5 testes de `OraculoDeExistenciaTest` falham. Build de produção
servida localmente com a CSP do `render.yaml` (API trocada por localhost): login, home, calendário,
matérias, matéria e resumo sem nenhuma violação no console; um `<script>` inline injetado foi
bloqueado e a violação apareceu, o que prova que o console estava sendo lido.
**Decisões que eu tomei:**
- *A1:* `LogEmailSender` agora só existe em `dev`/`test`, e o perfil `teste` exige `SMTP_HOST`,
  `SMTP_USER` e `SMTP_PASSWORD` sem default. Faltou uma, a API não sobe — em vez de subir mandando o
  token para o log. O Render mantém o deploy anterior no ar quando o novo falha, mas um **restart**
  sem as variáveis derruba a API: é o preço escolhido, porque o outro lado é tomada de conta.
- *A2:* a trava fica no `JwtService`: segredo que começa com `dev-`/`test-` só sobe com perfil
  dev/test **e** sem a variável `RENDER`. Isso cobre também "perfil dev no Render".
- *B2:* a visibilidade entrou em `daTurmaDoUsuario`/`materialDaTurmaDoUsuario` do `EventoService`,
  e não só em `marcar`/`vincular`. Efeito colateral deliberado: editar/excluir evento oculto alheio
  passou de 403 para 404, e o autor do evento não desvincula mais um material que o líder ocultou
  (ele também não o vê na lista).
- *B1:* a nota PESSOAL alheia responde 404 **antes** da checagem de papel, em ocultar, pedir exclusão
  e editar (`NotaService`). O 403 para aluno também confirmava a nota. `NotaTest.editar` mudou de
  403 para 404 nesse caso e ganhou o 403 depois que a nota vira TURMA.
- *C2:* `inlineCritical` desligado no build de produção. Ele carrega o CSS com
  `onload="this.media='all'"`, que a CSP sem `'unsafe-inline'` em script bloquearia — o site
  subiria sem CSS. `style-src` mantém `'unsafe-inline'` (Angular e Ionic injetam estilo em runtime).
  A CSP vale só para o site; o APK não lê headers do Render.
- *A4* (senha `senha123` do seed) ficou: só existe no perfil dev, que a trava do A2 impede no Render.
- *D1* (RLS) ficou: o próprio relatório classifica como informativo e de custo alto.
**Travas / dúvidas:** publicar exige `git push origin master:acelera-backend`; confirmar antes no
painel do Render que `SMTP_HOST`, `SMTP_USER` e `SMTP_PASSWORD` estão preenchidos. Fora do escopo,
sem issue no relatório: rate limiting em login/esqueci/entrar, e JWT de 720 h sem revogação no reset.

---

### [2026-10-05] Fora do plano — teto de tentativas e reset de senha que derruba sessões (Claude)
**Status:** concluída; commitada, **não publicada**.
**O que foi feito:** as duas observações da auditoria que ficaram sem issue. (1) `LimiteDeTentativas`:
10 logins por e-mail a cada 15 min, 5 "esqueci a senha" por e-mail por hora, 10 códigos de convite
por usuário a cada 15 min; acima disso, 429. (2) O JWT carrega a versão da senha (claim `sv`, resumo
SHA-256 do hash); trocar a senha invalida todo token emitido antes.
**Arquivos principais:** `security/LimiteDeTentativas.java`, `security/JwtService.java`,
`AuthController`, `TurmaController`. Testes: `LimiteDeTentativasTest`, `ForcaBrutaTest`,
`SessaoRevogadaTest`; `SegredoVersionadoTest` ajustado ao construtor novo.
**Critério de aceite:** `./mvnw test` numa worktree limpa (HEAD + só estes arquivos) → 183/183.
Mutação: sem a checagem de `sv` o `SessaoRevogadaTest` falha (200 em vez de 401); sem as chamadas
ao limitador os 3 testes do `ForcaBrutaTest` falham. `PerfilTest`, da feature de perfil ainda não
commitada, passa 9/9 com isto.
**Decisões que eu tomei:**
- *Chave por e-mail/usuário, não por IP.* Atrás do proxy do Render o IP vem do X-Forwarded-For, que
  o cliente também escreve. Custo: "uma senha contra muitas contas" não é barrado. O 429 sai igual
  para e-mail com e sem conta, então não reabre a enumeração.
- *Em memória.* O free tier roda uma instância; com réplicas, o contador iria para o banco. Se
  passar de 10 mil chaves, varre as vencidas e, se não bastar, zera — para inundação não estourar
  a memória.
- *Versão da senha em vez de coluna nova.* Reset por e-mail e troca pelo perfil passam pelo mesmo
  `Usuario.trocarSenha`, então uma regra no `JwtService` cobre os dois, sem migration e sem tocar
  em `AuthService`/`Usuario`, que estavam com a feature de perfil em andamento. Custo: uma busca
  do usuário por requisição autenticada.
- *Tokens antigos, sem `sv`, deixam de valer.* Depois do deploy todo mundo entra de novo uma vez.
**Travas / dúvidas:** para a feature de perfil: `POST /eu/senha` devolve 204, e depois dele o JWT do
próprio aparelho deixa de valer — o app vai cair no login na requisição seguinte. Se a intenção é
manter a pessoa logada, a rota deve devolver um JWT novo (como `PATCH /eu` já faz com o nome).

---

### [2026-10-05] Fora do plano — perfil no rodapé do menu, e o menu lateral que recolhe (Claude)
**Status:** concluída; publicada junto com as duas entradas de segurança acima.
**O que foi feito:** pedido do dono — no PC, menu lateral "como o do Claude", que recolhe, com a
conta no rodapé "estilo Google". Backend: `GET/PATCH /api/v1/eu` (nome) e `POST /api/v1/eu/senha`.
Front: `features/perfil` (nome, senha, Minha turma, Ajustes, Sair) e a aba `pf-aba-perfil` — no PC
vai para o rodapé do menu (avatar, nome, e-mail; recolhido, só o avatar), no celular é a 5ª aba.
**Arquivos principais:** `EuController`, `AuthService` (perfil/renomear/trocarSenha/hashDaSenha/
nomeValido), `Usuario` (`@DynamicUpdate`, `renomear`), `perfil.page.ts`, `tabs.page.ts`,
`auth.service.ts` (`renovarSessao`), `global.scss` (bloco do PC). Testes: `PerfilTest`,
`perfil.page.spec.ts`, `tabs.page.spec.ts`.
**Critério de aceite:** backend 192/192, front 232/232, `ng build` ok. Conferido no navegador em
1440×900 (aberto e recolhido) e 320×640 (5 abas de 64px, sem transbordo).
**Decisões que eu tomei:**
- *`POST /eu/senha` devolve `{jwt}` (200), não 204.* Com a versão da senha no JWT (entrada acima),
  a troca derruba toda sessão — inclusive a de quem trocou. Os outros aparelhos saem, que é o
  objetivo; quem trocou segue com o token novo. `PATCH /eu` também devolve JWT, porque ele carrega o nome.
- *Resposta descartada se a sessão mudou no meio.* Sair com o PATCH no ar não pode ressuscitar a
  conta num PC compartilhado.
- *Senha acima de 72 bytes é 400.* O BCrypt do spring-security-crypto 6.5 lança exceção acima disso
  (era 500 no cadastro, no reset e na troca); uma guarda só, em `hashDaSenha`.
- *`ion-tabs.pf-abas`, não `ion-tabs`.* O host Angular do Ionic usa `[_nghost-…]`, que ganha de
  seletor de tag: com `ion-tabs` puro a barra virava coluna e as telas sumiam (bug que chegou ao ar).
**Travas / dúvidas:** e-mail não se troca pelo perfil (exigiria confirmar o endereço novo). Ficaram
de fora achados leves da revisão: avatar com emoji em `turma.page.ts`/`transferir.page.ts`, oráculo
403 em `NotaService.minha`, `SyncService` com cópia da regra de visibilidade, e o teto de login por
e-mail permitir trancar a conta de um colega por 15 min.

---

### [2026-10-06] Fora do plano — lembretes (dia, vespera, 1h, personalizado) e correcoes rapidas (Claude)
**Status:** concluída no working tree; **não commitada, não publicada**. Versão do app: 1.1.0.
**O que foi feito:** (1) Lembretes no aparelho: no dia, véspera e uma hora antes de cada prova e
entrega, mais o alarme personalizado que a pessoa marca no evento; ligam e desligam nos Ajustes. A
fonte passou a ser o `/sync` completo (`SyncRepository`), cancela tudo e reagenda tudo a cada carga
e a cada mudança de preferência. (2) Correções rápidas da revisão: hora sem segundos nos cards,
teto de login só por falhas e destravado pelo reset de senha, um aluno uma turma (409 curado na
tela de entrar), zoom liberado com campos de 16px, ocultar material pelo líder, turma recarregada
depois de transferir a liderança e zerada ao sair da conta, Google escondido, pool do Hikari
enxuto no perfil `teste`.
**Arquivos principais:** `notifications/*`, `data/sync.repository.ts`, `evento-vm.ts`,
`entrar-turma.page.ts`, `turma.repository.ts`, `moderacao.repository.ts`, `global.scss`,
`auth.scss`, `LimiteDeTentativas`, `AuthService.resetarSenha`, `AuthController`, `TurmaService`
(um aluno, uma turma), `application.yml`, `docs/DEPLOY.md`. Testes: `ForcaBrutaTest`,
`UmaTurmaPorPessoaTest`, `evento-vm.spec`, `entrar-turma.page.spec`, `turma.repository.spec`,
`moderacao.repository.spec`, `sync.repository.spec`, `reagendador.spec`, `notificacoes.service.spec`.
**Critério de aceite:** backend `./mvnw -q test` → 198 testes em 27 classes, 0 falhas. Front
`ng test` → 325 de 326 verdes; o único vermelho é `NotificacoesService › o alarme personalizado
entra no agendamento e sai quando removido` (`getPending` chamado 4 vezes em vez de 3), do código de
lembretes ainda em ajuste, fora destas correções. `ng build` ok (aviso de orçamento de 39 bytes
no CSS inline de `calendario.page.ts`). Mutação: sem o corte
`slice(0, 5)`, sem o `loginCerto` no reset, sem o efeito de logout do `TurmaRepository`, sem o zerar
na releitura que falhou e com o campo de volta a 15px, cada teste correspondente falha.
**Decisões que eu tomei:**
- *Lembretes pelo `/sync`, não pela Home.* A Home tem teto de 6 e janela de 14 dias: a sétima prova
  da semana ficava sem aviso. O `/sync` é a única rota que devolve oculto e excluído, e é assim que o
  aparelho aprende o que desagendar.
- *Hora cortada em `eventoVm`, não em cada tela.* O backend serializa `LocalTime` com segundos
  (`19:00:00`) e as quatro telas passam por esse mapeamento. O campo de editar evento corta ao
  preencher, senão o PATCH devolvia os segundos.
- *Teto de login só conta falha.* Login certo devolve a ficha; travado, nem a senha certa entra
  (o 200 no meio dos 429 entregaria a senha). A janela é fixa e renovável enquanto o atacante
  insistir, então quem sabe o e-mail ainda tranca a conta: o reset de senha concluído (o token do
  e-mail prova posse) destrava. `AuthService.resetarSenha` passou a devolver o e-mail para o
  controller chamar `loginCerto`.
- *Um aluno, uma turma (409).* Quem já tem turma e tenta criar ou entrar em outra recebe 409; a
  tela lê `/turmas/minha`, grava o vínculo na sessão e abre a Home, em vez de repetir o erro a cada
  toque. Se a leitura falhar, o erro aparece e a Home não abre.
- *Zoom liberado.* O Safari dá zoom sozinho ao focar campo abaixo de 16px, então campos usam
  `max(16px, 1em)` e botões `touch-action: manipulation` (tira só o duplo toque; o pinça fica).
- *`TurmaRepository` zera quando o usuário da sessão some*, lendo `usuario()` e não `autenticado()`:
  o AuthService apaga os dois juntos e `usuario` é o sinal que `souLider` já lê. Na transferência de
  liderança, releitura que falha também zera: o dado velho é o que acabou de deixar de valer.
- *Hikari com zero conexões ociosas e `/saude` sem consulta ao banco*, para o Neon free suspender o
  compute com a API acordada pelo monitor externo.
**Travas / dúvidas:** pendências: (1) testar os lembretes num **Android real** — alarme exato,
permissão e canal só se provam no aparelho, o karma usa plugin falso; (2) ativar o **monitor
externo** (UptimeRobot, `docs/DEPLOY.md`, "Manter a API acordada"); (3) o workflow
`manter-acordado.yml` **roda em `master`** e não segura a API (~6 execuções por dia, 3 a 4 min
cada, a API sempre dormindo) — **desligar quando o monitor estiver ativo**; ainda não foi
desligado.

### [2026-10-07] Fora do plano — correções da revisão de segurança de professor/coordenador (Claude)
**Status:** concluída
**O que foi feito:** (1) HIGH: PATCH de evento/material só aceita matéria da MESMA turma do registro (404 para autor, professor e coordenador), vincular/desvincular exige evento e material da mesma turma, as telas `/materias/{id}` e `/eventos/{id}` filtram por `turma_id`, e o `/sync` pula (log.warn) o item que aponta para matéria de outra turma em vez de dar 404 para a turma toda. (2) MEDIUM: V10 cria `contestacao_docente`; contestar grava lá, restaurar apaga, entrar de novo nasce contestado, e remover o docente apaga as declarações dele DAQUELA turma. (3) MEDIUM mitigação: `emailVerificado: false` na fila do admin + aviso na tela + A27. (4) LOW: teto de 5/h por e-mail em `POST /auth/registrar` e de 3 turmas criadas por conta docente PENDENTE.
**Arquivos principais:** `V10__contestacao_duravel_e_criador_da_turma.sql`, `EventoService`, `MaterialService`, `SyncService`, `TurmaService`, `DocenteService`, `LimiteDeTentativas`, `admin.page.ts`; testes `IsolamentoEntreTurmasTest`, `ContestacaoDuravelTest`, `LimitesDoCadastroDocenteTest`.
**Critério de aceite:** `./mvnw -q test` (backend, 437 testes, 0 falhas) e `ng test` (app, 537 de 537) verdes; `ng build` ok. Cada correção foi confirmada revertendo-a à mão: o teste dela fica vermelho.
**Decisões que eu tomei:** (a) a checagem da matéria de destino vem ANTES da de poder (404 antes de 403), senão o professor recebia 403 e só o coordenador/autor 404 — escopo vem antes de poder, como no resto. (b) "turmas criadas" precisava de dado que não existia: a V10 também acrescenta `turma.criada_por` (vínculo não serve, entrar por código também gera vínculo docente); turmas anteriores ficam com NULL e não contam. (c) o teto de criação trava a linha da conta (`FOR UPDATE`) antes de contar, senão criações paralelas passavam todas. (d) a V10 copia para `contestacao_docente` as contestações que já estavam no vínculo. (e) o `/sync` ainda devolve a LÁPIDE de evento oculto/excluído mesmo apontando para matéria torta: ela não carrega matéria nem conteúdo. (f) `desvincular` com material de outra turma também dá 404, então um vínculo cruzado antigo não se desfaz pela API (as telas já o escondem). (g) numerei a pergunta como A27 porque A24–A26 são da spec de professor/coordenador.
**Travas / dúvidas:** A27 (verificar e-mail de conta docente) fica aberta, sem verificação de verdade ainda.

### [2026-10-23] Fora do plano — app Flutter/Dart `fans_lab` para a disciplina de Aplicações Móveis (Claude)
**Status:** concluída no código e nos testes; **apresentação em aparelho pendente** (sem Android SDK no ambiente).
**O que foi feito:** cliente Flutter/Dart do projetoFans que cobre as duas apostilas da disciplina
(HTTP no Flutter; Persistência local e banco remoto): GET/POST/PUT/PATCH/DELETE contra a API deste
repo, JSON ↔ model, SQLite (cache da Home, matérias, rascunhos, estado pessoal), SharedPreferences
(sessão, tema, datas), offline-first com fila e sincronização. Construído por um swarm de agentes Haiku
em paralelo contra contratos fixos, revisado por Sonnet/Opus em loop de correção com mutação de controle.
Registro completo, com decisões e histórico das voltas: `docs/ENTREGA-FLUTTER.md`.
**Arquivos principais:** `fans_lab/lib/{models,database,repositories,services,screens,widgets}/*`,
`fans_lab/lib/main.dart`, `fans_lab/lib/app_deps.dart`, `fans_lab/android/app/src/{main,debug}/AndroidManifest.xml`,
`fans_lab/test/*`, `fans_lab/test_e2e/api_real_test.dart`, `docs/ENTREGA-FLUTTER.md`,
`docs/APRESENTACAO-FLUTTER.md`, `docs/BANCA-PERGUNTAS.md`, `.gitignore`.
**Critério de aceite:** `cd fans_lab && flutter analyze` → No issues found; `flutter test` → 177/177
verdes (rodado 2× sem flake); `flutter test test_e2e/api_real_test.dart` contra o backend Spring LOCAL
(perfil `dev`) → 13/13. Cada correção do loop tem teste que fica vermelho com a correção desfeita.
**Decisões que eu tomei:**
- *A entrega é o app da turma, não o "tarefas_http" da apostila* (A28 em `PERGUNTAS-ABERTAS.md`).
- *O "PUT" da rubrica é `PUT /eventos/{id}/estado-pessoal`*; a edição usa PATCH com If-Match (o
  desafio da apostila aceita PUT/PATCH); PATCH e DELETE são só online.
- *`feito` em tabela própria* (`estado_pessoal`) também no SQLite do aparelho (não-negociável 3).
- *A Home renderiza na ordem do servidor e o cache guarda a posição* (não-negociáveis 4 e 5).
- *Sessão expirada não apaga a fila; "Sair" apaga com aviso; outra conta apaga antes de entrar*
  (falha fechado sem dono gravado) — rascunho nunca sai com autoria de outra pessoa (não-negociável 1).
- *Mensagens de erro são do app*; o `detail` do servidor só aparece em 400.
- *`.gitignore` da raiz ignorava qualquer `android/`* (era para o Capacitor): o manifest do Flutter,
  com a permissão INTERNET, nunca tinha entrado no repo. Exceção só para `fans_lab/android/`.
- *`flutter_localizations` (SDK) entrou* para os seletores de data em pt-BR.
**Travas / dúvidas:** (1) **A28** — confirmar no enunciado se o app da turma vale como entrega;
(2) nunca rodou em aparelho: `dl.google.com` bloqueado no ambiente, sem APK gerado aqui;
(3) Figma do link sem acesso para a conta conectada; o visual seguiu `docs/design/png-figma`;
(4) limites declarados na §9 do brief: JWT em SharedPreferences, logout não revoga JWT, duplicata
possível após timeout de POST, release assinado com chave debug.
