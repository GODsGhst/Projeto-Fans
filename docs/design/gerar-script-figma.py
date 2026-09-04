"""
Gera o script que monta o protótipo no Figma, para colar no plugin Scripter.

POR QUE SCRIPTER, E NAO A MCP DO FIGMA
A MCP do plano Starter esgota em pouquíssimas chamadas — travou na segunda. O
Scripter roda dentro do Figma, com a Plugin API inteira e sem cota nenhuma.

O QUE O SCRIPT MONTADO FAZ
1. Acha as 19 imagens que você arrastou para o arquivo (o Figma nomeia cada uma
   pelo nome do arquivo: `home`, `cal`, `editar-evento`…).
2. Envolve cada uma num frame de 390x844 com o nome da tela.
3. Nos frames cujo conteúdo é mais alto que 844 — home, cal, matérias, material,
   turma — liga a rolagem vertical, em vez de cortar. A home tem o botão
   principal em y=1173: cortar deixaria o Teste 03 sem alvo.
4. Cria os retângulos invisíveis de toque e liga cada um à tela de destino.
5. Marca `login` como ponto de partida do fluxo.

As coordenadas saem de `hotspots.json`, que foi medido pelo próprio navegador em
cima do mockup. Nenhuma posição aqui foi digitada à mão.
"""
import json
import pathlib
import sys

AQUI = pathlib.Path(__file__).parent
MAPA = AQUI / "hotspots.json"
DESTINO = AQUI / "figma-montar-prototipo.js"

INICIAL = "login"
COLUNAS = 5
ESPACO = 80


def main() -> None:
    if not MAPA.exists():
        sys.exit("hotspots.json não existe. Rode extrair-hotspots.py antes.")
    dados = json.loads(MAPA.read_text(encoding="utf-8"))
    telas = dados["telas"]
    largura = dados["quadro"]["w"]
    altura = dados["quadro"]["h"]

    # Só o necessário para o script: nome, altura real e os alvos (alvos da tela
    # + abas, que são alvo em toda tela que as mostra).
    compacto = []
    for i, t in enumerate(telas):
        compacto.append({
            "nome": t["nome"],
            "alt": t.get("alturaConteudo", altura),
            "col": i % COLUNAS,
            "lin": i // COLUNAS,
            "alvos": [
                {"p": a["para"], "x": a["x"], "y": a["y"], "w": a["w"], "h": a["h"],
                 "r": (a["rotulo"] or "")[:28],
                 # Seta de voltar e botao de cancelar viram navegacao BACK: eles
                 # devem devolver a pessoa de ONDE ELA VEIO, e nao a um destino
                 # fixo. `confirmar-exclusao` tem duas entradas (o cartao da home
                 # e o botao Apagar da edicao) — com destino fixo, cancelar
                 # levaria ao lugar errado em uma das duas. E o Teste 07 pergunta
                 # exatamente se "o comportamento de voltar e o esperado".
                 "back": bool(a.get("voltar")) or (a["rotulo"] or "").strip() == "Cancelar"}
                for a in t["alvos"] + t["abas"]
            ],
        })

    js = f"""// ============================================================
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

const LARGURA = {largura};
const ALTURA  = {altura};
const ESPACO  = {ESPACO};
const INICIAL = {json.dumps(INICIAL)};

const TELAS = {json.dumps(compacto, ensure_ascii=False, indent=1)};

// ------------------------------------------------------------
// 1. Acha as imagens importadas, pelo nome do arquivo.
// ------------------------------------------------------------
const porNome = new Map();
for (const no of figma.currentPage.children) {{
  // O Figma pode acrescentar sufixo (" 1", "@2x"); normaliza.
  const limpo = no.name.replace(/@2x/i, "").replace(/\\s+\\d+$/, "").replace(/\\.png$/i, "").trim();
  if (!porNome.has(limpo)) porNome.set(limpo, no);
}}

const faltando = TELAS.filter(t => !porNome.has(t.nome)).map(t => t.nome);
if (faltando.length) {{
  figma.notify("Faltam imagens: " + faltando.join(", "), {{ error: true, timeout: 8000 }});
  console.log("Na página há:", figma.currentPage.children.map(n => n.name).join(", "));
  throw new Error("Arraste os PNGs que faltam e rode de novo.");
}}

// ------------------------------------------------------------
// 2. Um frame por tela, com a imagem dentro.
// ------------------------------------------------------------
const frames = new Map();

for (const t of TELAS) {{
  const img = porNome.get(t.nome);

  const frame = figma.createFrame();
  frame.name = t.nome;
  frame.resize(LARGURA, ALTURA);
  frame.x = t.col * (LARGURA + ESPACO);
  frame.y = t.lin * (ALTURA + ESPACO * 2);
  frame.clipsContent = true;
  frame.fills = [{{ type: "SOLID", color: {{ r: 1, g: 1, b: 1 }} }}];

  // A imagem entra no tamanho REAL do conteúdo, que pode passar de 844.
  img.resize(LARGURA, t.alt);
  frame.appendChild(img);
  img.x = 0;
  img.y = 0;
  img.name = "tela";
  img.locked = true;   // travada para o toque cair no hotspot, não na imagem

  // Rolagem só onde o conteúdo é mais alto. Cortar a home tiraria do alcance
  // o botão principal (y=1173) e o Teste 03 morreria com ele.
  if (t.alt > ALTURA + 8) {{   // 8px de folga: 845 nao e rolagem, e arredondamento
    frame.overflowDirection = "VERTICAL";
  }}

  frames.set(t.nome, frame);
}}

// ------------------------------------------------------------
// 3. Hotspots e ligações.
// ------------------------------------------------------------
let ligacoes = 0;
let semDestino = [];

for (const t of TELAS) {{
  const frame = frames.get(t.nome);

  for (const a of t.alvos) {{
    const destino = frames.get(a.p);
    if (!destino) {{ semDestino.push(t.nome + " -> " + a.p); continue; }}

    const hot = figma.createRectangle();
    hot.name = (a.back ? "↩ voltar" : "→ " + a.p) + (a.r ? "  (" + a.r + ")" : "");
    hot.resize(Math.max(a.w, 1), Math.max(a.h, 1));
    hot.x = a.x;
    hot.y = a.y;
    // Invisível, mas presente: opacidade 0 continua recebendo o clique no
    // protótipo. `visible = false` NÃO recebe — é a pegadinha clássica.
    hot.fills = [{{ type: "SOLID", color: {{ r: 1, g: 0, b: 0 }}, opacity: 0 }}];
    hot.cornerRadius = 8;
    frame.appendChild(hot);

    await hot.setReactionsAsync([{{
      trigger: {{ type: "ON_CLICK" }},
      actions: [{{
        type: "NODE",
        destinationId: destino.id,
        navigation: a.back ? "BACK" : "NAVIGATE",
        transition: {{
          type: "SMART_ANIMATE",
          easing: {{ type: "EASE_OUT" }},
          duration: 0.2
        }},
        preserveScrollPosition: false
      }}]
    }}]);
    ligacoes++;
  }}
}}

// ------------------------------------------------------------
// 4. Ponto de partida do fluxo.
// ------------------------------------------------------------
const partida = frames.get(INICIAL);
if (partida) {{
  figma.currentPage.flowStartingPoints = [
    {{ nodeId: partida.id, name: "Fluxo completo — projetoFans" }}
  ];
}}

figma.currentPage.selection = [...frames.values()];
figma.viewport.scrollAndZoomIntoView([...frames.values()]);

const recado = frames.size + " telas, " + ligacoes + " ligações";
console.log(recado);
if (semDestino.length) console.log("SEM DESTINO:", semDestino.join(", "));
figma.notify(recado, {{ timeout: 6000 }});
"""

    DESTINO.write_text(js, encoding="utf-8")
    alvos = sum(len(t["alvos"]) for t in compacto)
    rolam = [t["nome"] for t in compacto if t["alt"] > altura + 8]
    print(f"{DESTINO.name} escrito")
    print(f"  {len(compacto)} telas, {alvos} hotspots")
    print(f"  rolagem vertical em: {', '.join(rolam)}")
    print(f"  ponto de partida: {INICIAL}")
    voltas = sum(1 for t in compacto for a in t["alvos"] if a["back"])
    print(f"  {voltas} hotspots usam navegação BACK (setas e Cancelar)")


if __name__ == "__main__":
    main()
