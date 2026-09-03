"""
Gera `telas-figma.html` a partir de `telas-v3.html`.

POR QUE ISTO EXISTE
O mockup navegavel tem UMA casca de celular e alterna as telas com
`display:none`. Isso e certo para clicar e errado para importar: todo importador
de HTML para Figma renderiza o DOM como ele esta na tela, entao 16 das 17 telas
chegariam vazias ou nem chegariam. O bug seria silencioso — o import "funciona",
so vem incompleto.

Aqui cada tela vira um artboard proprio, visivel ao mesmo tempo que os outros,
com a propria copia da barra de abas. E o mesmo CSS, sem nenhum token novo: o
que muda e so quantas telas estao visiveis de uma vez.

RODAR: python docs/design/gerar-telas-figma.py
"""
import pathlib
import re

AQUI = pathlib.Path(__file__).parent
ORIGEM = AQUI / "telas-v3.html"

# Parte do mockup nasce por JavaScript — a grade do calendário, o painel do dia.
# Ler o arquivo cru exporta um calendário VAZIO, e vazio em silêncio.
from render import renderizar
DESTINO = AQUI / "telas-figma.html"


def bloco_balanceado(html: str, inicio: int) -> str:
    """Recorta uma <div> inteira contando abertura e fechamento.

    Regex nao serve: as telas tem divs aninhadas em varios niveis, e
    `<div class="tela".*?</div>` pararia no primeiro fechamento interno.
    """
    profundidade = 0
    for m in re.finditer(r"<(/?)div\b[^>]*?(/?)>", html[inicio:]):
        if m.group(2) == "/":       # <div/>, nao abre nada
            continue
        profundidade += -1 if m.group(1) else 1
        if profundidade == 0:
            return html[inicio : inicio + m.end()]
    raise ValueError(f"div sem fechamento na posicao {inicio}")


def gerar() -> str:
    t = renderizar(ORIGEM)

    estilo = re.search(r"<style>.*?</style>", t, re.S)
    if not estilo:
        raise ValueError("bloco <style> nao encontrado em telas-v3.html")

    abas = re.search(r'<nav class="abas".*?</nav>', t, re.S)
    if not abas:
        raise ValueError("nav.abas nao encontrada em telas-v3.html")

    telas = []
    for m in re.finditer(r'<div class="tela"[^>]*data-tela="([a-z-]+)"', t):
        telas.append((m.group(1), bloco_balanceado(t, m.start())))
    if not telas:
        raise ValueError("nenhuma .tela encontrada")

    partes = []
    for nome, marcacao in telas:
        # `data-ativa` e o que torna a tela visivel; no mockup so uma tem por vez.
        visivel = marcacao.replace(
            f'data-tela="{nome}"', f'data-tela="{nome}" data-ativa', 1
        )
        # As telas de entrada nao tem abas — quem ainda nao entrou na turma nao
        # tem para onde ir. Copiar a barra ali desenharia navegacao que nao existe.
        barra = "" if "data-sem-abas" in marcacao else abas.group(0)
        partes.append(
            f'<figure class="art">\n'
            f'  <div class="fone" id="tela-{nome}">\n{visivel}\n{barra}\n  </div>\n'
            f'  <figcaption>{nome}</figcaption>\n'
            f"</figure>"
        )

    return f"""<!doctype html>
<html lang="pt-BR" data-tema="claro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>projetoFans — telas para importar no Figma</title>
{estilo.group(0)}
<style>
  /* Unico CSS proprio deste arquivo: por o palco em grade e destravar o
     display:none das telas. Nenhum token, nenhuma cor, nenhuma medida nova. */
  body {{ padding: 40px; }}
  /* Grade de colunas FIXAS de 390px, nao flex. Com flex os quadros encolhem —
     medido: as telas saiam com 173 a 328px de largura em vez de 390, e um
     import assim entrega telas espremidas que parecem certas de longe. */
  .folha {{
    display: grid;
    grid-template-columns: repeat(auto-fill, 390px);
    gap: 56px 40px;
    align-items: start;
    justify-content: start;
  }}
  .art {{ margin: 0; }}
  /* No mockup o celular e 390x844 com `overflow: hidden` e o corpo rolando por
     dentro. Aqui isso cortaria: um importador captura o que esta renderizado, e
     tudo abaixo da dobra sumiria sem aviso — o import "funciona" e vem pela
     metade. Na folha a altura cresce com o conteudo; a largura, que e a medida
     que importa para o aparelho, continua 390. */
  .art .fone {{ height: auto; min-height: 844px; }}
  .art .t-corpo {{ overflow: visible; }}
  /* A barra de abas flutua sobre o conteudo; com a tela mais alta ela precisa
     ficar no fim do quadro, nao no meio dele. */
  .art .abas {{ position: sticky; bottom: 0; }}


  /* A tela entra com uma animação (`opacity: 0` -> 1, `fill-mode: both`). Numa
     exportação estática ela congela no PRIMEIRO quadro e o conteúdo sai
     invisível: a moldura do aparelho aparece e não há nada dentro. Foi
     exatamente o que saiu — 15 páginas de celular em branco, com a sombra do
     telefone e mais nada. Exportação não tem "entrada". */
  *, *::before, *::after {{
    animation: none !important;
    transition: none !important;
  }}

  .art figcaption {{
    margin-top: 10px; text-align: center;
    font-family: var(--mono, monospace); font-size: 11px;
    letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3);
  }}
</style>
</head>
<body>
<p class="prose" style="max-width:780px;margin:0 auto 32px">
  <b>Para importar no Figma.</b> Cada quadro abaixo e uma tela independente, ja
  visivel — diferente de <code>telas-v3.html</code>, onde so uma aparece por vez e
  as outras {len(telas) - 1} nao chegariam no import. Gerado por
  <code>gerar-telas-figma.py</code>; edite <code>telas-v3.html</code> e rode de novo.
</p>
<div class="folha">
{chr(10).join(partes)}
</div>
</body>
</html>
"""


if __name__ == "__main__":
    DESTINO.write_text(gerar(), encoding="utf-8")
    n = gerar().count('class="art"')
    print(f"{DESTINO.name}: {n} telas, {DESTINO.stat().st_size // 1024} KB")
