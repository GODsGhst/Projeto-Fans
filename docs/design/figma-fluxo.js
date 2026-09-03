/**
 * Liga o fluxo de protótipo do Figma — arquivo "projetoFans — Design System e Telas".
 *
 * POR QUE ELE NÃO USA MAIS IDS
 * A versão anterior tinha os ids escritos à mão (`24:152`, `24:247`…). Ela
 * funcionava exatamente uma vez: **todo id muda quando as telas são reimportadas**,
 * e reimportar é justamente o que se faz ao adicionar tela nova. O script inteiro
 * viraria uma lista de nós inexistentes, e o relatório diria "16 faltando" sem
 * dizer por quê. Agora ele acha tudo pelo texto que está desenhado na tela — o
 * texto sobrevive ao reimport, o id não.
 *
 * ANTES DE RODAR
 * Importe `telas-figma.html`, não `telas-v3.html`. O segundo esconde 12 das 13
 * telas com `display:none` e o import viria quase vazio. Gere o primeiro com
 * `python docs/design/gerar-telas-figma.py`.
 *
 * COMO RODAR SEM GASTAR COTA DO MCP
 * 1. No Figma, instale o plugin "Scripter" (gratuito).
 * 2. Abra o arquivo do projetoFans, na página das telas.
 * 3. Plugins → Scripter → cole tudo daqui → Run.
 * Depois é só entrar no modo de apresentação (▶) e clicar.
 *
 * O QUE ELE LIGA
 * - as 4 abas da barra inferior, em cada tela que tem barra
 * - as 3 entradas novas: cadastrar prova/entrega, nova matéria, a turma
 * - "+ Anotar neste dia" e "+ Enviar material"
 * - a seta de voltar de cada subtela
 * - dois pontos de partida: o fluxo inteiro (login) e só as abas (home)
 *
 * O relatório no fim diz o que ligou e o que não encontrou, com o nome de cada
 * coisa. "Não encontrado" quase sempre significa que o texto da tela mudou —
 * ajuste o marcador aqui, não o desenho lá.
 */

// Cada tela é identificada por um texto que só existe nela. Conferido contra o
// HTML: todos aparecem uma vez só no documento inteiro.
const MARCA_DA_TELA = {
  login: 'projetoFans',
  cadastro: 'seu nome',
  entrarTurma: 'código da turma',
  recuperar: 'Enviar link',
  home: 'Sexta, 21 ago',
  cal: 'Agosto',
  materias: 'bd · b-204',
  // NÃO use 'Meu quadro' nem 'Fans 2026.2': a barra lateral do desktop repete os
  // dois em TODA tela, e o marcador passou a casar com 12 quadros em vez de um.
  // O marcador tem de viver no corpo da tela, não na moldura.
  quadro: 'não listados · 1',
  nota: 'Nova anotação',
  material: 'Enviar material',
  novaMateria: 'Nova matéria',
  novoEvento: 'O que vai cair',
  turma: 'quem está aqui',
  // "Passar a liderança" aparece DUAS vezes — é o título desta tela e o rótulo do
  // botão que leva até ela. Marcador tem de ser único, então uso o rótulo do
  // seletor de pessoa, que só existe aqui.
  transferir: 'para quem',
  transferirOk: 'Ana Beatriz agora é a líder.',
};

/**
 * As duas larguras de artboard. O mesmo script liga os dois tamanhos porque as
 * telas são as mesmas — muda a moldura, não o fluxo.
 *
 * No desktop a navegação é a barra lateral, com os rótulos por extenso
 * ("Calendário", "Meu quadro"); no celular são as abas de baixo, abreviadas
 * porque quatro palavras não cabem em 390px. Os dois mapas estão em ABAS.
 */
const LARGURAS = [390, 1280];
const LARGURA_DA_TELA = 390;
// A barra de título e a de abas também têm 390 de largura. Sem uma altura
// mínima, subir do texto até "o primeiro ancestral de 390" para na barra, e todo
// botão passa a ser procurado dentro dela — onde não há nenhum. Medido no HTML:
// a barra tem ~56 de altura, a tela tem 844 ou mais.
const ALTURA_MINIMA_DA_TELA = 700;

function transicao(destinoId) {
  return [{
    trigger: { type: 'ON_CLICK' },
    actions: [{
      type: 'NODE',
      destinationId: destinoId,
      navigation: 'NAVIGATE',
      transition: { type: 'SMART_ANIMATE', easing: { type: 'EASE_OUT' }, duration: 0.22 },
      preserveScrollPosition: false,
    }],
  }];
}

/**
 * Sobe do texto até o quadro da tela.
 *
 * A regra é ESTRUTURAL, não métrica: sobe até o nó de primeiro nível — aquele
 * cujo pai é a página (ou uma seção) — e confere se ele tem uma das larguras de
 * artboard. No Figma todo artboard é de primeiro nível, então isso identifica a
 * tela sem depender de altura.
 *
 * A versão anterior procurava "o ancestral mais externo com 390 de largura", e
 * isso quebrou no dia em que passaram a existir duas larguras válidas: um
 * invólucro de 390px em volta de um quadro de desktop de 1280 sequestrava o
 * resultado, e as 62 ligações de desktop iam todas para o lugar errado. Medida
 * confunde quando há mais de um tamanho; posição na árvore não.
 */
function telaDe(no) {
  let atual = no;
  while (atual && atual.parent && atual.parent.type !== 'PAGE' && atual.parent.type !== 'SECTION') {
    atual = atual.parent;
  }
  if (!atual) return null;
  return LARGURAS.indexOf(Math.round(atual.width)) !== -1 ? atual : null;
}

const todosOsTextos = figma.currentPage.findAllWithCriteria({ types: ['TEXT'] });

// Texto EXATO: "Nova matéria" é o título da tela e "+  Nova matéria" é o botão
// que leva até ela. Casar por substring confundiria os dois.
const TELAS = {};
const semTela = [];
for (const chave of Object.keys(MARCA_DA_TELA)) {
  const marca = MARCA_DA_TELA[chave];
  // TODAS as ocorrências, não a primeira: cada tela existe duas vezes no arquivo
  // (celular e desktop) e ligar só uma deixaria metade do protótipo morto.
  const achadas = [];
  for (const t of todosOsTextos) {
    if (t.characters.trim() !== marca) continue;
    const tela = telaDe(t);
    if (tela && achadas.indexOf(tela) === -1) achadas.push(tela);
  }
  if (achadas.length) TELAS[chave] = achadas;
  else semTela.push(chave + ' (procurei o texto "' + marca + '")');
}

/** A versão de uma tela com a mesma largura de `referencia`. */
function mesmoTamanho(lista, referencia) {
  if (!lista || !referencia) return null;
  const alvo = Math.round(referencia.width);
  for (const t of lista) if (Math.round(t.width) === alvo) return t;
  return null;
}

/**
 * Acha o que se clica DENTRO de uma tela, pelo rótulo.
 *
 * A busca é restrita à tela de propósito: "Matérias" é rótulo de aba nas quatro
 * telas principais, e procurar no arquivo inteiro ligaria sempre a mesma.
 */
function botao(tela, rotulo) {
  if (!tela) return null;
  const textos = tela.findAllWithCriteria({ types: ['TEXT'] });
  const texto =
    textos.find((t) => t.characters.trim() === rotulo) ||
    textos.find((t) => t.characters.indexOf(rotulo) !== -1);
  if (!texto) return null;
  // O alvo do clique é o botão, não a letra: sobe um nível, desde que o pai não
  // seja a tela inteira — aí o clique valeria em qualquer lugar dela.
  const pai = texto.parent;
  const paiServe = pai && pai.id !== tela.id && pai.height < ALTURA_MINIMA_DA_TELA;
  return paiServe ? pai : texto;
}

/**
 * A navegação principal, por largura.
 *
 * No celular são as abas de baixo, com "Cal" abreviado porque quatro palavras
 * não cabem em 390px. No desktop é a barra lateral, e lá cabem por extenso —
 * abreviar sem precisar é hostil com quem lê. Os rótulos diferem, o destino não.
 */
const NAV = {
  390: [['Home', 'home'], ['Cal', 'cal'], ['Matérias', 'materias'], ['Quadro', 'quadro']],
  1280: [
    ['Home', 'home'],
    ['Calendário', 'cal'],
    ['Matérias', 'materias'],
    ['Meu quadro', 'quadro'],
  ],
};

const COM_NAV = [
  'home', 'cal', 'materias', 'quadro',
  'nota', 'material', 'novaMateria', 'novoEvento', 'turma',
  'transferir', 'transferirOk',
];

/** Ações que existem nos dois tamanhos: [tela de origem, rótulo, tela de destino]. */
const ACOES = [
  ['home', 'Cadastrar prova ou entrega', 'novoEvento'],
  ['materias', 'Nova matéria', 'novaMateria'],
  ['quadro', 'a turma', 'turma'],
  ['materias', 'Enviar material', 'material'],
  // Sem 'calendário -> nova anotação': esse botão é montado por JavaScript
  // depois de tocar num dia. Ele existe no DOM renderizado, mas depende de um
  // clique que o import não dá — se aparecer no arquivo, o script o liga.
  ['cal', 'Anotar neste dia', 'nota'],

  ['novaMateria', '←', 'materias'],
  ['novoEvento', '←', 'home'],
  ['turma', '←', 'quadro'],

  ['turma', 'Passar a liderança', 'transferir'],
  ['transferir', 'Ana Beatriz', 'transferirOk'],
  ['transferir', '←', 'turma'],
  ['transferirOk', 'Voltar para a turma', 'turma'],
  ['transferirOk', '←', 'turma'],

  ['login', 'Criar conta', 'cadastro'],
  ['login', 'Esqueci', 'recuperar'],
  ['login', 'Entrar', 'entrarTurma'],
  ['cadastro', 'Criar conta', 'entrarTurma'],
  ['entrarTurma', 'Entrar na turma', 'home'],
];

/** Telas sem seta desenhada: a tela inteira volta ao clique. */
const VOLTA_INTEIRA = [['nota', 'cal'], ['material', 'materias']];

const ligacoes = [];

// Um passe por largura. Uma tela de celular NUNCA aponta para uma de desktop:
// no modo de apresentação isso trocaria o aparelho no meio do fluxo.
for (const largura of LARGURAS) {
  const sufixo = largura === 390 ? ' [celular]' : ' [desktop]';
  const nav = NAV[largura] || [];

  const daLargura = (chave) => {
    const lista = TELAS[chave];
    if (!lista) return null;
    for (const t of lista) if (Math.round(t.width) === largura) return t;
    return null;
  };

  // A seção atual aponta para ela mesma de propósito: tocar em "Home" estando
  // na Home não pode levar a lugar nenhum.
  for (const onde of COM_NAV) {
    for (const [rotulo, destino] of nav) {
      ligacoes.push([
        botao(daLargura(onde), rotulo),
        daLargura(destino),
        onde + ' · ' + rotulo + sufixo,
      ]);
    }
  }

  for (const [origem, rotulo, destino] of ACOES) {
    ligacoes.push([
      botao(daLargura(origem), rotulo),
      daLargura(destino),
      origem + ' -> ' + destino + sufixo,
    ]);
  }

  for (const [origem, destino] of VOLTA_INTEIRA) {
    ligacoes.push([daLargura(origem), daLargura(destino), origem + ' -> voltar' + sufixo]);
  }
}

const ligados = [];
const naoLigadas = [];
for (const [origem, destino, nome] of ligacoes) {
  if (!origem || !destino) {
    naoLigadas.push(nome);
    continue;
  }
  await origem.setReactionsAsync(transicao(destino.id));
  ligados.push(nome);
}

// Sem ponto de partida a apresentação abre no que estiver selecionado. Dois
// fluxos: o completo, para mostrar o app como um aluno o encontra, e o das abas,
// para quem só quer ver a navegação sem passar pelo login toda vez.
const inicio = [];
for (const largura of LARGURAS) {
  const nome = largura === 390 ? 'celular' : 'desktop';
  for (const chave of ['login', 'home']) {
    const lista = TELAS[chave] || [];
    for (const tela of lista) {
      if (Math.round(tela.width) !== largura) continue;
      inicio.push({
        nodeId: tela.id,
        name: 'projetoFans · ' + nome + (chave === 'login' ? ' — completo' : ' — só as abas'),
      });
    }
  }
}
figma.currentPage.flowStartingPoints = inicio;

let quadros = 0;
for (const k of Object.keys(TELAS)) quadros += TELAS[k].length;

return {
  telasEncontradas:
    Object.keys(TELAS).length + ' de ' + Object.keys(MARCA_DA_TELA).length +
    ' (' + quadros + ' quadros, contando celular e desktop)',
  telasNaoEncontradas: semTela,
  ligacoes: ligados.length,
  naoLigadas: naoLigadas,
};
