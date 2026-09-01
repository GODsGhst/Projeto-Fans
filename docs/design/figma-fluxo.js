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
  quadro: 'Meu quadro',
  nota: 'Nova anotação',
  material: 'Enviar material',
  novaMateria: 'Nova matéria',
  novoEvento: 'O que vai cair',
  turma: 'Fans 2026.2',
};

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
 * Devolve o ancestral MAIS EXTERNO que serve, não o primeiro. O primeiro seria o
 * corpo da tela — e a barra de abas é IRMÃ dele, não filha. Parando ali, nenhuma
 * das 36 ligações de aba encontra o próprio botão, e o relatório culpa o rótulo
 * em vez da subida. Medido: com o critério antigo, 34 de 36 abas ficavam de fora.
 */
function telaDe(no) {
  let atual = no;
  let melhor = null;
  while (atual && atual.type !== 'PAGE') {
    if (Math.round(atual.width) === LARGURA_DA_TELA && atual.height >= ALTURA_MINIMA_DA_TELA) {
      melhor = atual;
    }
    atual = atual.parent;
  }
  return melhor;
}

const todosOsTextos = figma.currentPage.findAllWithCriteria({ types: ['TEXT'] });

// Texto EXATO: "Nova matéria" é o título da tela e "+  Nova matéria" é o botão
// que leva até ela. Casar por substring confundiria os dois.
const TELAS = {};
const semTela = [];
for (const chave of Object.keys(MARCA_DA_TELA)) {
  const marca = MARCA_DA_TELA[chave];
  const texto = todosOsTextos.find((t) => t.characters.trim() === marca);
  const tela = texto && telaDe(texto);
  if (tela) TELAS[chave] = tela;
  else semTela.push(chave + ' (procurei o texto "' + marca + '")');
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

const ABAS = [
  ['Home', 'home'],
  ['Cal', 'cal'],  // o rótulo desenhado é "Cal", não "Calendário"
  ['Matérias', 'materias'],
  ['Quadro', 'quadro'],
];

const COM_ABAS = [
  'home', 'cal', 'materias', 'quadro',
  'nota', 'material', 'novaMateria', 'novoEvento', 'turma',
];

const ligacoes = [];

// A aba da tela atual aponta para ela mesma de propósito: tocar em "Home"
// estando na Home não pode levar a lugar nenhum.
for (const onde of COM_ABAS) {
  for (const [rotulo, destino] of ABAS) {
    ligacoes.push([botao(TELAS[onde], rotulo), TELAS[destino], onde + ' · aba ' + rotulo]);
  }
}

ligacoes.push(
  [botao(TELAS.home, 'Cadastrar prova ou entrega'), TELAS.novoEvento, 'home -> novo evento'],
  [botao(TELAS.materias, 'Nova matéria'), TELAS.novaMateria, 'matérias -> nova matéria'],
  [botao(TELAS.quadro, 'a turma'), TELAS.turma, 'quadro -> a turma'],
  // Sem 'calendário -> nova anotação': no mockup esse botão é montado por
  // JavaScript depois de tocar num dia, então ele não existe no HTML estático e
  // não chega no import. Para ligá-lo, ele precisa primeiro ser desenhado.
  [botao(TELAS.materias, 'Enviar material'), TELAS.material, 'matérias -> enviar material'],

  // A seta de voltar das telas novas.
  [botao(TELAS.novaMateria, '←'), TELAS.materias, 'nova matéria -> voltar'],
  [botao(TELAS.novoEvento, '←'), TELAS.home, 'novo evento -> voltar'],
  [botao(TELAS.turma, '←'), TELAS.quadro, 'a turma -> voltar'],

  // Estas duas não têm seta desenhada: a tela inteira volta ao clique. Num
  // protótipo, alvo largo demais é menos ruim que ficar preso.
  [TELAS.nota, TELAS.cal, 'nova anotação -> voltar (tela toda)'],
  [TELAS.material, TELAS.materias, 'enviar material -> voltar (tela toda)'],

  // As telas de entrada, na ordem em que um aluno as vê de verdade.
  [botao(TELAS.login, 'Criar conta'), TELAS.cadastro, 'login -> cadastro'],
  [botao(TELAS.login, 'Esqueci'), TELAS.recuperar, 'login -> recuperar senha'],
  [botao(TELAS.login, 'Entrar'), TELAS.entrarTurma, 'login -> entrar na turma'],
  [botao(TELAS.cadastro, 'Criar conta'), TELAS.entrarTurma, 'cadastro -> entrar na turma'],
  [botao(TELAS.entrarTurma, 'Entrar na turma'), TELAS.home, 'entrar na turma -> home'],
);

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
figma.currentPage.flowStartingPoints = [
  TELAS.login && { nodeId: TELAS.login.id, name: 'projetoFans — fluxo completo' },
  TELAS.home && { nodeId: TELAS.home.id, name: 'projetoFans — só as abas' },
].filter(Boolean);

return {
  telasEncontradas: Object.keys(TELAS).length + ' de ' + Object.keys(MARCA_DA_TELA).length,
  telasNaoEncontradas: semTela,
  ligacoes: ligados.length,
  naoLigadas: naoLigadas,
};
