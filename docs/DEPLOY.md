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
| perfil `teste` | Postgres real, e-mail no log, Google desligado — **uma conta só** |
| `GET /api/v1/saude` | health check, público, não expõe nada |

O perfil `prod` continua existindo e continua exigente: sem `SMTP_*` nem `FCM_SERVICE_ACCOUNT_JSON`
ele **não sobe**, e isso é correto para produção de verdade. O `teste` é o que troca rigor por
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

4. Guarde três coisas, separadas:
   - a **URL** acima (é o `DATABASE_URL`)
   - o **usuário** (algo como `neondb_owner`)
   - a **senha**

> **Não use o Postgres gratuito do próprio Render.** Ele expira em 30 dias e apaga os dados junto.
> Num app que a turma vai usar por um semestre, isso é uma armadilha com data marcada. O do Neon
> não expira.

---

## Passo 2 — API no Render (~5 min)

1. Entre em **render.com** e crie conta com o GitHub.
2. Vá em **Blueprints → New Blueprint Instance**.
3. Aponte para o repositório `GODsGhst/Projeto-Fans`. Ele acha o `render.yaml` sozinho.
4. Ele vai pedir as três variáveis que ficaram marcadas como "pergunte no painel":

   | Variável | O que colar |
   |---|---|
   | `DATABASE_URL` | a URL JDBC do Neon, inteira |
   | `DATABASE_USER` | o usuário do Neon |
   | `DATABASE_PASSWORD` | a senha do Neon |

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

Em `app/src/environments/environment.prod.ts`:

```ts
apiUrl: 'https://projetofans-api.onrender.com/api/v1'
```

Depois é `npx cap add android` e gerar o APK. Esse passo tem guia próprio quando chegar a hora.

---

## O que esperar do plano gratuito

**O serviço dorme depois de 15 minutos parado**, e a primeira chamada depois disso leva **30 a 50
segundos** para responder. Isso é do free tier do Render, não do app.

Na prática, para a turma: quem abre o app primeiro no dia espera; os outros não. O app guarda
snapshot local, então quem já usou continua vendo o que tinha mesmo enquanto o servidor acorda.

**O design já contava com isso.** A notificação da véspera é agendada **no aparelho**, não empurrada
pelo servidor — decisão 2.3 do spec, tomada justamente porque um job `@Scheduled` às 19h não roda
num servidor dormindo. O furo que essa hibernação criaria já estava fechado antes de existir.

Se o cold start incomodar de verdade, a saída é um host que não hiberne — e aí passa a custar.
Para um teste de turma, os 40 s da primeira abertura são o preço de não pagar nada.

---

## O que este ambiente NÃO tem

Consciente, e cada um por um motivo:

- **Login por Google.** Precisa de projeto no Google Cloud e OAuth Client ID. O botão aparece
  explicitamente desabilitado no app — botão presente e morto mente sobre o que o app faz. E-mail
  e senha funcionam normalmente.
- **E-mail de "esqueci a senha".** Cai no log do Render em vez de chegar na caixa de entrada. Para
  recuperar uma senha no teste, você lê o link no painel do Render. Ligar SMTP de verdade é uma
  variável de ambiente e uma conta na Brevo (300/dia grátis).
- **Notificação push.** É a Task 8, ainda não implementada.
- **Envio de arquivo.** É a Task 15. Material entra por link.

---

## Se der errado

| Sintoma | Causa provável |
|---|---|
| Build falha no Maven | o `Dockerfile` compila com Java 17; se alguém mexeu no `pom.xml`, as duas versões precisam bater |
| Sobe e morre em seguida | `DATABASE_URL` sem `jdbc:` na frente, ou usuário/senha em branco |
| `502` que não passa | veja os logs no Render: Flyway falhando aparece lá com o nome da migration |
| `401` em tudo, inclusive login | `JWT_SECRET` ausente ou curto demais (precisa de 256 bits) |
| Funciona no `curl` e não no app | `apiUrl` do `environment.prod.ts` ainda apontando para `localhost` |
