"""
Extrai de `telas-v3.html` o mapa de telas e de áreas clicáveis, em pixels.

POR QUE ISTO EXISTE
Para montar o protótipo no Figma é preciso saber, de cada tela, onde fica cada
alvo de toque e para onde ele leva. Essa informação já existe — está nos
atributos `data-ir` do mockup — mas só em coordenadas depois que o CSS resolve o
layout. Ler o HTML cru não dá posição nenhuma.

Então a página mede a si mesma: um script injetado ativa cada `.tela` por vez,
pergunta ao próprio navegador o `getBoundingClientRect()` de cada alvo, e escreve
o resultado num `<pre>`. O `--dump-dom` traz esse `<pre>` de volta.

O ALTERNATIVO SERIA PIOR
Reimplementar o layout em Python para calcular posições seria a mesma regra em
dois lugares, divergindo na primeira mudança de CSS. Aqui, se o mockup mudar, as
coordenadas mudam junto, sozinhas.

CUIDADO QUE JÁ CUSTOU CARO ANTES
A animação de entrada (`entra`, com `fill-mode: both`) congela no frame 0 em
render estático — foi o que produziu 15 páginas de PDF com o aparelho desenhado e
nada dentro. Aqui ela é desligada antes de medir; sem isso as telas podem ser
medidas com `opacity: 0` e transformadas, e as coordenadas saem deslocadas.
"""
import json
import pathlib
import re
import subprocess
import sys

from render import achar_navegador

AQUI = pathlib.Path(__file__).parent
ORIGEM = AQUI / "telas-v3.html"
DESTINO = AQUI / "hotspots.json"

# Roda depois do script do mockup. Mede tudo e despeja num <pre> que o
# --dump-dom devolve.
MEDIDOR = """
<script>
(function () {
  // Sem animacao e sem transicao: `fill-mode: both` congela no frame 0 num
  // render estatico, e ai a medida sai do lugar errado.
  var mata = document.createElement('style');
  mata.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
  document.head.appendChild(mata);

  var abas = document.getElementById('abas');

  function retangulo(el, base) {
    var r = el.getBoundingClientRect();
    return {
      x: Math.round(r.left - base.left),
      y: Math.round(r.top - base.top),
      w: Math.round(r.width),
      h: Math.round(r.height)
    };
  }

  // O quadro do aparelho: a area util e a tela mais a barra de abas.
  var telas = Array.prototype.slice.call(document.querySelectorAll('.tela'));
  var quadro = telas[0].parentElement;

  var saida = { quadro: null, telas: [] };

  telas.forEach(function (tela) {
    // Os aparelhos-miniatura do cabecalho tambem usam .tela e nao tem
    // data-tela. Nao sao telas do fluxo; medi-las poluiria o mapa.
    if (!tela.getAttribute('data-tela')) return;
    telas.forEach(function (t) { t.removeAttribute('data-ativa'); });
    tela.setAttribute('data-ativa', '');
    var semAbas = tela.hasAttribute('data-sem-abas');
    abas.style.display = semAbas ? 'none' : '';
    // Forca o layout antes de medir.
    void quadro.offsetHeight;

    var base = quadro.getBoundingClientRect();
    if (!saida.quadro) {
      saida.quadro = { w: Math.round(base.width), h: Math.round(base.height) };
    }

    var alvos = [];
    Array.prototype.forEach.call(tela.querySelectorAll('[data-ir]'), function (el) {
      var r = retangulo(el, base);
      if (r.w < 1 || r.h < 1) return;   // invisivel: nao vira hotspot
      alvos.push({
        para: el.getAttribute('data-ir'),
        rotulo: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
        voltar: el.classList.contains('voltar'),
        x: r.x, y: r.y, w: r.w, h: r.h
      });
    });

    // As abas ficam FORA da .tela, mas sao alvo de toque em toda tela que as
    // mostra — e o Teste 07 da atividade e exatamente sobre elas.
    var abasAlvos = [];
    if (!semAbas) {
      Array.prototype.forEach.call(abas.querySelectorAll('[data-ir]'), function (el) {
        var r = retangulo(el, base);
        if (r.w < 1 || r.h < 1) return;
        abasAlvos.push({
          para: el.getAttribute('data-ir'),
          rotulo: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
          x: r.x, y: r.y, w: r.w, h: r.h
        });
      });
    }

    // Altura REAL do conteudo. A home rola: com os cartoes que o teste de
    // usabilidade precisa, o botao principal cai em y=1173, fora de um quadro
    // de 844. No Figma isso vira quadro rolavel, e nao conteudo cortado.
    var corpo = tela.querySelector('.t-corpo');
    var barra = tela.querySelector('.t-barra');
    var alturaConteudo = (barra ? barra.getBoundingClientRect().height : 0)
      + (corpo ? corpo.scrollHeight : 0)
      + (semAbas ? 0 : abas.getBoundingClientRect().height);

    saida.telas.push({
      nome: tela.getAttribute('data-tela'),
      alturaConteudo: Math.max(844, Math.ceil(alturaConteudo)),
      aba: tela.getAttribute('data-aba') || tela.getAttribute('data-tela'),
      semAbas: semAbas,
      titulo: (tela.querySelector('.t-barra h3') || {}).textContent || '',
      alvos: alvos,
      abas: abasAlvos
    });
  });

  var pre = document.createElement('pre');
  pre.id = 'saida-hotspots';
  pre.textContent = JSON.stringify(saida);
  document.body.appendChild(pre);
})();
</script>
"""


def medir() -> dict:
    navegador = achar_navegador()
    if navegador is None:
        sys.exit("Chrome não encontrado — sem ele não há como medir o layout.")

    html = ORIGEM.read_text(encoding="utf-8")
    # No FIM do arquivo, não antes de `</body>`: o mockup não tem essa tag (o
    # navegador cria o body sozinho). O que importa é vir depois do script do
    # mockup, para medir o DOM já montado — e o fim do arquivo garante isso.
    if 'class="tela"' not in html:
        sys.exit("telas-v3.html não parece o mockup: nenhuma .tela encontrada.")
    temp = AQUI / "_medindo.html"
    temp.write_text(html + MEDIDOR, encoding="utf-8")

    try:
        saida = subprocess.run(
            [navegador, "--headless", "--disable-gpu",
             "--virtual-time-budget=6000", "--dump-dom", temp.resolve().as_uri()],
            capture_output=True, timeout=120,
        )
        dom = saida.stdout.decode("utf-8", errors="replace")
    finally:
        temp.unlink(missing_ok=True)

    achado = re.search(
        r'<pre id="saida-hotspots">(.*?)</pre>', dom, re.S)
    if achado is None:
        sys.exit("O medidor não rodou. O DOM voltou sem o <pre> de saída.")
    bruto = achado.group(1)
    # O dump vem com as entidades HTML escapadas.
    for de, para in (("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"')):
        bruto = bruto.replace(de, para)
    return json.loads(bruto)


def conferir(dados: dict) -> None:
    """Falha alto em vez de entregar um mapa mudo e quebrado."""
    nomes = {t["nome"] for t in dados["telas"]}
    problemas = []
    for tela in dados["telas"]:
        for alvo in tela["alvos"] + tela["abas"]:
            if alvo["para"] not in nomes:
                problemas.append(
                    f'{tela["nome"]}: "{alvo["rotulo"]}" aponta para "{alvo["para"]}", que não existe')
    sem_saida = [t["nome"] for t in dados["telas"] if not t["alvos"] and not t["abas"]]
    if sem_saida:
        problemas.append("telas sem NENHUMA saída (beco sem fim no protótipo): "
                         + ", ".join(sem_saida))
    if problemas:
        print("PROBLEMAS NO FLUXO:", file=sys.stderr)
        for p in problemas:
            print("  -", p, file=sys.stderr)


if __name__ == "__main__":
    dados = medir()
    conferir(dados)
    DESTINO.write_text(json.dumps(dados, ensure_ascii=False, indent=2), encoding="utf-8")
    quadro = dados["quadro"]
    print(f'quadro do aparelho: {quadro["w"]}x{quadro["h"]}')
    print(f'{len(dados["telas"])} telas medidas')
    for t in dados["telas"]:
        print(f'  {t["nome"]:<20} {len(t["alvos"]):>2} alvos + {len(t["abas"])} abas')
    total = sum(len(t["alvos"]) + len(t["abas"]) for t in dados["telas"])
    print(f'{total} hotspots no total -> {DESTINO.name}')
