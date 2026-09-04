// ============================================================
// projetoFans — monta o protótipo navegável
// Cole no plugin Scripter (Figma > Plugins > Scripter) e rode.
//
// ANTES DE RODAR:
//   1. Crie uma página nova no arquivo e deixe ela aberta.
//   2. Arraste TODOS os 19 PNGs de docs/design/png-figma/ para dentro dela.
//      O Figma nomeia cada imagem pelo arquivo — é assim que o script acha.
//   3. Rode este script.
//
// Ele NÃO apaga nada que já exista: cria os frames ao lado das imagens e move
// cada imagem para dentro do frame dela.
// ============================================================

const LARGURA = 390;
const ALTURA  = 844;
const ESPACO  = 80;
const INICIAL = "login";

const TELAS = [
 {
  "nome": "nova-materia",
  "alt": 844,
  "col": 0,
  "lin": 0,
  "alvos": [
   {
    "p": "materias",
    "x": 18,
    "y": 22,
    "w": 32,
    "h": 32,
    "r": "Voltar",
    "back": true
   },
   {
    "p": "materias",
    "x": 16,
    "y": 541,
    "w": 358,
    "h": 51,
    "r": "Criar matéria",
    "back": false
   },
   {
    "p": "home",
    "x": 8,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Home",
    "back": false
   },
   {
    "p": "cal",
    "x": 102,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Cal",
    "back": false
   },
   {
    "p": "materias",
    "x": 195,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Matérias",
    "back": false
   },
   {
    "p": "quadro",
    "x": 289,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Quadro",
    "back": false
   }
  ]
 },
 {
  "nome": "novo-evento",
  "alt": 844,
  "col": 1,
  "lin": 0,
  "alvos": [
   {
    "p": "home",
    "x": 18,
    "y": 22,
    "w": 32,
    "h": 32,
    "r": "Voltar",
    "back": true
   },
   {
    "p": "home",
    "x": 16,
    "y": 636,
    "w": 358,
    "h": 51,
    "r": "Adicionar",
    "back": false
   },
   {
    "p": "home",
    "x": 8,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Home",
    "back": false
   },
   {
    "p": "cal",
    "x": 102,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Cal",
    "back": false
   },
   {
    "p": "materias",
    "x": 195,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Matérias",
    "back": false
   },
   {
    "p": "quadro",
    "x": 289,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Quadro",
    "back": false
   }
  ]
 },
 {
  "nome": "turma",
  "alt": 867,
  "col": 2,
  "lin": 0,
  "alvos": [
   {
    "p": "quadro",
    "x": 18,
    "y": 22,
    "w": 32,
    "h": 32,
    "r": "Voltar",
    "back": true
   },
   {
    "p": "transferir",
    "x": 16,
    "y": 641,
    "w": 348,
    "h": 53,
    "r": "Passar a liderança",
    "back": false
   },
   {
    "p": "home",
    "x": 8,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Home",
    "back": false
   },
   {
    "p": "cal",
    "x": 102,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Cal",
    "back": false
   },
   {
    "p": "materias",
    "x": 195,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Matérias",
    "back": false
   },
   {
    "p": "quadro",
    "x": 289,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Quadro",
    "back": false
   }
  ]
 },
 {
  "nome": "transferir",
  "alt": 844,
  "col": 3,
  "lin": 0,
  "alvos": [
   {
    "p": "turma",
    "x": 18,
    "y": 22,
    "w": 32,
    "h": 32,
    "r": "Voltar",
    "back": true
   },
   {
    "p": "transferir-ok",
    "x": 16,
    "y": 222,
    "w": 358,
    "h": 59,
    "r": "A\n            \n             ",
    "back": false
   },
   {
    "p": "transferir-ok",
    "x": 16,
    "y": 291,
    "w": 358,
    "h": 59,
    "r": "B\n            \n             ",
    "back": false
   },
   {
    "p": "transferir-ok",
    "x": 16,
    "y": 360,
    "w": 358,
    "h": 59,
    "r": "M\n            \n             ",
    "back": false
   },
   {
    "p": "home",
    "x": 8,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Home",
    "back": false
   },
   {
    "p": "cal",
    "x": 102,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Cal",
    "back": false
   },
   {
    "p": "materias",
    "x": 195,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Matérias",
    "back": false
   },
   {
    "p": "quadro",
    "x": 289,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Quadro",
    "back": false
   }
  ]
 },
 {
  "nome": "transferir-ok",
  "alt": 844,
  "col": 4,
  "lin": 0,
  "alvos": [
   {
    "p": "turma",
    "x": 18,
    "y": 22,
    "w": 32,
    "h": 32,
    "r": "Voltar",
    "back": true
   },
   {
    "p": "turma",
    "x": 16,
    "y": 288,
    "w": 358,
    "h": 51,
    "r": "Voltar para a turma",
    "back": false
   },
   {
    "p": "home",
    "x": 8,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Home",
    "back": false
   },
   {
    "p": "cal",
    "x": 102,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Cal",
    "back": false
   },
   {
    "p": "materias",
    "x": 195,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Matérias",
    "back": false
   },
   {
    "p": "quadro",
    "x": 289,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Quadro",
    "back": false
   }
  ]
 },
 {
  "nome": "login",
  "alt": 844,
  "col": 0,
  "lin": 1,
  "alvos": [
   {
    "p": "home",
    "x": 16,
    "y": 313,
    "w": 358,
    "h": 51,
    "r": "Entrar",
    "back": false
   },
   {
    "p": "recuperar",
    "x": 143,
    "y": 374,
    "w": 104,
    "h": 37,
    "r": "Esqueci a senha",
    "back": false
   },
   {
    "p": "cadastro",
    "x": 16,
    "y": 462,
    "w": 358,
    "h": 53,
    "r": "Criar conta",
    "back": false
   }
  ]
 },
 {
  "nome": "cadastro",
  "alt": 845,
  "col": 1,
  "lin": 1,
  "alvos": [
   {
    "p": "login",
    "x": 18,
    "y": 22,
    "w": 32,
    "h": 32,
    "r": "Voltar para o login",
    "back": true
   },
   {
    "p": "entrar-turma",
    "x": 16,
    "y": 432,
    "w": 358,
    "h": 51,
    "r": "Criar conta",
    "back": false
   }
  ]
 },
 {
  "nome": "entrar-turma",
  "alt": 845,
  "col": 2,
  "lin": 1,
  "alvos": [
   {
    "p": "cadastro",
    "x": 18,
    "y": 22,
    "w": 32,
    "h": 32,
    "r": "Voltar",
    "back": true
   },
   {
    "p": "home",
    "x": 16,
    "y": 247,
    "w": 358,
    "h": 51,
    "r": "Entrar na turma",
    "back": false
   },
   {
    "p": "home",
    "x": 16,
    "y": 350,
    "w": 358,
    "h": 53,
    "r": "Criar uma turma nova",
    "back": false
   }
  ]
 },
 {
  "nome": "recuperar",
  "alt": 845,
  "col": 3,
  "lin": 1,
  "alvos": [
   {
    "p": "login",
    "x": 18,
    "y": 22,
    "w": 32,
    "h": 32,
    "r": "Voltar para o login",
    "back": true
   }
  ]
 },
 {
  "nome": "home",
  "alt": 1309,
  "col": 4,
  "lin": 1,
  "alvos": [
   {
    "p": "editar-evento",
    "x": 16,
    "y": 724,
    "w": 348,
    "h": 102,
    "r": "29ago\n            \n         ",
    "back": false
   },
   {
    "p": "ver-evento",
    "x": 16,
    "y": 836,
    "w": 348,
    "h": 102,
    "r": "27ago\n            \n         ",
    "back": false
   },
   {
    "p": "confirmar-exclusao",
    "x": 16,
    "y": 949,
    "w": 348,
    "h": 102,
    "r": "30ago\n            \n         ",
    "back": false
   },
   {
    "p": "confirmar-exclusao",
    "x": 16,
    "y": 1061,
    "w": 348,
    "h": 102,
    "r": "30ago\n            \n         ",
    "back": false
   },
   {
    "p": "novo-evento",
    "x": 16,
    "y": 1173,
    "w": 348,
    "h": 48,
    "r": "+&nbsp;&nbsp;Adicionar prova",
    "back": false
   },
   {
    "p": "home",
    "x": 8,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Home",
    "back": false
   },
   {
    "p": "cal",
    "x": 102,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Cal",
    "back": false
   },
   {
    "p": "materias",
    "x": 195,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Matérias",
    "back": false
   },
   {
    "p": "quadro",
    "x": 289,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Quadro",
    "back": false
   }
  ]
 },
 {
  "nome": "editar-evento",
  "alt": 844,
  "col": 0,
  "lin": 2,
  "alvos": [
   {
    "p": "home",
    "x": 18,
    "y": 22,
    "w": 32,
    "h": 32,
    "r": "Voltar",
    "back": true
   },
   {
    "p": "home",
    "x": 16,
    "y": 586,
    "w": 358,
    "h": 51,
    "r": "Salvar",
    "back": false
   },
   {
    "p": "confirmar-exclusao",
    "x": 16,
    "y": 647,
    "w": 358,
    "h": 53,
    "r": "Apagar",
    "back": false
   },
   {
    "p": "erro",
    "x": 111,
    "y": 710,
    "w": 169,
    "h": 37,
    "r": "demo: salvar sem conexão",
    "back": false
   },
   {
    "p": "home",
    "x": 8,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Home",
    "back": false
   },
   {
    "p": "cal",
    "x": 102,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Cal",
    "back": false
   },
   {
    "p": "materias",
    "x": 195,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Matérias",
    "back": false
   },
   {
    "p": "quadro",
    "x": 289,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Quadro",
    "back": false
   }
  ]
 },
 {
  "nome": "ver-evento",
  "alt": 844,
  "col": 1,
  "lin": 2,
  "alvos": [
   {
    "p": "home",
    "x": 18,
    "y": 22,
    "w": 32,
    "h": 32,
    "r": "Voltar",
    "back": true
   },
   {
    "p": "quadro",
    "x": 16,
    "y": 316,
    "w": 358,
    "h": 53,
    "r": "Avisar no quadro",
    "back": false
   },
   {
    "p": "home",
    "x": 8,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Home",
    "back": false
   },
   {
    "p": "cal",
    "x": 102,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Cal",
    "back": false
   },
   {
    "p": "materias",
    "x": 195,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Matérias",
    "back": false
   },
   {
    "p": "quadro",
    "x": 289,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Quadro",
    "back": false
   }
  ]
 },
 {
  "nome": "confirmar-exclusao",
  "alt": 844,
  "col": 2,
  "lin": 2,
  "alvos": [
   {
    "p": "home",
    "x": 18,
    "y": 22,
    "w": 32,
    "h": 32,
    "r": "Voltar",
    "back": true
   },
   {
    "p": "home",
    "x": 16,
    "y": 345,
    "w": 358,
    "h": 53,
    "r": "Sim, apagar",
    "back": false
   },
   {
    "p": "home",
    "x": 16,
    "y": 408,
    "w": 358,
    "h": 51,
    "r": "Cancelar",
    "back": true
   },
   {
    "p": "home",
    "x": 8,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Home",
    "back": false
   },
   {
    "p": "cal",
    "x": 102,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Cal",
    "back": false
   },
   {
    "p": "materias",
    "x": 195,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Matérias",
    "back": false
   },
   {
    "p": "quadro",
    "x": 289,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Quadro",
    "back": false
   }
  ]
 },
 {
  "nome": "erro",
  "alt": 844,
  "col": 3,
  "lin": 2,
  "alvos": [
   {
    "p": "editar-evento",
    "x": 18,
    "y": 22,
    "w": 32,
    "h": 32,
    "r": "Voltar",
    "back": true
   },
   {
    "p": "home",
    "x": 16,
    "y": 345,
    "w": 358,
    "h": 51,
    "r": "Tentar de novo",
    "back": false
   },
   {
    "p": "home",
    "x": 8,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Home",
    "back": false
   },
   {
    "p": "cal",
    "x": 102,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Cal",
    "back": false
   },
   {
    "p": "materias",
    "x": 195,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Matérias",
    "back": false
   },
   {
    "p": "quadro",
    "x": 289,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Quadro",
    "back": false
   }
  ]
 },
 {
  "nome": "cal",
  "alt": 1091,
  "col": 4,
  "lin": 2,
  "alvos": [
   {
    "p": "nota",
    "x": 31,
    "y": 942,
    "w": 318,
    "h": 48,
    "r": "+ &nbsp;Anotar neste dia",
    "back": false
   },
   {
    "p": "home",
    "x": 8,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Home",
    "back": false
   },
   {
    "p": "cal",
    "x": 102,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Cal",
    "back": false
   },
   {
    "p": "materias",
    "x": 195,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Matérias",
    "back": false
   },
   {
    "p": "quadro",
    "x": 289,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Quadro",
    "back": false
   }
  ]
 },
 {
  "nome": "nota",
  "alt": 844,
  "col": 0,
  "lin": 3,
  "alvos": [
   {
    "p": "cal",
    "x": 18,
    "y": 22,
    "w": 32,
    "h": 32,
    "r": "Voltar para o calendário",
    "back": true
   },
   {
    "p": "home",
    "x": 8,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Home",
    "back": false
   },
   {
    "p": "cal",
    "x": 102,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Cal",
    "back": false
   },
   {
    "p": "materias",
    "x": 195,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Matérias",
    "back": false
   },
   {
    "p": "quadro",
    "x": 289,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Quadro",
    "back": false
   }
  ]
 },
 {
  "nome": "materias",
  "alt": 979,
  "col": 1,
  "lin": 3,
  "alvos": [
   {
    "p": "nova-materia",
    "x": 16,
    "y": 83,
    "w": 348,
    "h": 48,
    "r": "+&nbsp;&nbsp;Nova matéria",
    "back": false
   },
   {
    "p": "material",
    "x": 16,
    "y": 725,
    "w": 348,
    "h": 48,
    "r": "+ &nbsp;Enviar material",
    "back": false
   },
   {
    "p": "home",
    "x": 8,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Home",
    "back": false
   },
   {
    "p": "cal",
    "x": 102,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Cal",
    "back": false
   },
   {
    "p": "materias",
    "x": 195,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Matérias",
    "back": false
   },
   {
    "p": "quadro",
    "x": 289,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Quadro",
    "back": false
   }
  ]
 },
 {
  "nome": "quadro",
  "alt": 844,
  "col": 2,
  "lin": 3,
  "alvos": [
   {
    "p": "turma",
    "x": 309,
    "y": 23,
    "w": 63,
    "h": 29,
    "r": "a turma →",
    "back": false
   },
   {
    "p": "home",
    "x": 8,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Home",
    "back": false
   },
   {
    "p": "cal",
    "x": 102,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Cal",
    "back": false
   },
   {
    "p": "materias",
    "x": 195,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Matérias",
    "back": false
   },
   {
    "p": "quadro",
    "x": 289,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Quadro",
    "back": false
   }
  ]
 },
 {
  "nome": "material",
  "alt": 888,
  "col": 3,
  "lin": 3,
  "alvos": [
   {
    "p": "materias",
    "x": 18,
    "y": 22,
    "w": 32,
    "h": 32,
    "r": "Voltar para Matérias",
    "back": true
   },
   {
    "p": "home",
    "x": 8,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Home",
    "back": false
   },
   {
    "p": "cal",
    "x": 102,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Cal",
    "back": false
   },
   {
    "p": "materias",
    "x": 195,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Matérias",
    "back": false
   },
   {
    "p": "quadro",
    "x": 289,
    "y": 783,
    "w": 94,
    "h": 49,
    "r": "Quadro",
    "back": false
   }
  ]
 }
];

// ------------------------------------------------------------
// 1. Acha as imagens importadas, pelo nome do arquivo.
// ------------------------------------------------------------
const porNome = new Map();
for (const no of figma.currentPage.children) {
  // O Figma pode acrescentar sufixo (" 1", "@2x"); normaliza.
  const limpo = no.name.replace(/@2x/i, "").replace(/\s+\d+$/, "").replace(/\.png$/i, "").trim();
  if (!porNome.has(limpo)) porNome.set(limpo, no);
}

const faltando = TELAS.filter(t => !porNome.has(t.nome)).map(t => t.nome);
if (faltando.length) {
  figma.notify("Faltam imagens: " + faltando.join(", "), { error: true, timeout: 8000 });
  console.log("Na página há:", figma.currentPage.children.map(n => n.name).join(", "));
  throw new Error("Arraste os PNGs que faltam e rode de novo.");
}

// ------------------------------------------------------------
// 2. Um frame por tela, com a imagem dentro.
// ------------------------------------------------------------
const frames = new Map();

for (const t of TELAS) {
  const img = porNome.get(t.nome);

  const frame = figma.createFrame();
  frame.name = t.nome;
  frame.resize(LARGURA, ALTURA);
  frame.x = t.col * (LARGURA + ESPACO);
  frame.y = t.lin * (ALTURA + ESPACO * 2);
  frame.clipsContent = true;
  frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];

  // A imagem entra no tamanho REAL do conteúdo, que pode passar de 844.
  img.resize(LARGURA, t.alt);
  frame.appendChild(img);
  img.x = 0;
  img.y = 0;
  img.name = "tela";
  img.locked = true;   // travada para o toque cair no hotspot, não na imagem

  // Rolagem só onde o conteúdo é mais alto. Cortar a home tiraria do alcance
  // o botão principal (y=1173) e o Teste 03 morreria com ele.
  if (t.alt > ALTURA + 8) {   // 8px de folga: 845 nao e rolagem, e arredondamento
    frame.overflowDirection = "VERTICAL";
  }

  frames.set(t.nome, frame);
}

// ------------------------------------------------------------
// 3. Hotspots e ligações.
// ------------------------------------------------------------
let ligacoes = 0;
let semDestino = [];

for (const t of TELAS) {
  const frame = frames.get(t.nome);

  for (const a of t.alvos) {
    const destino = frames.get(a.p);
    if (!destino) { semDestino.push(t.nome + " -> " + a.p); continue; }

    const hot = figma.createRectangle();
    hot.name = (a.back ? "↩ voltar" : "→ " + a.p) + (a.r ? "  (" + a.r + ")" : "");
    hot.resize(Math.max(a.w, 1), Math.max(a.h, 1));
    hot.x = a.x;
    hot.y = a.y;
    // Invisível, mas presente: opacidade 0 continua recebendo o clique no
    // protótipo. `visible = false` NÃO recebe — é a pegadinha clássica.
    hot.fills = [{ type: "SOLID", color: { r: 1, g: 0, b: 0 }, opacity: 0 }];
    hot.cornerRadius = 8;
    frame.appendChild(hot);

    await hot.setReactionsAsync([{
      trigger: { type: "ON_CLICK" },
      actions: [{
        type: "NODE",
        destinationId: destino.id,
        navigation: a.back ? "BACK" : "NAVIGATE",
        transition: {
          type: "SMART_ANIMATE",
          easing: { type: "EASE_OUT" },
          duration: 0.2
        },
        preserveScrollPosition: false
      }]
    }]);
    ligacoes++;
  }
}

// ------------------------------------------------------------
// 4. Ponto de partida do fluxo.
// ------------------------------------------------------------
const partida = frames.get(INICIAL);
if (partida) {
  figma.currentPage.flowStartingPoints = [
    { nodeId: partida.id, name: "Fluxo completo — projetoFans" }
  ];
}

figma.currentPage.selection = [...frames.values()];
figma.viewport.scrollAndZoomIntoView([...frames.values()]);

const recado = frames.size + " telas, " + ligacoes + " ligações";
console.log(recado);
if (semDestino.length) console.log("SEM DESTINO:", semDestino.join(", "));
figma.notify(recado, { timeout: 6000 });
