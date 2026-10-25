/**
 * Cria a turma de DEMONSTRACAO usada na apresentacao de 21/10.
 *
 * Turma separada da turma real de proposito: o codigo dela vai para o slide
 * final e para a plateia, entao ninguem que entrar por ali cai nos dados dos
 * colegas.
 *
 * Datas sao relativas a data da apresentacao, para que os eventos caiam dentro
 * da janela de 14 dias da Home no dia — uma Home vazia na frente da sala e o
 * pior resultado possivel.
 *
 *   node docs/apresentacao/criar-turma-demo.mjs
 */
const API = 'https://projetofans-api.onrender.com/api/v1';

const CONTA = {
  nome: 'Turma Demonstração',
  email: 'demo.apresentacao@projetofans.app',
  senha: 'demo-apresentacao-2026',
  tipoConta: 'ALUNO',
};

const APRESENTACAO = new Date('2026-10-21T00:00:00');
const dia = (n) => {
  const d = new Date(APRESENTACAO);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

let jwt = null;

async function chamar(metodo, rota, corpo) {
  const r = await fetch(API + rota, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  let dados = null;
  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    dados = texto;
  }
  return { ok: r.ok, status: r.status, dados };
}

console.log('Acordando o servidor…');
const saude = await chamar('GET', '/saude');
console.log('  saude:', saude.status, JSON.stringify(saude.dados));

// Registrar, ou entrar se a conta ja existe (o script roda mais de uma vez).
let r = await chamar('POST', '/auth/registrar', CONTA);
if (!r.ok) {
  console.log(`  registrar devolveu ${r.status}; tentando login…`);
  r = await chamar('POST', '/auth/login', { email: CONTA.email, senha: CONTA.senha });
}
if (!r.ok) {
  console.error('Falhou ao obter sessao:', r.status, JSON.stringify(r.dados));
  process.exit(1);
}
jwt = r.dados.jwt;
console.log('  sessao obtida. turmaId existente:', r.dados.turmaId ?? '(nenhuma)');

// Turma: se a conta ja tem uma, reusa — nao criar duplicada a cada execucao.
let turma;
const minha = await chamar('GET', '/turmas/minha');
if (minha.ok && minha.dados) {
  turma = minha.dados;
  console.log('  turma ja existia, reusando.');
} else {
  const criada = await chamar('POST', '/turmas', {
    nome: 'Demonstração — Engenharia de Software',
    semestre: '2026.2',
  });
  if (!criada.ok) {
    console.error('Falhou ao criar turma:', criada.status, JSON.stringify(criada.dados));
    process.exit(1);
  }
  turma = criada.dados;
  console.log('  turma criada.');
}

const codigo = turma.codigoConvite ?? turma.codigo ?? '(ver no app)';
console.log('\n  CODIGO DE CONVITE:', codigo, '\n');

// Materias com cores da paleta validada (contraste >= 4.5:1 com texto branco).
const MATERIAS = [
  { nome: 'Laboratório de Aplicações Móveis', sigla: 'MOBILE', corHex: '#1D4ED8' },
  { nome: 'Trabalho Interdisciplinar I', sigla: 'TI1', corHex: '#0F766E' },
  { nome: 'Banco de Dados', sigla: 'BD', corHex: '#0369A1' },
  { nome: 'Engenharia de Software', sigla: 'ESOFT', corHex: '#15803D' },
];

const existentes = await chamar('GET', '/materias');
const jaTem = new Set((existentes.ok && Array.isArray(existentes.dados) ? existentes.dados : []).map((m) => m.sigla));

const porSigla = {};
for (const m of MATERIAS) {
  if (jaTem.has(m.sigla)) {
    const achada = existentes.dados.find((x) => x.sigla === m.sigla);
    porSigla[m.sigla] = achada.id;
    console.log(`  materia ${m.sigla} ja existia`);
    continue;
  }
  const res = await chamar('POST', '/materias', m);
  if (!res.ok) {
    console.error(`  falhou materia ${m.sigla}:`, res.status, JSON.stringify(res.dados));
    continue;
  }
  porSigla[m.sigla] = res.dados.id;
  console.log(`  materia ${m.sigla} criada`);
}

// Eventos dentro da janela de 14 dias contada a partir da apresentacao.
const EVENTOS = [
  { sigla: 'MOBILE', tipo: 'ENTREGA', titulo: 'Entrega do protótipo navegável', data: dia(1), hora: '23:59' },
  { sigla: 'BD', tipo: 'PROVA', titulo: 'Prova 2 — normalização e consultas SQL', data: dia(3), hora: '19:00' },
  { sigla: 'TI1', tipo: 'ENTREGA', titulo: 'Documentação ABNT do projeto', data: dia(6), hora: '23:59' },
  { sigla: 'ESOFT', tipo: 'PROVA', titulo: 'Prova 1 — requisitos e casos de uso', data: dia(8), hora: '19:00' },
  { sigla: 'MOBILE', tipo: 'ENTREGA', titulo: 'Relatório de testes em dispositivo real', data: dia(11) },
  { sigla: 'BD', tipo: 'ENTREGA', titulo: 'Lista 4 — modelagem relacional', data: dia(13), hora: '23:59' },
];

const jaCriados = await chamar('GET', `/eventos?de=${dia(0)}&ate=${dia(14)}`);
const titulosExistentes = new Set(
  (jaCriados.ok && Array.isArray(jaCriados.dados) ? jaCriados.dados : []).map((e) => e.titulo),
);

for (const e of EVENTOS) {
  if (titulosExistentes.has(e.titulo)) {
    console.log(`  evento "${e.titulo}" ja existia`);
    continue;
  }
  const materiaId = porSigla[e.sigla];
  if (!materiaId) {
    console.log(`  pulando "${e.titulo}": materia ${e.sigla} indisponivel`);
    continue;
  }
  const res = await chamar('POST', '/eventos', {
    materiaId,
    tipo: e.tipo,
    titulo: e.titulo,
    data: e.data,
    hora: e.hora ?? null,
  });
  console.log(res.ok ? `  ${e.tipo.padEnd(7)} ${e.data}  ${e.titulo}` : `  FALHOU "${e.titulo}": ${res.status} ${JSON.stringify(res.dados)}`);
}

console.log('\n================================================');
console.log('  CODIGO DA TURMA DE DEMONSTRACAO:', codigo);
console.log('  login..:', CONTA.email);
console.log('  senha..:', CONTA.senha);
console.log('================================================');
