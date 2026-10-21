/**
 * Gera o PDF do deck a partir dos 16 slides em deck/project/slides/.
 *
 * O proprio artifact exporta PDF e PPTX pelo menu — use aquele quando puder,
 * porque ele e quem renderiza de verdade os elementos do runtime. Este script
 * existe para ter o arquivo na mao sem depender de abrir a pagina.
 *
 * Dois slides usam elementos que so o runtime do artifact conhece: a barra de
 * 12 cores da capa (<x-shape>) e a seta da arquitetura (<x-connector>). Em
 * navegador comum eles nao renderizam, entao ha um remendo de CSS abaixo que
 * reproduz os dois. Se algum slide novo usar outro elemento custom, ele sai
 * invisivel — conferir a lista no fim da execucao.
 *
 *   node docs/apresentacao/gerar-deck-pdf.mjs
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORTA = 9334;
const DECK = resolve('docs/apresentacao/deck/project');
const MONTADO = resolve('docs/apresentacao/deck-para-impressao.html');
const SAIDA = resolve('docs/apresentacao/projetoFans-apresentacao.pdf');

const indice = JSON.parse(readFileSync(join(DECK, 'deck.json'), 'utf8'));
const fonte = Object.values(indice.faces ?? {})[0]?.href ?? '';

const slides = indice.order.map((id) => {
  const bruto = readFileSync(join(DECK, 'slides', `${id}.html`), 'utf8');
  // As notas de orador nao vao para o PDF projetado.
  return bruto.replace(/<aside>[\s\S]*?<\/aside>/g, '');
});

const custom = [...new Set(slides.join('').match(/<x-[a-z-]+/g) ?? [])];

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${indice.title}</title>
<link rel="stylesheet" href="${fonte}">
<style>
  /* Pagina com a proporcao do slide: 1920x1080 a 96dpi. */
  @page { size: 1920px 1080px; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }

  section {
    position: relative;
    width: 1920px;
    height: 1080px;
    overflow: hidden;
    page-break-after: always;
    box-sizing: border-box;
  }
  section:last-of-type { page-break-after: auto; }

  /* O runtime do artifact nao aceita margin: todo espacamento vem de gap e
     padding. O navegador comum da 1em de margem a p, h1-h3 e ul — sem este
     reset os slides estouravam a altura e o fim deles saia cortado. */
  section * { margin: 0; box-sizing: border-box; }
  section ul, section ol { padding-left: 1.2em; }

  /* Remendo dos elementos do runtime do artifact.
     x-shape kind="rect": o estilo inline ja traz background, width e height —
     falta so deixar de ser inline. */
  x-shape { display: block; }

  /* x-connector e uma camada posicionada no runtime; aqui vira um fio
     horizontal que ocupa seu lugar na linha flex. Aproximacao deliberada: o
     que ele comunica e "o cliente fala com a API". */
  x-connector {
    display: block;
    align-self: center;
    width: 64px;
    height: 0;
    border-top: 3px solid currentColor;
  }

  x-icon { display: inline-block; width: 1em; height: 1em; }
</style>
</head>
<body>
${slides.join('\n')}
</body>
</html>`;

writeFileSync(MONTADO, html, 'utf8');
console.log(`montado: ${indice.order.length} slides`);
console.log(`elementos custom encontrados: ${custom.join(', ') || '(nenhum)'}`);

const perfil = mkdtempSync(join(tmpdir(), 'pf-deck-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORTA}`,
  `--user-data-dir=${perfil}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--disable-extensions',
  'about:blank',
], { stdio: 'ignore' });

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function esperarDevTools() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORTA}/json/version`)).ok) return;
    } catch {
      // ainda subindo
    }
    await dormir(250);
  }
  throw new Error('Chrome nao abriu a porta de depuracao em 15s.');
}

function cliente(url) {
  const ws = new WebSocket(url);
  let seq = 0;
  const pendentes = new Map();
  const eventos = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id !== undefined) {
      const p = pendentes.get(msg.id);
      pendentes.delete(msg.id);
      if (p) (msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result));
    } else if (eventos.has(msg.method)) {
      eventos.get(msg.method)();
      eventos.delete(msg.method);
    }
  });
  return {
    pronto: new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', () => rej(new Error('Falha no CDP.')), { once: true });
    }),
    enviar(method, params = {}) {
      const id = ++seq;
      return new Promise((res, rej) => {
        pendentes.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    aoEvento: (nome) => new Promise((res) => eventos.set(nome, res)),
    fechar: () => ws.close(),
  };
}

try {
  await esperarDevTools();
  const alvo = await (await fetch(`http://127.0.0.1:${PORTA}/json/new?about:blank`, { method: 'PUT' })).json();
  const cdp = cliente(alvo.webSocketDebuggerUrl);
  await cdp.pronto;

  await cdp.enviar('Page.enable');
  const carregou = cdp.aoEvento('Page.loadEventFired');
  await cdp.enviar('Page.navigate', { url: pathToFileURL(MONTADO).href });
  await carregou;

  /**
   * Esperar `document.fonts.ready`, nao um numero de milissegundos.
   *
   * Com espera fixa de 2,5s o PDF saiu inteiro em Arial: o Google Fonts nao
   * tinha chegado e o Chrome imprimiu com a fonte de fallback. Como o resultado
   * continha texto normalmente, a falha so apareceu ao listar as fontes
   * embutidas no PDF — nenhuma verificacao visual teria pego isso rapido.
   */
  await cdp.enviar('Runtime.enable');
  const prontas = await cdp.enviar('Runtime.evaluate', {
    expression: `document.fonts.ready.then(() => [...document.fonts].map(f => f.family + ' ' + f.weight + ' ' + f.status).join(' | '))`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('fontes carregadas:', prontas.result?.value || '(nenhuma)');
  await dormir(500); // layout assentar depois da troca de fonte

  const { data } = await cdp.enviar('Page.printToPDF', {
    paperWidth: 1920 / 96,
    paperHeight: 1080 / 96,
    marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
    printBackground: true,
    preferCSSPageSize: false,
    displayHeaderFooter: false,
    landscape: false,
  });

  writeFileSync(SAIDA, Buffer.from(data, 'base64'));
  console.log(`PDF gerado: ${SAIDA}`);
  cdp.fechar();
} finally {
  chrome.kill();
  try {
    rmSync(perfil, { recursive: true, force: true });
  } catch {
    // perfil temporario preso pelo Chrome encerrando; o SO limpa
  }
}
