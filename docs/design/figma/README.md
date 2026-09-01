# Figma — projetoFans

Arquivo: **projetoFans — Design System e Telas**
`fileKey` = `2y3DwZteuQfOFQxoj7o1fd` · https://www.figma.com/design/2y3DwZteuQfOFQxoj7o1fd

Convertido de `docs/design/design-system-v1.html` (fase 1 aprovada). Nada foi redesenhado:
tokens, hues e gramática visual vieram do mockup; os hexes conferem com `validar-paleta.mjs`
(12/12 ≥ 4.5:1, mínimo 4.92:1).

## Estado

| Item | Situação |
|---|---|
| Variáveis: Cor (26), Materia (12), Raio (3) | pronto |
| 14 estilos de texto (Roboto / Roboto Mono) | pronto |
| Componentes: Chip, Card de evento, Barra de abas, Mini card, Linha de material | pronto |
| Telas: Home, Matérias, Meu quadro | pronto |
| Telas: Calendário, Home vazia, Home offline | **pendente** — cota MCP do plano Starter |

Os scripts das três telas pendentes estão no fim deste arquivo, prontos para rodar via
`use_figma` com o `fileKey` acima. Rode na ordem.

## Por que não há modos Claro/Escuro

O plano Starter limita a **1 modo por coleção**. Os dois temas viraram grupos de nome
(`claro/paper`, `escuro/paper`) na mesma coleção — mesmo acesso, sem depender do plano.
Trocar de tema no Figma exige religar as variáveis, não é um toggle. Num plano pago,
converter para modos é meia hora.

## Mapa de IDs

Necessário porque cada chamada `use_figma` é um contexto novo — IDs de chamadas anteriores
precisam entrar no script como literais.

### Páginas

| Página | ID |
|---|---|
| Design System | `0:1` |
| Telas | `11:7` |

### Frames de tela

| Tela | ID |
|---|---|
| Home | `11:8` |
| Matérias | `11:9` |
| Meu quadro | `11:10` |
| Calendário | `11:11` (vazio) |
| Home — semana vazia | `11:12` (vazio) |
| Home — offline | ainda não criado |

### Componentes

| Componente | Set | Variantes / propriedades |
|---|---|---|
| Chip de materia | `6:26` | `6:2` 01-azul, `6:4` 02-azul-celeste, `6:6` 03-teal, `6:8` 04-verde, `6:10` 05-oliva, `6:12` 06-ambar, `6:14` 07-laranja-queimado, `6:16` 08-laranja, `6:18` 09-vermelho, `6:20` 10-rosa, `6:22` 11-magenta, `6:24` 12-violeta · props: `Cor` (variante), `Sigla#6:0` |
| Card de evento | `7:28` | `7:2` Prova, `7:15` Entrega · props: `Dia#7:0`, `Mes#7:3`, `Quando#7:6`, `Titulo#7:9`, `Rodape#7:12`, `Mostrar chip#14:0`, `Mostrar rodape#14:3` |
| Barra de abas | `9:56` | `9:4` Home, `9:17` Cal, `9:30` Materias, `9:43` Quadro |
| Mini card | `10:18` | `10:6` Prova, `10:10` Entrega, `10:14` Feito · props: `Titulo#10:0`, `Mostrar aviso#15:0`, `Aviso#15:4` |
| Linha de material | `10:19` | props: `Tipo#10:4`, `Titulo#10:5`, `Autor#10:6` |

### Variáveis usadas nos scripts

| Token | ID |
|---|---|
| claro/paper | `VariableID:3:3` |
| claro/panel | `VariableID:3:5` |
| claro/ink | `VariableID:3:7` |
| claro/ink-2 | `VariableID:3:9` |
| claro/ink-3 | `VariableID:3:11` |
| claro/rule | `VariableID:3:13` |
| claro/rule-soft | `VariableID:3:15` |
| claro/accent | `VariableID:3:17` |
| claro/prova-bg | `VariableID:3:21` |
| claro/prova-fg | `VariableID:3:23` |
| claro/prova-fg-2 | `VariableID:3:25` |
| Materia 01-azul | `VariableID:4:3` |
| Materia 02-azul-celeste | `VariableID:4:4` |
| Materia 03-teal | `VariableID:4:5` |
| Materia 04-verde | `VariableID:4:6` |
| Raio r-sm | `VariableID:4:16` |
| Raio r-md | `VariableID:4:17` |
| Raio r-lg | `VariableID:4:18` |

## Armadilhas já pagas

Quatro erros que custaram chamadas. Não repetir:

1. **`createAutoLayout()` cria frame com preenchimento branco.** Todo contêiner interno
   precisa de `fills = []`, senão tapa o bloco sólido da prova.
2. **Mexer em estilo de texto exige carregar a fonte dele antes** — inclusive Roboto Mono,
   mesmo que o script pareça só tocar em `letterSpacing`.
3. **Propriedade não-variante se referencia pelo id completo** (`Mostrar chip#14:0`), não
   pelo nome. Só propriedade de variante (`Cor`) usa o nome puro.
4. **Roboto usa `SemiBold`**, sem espaço. Inter usa `Semi Bold`, com espaço.

Script que falha é atômico: nada é criado, pode corrigir e repetir.

---

## Pendente 1 — Calendário (frame `11:11`)

Agosto de 2026 começa num sábado. Dia com prova é preenchido, dia com entrega é vazado —
mesma gramática da Home. As marcas são pontos de 4px na cor da matéria.

```js
const R = "Roboto", M = "Roboto Mono";
await Promise.all([
  figma.loadFontAsync({ family: R, style: "Regular" }), figma.loadFontAsync({ family: R, style: "Medium" }),
  figma.loadFontAsync({ family: R, style: "SemiBold" }), figma.loadFontAsync({ family: R, style: "Bold" }),
  figma.loadFontAsync({ family: M, style: "Regular" }), figma.loadFontAsync({ family: M, style: "Medium" })
]);
const telas = await figma.getNodeByIdAsync("11:7");
await figma.setCurrentPageAsync(telas);

const styles = await figma.getLocalTextStylesAsync();
const S = {}; for (const s of styles) S[s.name] = s.id;
const nomes = ["ink","ink2","ink3","rule","ruleSoft","provaBg","provaFg","m1","m2","m3","m4"];
const idsv = ["VariableID:3:7","VariableID:3:9","VariableID:3:11","VariableID:3:13","VariableID:3:15","VariableID:3:21","VariableID:3:23","VariableID:4:3","VariableID:4:4","VariableID:4:5","VariableID:4:6"];
const resolved = await Promise.all(idsv.map(i => figma.variables.getVariableByIdAsync(i)));
const V = {}; nomes.forEach((n, i) => { V[n] = resolved[i]; });
const paint = (v) => figma.variables.setBoundVariableForPaint({ type: "SOLID", color: { r: 0, g: 0, b: 0 } }, "color", v);

const frame = await figma.getNodeByIdAsync("11:11");
const [cProva, tabCal] = await Promise.all([figma.getNodeByIdAsync("7:2"), figma.getNodeByIdAsync("9:17")]);

const bar = figma.createAutoLayout("HORIZONTAL", { name: "barra" });
bar.fills = []; bar.primaryAxisAlignItems = "SPACE_BETWEEN"; bar.counterAxisAlignItems = "CENTER";
bar.paddingLeft = 16; bar.paddingRight = 16; bar.paddingTop = 18; bar.paddingBottom = 12;
bar.strokes = [paint(V.ruleSoft)]; bar.strokeAlign = "INSIDE";
bar.strokeBottomWeight = 1; bar.strokeTopWeight = 0; bar.strokeLeftWeight = 0; bar.strokeRightWeight = 0;
frame.appendChild(bar);
bar.layoutSizingHorizontal = "FILL"; bar.layoutSizingVertical = "HUG";
const tit = figma.createText();
tit.characters = "Agosto"; tit.textStyleId = S["barra/titulo"]; tit.fills = [paint(V.ink)];
bar.appendChild(tit);
const mes = figma.createText();
mes.characters = "mês"; mes.textStyleId = S["meta"]; mes.fills = [paint(V.ink3)];
bar.appendChild(mes);

const corpo = figma.createAutoLayout("VERTICAL", { name: "corpo", itemSpacing: 10 });
corpo.fills = [];
corpo.paddingLeft = 16; corpo.paddingRight = 16; corpo.paddingTop = 12; corpo.paddingBottom = 12;
frame.appendChild(corpo);
corpo.layoutSizingHorizontal = "FILL"; corpo.layoutSizingVertical = "FILL";
corpo.primaryAxisAlignItems = "MIN";

const EVENTOS = {
  8:  { tipo: "entrega", cor: "m1" }, 12: { tipo: "prova", cor: "m2" },
  14: { tipo: "entrega", cor: "m3" }, 16: { tipo: "prova", cor: "m4" },
  19: { tipo: "entrega", cor: "m4" }, 23: { tipo: "prova", cor: "m1" }
};
const grade = figma.createAutoLayout("VERTICAL", { name: "grade", itemSpacing: 2 });
grade.fills = [];
corpo.appendChild(grade);
grade.layoutSizingHorizontal = "FILL"; grade.layoutSizingVertical = "HUG";

function novaLinha() {
  const l = figma.createAutoLayout("HORIZONTAL", { name: "semana", itemSpacing: 2 });
  l.fills = [];
  grade.appendChild(l);
  l.layoutSizingHorizontal = "FILL"; l.layoutSizingVertical = "HUG";
  return l;
}

const cab = novaLinha();
for (const d of ["d", "s", "t", "q", "q", "s", "s"]) {
  const c = figma.createFrame();
  c.name = "hd"; c.fills = []; c.layoutMode = "HORIZONTAL";
  c.primaryAxisAlignItems = "CENTER"; c.counterAxisAlignItems = "CENTER";
  c.resize(49, 16);
  cab.appendChild(c);
  c.layoutSizingHorizontal = "FILL";
  const t = figma.createText();
  t.characters = d; t.textStyleId = S["meta"]; t.fills = [paint(V.ink3)];
  c.appendChild(t);
}

const celulas = [];
for (let i = 0; i < 6; i++) celulas.push(null);
for (let d = 1; d <= 31; d++) celulas.push(d);
while (celulas.length % 7 !== 0) celulas.push(null);

for (let i = 0; i < celulas.length; i += 7) {
  const linha = novaLinha();
  for (let j = 0; j < 7; j++) {
    const dia = celulas[i + j];
    const ev = dia ? EVENTOS[dia] : null;
    const c = figma.createFrame();
    c.name = dia ? "dia-" + dia : "vazio";
    c.layoutMode = "VERTICAL"; c.itemSpacing = 2;
    c.primaryAxisAlignItems = "CENTER"; c.counterAxisAlignItems = "CENTER";
    c.cornerRadius = 3;
    c.resize(49, 46);
    if (ev && ev.tipo === "prova") { c.fills = [paint(V.provaBg)]; c.strokes = []; }
    else if (ev) { c.fills = []; c.strokes = [paint(V.rule)]; c.strokeWeight = 1; c.strokeAlign = "INSIDE"; }
    else { c.fills = []; c.strokes = []; }
    linha.appendChild(c);
    c.layoutSizingHorizontal = "FILL";

    if (dia) {
      const t = figma.createText();
      t.characters = String(dia);
      t.textStyleId = S["lista/autor"];
      t.fills = [paint(ev && ev.tipo === "prova" ? V.provaFg : V.ink2)];
      if (ev && ev.tipo === "prova") t.fontName = { family: R, style: "Bold" };
      c.appendChild(t);
      if (ev) {
        const marcas = figma.createAutoLayout("HORIZONTAL", { name: "marcas", itemSpacing: 2 });
        marcas.fills = [];
        c.appendChild(marcas);
        const u = figma.createEllipse();
        u.resize(4, 4); u.fills = [paint(V[ev.cor])];
        marcas.appendChild(u);
      }
    }
  }
}

const rot = figma.createAutoLayout("HORIZONTAL", { name: "rotulo", itemSpacing: 6 });
rot.fills = []; rot.counterAxisAlignItems = "CENTER"; rot.paddingTop = 4;
corpo.appendChild(rot);
rot.layoutSizingHorizontal = "FILL"; rot.layoutSizingVertical = "HUG";
const rt = figma.createText();
rt.characters = "dia 12"; rt.textStyleId = S["rotulo/grupo"]; rt.fills = [paint(V.ink3)];
rot.appendChild(rt);
const fio = figma.createRectangle();
fio.resize(40, 1); fio.fills = [paint(V.rule)];
rot.appendChild(fio); fio.layoutSizingHorizontal = "FILL";

const ev = cProva.createInstance();
corpo.appendChild(ev);
ev.layoutSizingHorizontal = "FILL";
const p = { "Dia#7:0": "12", "Mes#7:3": "ago", "Quando#7:6": "19:00", "Titulo#7:9": "Prova 2 — normalização e SQL" };
p["Mostrar rodape#14:3"] = false;
ev.setProperties(p);
ev.findAllWithCriteria({ types: ["INSTANCE"] })[0].setProperties({ "Cor": "02-azul-celeste", "Sigla#6:0": "BD" });

const tabs = tabCal.createInstance();
frame.appendChild(tabs);
tabs.layoutSizingHorizontal = "FILL";

await frame.screenshot();
return { frameId: frame.id };
```

---

## Pendente 2 — Home vazia (frame `11:12`) e Home offline (frame novo)

São duas telas, não uma. O spec é explícito: confundir *não tem prova* com *falhei ao buscar*
é o pior bug que este app pode ter. A tela vazia não preenche com dica, sugestão nem skeleton —
duas frases, e a segunda é o convite a cadastrar, que é a única coisa acionável honesta ali.

```js
const R = "Roboto", M = "Roboto Mono";
await Promise.all([
  figma.loadFontAsync({ family: R, style: "Regular" }), figma.loadFontAsync({ family: R, style: "Medium" }),
  figma.loadFontAsync({ family: R, style: "SemiBold" }), figma.loadFontAsync({ family: R, style: "Bold" }),
  figma.loadFontAsync({ family: M, style: "Regular" }), figma.loadFontAsync({ family: M, style: "Medium" })
]);
const telas = await figma.getNodeByIdAsync("11:7");
await figma.setCurrentPageAsync(telas);

const styles = await figma.getLocalTextStylesAsync();
const S = {}; for (const s of styles) S[s.name] = s.id;
const idsv = ["VariableID:3:3","VariableID:3:7","VariableID:3:9","VariableID:3:11","VariableID:3:13","VariableID:3:15","VariableID:4:16"];
const [paper, ink, ink2, ink3, rule, ruleSoft, rSm] = await Promise.all(idsv.map(i => figma.variables.getVariableByIdAsync(i)));
const paint = (v) => figma.variables.setBoundVariableForPaint({ type: "SOLID", color: { r: 0, g: 0, b: 0 } }, "color", v);

const [cEntrega, tabHome] = await Promise.all([figma.getNodeByIdAsync("7:15"), figma.getNodeByIdAsync("9:4")]);

function barra(frame, titulo, direita) {
  const bar = figma.createAutoLayout("HORIZONTAL", { name: "barra" });
  bar.fills = []; bar.primaryAxisAlignItems = "SPACE_BETWEEN"; bar.counterAxisAlignItems = "CENTER";
  bar.paddingLeft = 16; bar.paddingRight = 16; bar.paddingTop = 18; bar.paddingBottom = 12;
  bar.strokes = [paint(ruleSoft)]; bar.strokeAlign = "INSIDE";
  bar.strokeBottomWeight = 1; bar.strokeTopWeight = 0; bar.strokeLeftWeight = 0; bar.strokeRightWeight = 0;
  frame.appendChild(bar);
  bar.layoutSizingHorizontal = "FILL"; bar.layoutSizingVertical = "HUG";
  const t = figma.createText();
  t.characters = titulo; t.textStyleId = S["barra/titulo"]; t.fills = [paint(ink)];
  bar.appendChild(t);
  const d = figma.createText();
  d.characters = direita; d.textStyleId = S["meta"]; d.fills = [paint(ink3)];
  bar.appendChild(d);
}

function corpoDe(frame, gap) {
  const c = figma.createAutoLayout("VERTICAL", { name: "corpo", itemSpacing: gap });
  c.fills = [];
  c.paddingLeft = 16; c.paddingRight = 16; c.paddingTop = 12; c.paddingBottom = 12;
  frame.appendChild(c);
  c.layoutSizingHorizontal = "FILL"; c.layoutSizingVertical = "FILL";
  c.primaryAxisAlignItems = "MIN";
  return c;
}

// ---------- 1. semana vazia ----------
const vazia = await figma.getNodeByIdAsync("11:12");
barra(vazia, "Esta semana", "0 de 6");
const cv = corpoDe(vazia, 8);

const bloco = figma.createAutoLayout("VERTICAL", { name: "vazio", itemSpacing: 8 });
bloco.fills = [];
bloco.paddingTop = 26; bloco.paddingBottom = 26; bloco.paddingLeft = 4; bloco.paddingRight = 4;
cv.appendChild(bloco);
bloco.layoutSizingHorizontal = "FILL"; bloco.layoutSizingVertical = "HUG";

const b1 = figma.createText();
b1.characters = "Nada nos próximos 14 dias.";
b1.textStyleId = S["evento/titulo-entrega"]; b1.fills = [paint(ink)];
b1.textAutoResize = "HEIGHT";
bloco.appendChild(b1); b1.layoutSizingHorizontal = "FILL";

const b2 = figma.createText();
b2.characters = "Se você sabe de alguma prova ou entrega que não está aqui, cadastre — qualquer pessoa da turma pode.";
b2.textStyleId = S["corpo"]; b2.fills = [paint(ink3)];
b2.textAutoResize = "HEIGHT";
bloco.appendChild(b2); b2.layoutSizingHorizontal = "FILL";

const tv = tabHome.createInstance();
vazia.appendChild(tv); tv.layoutSizingHorizontal = "FILL";

// ---------- 2. offline ----------
const off = figma.createFrame();
off.name = "Home — offline";
off.resize(390, 844);
off.x = 5 * 470; off.y = 0;
off.fills = [paint(paper)];
off.clipsContent = true;
off.layoutMode = "VERTICAL";
off.primaryAxisSizingMode = "FIXED"; off.counterAxisSizingMode = "FIXED";
off.itemSpacing = 0;

barra(off, "Esta semana", "cache");
const co = corpoDe(off, 8);

const aviso = figma.createAutoLayout("HORIZONTAL", { name: "aviso" });
aviso.fills = [];
aviso.paddingLeft = 10; aviso.paddingRight = 10; aviso.paddingTop = 8; aviso.paddingBottom = 8;
aviso.strokes = [paint(rule)]; aviso.strokeWeight = 1; aviso.dashPattern = [3, 3];
["topLeftRadius","topRightRadius","bottomLeftRadius","bottomRightRadius"].forEach(k => aviso.setBoundVariable(k, rSm));
co.appendChild(aviso);
aviso.layoutSizingHorizontal = "FILL"; aviso.layoutSizingVertical = "HUG";
const av = figma.createText();
av.characters = "Sem conexão · mostrando dados de ontem 21:40";
av.textStyleId = S["evento/rodape"]; av.fills = [paint(ink2)];
av.textAutoResize = "HEIGHT";
aviso.appendChild(av); av.layoutSizingHorizontal = "FILL";

const cache = cEntrega.createInstance();
co.appendChild(cache);
cache.layoutSizingHorizontal = "FILL";
const pc = { "Dia#7:0": "08", "Mes#7:3": "ago", "Quando#7:6": "23:59", "Titulo#7:9": "Lista 4 — integrais por partes" };
pc["Mostrar rodape#14:3"] = false;
cache.setProperties(pc);
cache.findAllWithCriteria({ types: ["INSTANCE"] })[0].setProperties({ "Cor": "01-azul", "Sigla#6:0": "CALC2" });

const to = tabHome.createInstance();
off.appendChild(to); to.layoutSizingHorizontal = "FILL";

await vazia.screenshot();
return { vaziaId: vazia.id, offlineId: off.id };
```

---

---

## Telas novas — set/2026

Três telas entraram depois do MVP e precisam existir aqui também: **Nova matéria**,
**O que vai cair** (nova prova/entrega) e **A turma** (código de convite + membros).

### Importar

Importe `docs/design/telas-figma.html`, **não** `telas-v3.html`.

O mockup navegável tem uma casca de celular só e alterna as telas com `display:none`.
Todo importador renderiza o DOM como ele está: 12 das 13 telas chegariam vazias, e o
import *parece* ter funcionado. O arquivo de import é gerado:

```
python docs/design/gerar-telas-figma.py
```

Cada tela vira um quadro próprio de 390px, visível, com a própria barra de abas.
As que passam de 844px de altura crescem em vez de cortar — medido: Matérias tem 976.

### Ligar o fluxo

`docs/design/figma-fluxo.js`, no plugin Scripter. Ele foi **reescrito**: a versão com ids
literais (`24:152`) funcionava exatamente uma vez, porque todo id muda no reimport — e
reimportar é o que se faz ao adicionar tela. Agora ele acha tudo pelo texto desenhado.

Liga 48 coisas: 36 abas, as 3 entradas novas, as setas de voltar e o caminho de entrada
(login → cadastro → turma → home). Dois pontos de partida: fluxo completo e só as abas.

### O que foi verificado, e o que não foi

A lógica de resolução foi rodada contra o DOM de `telas-figma.html`, que tem a mesma forma
que o Figma monta: 13/13 telas e 48/48 ligações resolvem, e marcador inexistente devolve
`null` em vez de chutar outro nó. Isso pegou três bugs reais antes de qualquer chamada:

1. o rótulo da aba é **"Cal"**, não "Calendário";
2. a barra de título também tem 390 de largura, então largura sozinha não identifica tela —
   `telaDe` parava nela e procurava os botões dentro do cabeçalho;
3. a barra de abas é **irmã** do corpo da tela, não filha: subindo até o *primeiro*
   ancestral de 390, 34 das 36 abas ficavam de fora. Agora sobe até o mais externo.

**Não foi rodado no Figma** — a árvore de nós de lá não é idêntica à do DOM (o importador
agrupa coisas, e textos podem se juntar ou separar). Se algo não ligar, o relatório do
script diz qual marcador falhou; o conserto é o marcador aqui, não o desenho lá.

### Uma ligação que não existe

`calendário → nova anotação` ficou de fora de propósito. No mockup esse botão é montado por
JavaScript depois de tocar num dia, então não existe no HTML estático e não chega no import.
Para ligá-lo, ele precisa primeiro ser desenhado.

## Depois das telas

O próximo passo do `LOG.md` continua valendo e não depende do Figma: converter o mockup
aprovado em componentes Ionic/Angular reais em `app/src/app/shared/`, o que desbloqueia as
tarefas 10-12 do Codex. O arquivo Figma é referência visual e superfície de ajuste barato —
não substitui essa conversão.
