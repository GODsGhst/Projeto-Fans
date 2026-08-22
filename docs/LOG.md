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
