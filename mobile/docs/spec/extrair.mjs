// Extrai as especificacoes do journal do workflow para um JSON por area.
// node mobile/docs/spec/extrair.mjs <journal.jsonl>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const aqui = dirname(fileURLToPath(import.meta.url));
const linhas = readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const rotulo = new Map(linhas.filter((l) => l.type === 'started').map((l) => [l.agentId, l.label]));
let n = 0;
for (const l of linhas.filter((x) => x.type === 'result' && x.result)) {
  const r = rotulo.get(l.agentId) ?? '';
  const id = r.startsWith('ler:') ? r.slice(4) : r;
  if (!id) continue;
  writeFileSync(join(aqui, `${id}.json`), JSON.stringify(l.result, null, 2));
  const t = l.result.telas?.length ?? '-', e = l.result.endpoints?.length ?? '-', a = l.result.armadilhas?.length ?? '-';
  console.log(`${id.padEnd(26)} telas=${String(t).padStart(2)} endpoints=${String(e).padStart(2)} armadilhas=${String(a).padStart(2)}`);
  n++;
}
console.log(`${n} arquivos escritos em ${aqui}`);
