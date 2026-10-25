/**
 * Descobre em que pagina do PDF cada secao primaria comeca.
 *
 * O sumario da ABNT precisa bater com o documento. Em vez de estimar, isto le o
 * PDF gerado: infla os fluxos de conteudo (o Chrome grava comprimidos), fica so
 * com os que tem operadores de texto — os de fonte tambem sao comprimidos — e
 * procura o titulo de cada secao.
 *
 * O texto vem como <hex> de ID de glifo, porque a fonte e embutida em
 * subconjunto. Nesta saida o ID e o ASCII menos 29, constante em todo o arquivo:
 * 0029 0024 0031 0036 = F A N S, a capa. Acentuados caem fora dessa faixa, entao
 * os marcadores abaixo usam so trechos ASCII.
 *
 *   node docs/apresentacao/mapear-paginas.mjs
 */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { resolve } from 'node:path';

const PDF = resolve('docs/apresentacao/projetoFans-documentacao-ABNT.pdf');
const DESLOCAMENTO = 29;

/**
 * Marcadores SENSIVEIS A CAIXA, e por um motivo: os titulos sao maiusculos por
 * CSS, mas as mesmas palavras aparecem minusculas no corpo. Comparando sem
 * caixa, "foi considerada no projeto" casava com a secao 10 e devolvia a pagina
 * errada. O numero da secao entra no marcador onde ajuda a desambiguar.
 */
const SECOES = [
  ['1', '1 INTRODU'],
  ['1.1', '1.1 Problema'],
  ['1.2', '1.2 Justificativa'],
  ['2', '2 OBJETIVOS'],
  ['2.1', '2.1 Objetivo geral'],
  ['2.2', '2.2 Objetivos espec'],
  ['2.3', '2.3 Delimita'],
  ['3', 'BLICO-ALVO'],
  ['4', '4 RECURSOS TECNOL'],
  ['4.1', '4.1 Linguagens'],
  ['4.2', '4.2 Banco de dados'],
  ['4.3', '4.3 Ferramentas'],
  ['5', '5 ARQUITETURA'],
  ['5.1', '5.1 Vis'],
  ['5.2', '5.2 Modelo de dados'],
  ['6', '6 PRINCIPAIS FUNCIONALIDADES'],
  ['7', 'VEIS DE ACESSO'],
  ['7.1', '7.1 N'],
  ['7.2', '7.2 Mecanismos'],
  ['7.3', '7.3 Auditoria'],
  ['8', '8 DIFICULDADES'],
  ['8.1', '8.1 Indisponibilidade'],
  ['8.2', '8.2 Conflito'],
  ['8.3', '8.3 Falha'],
  ['8.4', '8.4 Demais'],
  ['9', '9 BENEF'],
  ['10', '10 CONSIDERA'],
  ['', 'REFER'],
];

function decodificar(fluxo) {
  let saida = '';
  for (const [, hex] of fluxo.matchAll(/<([0-9A-Fa-f]+)>/g)) {
    for (let i = 0; i + 4 <= hex.length; i += 4) {
      const id = parseInt(hex.slice(i, i + 4), 16);
      const cod = id + DESLOCAMENTO;
      saida += cod >= 32 && cod <= 126 ? String.fromCharCode(cod) : '·';
    }
  }
  return saida;
}

const bruto = readFileSync(PDF);
const texto = bruto.toString('latin1');

const paginas = [];
const re = /stream\r?\n/g;
let m;
while ((m = re.exec(texto)) !== null) {
  const ini = m.index + m[0].length;
  const fim = texto.indexOf('endstream', ini);
  if (fim < 0) continue;
  let conteudo;
  try {
    conteudo = inflateSync(bruto.subarray(ini, fim)).toString('latin1');
  } catch {
    continue; // nao inflavel — esperado para alguns objetos
  }
  if (conteudo.includes('BT') && (conteudo.includes('Tj') || conteudo.includes('TJ'))) {
    paginas.push(decodificar(conteudo));
  }
}

// Sanidade: se a capa nao disser FANS, o deslocamento mudou e o resto e lixo.
if (!paginas[0] || !paginas[0].includes('FANS')) {
  console.error('A capa nao contem "FANS" — o deslocamento de glifo mudou. Conferir antes de usar.');
  console.error('Inicio da pagina 1:', JSON.stringify((paginas[0] ?? '').slice(0, 120)));
  process.exit(1);
}

console.log(`paginas de texto: ${paginas.length}\n`);

// A busca comeca DEPOIS do sumario: ele lista todos os titulos e casaria com
// todos os marcadores, devolvendo a propria pagina dele para cada secao.
const INICIO_DO_CORPO = paginas.findIndex((p) => p.toUpperCase().includes('SUM')) + 1;

const achados = [];
for (const [num, marca] of SECOES) {
  const rel = paginas.slice(INICIO_DO_CORPO).findIndex((p) => p.includes(marca));
  const pagina = rel < 0 ? null : INICIO_DO_CORPO + rel + 1;
  achados.push({ num, marca, pagina });
  console.log(`${(num || '—').padStart(3)}  ${marca.padEnd(28)} ${pagina ?? 'NAO ENCONTRADA'}`);
}

if (achados.some((a) => a.pagina === null)) {
  console.log('\nAlguma secao nao foi localizada — conferir os marcadores.');
  process.exit(1);
}

/**
 * As paginas tem de ser crescentes. Se nao forem, algum marcador casou dentro do
 * sumario — foi o que aconteceu quando o sumario passou a ocupar duas paginas e
 * a segunda ficou depois do ponto de corte. Falhar aqui e melhor que publicar um
 * sumario errado.
 */
let anterior = 0;
for (const a of achados) {
  if (a.pagina < anterior) {
    console.error(`\nFora de ordem: "${a.marca}" caiu na pagina ${a.pagina}, depois de ${anterior}.`);
    console.error('O corpo comeca na pagina', INICIO_DO_CORPO + 1, '— o sumario provavelmente passou de uma pagina.');
    process.exit(1);
  }
  anterior = a.pagina;
}
console.log('\nPaginas crescentes: ok. Sumario comeca o corpo na pagina', INICIO_DO_CORPO + 1);
