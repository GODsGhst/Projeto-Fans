"""
Renderiza `telas-v3.html` num Chrome sem interface e devolve o DOM resultante.

POR QUE ISTO EXISTE
Parte do mockup é montada por JavaScript, não escrita no HTML: a grade do
calendário (37 células), o painel do dia aberto e o botão "Anotar neste dia" só
existem depois que o script roda. Um gerador que lê o arquivo cru produz um
calendário **vazio** — e vazio em silêncio, que é o pior jeito de falhar: a
exportação "funciona", o PDF sai com 30 páginas, e a página do calendário está em
branco sem ninguém notar até a reunião.

Reimplementar a montagem em Python seria a mesma lógica em dois lugares, e as
duas divergiriam na primeira mudança. Rodar o próprio script do mockup e capturar
o resultado mantém uma fonte só.

O mockup abre o dia 25 sozinho ao carregar (última linha do script dele), então o
painel do dia vem preenchido sem precisar de clique.

Se o Chrome não estiver instalado, `renderizar()` avisa e devolve o HTML cru — a
exportação continua, com o calendário vazio, e o aviso diz exatamente isso.
"""
import pathlib
import shutil
import subprocess
import sys

# Ordem de procura: o que costuma existir numa máquina Windows, depois o PATH.
CANDIDATOS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]

# O mockup não faz rede; 5 s é folga larga para o script montar o calendário.
ORCAMENTO_MS = 5000


def achar_navegador() -> str | None:
    for caminho in CANDIDATOS:
        if pathlib.Path(caminho).exists():
            return caminho
    for nome in ("chrome", "google-chrome", "chromium", "msedge"):
        achado = shutil.which(nome)
        if achado:
            return achado
    return None


def renderizar(origem: pathlib.Path) -> str:
    """DOM depois do script rodar. Cai para o HTML cru se não houver navegador."""
    navegador = achar_navegador()
    if navegador is None:
        print(
            "AVISO: Chrome não encontrado. Exportando o HTML cru — o calendário "
            "vai sair VAZIO, porque a grade dele é montada por JavaScript.",
            file=sys.stderr,
        )
        return origem.read_text(encoding="utf-8")

    url = origem.resolve().as_uri()
    saida = subprocess.run(
        [
            navegador,
            "--headless",
            "--disable-gpu",
            f"--virtual-time-budget={ORCAMENTO_MS}",
            "--dump-dom",
            url,
        ],
        capture_output=True,
        timeout=120,
    )
    html = saida.stdout.decode("utf-8", errors="replace")

    # Checagem barata que pega a falha silenciosa: sem os dias, o render não
    # rodou o script e continuar produziria um PDF com o calendário em branco.
    if "data-dia=" not in html:
        print(
            "AVISO: o DOM renderizado não tem a grade do calendário. "
            "Usando o HTML cru; confira se o navegador rodou de verdade.",
            file=sys.stderr,
        )
        return origem.read_text(encoding="utf-8")
    return html
