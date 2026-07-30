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
