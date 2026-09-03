# Montar o protótipo navegável no Figma

Arquivo: **projetoFans — Design System e Telas** · `2y3DwZteuQfOFQxoj7o1fd`

Hoje esse arquivo tem **só a página "Design System"**. A página "Telas" que o
antigo README dizia existir não está lá — ou foi apagada, ou nunca chegou a ser
criada. Este documento é o caminho para pôr as 19 telas e o fluxo dentro dele.

## Por que não pela MCP do Figma

O plano Starter esgota a cota de chamadas MCP quase imediatamente — travou na
segunda chamada. O **plugin Scripter** roda dentro do Figma, com a Plugin API
inteira, e **não consome cota nenhuma**. É por ele que vamos.

---

## Caminho principal — Scripter (5 minutos, sem cota)

1. Abra o arquivo no Figma e **crie uma página nova** (chame de `Telas`).
2. Descompacte `telas-figma-png.zip` e **arraste os 19 PNGs para dentro dessa
   página**. O Figma nomeia cada imagem pelo nome do arquivo — é assim que o
   script encontra cada uma.
3. `Plugins → Scripter` (instale se não tiver: é gratuito na Community).
4. Cole o conteúdo de **`figma-montar-prototipo.js`** e rode (Ctrl/Cmd + Enter).

O script:

- envolve cada imagem num frame de **390×844** com o nome da tela;
- liga **rolagem vertical** nos frames cujo conteúdo passa de 844 — `home`,
  `cal`, `materias`, `material`, `turma`. Isso não é detalhe: o botão
  "Adicionar prova ou entrega" da home fica em **y=1173**. Um frame cortado em
  844 deixaria o Teste 03 sem alvo nenhum;
- cria **103 retângulos invisíveis** de toque e liga cada um ao destino;
- marca `login` como ponto de partida do fluxo.

Ao terminar mostra `19 telas, 103 ligações`. Se disser "Faltam imagens", é
porque algum PNG não foi arrastado — o console lista o que ele achou na página.

### Se o Scripter falhar

Rode `python gerar-script-figma.py` para regerar o script a partir de
`hotspots.json`. Nenhuma coordenada foi digitada à mão: todas foram medidas pelo
navegador em cima do mockup, então regerar é sempre seguro.

---

## Caminho de reserva — modo agente do Figma

Só se o Scripter não der. O modo agente também tem uso limitado no plano
Starter, então **este prompt foi escrito para acertar de primeira**, e não para
virar conversa. Cole inteiro, de uma vez:

> Na página atual há 19 imagens PNG, cada uma é uma tela de um app de celular, e
> o nome de cada imagem é o nome da tela. Faça o seguinte, sem me perguntar nada
> no meio:
>
> 1. Para cada imagem, crie um frame de 390 de largura por 844 de altura, com o
>    mesmo nome da imagem, e mova a imagem para dentro dele na posição 0,0.
>    Redimensione a imagem para 390 de largura mantendo a proporção.
> 2. Nos frames `home`, `cal`, `materias`, `material` e `turma` a imagem fica
>    mais alta que 844. Nesses, ative "clip content" e defina a direção de
>    overflow como vertical, para o protótipo rolar. Não corte a imagem.
> 3. Organize os frames numa grade de 5 colunas, com 80 de espaço horizontal e
>    160 de espaço vertical entre eles.
> 4. Marque o frame `login` como ponto de partida do fluxo (flow starting point),
>    com o nome "Fluxo completo — projetoFans".
> 5. Me avise quando terminar, dizendo quantos frames criou.
>
> Não crie as ligações de clique ainda — eu vou te passar a lista depois.

Depois disso, as ligações precisam ser criadas a partir de `hotspots.json` — são
103, uma a uma, e é exatamente por isso que o Scripter é o caminho melhor.

---

## Regerar tudo, se o mockup mudar

A fonte de verdade é `telas-v3.html`. Mudou o desenho? Rode em ordem:

```bash
python extrair-hotspots.py     # mede telas e alvos no navegador -> hotspots.json
python gerar-pngs-figma.py     # 19 PNGs @2x em png-figma/
python gerar-script-figma.py   # figma-montar-prototipo.js
```

`extrair-hotspots.py` avisa em `stderr` se algum `data-ir` apontar para uma tela
que não existe, ou se alguma tela ficar sem saída.

### Uma armadilha que custou seis tentativas

`--screenshot` do Chrome sem interface **fotografa antes de rodar script
injetado no fim do arquivo**; `--dump-dom` espera. Qualquer tentativa de
"injetar um script que arruma a página e depois tirar a foto" fotografa a página
como ela estava **antes** — e sai uma imagem plausível, do tamanho certo, com o
conteúdo errado. Foram 19 PNGs dados como bons duas vezes seguidas.

Por isso `gerar-pngs-figma.py` faz uma passada de `--dump-dom` para pegar o DOM
já montado e depois monta, em Python, um documento estático por tela. A foto é
de algo que não precisa de JS.

Duas armadilhas menores que o mesmo caminho resolve:

- o Chrome sem interface responde `prefers-color-scheme: dark`, e o mockup
  obedece — daí `data-tema="claro"` ir escrito no `<html>`;
- a animação de entrada congela no frame 0 num render estático e esvazia a tela.
