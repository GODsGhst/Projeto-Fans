# Teste no celular — o que mandar junto com o APK

Esta página tem duas partes: o que **você** faz antes de enviar, e o texto que **o colega** recebe.
A segunda parte é para copiar e colar — está escrita para alguém que não mexe com código.

---

## Antes de enviar

1. **Acorde o servidor.** O plano gratuito do Render dorme com 15 minutos de silêncio, e a primeira
   chamada depois disso já passou de 2 minutos aqui. Abra o app no seu celular uma vez, ou rode o
   workflow pela aba Actions do GitHub. Se o `manter-acordado.yml` já estiver ligado no `master`,
   pule este passo — é justamente para isso que ele existe.

2. **Crie a turma e pegue o código.** Instale o APK, crie sua conta, escolha "Criar uma turma nova".
   O código aparece na tela seguinte, e depois fica em Meu quadro → *a turma*. São 8 caracteres e
   ele não expira.

3. **Cadastre pelo menos uma matéria e uma prova.** Um app vazio não se deixa testar: o colega abre,
   vê "Nada nos próximos 14 dias" e não tem o que olhar. Com uma prova lá dentro, ele já vê o nome
   de quem cadastrou e entende o que o app faz em cinco segundos.

4. **Mande o APK e o código.** O arquivo é `app-debug.apk`, cerca de 5 MB. WhatsApp costuma recusar
   `.apk` — Drive, Telegram ou cabo resolvem.

---

## Para copiar e mandar ao colega

> Oi! Fiz um app pra turma e queria que você testasse no seu celular. Leva uns 5 minutos.
>
> **Instalar**
> Baixe o arquivo `.apk` que te mandei e toque nele. O Android vai avisar que não conhece a origem —
> é esperado, o app não está na Play Store. Toque em *Configurações* e libere "instalar apps
> desconhecidos" para o aplicativo que abriu o arquivo (normalmente o Drive ou o Arquivos).
>
> **Entrar**
> Abra o app, toque em *Criar conta* e use qualquer e-mail — não precisa ser o verdadeiro e ninguém
> vai receber nada nele. Depois ele vai pedir o código da turma: **[COLE O CÓDIGO AQUI]**
>
> **A primeira tela pode demorar.** O servidor é gratuito e dorme quando ninguém usa; acordar leva
> até uns 2 minutos na primeira vez. Se der erro, tente de novo — a segunda costuma ser instantânea.
> Isso é do plano gratuito, não do app.
>
> **O que fazer lá dentro**
> 1. Veja se a prova que eu cadastrei aparece na tela inicial, com o meu nome embaixo.
> 2. Toque nela e veja se abre.
> 3. Cadastre uma prova ou entrega você mesmo — **qualquer pessoa da turma pode**, não precisa pedir
>    autorização pra ninguém. Eu vou ver aparecer aqui com o seu nome.
> 4. Em *Meu quadro*, marque algo como resolvido. Isso é só seu: eu não vejo, e ninguém mais vê.
> 5. Passeie pelas quatro abas de baixo e toque no que der vontade.
>
> **O que eu preciso saber**
> - Alguma tela ficou parada, em branco, ou girando pra sempre?
> - Algum botão não fez nada quando você tocou?
> - Alguma mensagem te deixou em dúvida sobre o que tinha acontecido?
> - Alguma coisa te pareceu errada ou fora de lugar?
>
> Print do que der errado ajuda bastante. Se travar, me fala em que tela estava e o que tinha
> acabado de tocar.
>
> **Duas coisas honestas:** os dados são de verdade e a turma inteira vê o que você cadastrar, então
> não escreva nada que não queira compartilhar. E é uma versão de teste — pode ter defeito, é
> exatamente isso que eu quero descobrir.

---

## O que já foi verificado, para você não caçar o que já se sabe

Rodado contra o servidor no ar em 2026-09-02, com duas contas de verdade — 19 verificações, todas
passaram:

| Verificado | |
|---|---|
| criar conta, criar turma, entrar com o código | ✓ |
| a prova de quem cadastrou aparece para o outro, com o nome certo | ✓ |
| qualquer membro cadastra, sem aprovação de ninguém | ✓ |
| marcar "feito" é pessoal e **não** vaza para o quadro do outro | ✓ |
| quem não é da turma não enxerga os dados dela | ✓ |
| o código de convite fica visível para todo membro, não só o líder | ✓ |

O que **não** foi testado num aparelho de verdade: a instalação em si, o comportamento com a tela
girada, e o que acontece quando o wifi cai no meio de uma ação. É para isso que o teste serve.
