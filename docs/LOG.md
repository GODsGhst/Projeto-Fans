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
