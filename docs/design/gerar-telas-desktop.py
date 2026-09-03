"""
Gera as telas de desktop e a folha de impressão a partir de `telas-v3.html`.

POR QUE ISTO É UM GERADOR E NÃO UM SEGUNDO MOCKUP ESCRITO À MÃO
O conteúdo das telas é o mesmo nos dois tamanhos — o que muda é a moldura. Um
arquivo desktop escrito à mão viraria uma segunda cópia de tudo, e as duas
divergiriam na primeira vez que alguém mexesse numa. Aqui o corpo de cada tela
(`.t-corpo`) é reaproveitado byte a byte; só a casca troca.

O QUE MUDA NO DESKTOP, E POR QUÊ
- **Barra lateral no lugar das abas de baixo.** Abas coladas no rodapé são um
  idioma de celular: existem porque o polegar alcança ali. Num monitor a mão está
  no mouse e o rodapé é o canto mais longe do olho.
- **Coluna de conteúdo com largura máxima.** O app é uma lista de cartões curtos.
  Esticá-los por 1280px faria linhas de texto que o olho perde no meio do
  caminho, e um cartão de duas frases ocupando a tela inteira.
- **A turma vive no rodapé da lateral**, não escondida atrás do Quadro: no
  desktop há espaço, e o código de convite é o que alguém procura quando abre no
  computador para mandar no grupo.

Desktop aqui é SECUNDÁRIO por decisão do dono: serve para abrir e conferir, não
para trabalhar. Por isso nada de painel lateral de detalhe, nada de tabela densa,
nada inventado para preencher espaço — o mesmo app, numa moldura que cabe no
monitor.

RODAR: python docs/design/gerar-telas-desktop.py
SAI:   telas-desktop.html   (para ver e importar no Figma)
       telas-impressao.html (uma tela por página, para virar PDF)
"""
import pathlib
import re

AQUI = pathlib.Path(__file__).parent
ORIGEM = AQUI / "telas-v3.html"

# Parte do mockup nasce por JavaScript — a grade do calendário, o painel do dia.
# Ler o arquivo cru exporta um calendário VAZIO, e vazio em silêncio.
from render import renderizar

LARGURA_DESKTOP = 1280
ALTURA_DESKTOP = 800


def bloco_balanceado(html: str, inicio: int) -> str:
    """Recorta uma <div> inteira contando abertura e fechamento."""
    profundidade = 0
    for m in re.finditer(r"<(/?)div\b[^>]*?(/?)>", html[inicio:]):
        if m.group(2) == "/":
            continue
        profundidade += -1 if m.group(1) else 1
        if profundidade == 0:
            return html[inicio : inicio + m.end()]
    raise ValueError(f"div sem fechamento em {inicio}")


def partes_da_tela(marcacao: str) -> tuple[str, str, str]:
    """Devolve (título, extra da barra, corpo) de uma `.tela`."""
    corpo_i = marcacao.index('<div class="t-corpo"')
    corpo = bloco_balanceado(marcacao, corpo_i)

    # O login não tem barra: ele abre direto no conteúdo, porque não há de onde
    # voltar nem para onde ir. Tratar a ausência é o caso normal, não a exceção.
    barra_i = marcacao.find('<div class="t-barra"')
    if barra_i == -1:
        return "", "", corpo
    barra = bloco_balanceado(marcacao, barra_i)

    h3 = re.search(r"<h3[^>]*>(.*?)</h3>", barra, re.S)
    titulo = re.sub(r"<[^>]+>", "", h3.group(1)).strip() if h3 else ""

    # Tudo da barra MENOS o título, com a marcação intacta.
    #
    # Achatar isso em texto puro foi um erro que custou 7 ligações do protótipo:
    # a seta de voltar e o link "a turma" vivem aqui, e viraram palavras sem
    # destino em todas as telas de desktop. Botão da barra é navegação, não
    # legenda — e no desktop a seta continua fazendo sentido, porque a lateral
    # leva para as seções e não desfaz o passo anterior.
    resto = re.sub(r"<h3[^>]*>.*?</h3>", "", barra, flags=re.S)
    return titulo, resto, corpo


def ler() -> tuple[str, list[tuple[str, str, bool, str, str, str]]]:
    t = renderizar(ORIGEM)
    estilo = re.search(r"<style>.*?</style>", t, re.S).group(0)

    nav = re.search(r'<nav class="abas".*?</nav>', t, re.S).group(0)
    icones = {}
    for m in re.finditer(r'data-ir="([a-z]+)"[^>]*>\s*<i>(.*?)</i>\s*([^<]*)<', nav, re.S):
        svg = re.search(r"<svg.*?</svg>", m.group(2), re.S)
        icones[m.group(1)] = (svg.group(0) if svg else "", m.group(3).strip())

    telas = []
    for m in re.finditer(r'<div class="tela"[^>]*data-tela="([a-z-]+)"([^>]*)>', t):
        nome = m.group(1)
        aba = re.search(r'data-aba="([a-z-]+)"', m.group(2))
        sem_abas = "data-sem-abas" in m.group(2)
        marcacao = bloco_balanceado(t, m.start())
        titulo, extra, corpo = partes_da_tela(marcacao)
        telas.append((nome, aba.group(1) if aba else nome, sem_abas, titulo, extra, corpo))
    return estilo, icones, telas


# Rótulos por extenso: "Cal" existe no celular porque quatro palavras não cabem
# em 390px. Na lateral cabem, e abreviar sem precisar é hostil com quem lê.
SECOES = [
    ("home", "Home"),
    ("cal", "Calendário"),
    ("materias", "Matérias"),
    ("quadro", "Meu quadro"),
]

CSS_DESKTOP = f"""
  /* ==================== DESKTOP ====================
     Mesmos tokens, mesmos cartões. O que muda é só a moldura. */
  .dt {{
    /* Largura fixa, altura MÍNIMA. A tela de Matérias tem 808px de conteúdo e
       não cabe em 800 — num navegador ela rolaria, mas num wireframe a rolagem
       vira conteúdo cortado, e conteúdo cortado é informação perdida para quem
       vai revisar o desenho. Cresce em vez de esconder. */
    width: {LARGURA_DESKTOP}px; min-height: {ALTURA_DESKTOP}px;
    display: flex;
    background: var(--paper);
    border-radius: 10px;
    box-shadow: var(--e-fone);
    color: var(--ink);
  }}

  .dt-lateral {{
    flex: 0 0 240px;
    display: flex; flex-direction: column;
    background: var(--surface);
    border-right: 1px solid var(--rule);
    padding: 20px 14px 16px;
    gap: 22px;
  }}
  .dt-marca {{
    font-size: 15px; font-weight: 700; letter-spacing: -.02em;
    padding: 0 8px; color: var(--ink);
  }}
  .dt-marca span {{ color: var(--accent); }}

  .dt-secoes {{ display: flex; flex-direction: column; gap: 2px; }}
  .dt-secao {{
    display: flex; align-items: center; gap: 11px;
    padding: 9px 10px; border-radius: var(--r-md);
    font-size: 14px; font-weight: 600; color: var(--ink-2);
    background: none; border: 0; width: 100%; text-align: left;
    cursor: pointer; font-family: inherit;
  }}
  .dt-secao svg {{ width: 19px; height: 19px; flex: 0 0 auto; }}
  /* A seção atual ganha fundo E peso: em escala de cinza a cor sozinha some. */
  .dt-secao[aria-current="page"] {{
    background: var(--accent-soft); color: var(--accent); font-weight: 700;
  }}

  /* A turma no rodapé da lateral. No celular ela está atrás do Quadro porque não
     há onde; aqui há, e o código é o que se procura ao abrir no computador. */
  .dt-turma {{
    margin-top: auto;
    padding: 12px; border-radius: var(--r-md);
    background: var(--surface-2); border: 1px solid var(--rule);
    display: flex; flex-direction: column; gap: 6px;
  }}
  .dt-turma b {{ font-size: 13px; letter-spacing: -.01em; }}
  .dt-turma .cod {{
    font-family: var(--mono); font-size: 15px; font-weight: 700;
    letter-spacing: .16em; color: var(--ink); user-select: all;
  }}
  .dt-turma small {{ font-size: 11px; color: var(--ink-3); }}

  .dt-principal {{ flex: 1; display: flex; flex-direction: column; min-width: 0; }}
  .dt-topo {{
    display: flex; align-items: baseline; gap: 12px;
    padding: 22px 32px 14px;
    border-bottom: 1px solid var(--rule-soft);
  }}
  .dt-topo h2 {{ margin: 0; font-size: 21px; font-weight: 700; letter-spacing: -.02em; }}
  .dt-topo .meta {{
    display: flex; align-items: baseline; gap: 12px;
    font-size: 12.5px; color: var(--ink-3);
  }}
  /* A barra do celular vem inteira para cá, então herda o layout dela. Aqui ela
     é uma linha de cabeçalho, não uma barra de aplicativo: sem fundo, sem borda,
     sem posicionamento. */
  .dt-topo .meta .t-barra,
  .dt-topo .meta .esq {{
    display: flex; align-items: baseline; gap: 10px;
    background: none; border: 0; padding: 0; box-shadow: none;
    position: static; backdrop-filter: none;
  }}
  .dt-topo .meta .voltar {{
    font-size: 15px; line-height: 1; padding: 4px 8px;
    border-radius: var(--r-sm); border: 1px solid var(--rule);
    background: var(--surface); color: var(--ink-2); cursor: pointer;
  }}

  .dt-conteudo {{ flex: 1; padding: 20px 32px; }}
  /* Coluna com teto de largura: o conteúdo é lista de cartões curtos, e esticá-los
     por 1280px faz linha de texto que o olho perde no meio. */
  .dt-conteudo .t-corpo {{
    max-width: 680px; padding: 0; height: auto;
    overflow: visible; background: none;
  }}
  /* O kanban e o calendário são as duas coisas que ganham de verdade com largura. */
  .dt--largo .dt-conteudo .t-corpo {{ max-width: 940px; }}

  /* ---------- CALENDÁRIO NO DESKTOP ----------
     No celular o mês ocupa a largura toda e o dia aberto vem abaixo, porque não
     há outro jeito em 390px. Aqui os dois cabem lado a lado — e ver o dia sem
     perder o mês de vista é a coisa que o desktop faz melhor neste app.

     O `aspect-ratio: 1` das células é o que quebra na largura maior: a 940px
     cada quadrado vira 130px de lado e o mês fica com 829px de altura. O teto
     abaixo devolve a proporção sem tocar no CSS do celular. */
  .dt[data-desktop-cal] .t-corpo {{
    display: grid; grid-template-columns: 1fr 300px; gap: 26px; align-items: start;
  }}
  .dt[data-desktop-cal] .cal button {{ aspect-ratio: auto; height: 46px; }}
  .dt[data-desktop-cal] .dia-aberto {{
    margin: 0; padding: 16px;
    background: var(--surface); border: 1px solid var(--rule);
    border-radius: var(--r-md); box-shadow: var(--e1);
  }}

  /* Telas de entrada não têm lateral: quem ainda não entrou não tem para onde ir. */
  .dt--entrada {{ align-items: center; justify-content: center; background: var(--panel); }}
  .dt--entrada .dt-cartao {{
    width: 420px; padding: 30px 28px;
    background: var(--paper); border: 1px solid var(--rule);
    border-radius: 16px; box-shadow: var(--e3);
  }}
  .dt--entrada .dt-cartao h2 {{
    margin: 0 0 18px; font-size: 20px; font-weight: 700; letter-spacing: -.02em;
  }}
  .dt--entrada .t-corpo {{ padding: 0; overflow: visible; height: auto; }}
"""


def lateral(icones: dict, aba: str) -> str:
    itens = []
    for chave, rotulo in SECOES:
        svg = icones.get(chave, ("", ""))[0]
        atual = ' aria-current="page"' if chave == aba else ""
        itens.append(
            f'<button class="dt-secao" type="button" data-ir="{chave}"{atual}>{svg}{rotulo}</button>'
        )
    return f"""    <aside class="dt-lateral">
      <div class="dt-marca">projeto<span>Fans</span></div>
      <nav class="dt-secoes">
        {"".join(itens)}
      </nav>
      <div class="dt-turma">
        <b>Fans 2026.2</b>
        <span class="cod">93EB9244</span>
        <small>4 pessoas · toque para copiar</small>
      </div>
    </aside>"""


def artboard(nome, aba, sem_abas, titulo, extra, corpo, icones) -> str:
    if sem_abas:
        # Sem fallback de título. O login é a única tela sem barra, e o corpo
        # dela já abre com a marca "projetoFans" — o fallback imprimia a marca
        # duas vezes, uma acima da outra.
        cabeca = f"<h2>{titulo}</h2>" if titulo else ""
        return f"""<div class="dt dt--entrada" data-desktop="{nome}">
  <div class="dt-cartao">
    {cabeca}
    {corpo}
  </div>
</div>"""
    largo = " dt--largo" if aba in ("quadro", "cal") else ""
    # O calendário tem layout próprio no desktop (mês + dia lado a lado).
    marca_cal = " data-desktop-cal" if nome == "cal" else ""
    meta = f'<span class="meta">{extra}</span>' if extra.strip() else ""
    return f"""<div class="dt{largo}" data-desktop="{nome}"{marca_cal}>
{lateral(icones, aba)}
  <div class="dt-principal">
    <div class="dt-topo"><h2>{titulo}</h2>{meta}</div>
    <div class="dt-conteudo">
      {corpo}
    </div>
  </div>
</div>"""


def gerar_desktop(estilo, icones, telas) -> str:
    quadros = []
    for nome, aba, sem_abas, titulo, extra, corpo in telas:
        art = artboard(nome, aba, sem_abas, titulo, extra, corpo, icones)
        quadros.append(
            f'<figure class="art">\n{art}\n<figcaption>{nome} · desktop</figcaption>\n</figure>'
        )
    return f"""<!doctype html>
<html lang="pt-BR" data-tema="claro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>projetoFans — telas de desktop</title>
{estilo}
<style>
{CSS_DESKTOP}
  body {{ padding: 40px; }}
  .folha {{ display: flex; flex-direction: column; gap: 56px; align-items: flex-start; }}
  .art {{ margin: 0; }}
  .art figcaption {{
    margin-top: 10px; font-family: var(--mono); font-size: 11px;
    letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3);
  }}
  .art .tela {{ display: flex; }}

  /* A tela entra com uma animação (`opacity: 0` -> 1, `fill-mode: both`). Numa
     exportação estática ela congela no PRIMEIRO quadro e o conteúdo sai
     invisível: a moldura do aparelho aparece e não há nada dentro. Foi
     exatamente o que saiu — 15 páginas de celular em branco, com a sombra do
     telefone e mais nada. Exportação não tem "entrada". */
  *, *::before, *::after {{
    animation: none !important;
    transition: none !important;
  }}

</style>
</head>
<body>
<p class="prose" style="max-width:780px;margin:0 auto 32px">
  <b>Desktop.</b> Mesmo app, moldura diferente: a barra de abas de baixo vira barra
  lateral, o conteúdo ganha teto de largura, e a turma sai de trás do Quadro para o
  rodapé da lateral. Desktop aqui é secundário — serve para abrir e conferir.
  Gerado por <code>gerar-telas-desktop.py</code> a partir de <code>telas-v3.html</code>.
</p>
<div class="folha">
{chr(10).join(quadros)}
</div>
</body>
</html>
"""


def gerar_impressao(estilo, icones, telas) -> str:
    """Uma tela por página. Celular primeiro, depois o mesmo em desktop."""
    paginas = []

    def pagina(rotulo, sub, conteudo, retrato):
        orient = "retrato" if retrato else "paisagem"
        paginas.append(
            f'<section class="pg pg--{orient}">\n'
            f'  <header class="pg-cab"><b>{rotulo}</b><span>{sub}</span></header>\n'
            f'  <div class="pg-palco">{conteudo}</div>\n'
            f"</section>"
        )

    t = renderizar(ORIGEM)
    abas = re.search(r'<nav class="abas".*?</nav>', t, re.S).group(0)
    # O DOM renderizado foi capturado com o mockup na tela de login, que é
    # `data-sem-abas` — e o script dela apaga a barra com `style="display:none"`
    # inline. Sem tirar isso, TODA página de celular sai sem barra de abas, e o
    # estilo inline vence qualquer CSS que eu escrevesse aqui.
    abas = re.sub(r'\s*style="[^"]*"', "", abas, count=1)

    for nome, aba, sem_abas, titulo, extra, corpo in telas:
        # celular: a tela inteira, como no mockup
        i = t.index(f'data-tela="{nome}"')
        inicio = t.rindex("<div", 0, i)
        marcacao = bloco_balanceado(t, inicio)
        # O login já vem com `data-ativa` no mockup (é a tela que abre); repetir
        # o atributo geraria HTML inválido.
        if "data-ativa" not in marcacao:
            marcacao = marcacao.replace(
                f'data-tela="{nome}"', f'data-tela="{nome}" data-ativa', 1
            )
        barra = "" if sem_abas else abas
        pagina(
            f"{nome} · celular",
            titulo or "—",
            f'<div class="fone">{marcacao}{barra}</div>',
            True,
        )

    for nome, aba, sem_abas, titulo, extra, corpo in telas:
        pagina(
            f"{nome} · desktop",
            titulo or "—",
            artboard(nome, aba, sem_abas, titulo, extra, corpo, icones),
            False,
        )

    return f"""<!doctype html>
<html lang="pt-BR" data-tema="claro">
<head>
<meta charset="utf-8">
<title>projetoFans — telas</title>
{estilo}
<style>
{CSS_DESKTOP}
  /* ==================== IMPRESSÃO ====================
     Uma tela por página. A4 nas duas orientações: retrato para o celular
     (390x844 é alto e estreito), paisagem para o desktop (1280x800 é o
     contrário). Misturar orientação num PDF é normal e melhor que encolher
     tudo para caber num formato só. */
  @page {{ size: A4 portrait; margin: 12mm; }}
  @page paisagem {{ size: A4 landscape; margin: 12mm; }}

  body {{ background: #fff; padding: 0; margin: 0; }}
  .pg {{
    break-after: page;
    display: flex; flex-direction: column; align-items: center;
    gap: 10mm;
  }}
  .pg:last-child {{ break-after: auto; }}
  .pg--paisagem {{ page: paisagem; }}

  .pg-cab {{
    width: 100%; display: flex; justify-content: space-between; align-items: baseline;
    font-family: var(--mono); font-size: 9pt; color: #555;
    border-bottom: .4pt solid #bbb; padding-bottom: 2mm;
    text-transform: uppercase; letter-spacing: .08em;
  }}
  .pg-cab b {{ color: #111; }}
  .pg-cab span {{ text-transform: none; letter-spacing: 0; font-family: var(--sans); }}

  .pg-palco {{ display: flex; justify-content: center; align-items: flex-start; }}
  /* O celular tem 844px de altura e a área útil do A4 retrato tem ~1078px em
     96dpi; cabe sem reduzir.

     O desktop não cabe e precisa encolher — com `zoom`, não com
     `transform: scale()`. A diferença não é estilística: `transform` desenha
     menor mas NÃO muda a caixa de layout, então a página continuava reservando
     os 800px inteiros e cada tela de desktop transbordava para uma segunda
     página em branco. Foi o que aconteceu: 45 páginas em vez de 30. `zoom`
     reduz a caixa junto.

     0.68 sai da tela mais alta, Matérias, com 910px de conteúdo:
     (910 + 78 de cabeçalho e respiro) × 0.68 = 672, dentro dos 703 úteis do A4
     paisagem. As telas de 800 sobram espaço em branco embaixo, e sobrar é
     melhor que cortar. */
  .pg--paisagem .pg-palco {{ zoom: .68; }}

  .pg .tela {{ display: flex; }}
  .pg .t-corpo {{ overflow: visible; }}
  /* O aparelho cresce com o conteúdo em vez de cortá-lo. Com os 844px fixos, a
     página do Calendário perdia o fim das anotações E a barra de abas inteira —
     e num wireframe conteúdo cortado é informação perdida para quem revisa. Num
     celular de verdade aquilo rolaria; no papel não há rolagem. */
  .pg .fone {{ height: auto; min-height: 844px; overflow: visible; }}
  /* O retrato precisa encolher junto quando o aparelho passa da página. O número
     sai da tela mais alta (Calendário, ~1180px de conteúdo): (1180 + 78) × .85 =
     1069, dentro dos 1078 úteis do A4 retrato. */
  .pg--retrato .pg-palco {{ zoom: .85; }}


  /* A tela entra com uma animação (`opacity: 0` -> 1, `fill-mode: both`). Numa
     exportação estática ela congela no PRIMEIRO quadro e o conteúdo sai
     invisível: a moldura do aparelho aparece e não há nada dentro. Foi
     exatamente o que saiu — 15 páginas de celular em branco, com a sombra do
     telefone e mais nada. Exportação não tem "entrada". */
  *, *::before, *::after {{
    animation: none !important;
    transition: none !important;
  }}

  /* Imprimir tem de sair com as cores, senão o que sobra é wireframe de arame —
     e a cor da matéria É informação neste app. */
  * {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
</style>
</head>
<body>
{chr(10).join(paginas)}
</body>
</html>
"""


if __name__ == "__main__":
    estilo, icones, telas = ler()
    d = AQUI / "telas-desktop.html"
    d.write_text(gerar_desktop(estilo, icones, telas), encoding="utf-8")
    p = AQUI / "telas-impressao.html"
    p.write_text(gerar_impressao(estilo, icones, telas), encoding="utf-8")
    print(f"{d.name}: {len(telas)} telas de desktop, {d.stat().st_size // 1024} KB")
    print(f"{p.name}: {len(telas) * 2} páginas, {p.stat().st_size // 1024} KB")
