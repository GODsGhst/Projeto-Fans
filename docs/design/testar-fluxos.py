"""
Percorre o protótipo clicando, e confere se os 7 testes da atividade chegam
onde deveriam.

POR QUE ISTO EXISTE
`extrair-hotspots.py` prova que existe CAMINHO no grafo. Não prova que o clique
funciona: um alvo pode estar coberto por outro elemento, um `data-ir` pode
apontar para uma tela que existe mas não ativa, o handler delegado pode não
pegar. Este arquivo clica de verdade, na ordem do roteiro, e diz onde parou.

É o ensaio que evita descobrir o problema com o avaliador na frente.
"""
import pathlib
import re
import subprocess
import sys

from render import achar_navegador

AQUI = pathlib.Path(__file__).parent
ORIGEM = AQUI / "telas-v3.html"

# (rótulo, seletor, tela onde procurar ou None para o documento, destino esperado)
PERCURSO = [
    ("T01 abertura", None, None, "login"),
    ("T02 login: Entrar", '[data-ir="home"]', "login", "home"),
    ("T03 home: Adicionar", ".add-linha", "home", "novo-evento"),
    ("T03 novo-evento: Adicionar", '.botao[data-ir="home"]', "novo-evento", "home"),
    ("T04 home: cartao da Marina", '[data-ir="ver-evento"]', "home", "ver-evento"),
    ("T04 ver-evento: voltar", ".voltar", "ver-evento", "home"),
    ("T05 home: meu cartao", '[data-ir="editar-evento"]', "home", "editar-evento"),
    ("T05 editar: Salvar", '.botao[data-ir="home"]', "editar-evento", "home"),
    ("T06 home: duplicata", '[data-ir="confirmar-exclusao"]', "home", "confirmar-exclusao"),
    ("T06 confirmar: Cancelar", '.botao[data-ir="home"]', "confirmar-exclusao", "home"),
    ("T06 home: duplicata de novo", '[data-ir="confirmar-exclusao"]', "home", "confirmar-exclusao"),
    ("T06 confirmar: Sim, apagar", '.botao--fantasma[data-ir="home"]', "confirmar-exclusao", "home"),
    ("T07 aba Cal", '#abas [data-ir="cal"]', None, "cal"),
    ("T07 aba Quadro", '#abas [data-ir="quadro"]', None, "quadro"),
    ("T07 aba Home", '#abas [data-ir="home"]', None, "home"),
    ("extra: editar de novo", '[data-ir="editar-evento"]', "home", "editar-evento"),
    ("extra: estado de erro", '.link-txt[data-ir="erro"]', "editar-evento", "erro"),
    ("extra: Tentar de novo", '.botao[data-ir="home"]', "erro", "home"),
    ("extra: anotacao", '#abas [data-ir="cal"]', None, "cal"),
    ("extra: anotar no dia", '[data-ir="nota"]', "cal", "nota"),
]


def montar_script() -> str:
    """JS sem escapes: `json` cuida das aspas, e erro de parse aqui é mudo."""
    import json
    passos = json.dumps(
        [{"rotulo": r, "sel": s, "dentro": d, "espera": e} for r, s, d, e in PERCURSO],
        ensure_ascii=False,
    )
    return (
        "\n<script>\n"
        "(function () {\n"
        "  var PASSOS = " + passos + ";\n"
        "  var linhas = [];\n"
        "  function ativa() {\n"
        "    var t = document.querySelector('.tela[data-ativa]');\n"
        "    return t ? t.getAttribute('data-tela') : '(nenhuma)';\n"
        "  }\n"
        "  for (var i = 0; i < PASSOS.length; i++) {\n"
        "    var p = PASSOS[i];\n"
        "    var obtido;\n"
        "    if (p.sel === null) {\n"
        "      obtido = ativa();\n"
        "    } else {\n"
        "      var raiz = p.dentro\n"
        "        ? document.querySelector('.tela[data-tela=\"' + p.dentro + '\"]')\n"
        "        : document;\n"
        "      if (!raiz) { obtido = 'TELA ' + p.dentro + ' NAO EXISTE'; }\n"
        "      else {\n"
        "        var el = raiz.querySelector(p.sel);\n"
        "        if (!el) { obtido = 'ALVO NAO ENCONTRADO'; }\n"
        "        else { try { el.click(); obtido = ativa(); }\n"
        "               catch (e) { obtido = 'ERRO NO CLIQUE: ' + e.message; } }\n"
        "      }\n"
        "    }\n"
        "    linhas.push((obtido === p.espera ? 'ok  ' : 'X   ')\n"
        "      + p.rotulo + '  ->  ' + obtido\n"
        "      + (obtido === p.espera ? '' : '   (esperado: ' + p.espera + ')'));\n"
        "  }\n"
        "  var pre = document.createElement('pre');\n"
        "  pre.id = 'resultado-fluxos';\n"
        "  pre.textContent = linhas.join(String.fromCharCode(10));\n"
        "  document.body.appendChild(pre);\n"
        "})();\n"
        "</script>\n"
    )


def main() -> None:
    navegador = achar_navegador()
    if navegador is None:
        sys.exit("Chrome não encontrado.")
    temp = AQUI / "_fluxos.html"
    temp.write_text(ORIGEM.read_text(encoding="utf-8") + montar_script(), encoding="utf-8")
    try:
        saida = subprocess.run(
            [navegador, "--headless", "--disable-gpu",
             "--virtual-time-budget=8000", "--dump-dom", temp.resolve().as_uri()],
            capture_output=True, timeout=180,
        )
        dom = saida.stdout.decode("utf-8", errors="replace")
    finally:
        temp.unlink(missing_ok=True)

    achado = re.search(r'<pre id="resultado-fluxos">(.*?)</pre>', dom, re.S)
    if achado is None:
        sys.exit("O percurso não rodou — provável erro de sintaxe no script injetado.")

    texto = achado.group(1)
    for de, para in (("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"')):
        texto = texto.replace(de, para)
    print(texto)

    falhas = [l for l in texto.splitlines() if l.startswith("X")]
    print()
    if falhas:
        sys.exit(f"{len(falhas)} passo(s) do percurso falharam.")
    print(f"{len(PERCURSO)} passos, todos chegaram onde deviam.")


if __name__ == "__main__":
    main()
