/**
 * Liga o fluxo de protótipo do Figma — arquivo "projetoFans — Design System e Telas"
 * (fileKey 2y3DwZteuQfOFQxoj7o1fd).
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * A cota MCP do plano Starter do Figma estourou quatro vezes tentando fazer isso.
 * O script em si é pequeno e roda em UMA chamada; o problema nunca foi a
 * complexidade, foi o orçamento. Guardado aqui para não se perder, e porque há um
 * caminho que não passa pela cota nenhuma (ver abaixo).
 *
 * COMO RODAR SEM GASTAR COTA
 * 1. No Figma, instale o plugin "Scripter" (gratuito, roda Plugin API no arquivo aberto).
 * 2. Abra o arquivo do projetoFans, página "Design System".
 * 3. Plugins → Scripter → cole tudo daqui → Run.
 * Leva uns 3 segundos. Depois é só entrar no modo de apresentação (▶) e clicar.
 *
 * COMO RODAR PELO MCP, se a cota estiver de pé
 * Uma chamada de use_figma com este conteúdo. Nada mais.
 *
 * O QUE ELE LIGA
 * - as 4 abas da barra inferior, nas 4 telas principais (16 conexões)
 * - "+ Anotar neste dia" (Calendário) → tela de nova anotação
 * - "+ Enviar material" (Matérias) → tela de enviar material
 * - as duas subtelas voltam com clique em qualquer lugar
 * - ponto de partida do fluxo na Home
 *
 * OS IDS SÃO DESTE ARQUIVO. Se alguém recriar as telas, eles mudam — rode
 * get_metadata no frame "workspace" (24:151) para pegar os novos.
 */

// As 4 telas principais vivem dentro do frame "workspace". Navegar para frame
// aninhado funciona no protótipo do Figma — a apresentação mostra o frame de
// destino no tamanho dele (390x844), o pai não entra.
const HOME = '24:152';
const CAL = '24:247';
const MAT = '24:398';
const QUADRO = '24:502';
const NOVA_ANOTACAO = '24:685';
const ENVIAR_MATERIAL = '24:743';

function irPara(destino) {
  return [{
    trigger: { type: 'ON_CLICK' },
    actions: [{
      type: 'NODE',
      destinationId: destino,
      navigation: 'NAVIGATE',
      transition: {
        type: 'SMART_ANIMATE',
        easing: { type: 'EASE_OUT' },
        duration: 0.22,
      },
      preserveScrollPosition: false,
    }],
  }];
}

// Cada tela tem a própria barra de abas, com ids próprios. Mapa explícito: quatro
// abas por tela, quatro telas. A aba da tela atual aponta para ela mesma de
// propósito — tocar em "Home" estando na Home não pode levar a lugar nenhum.
const ABAS = [
  // tela Home
  ['24:230', HOME], ['24:235', CAL], ['24:239', MAT], ['24:243', QUADRO],
  // tela Calendário
  ['24:381', HOME], ['24:385', CAL], ['24:390', MAT], ['24:394', QUADRO],
  // tela Matérias
  ['24:485', HOME], ['24:489', CAL], ['24:493', MAT], ['24:498', QUADRO],
  // tela Meu quadro
  ['24:567', HOME], ['24:571', CAL], ['24:575', MAT], ['24:579', QUADRO],
];

const ACOES = [
  ['24:378', NOVA_ANOTACAO],    // "+ Anotar neste dia", no Calendário
  ['24:467', ENVIAR_MATERIAL],  // "+ Enviar material", em Matérias
  // As duas subtelas voltam com clique em qualquer lugar: elas não têm botão de
  // voltar desenhado, e num protótipo de apresentação ficar preso é pior que um
  // alvo generoso demais.
  [NOVA_ANOTACAO, CAL],
  [ENVIAR_MATERIAL, MAT],
];

const ligados = [];
const faltando = [];

for (const [origem, destino] of [...ABAS, ...ACOES]) {
  const no = await figma.getNodeByIdAsync(origem);
  if (!no) { faltando.push(origem); continue; }
  await no.setReactionsAsync(irPara(destino));
  ligados.push(origem + ' -> ' + destino);
}

// Sem ponto de partida, o modo de apresentação abre no que estiver selecionado.
// Com ele, abre sempre na Home.
figma.currentPage.flowStartingPoints = [
  { nodeId: HOME, name: 'projetoFans — fluxo principal' },
];

return {
  ligados: ligados.length,
  faltando,
  pontoDePartida: 'Home (24:152)',
};
