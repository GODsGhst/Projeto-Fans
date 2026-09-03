"""
Gera `telas.pdf`: uma tela por página, celular e depois desktop.

CADEIA INTEIRA
  telas-v3.html  --(Chrome monta o calendário)-->  DOM renderizado
                 --(gerar-telas-desktop.py)---->  telas-impressao.html
                 --(Chrome imprime)------------>  telas.pdf

RODAR: python docs/design/gerar-pdf.py

TRÊS COISAS QUE DERAM ERRADO AQUI, E QUE O CÓDIGO AGORA IMPEDE
1. `transform: scale()` encolhe o desenho e NÃO a caixa de layout, então cada
   tela de desktop transbordava para uma segunda página em branco — 45 páginas
   em vez de 30. `zoom` encolhe a caixa junto.
2. A tela entra com uma animação de `opacity: 0`. Na impressão ela congela no
   primeiro quadro e o conteúdo sai INVISÍVEL: saíram 15 páginas com a moldura
   do celular e nada dentro. As animações são desligadas na folha de impressão.
3. O calendário é montado por JavaScript. Lendo o HTML cru ele sai vazio, em
   silêncio. Por isso o passo do Chrome no começo da cadeia.

A verificação no fim não é enfeite: ela conta as páginas e mede o texto de cada
uma. Página quase sem texto é o sintoma dos três problemas acima, e é o tipo de
falha que passa batida porque o arquivo abre normalmente.
"""
import pathlib
import re
import subprocess
import sys

AQUI = pathlib.Path(__file__).parent
ENTRADA = AQUI / "telas-impressao.html"
SAIDA = AQUI / "telas.pdf"

# Poucas páginas com texto de menos indicam conteúdo perdido. Um cabeçalho
# sozinho tem ~30 caracteres; qualquer tela de verdade passa de 200.
MINIMO_DE_TEXTO = 120


def main() -> int:
    sys.path.insert(0, str(AQUI))
    from render import achar_navegador

    print("1/3  gerando telas-impressao.html")
    subprocess.run(
        [sys.executable, str(AQUI / "gerar-telas-desktop.py")], check=True, cwd=AQUI
    )

    navegador = achar_navegador()
    if navegador is None:
        print("Chrome não encontrado — sem ele não dá para imprimir.", file=sys.stderr)
        return 1

    print("2/3  imprimindo")
    subprocess.run(
        [
            navegador,
            "--headless",
            "--disable-gpu",
            "--virtual-time-budget=8000",
            # Sem o cabeçalho e rodapé do navegador: eles imprimem a URL do
            # arquivo e a data por cima da margem, o que num entregável de
            # desenho é ruído com cara de erro.
            "--no-pdf-header-footer",
            f"--print-to-pdf={SAIDA}",
            ENTRADA.resolve().as_uri(),
        ],
        capture_output=True,
        timeout=300,
    )
    if not SAIDA.exists():
        print("o Chrome não escreveu o PDF", file=sys.stderr)
        return 1

    print("3/3  conferindo")
    dados = SAIDA.read_bytes()
    paginas = len(re.findall(rb"/Type\s*/Page[^s]", dados))
    # Só as <section> de página. Contar 'class="pg' pegava `pg-cab` e `pg-palco`
    # junto e acusava 90 páginas onde há 30 — a checagem falhando por conta
    # própria e culpando o PDF.
    esperado = len(re.findall(r'<section class="pg ', ENTRADA.read_text(encoding="utf-8")))

    problemas = []
    if paginas != esperado:
        problemas.append(f"{paginas} páginas, esperava {esperado}")

    try:
        import fitz  # PyMuPDF

        doc = fitz.open(SAIDA)
        magras = [
            f"p{i + 1} ({len(p.get_text().strip())} chars)"
            for i, p in enumerate(doc)
            if len(p.get_text().strip()) < MINIMO_DE_TEXTO
        ]
        if magras:
            problemas.append("páginas quase sem texto: " + ", ".join(magras))
    except ImportError:
        print("  (sem PyMuPDF: não dá para medir o texto por página)")

    print(f"\n{SAIDA.name}: {paginas} páginas, {len(dados) // 1024} KB")
    if problemas:
        print("PROBLEMAS: " + "; ".join(problemas), file=sys.stderr)
        return 1
    print("conferido: contagem de páginas certa e nenhuma página vazia")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
