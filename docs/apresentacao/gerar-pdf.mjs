/**
 * Gera o PDF ABNT a partir de documento-abnt.html.
 *
 * Usa o Chrome que ja existe nesta maquina pelo protocolo de depuracao (CDP),
 * com WebSocket nativo do Node 22+. Sem instalar dependencia nenhuma.
 *
 * Por que CDP e nao `chrome --headless --print-to-pdf`: aquele comando so
 * oferece dois extremos — cabecalho padrao do Chrome (com URL e data, que a
 * ABNT nao aceita) ou nenhuma numeracao. O CDP deixa definir o template do
 * cabecalho, que e como a numeracao vai para o canto superior direito.
 *
 * Perfil separado (--user-data-dir temporario) de proposito: sem isso o
 * comando se anexaria ao Chrome que o usuario ja tem aberto.
 *
 *   node docs/apresentacao/gerar-pdf.mjs
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORTA = 9333;
const ENTRADA = resolve('docs/apresentacao/documento-abnt.html');
const SAIDA = resolve('docs/apresentacao/projetoFans-documentacao-ABNT.pdf');

const CM = 1 / 2.54; // polegadas por centimetro

const perfil = mkdtempSync(join(tmpdir(), 'pf-chrome-'));

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

/** O Chrome demora a abrir a porta; tenta ate responder. */
async function esperarDevTools() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORTA}/json/version`);
      if (r.ok) return;
    } catch {
      // ainda subindo — nao e erro, e o estado esperado nas primeiras tentativas
    }
    await dormir(250);
  }
  throw new Error('O Chrome nao abriu a porta de depuracao em 15s.');
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
      if (!p) return;
      msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result);
    } else if (eventos.has(msg.method)) {
      eventos.get(msg.method)();
      eventos.delete(msg.method);
    }
  });

  return {
    pronto: new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', () => rej(new Error('Falha ao conectar no CDP.')), { once: true });
    }),
    enviar(method, params = {}) {
      const id = ++seq;
      return new Promise((res, rej) => {
        pendentes.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    aoEvento(nome) {
      return new Promise((res) => eventos.set(nome, res));
    },
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
  await cdp.enviar('Page.navigate', { url: pathToFileURL(ENTRADA).href });
  await carregou;
  await dormir(400); // fontes e layout assentarem

  // ABNT NBR 14724: numero da pagina no canto superior direito.
  // O cabecalho e desenhado dentro da margem superior de 3 cm.
  const cabecalho = `
    <div style="width:100%;font-family:Arial,Helvetica,sans-serif;font-size:10pt;
                color:#000;padding:1.1cm 2cm 0 3cm;text-align:right;">
      <span class="pageNumber"></span>
    </div>`;

  const { data } = await cdp.enviar('Page.printToPDF', {
    paperWidth: 21 * CM,
    paperHeight: 29.7 * CM,
    marginTop: 3 * CM,
    marginRight: 2 * CM,
    marginBottom: 2 * CM,
    marginLeft: 3 * CM,
    printBackground: true,
    preferCSSPageSize: false,
    displayHeaderFooter: true,
    headerTemplate: cabecalho,
    footerTemplate: '<div></div>',
  });

  writeFileSync(SAIDA, Buffer.from(data, 'base64'));
  console.log(`PDF gerado: ${SAIDA}`);

  cdp.fechar();
} finally {
  chrome.kill();
  try {
    rmSync(perfil, { recursive: true, force: true });
  } catch {
    // perfil temporario preso pelo Chrome encerrando; o SO limpa depois
  }
}
