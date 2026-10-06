# Deploy — colocar a API no ar para a turma testar

Escrito em **2026-08-31**, quando ficou claro que o teste não seria feito pelo dono: um colega
instala o APK no celular dele, e não dá para depender do notebook de alguém ligado 24h.

Isso responde a **B3** de `PERGUNTAS-ABERTAS.md`, aberta desde 29/07.

**Você precisa de duas contas, e nenhuma pede cartão de crédito.** O resto está pronto no repo.

---

## Por que não dá para rodar o backend no celular

Não é limitação de esforço, é de arquitetura:

- O backend é Spring Boot — uma JVM servindo HTTP. Não roda dentro de um app Android.
- E mesmo se rodasse, não adiantaria: **o app existe para a turma compartilhar dados.** Backend no
  celular de cada um significa cada pessoa sozinha com o que ela mesma digitou. Isso testa a
  interface, não o produto.
- Túnel (ngrok, Tailscale) também não serve: seu notebook continua tendo que estar ligado.

---

## O que já está pronto

| | |
|---|---|
| `backend/Dockerfile` | build em duas fases, imagem final só com JRE + jar |
| `render.yaml` | o Render monta o serviço sozinho a partir dele |
| perfil `teste` | Postgres e SMTP reais, Google desligado |
| `GET /api/v1/saude` | health check, público, não expõe nada |

O perfil `prod` continua existindo e continua exigente: sem `SMTP_*` nem `FCM_SERVICE_ACCOUNT_JSON`
ele **não sobe**, e isso é correto para produção de verdade. O `teste` também exige `SMTP_HOST`,
`SMTP_USER` e `SMTP_PASSWORD` desde 05/10/2026: antes, sem eles, o link de reset ia para o log do
Render — e qualquer pessoa com acesso ao log pedia o reset do e-mail de outra e entrava na conta
(achado A1 da auditoria de segurança de 05/10/2026; relatório fora do git). O `teste` é o que troca rigor por
"consigo mandar para um colega hoje".

---

## Passo 1 — banco no Neon (~3 min)

1. Entre em **neon.tech** e crie conta (GitHub serve).
2. Crie um projeto. **Região: `AWS US East 2 (Ohio)`**, que é o padrão do Neon.
   O `render.yaml` está fixado em `ohio` para casar com ela. A latência que importa é
   API↔banco, não celular↔API: uma tela sozinha faz várias queries, e pôr os dois em
   pontas opostas dos EUA custa mais que os ~130 ms do Brasil até a costa leste. Se você
   escolher outra região aqui, mude a linha `region:` do `render.yaml` junto.
3. Na tela de conexão, escolha o formato **Java / JDBC**. Você vai ver algo como:

```
jdbc:postgresql://ep-nome-123456.us-east-1.aws.neon.tech/neondb?sslmode=require
```

4. **Copie essa linha inteira.** É só ela — o formato Java já traz usuário e senha dentro da
   própria URL, então não há três campos para separar. Ela é o `DATABASE_URL`.

> **Não use o Postgres gratuito do próprio Render.** Ele expira em 30 dias e apaga os dados junto.
> Num app que a turma vai usar por um semestre, isso é uma armadilha com data marcada. O do Neon
> não expira.

---

## Passo 2 — API no Render (~5 min)

1. Entre em **render.com** e crie conta com o GitHub.
2. Vá em **Blueprints → New Blueprint Instance**.
3. Aponte para o repositório `GODsGhst/Projeto-Fans`. Ele acha o `render.yaml` sozinho.
4. Ele vai pedir **uma** variável: `DATABASE_URL`. Cole a linha que você copiou do Neon.

   O `JWT_SECRET` ele gera sozinho — não invente um à mão, e não cole em conversa nenhuma.

5. **Create**. O primeiro build leva ~5 minutos (ele compila o Java do zero).

---

## Passo 3 — conferir que está no ar

```bash
curl https://projetofans-api.onrender.com/api/v1/saude
```

Resposta esperada:

```json
{"status":"ok"}
```

Se der `502` ou demorar 40 s na primeira vez, é o serviço acordando — ver "O que esperar" abaixo.

Teste de ponta a ponta, criando uma conta de verdade:

```bash
curl -X POST https://projetofans-api.onrender.com/api/v1/auth/registrar -H "Content-Type: application/json" -d '{"nome":"Otavio","email":"voce@exemplo.com","senha":"uma-senha-boa-123"}'
```

Tem que voltar `200` com um `jwt` e o usuário criado. Se voltar, o Flyway rodou, o banco respondeu
e a autenticação funciona — o caminho inteiro está de pé.

---

## Passo 4 — apontar o app para lá

**FEITO em 2026-09-01.** `app/src/environments/environment.prod.ts` aponta para
`https://projetofans-api.onrender.com/api/v1`, e o APK foi gerado com ela dentro — conferido
descompactando o `.apk` e procurando a URL no bundle.

Se um dia a URL mudar, é trocar essa linha, rodar `npx ng build && npx cap sync android` e gerar
o APK de novo. Ver `docs/ANDROID.md` para os comandos, e a armadilha dos dois `JAVA_HOME`.

---

## O que esperar do plano gratuito

**O serviço dorme depois de 15 minutos parado**, e a primeira chamada depois disso paga o cold
start. Isso é do free tier do Render, não do app.

**O número varia mais do que a documentação sugere, e isso importa.** Medido neste projeto:
**45,6 s** em 2026-09-01 e **mais de 120 s** em 2026-09-02. O app aborta em 75 s
(`app/src/app/core/timeout.interceptor.ts`), então a segunda medição vira erro na tela — foi
exatamente o sintoma relatado no dia 1º, o botão preso em "Criando…". Subir o teto não resolve:
um spinner de dois minutos é indistinguível de app travado.

**A saída de graça é não deixar dormir, e o ping do GitHub Actions não faz isso.**
`.github/workflows/manter-acordado.yml` **está rodando**: ele já está em `master`, e o GitHub
executa `schedule` a partir do branch padrão. Só que o cron de 10 em 10 minutos não sai a cada 10:
na prática o GitHub dispara umas **6 execuções por dia**, muito espaçadas, e a API (que dorme com 15
min de silêncio) está **sempre dormindo** quando o ping chega. Cada execução paga o cold start
inteiro e dura **3 a 4 minutos**, então o workflow gasta minutos de Actions sem segurar a API. Ele
**será desligado** quando o monitor externo (UptimeRobot, ver "Manter a API acordada" abaixo)
estiver ativo; até lá, o único uso útil dele é o disparo manual: dá para acordar na hora pela aba
Actions → Run workflow, minutos antes de pedir para alguém abrir o app.

Na prática, para a turma: quem abre o app primeiro no dia espera; os outros não. O app guarda
snapshot local, então quem já usou continua vendo o que tinha mesmo enquanto o servidor acorda.

**O design já contava com isso.** A notificação da véspera é agendada **no aparelho**, não empurrada
pelo servidor — decisão 2.3 do spec, tomada justamente porque um job `@Scheduled` às 19h não roda
num servidor dormindo. O furo que essa hibernação criaria já estava fechado antes de existir.

Se o ping não bastar, a saída é um host que não hiberne — e aí passa a custar.

---

## O que este ambiente NÃO tem

Consciente, e cada um por um motivo:

- **Login por Google.** Precisa de projeto no Google Cloud e OAuth Client ID. O botão aparece
  explicitamente desabilitado no app — botão presente e morto mente sobre o que o app faz. E-mail
  e senha funcionam normalmente.
- **Notificação push.** Não existe, e não é falta: o aviso da véspera é **local**, agendado no
  próprio aparelho (decisão 2.3 do spec). Host gratuito hiberna, e um job das 19h não roda num
  servidor dormindo.
- **Envio de arquivo.** É a Task 15. Material entra por link.

---

## Destravar uma turma sem líder

A liderança só se transfere pelas mãos do líder. Quando o líder some — troca de faculdade,
formatura, desiste do app — a turma fica sem ninguém que possa ocultar conteúdo impróprio ou
passar o cargo adiante. Não há caminho de volta dentro do produto. Este é o alçapão.

**Virar admin é só por SQL, e isso é a decisão, não uma limitação.** Nenhuma rota da API escreve
na coluna `admin_plataforma`. Se existisse `POST /admin/promover`, ela seria o alvo mais valioso
da API: uma falha de autorização ali entregaria todas as turmas de uma vez. Sem rota, virar admin
exige acesso ao banco — outra credencial, guardada em outro lugar, com rastro fora da aplicação.

No console SQL do Neon:

```sql
-- 1. conceder (uma vez, para você)
UPDATE usuario SET admin_plataforma = true WHERE email = 'voce@exemplo.com';

-- 2. achar os ids da turma travada e de quem vai assumir
SELECT t.id AS turma_id, t.nome, u.id AS usuario_id, u.nome, m.papel
FROM turma t JOIN membro m ON m.turma_id = t.id JOIN usuario u ON u.id = m.usuario_id
WHERE t.nome ILIKE '%parte do nome%';
```

Depois, autenticado como o admin (o mesmo login do app):

```bash
curl -X POST "$API/api/v1/admin/turmas/$TURMA_ID/lider" -H "Authorization: Bearer $JWT" -H 'Content-Type: application/json' -d "{\"novoLiderUsuarioId\":\"$USUARIO_ID\"}"
```

**O que o admin pode e o que ele não pode.** Pode definir quem é líder de uma turma. Só isso. Não
lê, não cria, não edita e não apaga conteúdo de turma nenhuma — o poder é de destravar, não de
vigiar. E o novo líder precisa **já ser membro**: para entrar continua sendo preciso o código de
convite, que é de quem está lá dentro.

Não há tela para isso no app, de propósito: um painel de admin dentro do APK que todo aluno tem
instalado é superfície que não precisa existir. Toda ação daqui fica no diário de moderação.

---

## O deploy subiu mesmo?

`/api/v1/saude` devolve `{"status":"ok","build":"<8 hex>"}`. O `build` é um
digesto opaco do instante da compilação: **muda a cada deploy** e não conta
versão, data nem host — a rota continua sem ajudar quem estiver bisbilhando.

```bash
curl -s https://projetofans-api.onrender.com/api/v1/saude
```

Guarde o valor antes do push e compare depois. **Mudou, subiu.** Igual depois de
vários minutos significa que o Render não redeployou — não que está lento.

Antes disso existir, responder essa pergunta custava criar conta descartável,
turma e registro só para ver se um campo novo aparecia na resposta. O ritual
consumiu meia hora e deixou contas de teste no banco de produção.

### Quando o `build` não muda

O Render redeploya sozinho a cada push na branch configurada. Se o digesto não
mudar depois de ~10 min, o problema **não é lentidão** — é que o deploy não
disparou. Em `dashboard.render.com` → serviço `projetofans-api`:

| Onde olhar | O que procura |
|---|---|
| Aba **Events** | Aparece um deploy novo? Se não, o gatilho não chegou |
| **Settings → Build & Deploy** | `Auto-Deploy` está ligado? A branch é a que você empurrou? |
| **Settings → Repository** | A conexão com o GitHub ainda está válida |
| Aba **Logs** | Se o deploy rodou e falhou, o erro do Maven ou do Flyway está aqui |

Botão **Manual Deploy → Deploy latest commit** força, quando o gatilho falhou.

---

## Rotina de operação

### Antes de um deploy com migration

Migration aplicada não volta: o Flyway não desfaz, e a regra do projeto proíbe editar uma que já
rodou. Se ela estragar dado, o único caminho de volta é o banco de antes. Então **antes** do push
que leva uma `V<N>__*.sql` nova:

1. No console do Neon → **Branches → New branch**, a partir de `main`, no instante atual. Nome:
   `antes-V<N>`. É instantâneo e não copia nada (copy-on-write) — custa só o que divergir depois.
2. Faça o push e confira o `build` do `/saude` (seção acima).
3. Deu certo e a turma usou por um ou dois dias: apague o branch. O plano free tem limite de
   branches, e branch esquecido ocupa vaga.

**Para voltar**, se a migration estragou dado:

1. Volte o código primeiro: `git revert` do commit e push, ou **Manual Deploy** do commit anterior
   no Render. Se o código novo continuar no ar, ele roda a migration de novo no banco restaurado.
2. No Neon → branch `main` → **Restore**, com origem no branch `antes-V<N>` (CLI:
   `neon branches restore main antes-V<N>`). O Neon guarda o estado sobrescrito num branch
   `main_old_<data>`, então o restore também tem volta. O endpoint e a `DATABASE_URL` não mudam:
   o Render não precisa de nada.
3. Tudo que a turma postou entre o deploy e o restore se perde. Por isso o restore é para dado
   estragado, não para "a tela ficou feia" — esse caso se resolve com o revert do passo 1 sozinho,
   quando a migration é só aditiva.

### Manter a API acordada

O Render free dorme com 15 min sem tráfego, e o cold start medido passa de 120 s (ver "O que
esperar do plano gratuito"). Quem resolve é um **monitor externo gratuito**, como o UptimeRobot:

- Monitor tipo **HTTP(s)**, URL `https://projetofans-api.onrender.com/api/v1/saude`, intervalo
  **5 minutos** (o mínimo do plano free).
- Ganho extra: ele avisa por e-mail quando a API cai — hoje ninguém fica sabendo até um colega
  reclamar.
- As 750 h/mês de instância do Render free cobrem um serviço ligado o mês inteiro (744 h).

**Por que não o GitHub Actions** (o `manter-acordado.yml`): ele roda em `master`, mas não segura a
API. O `schedule` do GitHub atrasa e se espaça sob carga — cerca de 6 execuções por dia em vez de
144 —, e com 15 min de silêncio a API já dormiu em todas elas, então cada uma leva 3 a 4 minutos
esperando o cold start e não mantém nada acordado. O monitor externo, a cada 5 minutos, não tem esse
problema. **Quando o UptimeRobot estiver ativo, desligue o workflow** (aba Actions → Disable
workflow, ou apague o arquivo) — ainda não foi desligado.

**O banco não acorda junto, e isso é de propósito.** O `/saude` não consulta o banco, e o pool do
perfil `teste` não segura conexão ociosa (`spring.datasource.hikari` no `application.yml`). Assim o
Neon free suspende o compute quando ninguém usa o app, e a cota mensal de compute não acaba no
meio do mês com a API acordada 24 h. Quem abre o app depois de um tempo parado espera o Neon
acordar (alguns segundos), não o Render (minutos). **Não ponha consulta ao banco no `/saude`**: o
ping de 5 em 5 min manteria o Neon ligado o mês inteiro.

---

## Se der errado

| Sintoma | Causa provável |
|---|---|
| Build falha no Maven | o `Dockerfile` compila com Java 17; se alguém mexeu no `pom.xml`, as duas versões precisam bater |
| Sobe e morre em seguida | `DATABASE_URL` sem `jdbc:` na frente — você copiou o formato errado no Neon. Tem que ser o **Java**, não o "connection string" |
| `502` que não passa | veja os logs no Render: Flyway falhando aparece lá com o nome da migration |
| `401` em tudo, inclusive login | `JWT_SECRET` ausente ou curto demais (precisa de 256 bits) |
| Funciona no `curl` e não no app | `apiUrl` do `environment.prod.ts` ainda apontando para `localhost` |
