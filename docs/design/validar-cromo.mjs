/**
 * Contraste do CROMO, medido a partir do variables.scss de verdade.
 *
 * O `validar-paleta.mjs` valida as 12 hues de materia e so elas. O cromo — a
 * tinta sobre as superficies — nunca foi medido, e foi por isso que `--ink-3`
 * viveu em 3.33:1 (reprova AA) sendo a cor da AUTORIA, o nao-negociavel numero 1.
 *
 * Le o SCSS em vez de repetir os hex aqui: uma copia dos valores neste arquivo
 * empataria com o outro na primeira vez que alguem mudasse um dos dois, e um
 * validador que valida uma copia velha e pior que nenhum.
 *
 *   node docs/design/validar-cromo.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SCSS = join(AQUI, '..', '..', 'app', 'src', 'theme', 'variables.scss');

const canal = (v) => {
  v /= 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
};
/** rgba(r,g,b,a) composto sobre um hex opaco -> o hex que o olho ve. */
const compor = (rgba, fundoHex) => {
  const m = rgba.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)[,\s/]+([\d.]+)\s*\)/);
  if (!m) return rgba;
  const a = parseFloat(m[4]);
  const f = parseInt(fundoHex.slice(1), 16);
  const mix = (c, i) => Math.round(c * a + ((f >> (16 - 8 * i)) & 255) * (1 - a));
  return (
    '#' +
    [1, 2, 3]
      .map((i) => mix(parseInt(m[i], 10), i - 1).toString(16).padStart(2, '0'))
      .join('')
  );
};

/** Como `razao`, mas aceita rgba() do lado da tinta. */
const razaoAlpha = (tinta, ground) => razao(compor(tinta, ground), ground);

const razao = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * Os tokens do bloco pedido.
 *
 * O arquivo tem dois blocos que definem os MESMOS nomes: `:root` e o
 * `prefers-color-scheme: dark`. Fatiar pelo indice do `@media` e o que mantem
 * os dois separados sem precisar de um parser de SCSS.
 */
function tokens(fonte, tema) {
  const corte = fonte.indexOf('@media (prefers-color-scheme: dark)');
  const bloco = tema === 'claro' ? fonte.slice(0, corte) : fonte.slice(corte);
  const t = {};
  for (const m of bloco.matchAll(/^\s*(--[\w-]+):\s*(#[0-9A-Fa-f]{6}|rgba?\([^)]+\))\s*;/gm)) {
    t[m[1]] = m[2];
  }
  return t;
}

const fonte = readFileSync(SCSS, 'utf8');
const TINTAS = ['--ink', '--ink-2', '--ink-3', '--accent'];
const GROUNDS = ['--paper', '--surface', '--surface-2'];
const MINIMO = 4.5; // AA, texto pequeno. A autoria e renderizada em 11-13px.
const MINIMO_GRAFICO = 3; // WCAG 1.4.11, elemento grafico e borda de estado.

let falhas = 0;
for (const tema of ['claro', 'escuro']) {
  const t = tokens(fonte, tema);
  const ausentes = [...TINTAS, ...GROUNDS].filter((k) => !t[k]);
  if (ausentes.length) {
    console.log(`${tema}: token ausente -> ${ausentes.join(', ')}`);
    falhas += ausentes.length;
    continue;
  }
  console.log(`--- ${tema} ---`);
  for (const g of GROUNDS) {
    for (const tinta of TINTAS) {
      const r = razao(t[tinta], t[g]);
      const ok = r >= MINIMO;
      if (!ok) falhas++;
      console.log(
        `  ${tinta.padEnd(9)} sobre ${g.padEnd(11)} ${r.toFixed(2).padStart(6)}:1  ${ok ? 'OK' : '*** REPROVA AA ***'}`,
      );
    }
  }
  // Os dois degraus da escada NAO seguem a mesma regra, e a primeira versao
  // deste validador errou exatamente nisso: cobrou 1.05 dos dois e reprovou o
  // design aprovado por 0.003.
  //
  // paper -> surface tem de se sustentar SOZINHO. E a separacao mais repetida do
  // app (todo cartao contra o fundo) e ela nao pode depender de sombra: sombra
  // some em "reduzir transparencia", em modo de alto contraste e em impressao.
  //
  // surface -> surface-2 pode depender de elevacao, e depende: no claro sao
  // 1.047, e quem separa e `box-shadow: var(--e1)` mais a borda. Isso e legitimo
  // porque surface-2 e sempre um elemento FLUTUANTE, e flutuante sempre carrega
  // sombra — nao existe surface-2 chapado. Medimos e mostramos, mas nao reprova.
  const chao = razao(t['--paper'], t['--surface']);
  const alto = razao(t['--surface'], t['--surface-2']);
  const chaoOk = chao >= 1.05;
  if (!chaoOk) falhas++;
  console.log(
    `  escada  paper->surface ${chao.toFixed(3)}  ${chaoOk ? 'OK' : '*** DEGRAU INVISIVEL ***'}`,
  );
  console.log(
    `          surface->surface-2 ${alto.toFixed(3)}  (separado por --e1 + borda, nao por luminancia)`,
  );
  console.log();
}

// ---------------------------------------------------------------------------
// O BLOCO DE PROVA E UMA QUARTA SUPERFICIE, E A PRIMEIRA VERSAO DESTE ARQUIVO
// NAO O MEDIA.
//
// --prova-bg e o valor OPOSTO ao da pagina, e por isso ele tem tinta propria:
// --prova-fg e --prova-fg-2. A lacuna custou dois defeitos reais, achados por
// auditoria e nao por este script: o aviso "oculto pelo lider" do mini-card e a
// marca de anotacao do calendario usavam --ink-3 DENTRO do bloco invertido, a
// 3.23:1 no claro e 2.74:1 no escuro.
//
// Dai as duas asseguracoes abaixo. A segunda e a que importa: ela nao so mede a
// tinta certa, ela CONFIRMA que a tinta errada reprova — para que o dia em que
// alguem escrever `color: var(--ink-3)` sobre --prova-bg, este arquivo ja tenha
// dito, por escrito, que aquilo nao passa.
// ---------------------------------------------------------------------------
console.log('--- bloco de prova (tinta propria) ---');
for (const tema of ['claro', 'escuro']) {
  const t = tokens(fonte, tema);
  const fg = razao(t['--prova-fg'], t['--prova-bg']);
  const fg2 = razaoAlpha(t['--prova-fg-2'], t['--prova-bg']);
  const ok = fg >= MINIMO && fg2 >= MINIMO;
  if (!ok) falhas++;
  console.log(
    `  ${tema.padEnd(7)} prova-fg ${fg.toFixed(2)}:1  prova-fg-2 ${fg2.toFixed(2)}:1  ${ok ? 'OK' : '*** REPROVA AA ***'}`,
  );
  // --ink-3 sobre o bloco invertido: fica REGISTRADO que nao serve.
  //
  // Comparado com MINIMO (4.5) e nao com MINIMO_GRAFICO (3) de proposito: dos
  // dois usos errados que existiam, um era TEXTO de 9px (o aviso do mini-card).
  // Medir a tinta de texto pelo piso de elemento grafico foi o erro da primeira
  // versao desta checagem — 3.23:1 limpa os 3:1 e mesmo assim reprova.
  const errada = razao(t['--ink-3'], t['--prova-bg']);
  if (errada >= MINIMO) {
    console.log(
      `  ${tema.padEnd(7)} ATENCAO: --ink-3 sobre --prova-bg subiu para ${errada.toFixed(2)}:1.`,
    );
    console.log('          Reescreva este aviso — ele existe porque a resposta era "nao serve".');
  } else {
    console.log(
      `  ${tema.padEnd(7)} (--ink-3 sobre --prova-bg = ${errada.toFixed(2)}:1, abaixo de ${MINIMO} — nao use; ha --prova-fg-2)`,
    );
  }
}
console.log();

console.log(falhas === 0 ? 'OK: cromo passa AA nos dois temas' : `${falhas} problema(s)`);
process.exit(falhas === 0 ? 0 : 1);
