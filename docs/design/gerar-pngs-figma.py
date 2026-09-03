"""
Gera um PNG de 390x844 por tela, para importar no Figma.

POR QUE PNG, E NAO CAMADAS NATIVAS
Reconstruir 19 telas pela Plugin API do Figma é muito código e frágil — e o que
a atividade avalia é o protótipo NAVEGÁVEL: organização visual, conexão entre as
telas e os fluxos funcionando. Uma imagem fiel do mockup dá a fidelidade visual
perfeita, e os hotspots invisíveis por cima dão a navegação de verdade.

O QUE ISTO NAO RESOLVE
As camadas não ficam editáveis dentro do Figma. Mexer no desenho é mexer no
`telas-v3.html`, que é a fonte, e rodar isto de novo.

=============================================================================
A ARMADILHA QUE CUSTOU SEIS TENTATIVAS, ESCRITA PARA NINGUEM REPETIR
=============================================================================
`--screenshot` do Chrome sem interface FOTOGRAFA ANTES DE RODAR SCRIPT INJETADO
no fim do arquivo. `--dump-dom` espera; `--screenshot` não. Toda tentativa de
"injetar um script que arruma a página e depois tirar a foto" fotografa a página
como ela estava ANTES do script — e o sintoma é traiçoeiro: sai uma imagem
plausível, do tamanho certo, com o conteúdo errado ou em branco.

Foram 19 PNGs dados como bons duas vezes seguidas, todos inúteis.

A SAIDA E NAO DEPENDER DE SCRIPT NA HORA DA FOTO:
  1. Uma única passada de `--dump-dom` traz o DOM JÁ MONTADO pelo script do
     mockup (a grade do calendário, o painel do dia — coisas que não existem no
     HTML cru).
  2. Em Python, recorta desse DOM o `<head>` e, por tela, monta um documento
     estático onde aquela tela é o único conteúdo.
  3. A foto é de um documento que não precisa de JS nenhum.

Duas armadilhas menores que o mesmo caminho resolve de brinde:
  - `prefers-color-scheme: dark`: o Chrome sem interface responde "dark", e o
    mockup obedece (telas-v3.html:71). Aqui o `data-tema="claro"` vai escrito no
    `<html>`, não posto por script.
  - A animação de entrada (`entra`, `fill-mode: both`) congela no frame 0 num
    render estático e esvazia a tela. Morre no CSS abaixo.
"""
import json
import pathlib
import re
import shutil
import subprocess
import sys

from render import achar_navegador

AQUI = pathlib.Path(__file__).parent
ORIGEM = AQUI / "telas-v3.html"
MAPA = AQUI / "hotspots.json"
SAIDA = AQUI / "png-figma"

LARGURA, ALTURA = 390, 844
ESCALA = 2  # 780x1688: o Figma aceita @2x e a tela fica nítida no zoom.

FOLHA = f"""
<style id="so-a-tela">
  *, *::before, *::after {{ animation: none !important; transition: none !important; }}
  html, body {{ margin: 0 !important; padding: 0 !important; background: #fff !important; }}
  #palco-unico {{
    width: {LARGURA}px; height: var(--altura-tela, {ALTURA}px);
    overflow: hidden; position: relative;
    display: flex; flex-direction: column;
    background: var(--paper);
  }}
  /* A tela vira o corpo do aparelho; as abas voltam a ser irmãs dela. */
  #palco-unico > .tela {{ display: flex !important; flex: 1; min-height: 0; }}
  #palco-unico > #abas {{ display: flex !important; }}
</style>
"""


def dom_renderizado() -> str:
    """O DOM depois do script do mockup rodar. `--dump-dom` espera; screenshot nao."""
    navegador = achar_navegador()
    if navegador is None:
        sys.exit("Chrome não encontrado — sem ele não há como renderizar.")
    saida = subprocess.run(
        [navegador, "--headless", "--disable-gpu",
         "--virtual-time-budget=8000", "--dump-dom",
         ORIGEM.resolve().as_uri()],
        capture_output=True, timeout=180,
    )
    html = saida.stdout.decode("utf-8", errors="replace")
    if "data-dia=" not in html:
        sys.exit("O DOM veio sem a grade do calendário — o script do mockup não rodou.")
    return html


def cabeca(dom: str) -> str:
    """O <head> do documento renderizado: tokens, fontes e o CSS todo."""
    achado = re.search(r"<head\b[^>]*>(.*?)</head>", dom, re.S | re.I)
    if achado is None:
        sys.exit("DOM sem <head> — não dá para levar o CSS junto.")
    # `<script>` fora: documento estático não precisa, e um script rodando aqui
    # recria a corrida que este arquivo existe para evitar.
    return re.sub(r"<script\b.*?</script>", "", achado.group(1), flags=re.S | re.I)


def recorta(dom: str, tela: str) -> str | None:
    """Markup de uma `.tela`, contando `<div>` para achar o fechamento certo."""
    marca = f'<div class="tela" data-tela="{tela}"'
    ini = dom.find(marca)
    if ini == -1:
        return None
    profundidade = 0
    for m in re.finditer(r"<(/?)div\b", dom[ini:]):
        profundidade += -1 if m.group(1) else 1
        if profundidade == 0:
            fim = dom.find(">", ini + m.end() - 1) + 1
            return dom[ini:fim]
    return None


def barra_de_abas(dom: str) -> str:
    achado = re.search(r'<nav[^>]*id="abas".*?</nav>', dom, re.S | re.I)
    if achado is None:
        return ""
    # O DOM foi capturado numa tela sem abas, então veio com `display:none` no
    # atributo `style`. Sem tirar, a barra some de TODA tela exportada — foi
    # exatamente o que estragou as páginas do PDF uma vez.
    return re.sub(r'\sstyle="[^"]*"', "", achado.group(0), count=1)


def main() -> None:
    if not MAPA.exists():
        sys.exit("hotspots.json não existe. Rode extrair-hotspots.py antes.")
    navegador = achar_navegador()
    telas = json.loads(MAPA.read_text(encoding="utf-8"))["telas"]

    print("lendo o DOM já montado…")
    dom = dom_renderizado()
    cab = cabeca(dom)
    abas = barra_de_abas(dom)
    if not abas:
        print("AVISO: barra de abas não encontrada; as telas sairão sem ela.", file=sys.stderr)

    if SAIDA.exists():
        shutil.rmtree(SAIDA)
    SAIDA.mkdir()

    temp = AQUI / "_render.html"
    feitos = []
    try:
        for tela in telas:
            nome = tela["nome"]
            markup = recorta(dom, nome)
            if markup is None:
                print(f"  FALHOU  {nome:<20} markup não encontrado", file=sys.stderr)
                continue

            altura = tela.get("alturaConteudo", ALTURA)
            doc = (
                '<!doctype html><html lang="pt-BR" data-tema="claro"><head>'
                + cab + FOLHA
                # A home rola: o botao principal fica em y=1173. Exportar cortado
                # em 844 deixaria o Teste 03 sem alvo. Cada tela sai na altura
                # real do seu conteudo, e no Figma vira quadro rolavel.
                + f'<style>:root{{--altura-tela:{altura}px}}</style>'
                + '</head><body><div id="palco-unico">'
                + markup
                + ("" if tela["semAbas"] else abas)
                + "</div></body></html>"
            )
            temp.write_text(doc, encoding="utf-8")

            destino = (SAIDA / f"{nome}.png").resolve()
            subprocess.run(
                [navegador, "--headless", "--disable-gpu", "--hide-scrollbars",
                 f"--force-device-scale-factor={ESCALA}",
                 f"--window-size={LARGURA},{altura}",
                 "--virtual-time-budget=4000",
                 f"--screenshot={destino}",
                 temp.resolve().as_uri()],
                capture_output=True, timeout=120,
            )
            # 25 KB, e nao 3 KB: uma tela em branco de 780x1688 pesa ~6 KB e
            # passava tranquila pelo guarda antigo.
            tamanho = destino.stat().st_size if destino.exists() else 0
            if tamanho < 20_000:
                print(f"  FALHOU  {nome:<20} {tamanho // 1024} KB — provavelmente em branco",
                      file=sys.stderr)
            else:
                feitos.append((nome, tamanho))
                print(f"  ok  {nome:<20} {tamanho // 1024} KB")
    finally:
        temp.unlink(missing_ok=True)

    print(f"\n{len(feitos)} de {len(telas)} PNGs em {SAIDA.name}/")
    if len(feitos) != len(telas):
        sys.exit("Nem todas as telas renderizaram — não suba assim.")

    # Telas diferentes NAO pesam igual. Tamanhos todos iguais significa que
    # viraram a mesma imagem — foi o sintoma das falhas anteriores.
    tamanhos = {t for _, t in feitos}
    if len(tamanhos) < len(feitos) // 2:
        sys.exit(f"SUSPEITO: {len(feitos)} PNGs com só {len(tamanhos)} tamanhos distintos.")


if __name__ == "__main__":
    main()
