const MATERIAS = [
  ['CALC2','#1D4ED8'],['BD','#0369A1'],['ESOFT','#0F766E'],['REDES','#15803D'],
  ['SO','#4D7C0F'],['EST','#A16207'],['POO','#B45309'],['IHC','#C2410C'],
  ['ALG','#B91C1C'],['ETH','#BE185D'],['COMP','#A21CAF'],['MAT','#6D28D9'],
];
const canal = v => { v/=255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
const lum = hex => { const n = parseInt(hex.slice(1),16);
  return 0.2126*canal((n>>16)&255) + 0.7152*canal((n>>8)&255) + 0.0722*canal(n&255); };
const vsBranco = hex => 1.05/(lum(hex)+0.05);
const vsGround = (hex, g) => { const a=lum(hex), b=lum(g); const [hi,lo]=a>b?[a,b]:[b,a];
  return (hi+0.05)/(lo+0.05); };

let falhas = 0, spread = [];
console.log('sigla  hex       branco/fill  fill/papel  fill/escuro');
for (const [s,h] of MATERIAS) {
  const w = vsBranco(h), pl = vsGround(h,'#EEF0EC'), pd = vsGround(h,'#101315');
  spread.push(lum(h));
  const flag = w < 4.5 ? '  <-- FALHA texto branco' : (pd < 1.6 ? '  <-- fraco no escuro' : '');
  if (w < 4.5 || pd < 1.6) falhas++;
  console.log(`${s.padEnd(6)} ${h}   ${w.toFixed(2).padStart(6)}      ${pl.toFixed(2).padStart(5)}      ${pd.toFixed(2).padStart(5)}${flag}`);
}
const min = Math.min(...spread), max = Math.max(...spread);
console.log(`\nluminancia: min ${min.toFixed(4)} / max ${max.toFixed(4)} / razao ${(max/min).toFixed(2)}x`);
console.log(falhas === 0 ? 'OK: 12/12 passam' : `${falhas} problema(s)`);
