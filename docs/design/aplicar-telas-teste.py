"""
Acrescenta ao mockup as telas e os caminhos que o teste de usabilidade exige.

POR QUE
A atividade avaliativa testa 7 fluxos. Os Testes 05 (editar) e 06 (excluir com
confirmação) não tinham tela nenhuma no mockup, e a atividade ainda exige
"estados relevantes... sucesso, erro, confirmação ou ausência de dados".

E havia um problema pior que a ausência: telas novas nascem ÓRFÃS. Sem um cartão
tocável na home levando até elas, o participante do teste não tem como chegar —
o fluxo existe no arquivo e não existe na mão de quem testa.

O QUE ESTE SCRIPT FAZ, E POR QUE NESSA ORDEM
1. Insere 4 telas: editar-evento, ver-evento, confirmar-exclusao, erro.
2. Torna a home navegável até elas, com os registros que cada teste precisa
   encontrar: um meu (editável), um da Marina (só leitura) e um duplicado
   (para apagar).
3. Alinha as datas. O mockup mostra Agosto no calendário e nos cartões, mas os
   formulários vinham com `2026-09-10`. Um participante que lê "12 set" no
   formulário e "ago" no calendário trava por culpa do protótipo.
4. Troca "Cadastrar" por "Adicionar" — a mudança já foi feita no app e nunca
   chegou aqui; protótipo e app dizendo palavras diferentes para o mesmo botão
   é exatamente o que um teste de usabilidade pega.

Toda substituição é conferida: se uma âncora não existir, o script para em vez de
gravar um arquivo meio editado.
"""
import pathlib
import sys

AQUI = pathlib.Path(__file__).parent
ALVO = AQUI / "telas-v3.html"

# --------------------------------------------------------------------------
# As 4 telas novas.
#
# Nenhuma classe nova: .seg, .chips-pick, .linha-campo, .alerta, .rotulo,
# .glyph--prova, .glyph--entrega, .cache-aviso, .campo--linha, .botao,
# .botao--fantasma e .link-txt já existem no CSS.
# --------------------------------------------------------------------------
TELAS_NOVAS = """
      <!-- ==================== EDITAR PROVA OU ENTREGA ==================== -->
      <div class="tela" data-tela="editar-evento" data-aba="home">
        <div class="t-barra">
          <span class="esq">
            <button class="voltar" type="button" data-ir="home" aria-label="Voltar">&larr;</button>
            <h3>Editar</h3>
          </span>
        </div>
        <div class="t-corpo">
          <p class="rot-campo">tipo</p>
          <div class="seg" id="seg-tipo-editar">
            <button type="button" data-tipo="prova" aria-pressed="true">Prova</button>
            <button type="button" data-tipo="entrega" aria-pressed="false">Entrega</button>
          </div>

          <p class="rot-campo">matéria</p>
          <div class="chips-pick" role="group" aria-label="Matéria" id="pick-materia-editar">
            <button type="button" aria-pressed="true"><span class="chip" style="--c: var(--m-bd)">BD</span></button>
            <button type="button" aria-pressed="false"><span class="chip" style="--c: var(--m-calc)">CALC2</span></button>
            <button type="button" aria-pressed="false"><span class="chip" style="--c: var(--m-esoft)">ESOFT</span></button>
            <button type="button" aria-pressed="false"><span class="chip" style="--c: var(--m-redes)">REDES</span></button>
          </div>

          <p class="rot-campo">o que é</p>
          <input class="campo--linha" type="text" placeholder="Prova 2 — normalização"
                 aria-label="Título" value="Prova 2 — normalização e SQL">

          <p class="rot-campo">quando</p>
          <input class="campo--linha" type="date" aria-label="Data" value="2026-08-29">

          <p class="rot-campo">hora <span style="font-weight:400">— opcional</span></p>
          <input class="campo--linha" type="time" aria-label="Hora" value="19:00">

          <p class="cache-aviso">
            Este registro é seu: você cadastrou hoje. Só quem criou pode editar ou apagar. O líder
            não mexe no registro de ninguém — ele só oculta da lista da turma.
          </p>

          <button class="botao" type="button" data-ir="home">Salvar</button>
          <button class="botao botao--fantasma" type="button" data-ir="confirmar-exclusao">Apagar</button>

          <!-- Atalho só do protótipo, para o avaliador alcançar o estado de falha.
               No app de verdade essa tela aparece sozinha quando o envio falha. -->
          <button class="link-txt" type="button" data-ir="erro">demo: salvar sem conexão</button>
        </div>
      </div>

      <!-- ==================== VER REGISTRO DE OUTRA PESSOA ==================== -->
      <div class="tela" data-tela="ver-evento" data-aba="home">
        <div class="t-barra">
          <span class="esq">
            <button class="voltar" type="button" data-ir="home" aria-label="Voltar">&larr;</button>
            <h3>Entrega</h3>
          </span>
        </div>
        <div class="t-corpo">
          <div class="linha-campo">
            <b><span class="glyph glyph--entrega"></span>&nbsp; Diagrama de casos de uso</b>
            <span>ESOFT · 27 ago · entrega</span>
          </div>

          <p class="rotulo">quem cadastrou</p>
          <div class="linha-campo">
            <b>Marina</b>
            <span>há 3 dias</span>
          </div>

          <!-- A restricao e dita ANTES de tentar, e nao depois de um toque negado:
               descobrir que nao pode editar depois de digitar e o pior momento. -->
          <div class="alerta" data-tom="turma">
            <span class="glyph glyph--entrega" style="margin-top:3px"></span>
            <span>Só a <b>Marina</b> edita ou apaga este registro, porque foi ela que cadastrou.
              Se a informação mudou, avise no quadro — ela corrige.</span>
          </div>

          <button class="botao botao--fantasma" type="button" data-ir="quadro">Avisar no quadro</button>
        </div>
      </div>

      <!-- ==================== APAGAR? (CONFIRMACAO) ==================== -->
      <div class="tela" data-tela="confirmar-exclusao" data-aba="home">
        <div class="t-barra">
          <span class="esq">
            <!-- A seta volta para a home: sair daqui NUNCA apaga nada. -->
            <button class="voltar" type="button" data-ir="home" aria-label="Voltar">&larr;</button>
            <h3>Apagar?</h3>
          </span>
        </div>
        <div class="t-corpo">
          <p class="rotulo">o que vai sumir</p>

          <div class="linha-campo">
            <b><span class="glyph glyph--entrega"></span>&nbsp; Seminário de Redes</b>
            <span>REDES · 30 ago · 23:59</span>
          </div>

          <div class="alerta" data-tom="turma">
            <span class="glyph glyph--entrega" style="margin-top:3px"></span>
            <span>
              Some da lista da turma e do calendário das <b>4 pessoas</b> que já viram este
              registro. <b>Não dá para desfazer.</b>
            </span>
          </div>

          <p class="cache-aviso">
            Apagar é diferente de ocultar. Ocultar tira da lista e volta atrás; apagar destrói o
            registro para todo mundo — e só você, que criou, pode fazer isso.
          </p>

          <!-- O destrutivo e o botao LEVE. O de maior peso visual e o caminho seguro,
               e fica por ultimo, onde o polegar cai sozinho. -->
          <button class="botao botao--fantasma" type="button" data-ir="home">Sim, apagar</button>
          <button class="botao" type="button" data-ir="home">Cancelar</button>
        </div>
      </div>

      <!-- ==================== FALHA AO SALVAR ==================== -->
      <div class="tela" data-tela="erro" data-aba="home">
        <div class="t-barra">
          <span class="esq">
            <button class="voltar" type="button" data-ir="editar-evento" aria-label="Voltar">&larr;</button>
            <h3>Não salvou</h3>
          </span>
        </div>
        <div class="t-corpo">
          <!-- Sem glifo aqui de proposito: o circulo e o quadrado ja significam
               "entrega" e "prova" em todo o resto do sistema, e reusa-los para
               marcar falha faria o participante ler erro como tipo de evento.
               A borda do .alerta mais a palavra "Falhou" bastam, e sobrevivem a
               escala de cinza. -->
          <div class="alerta" data-tom="turma">
            <span>
              <b>Falhou ao enviar.</b> O aparelho está sem conexão. A alteração não chegou ao
              servidor, então a turma ainda vê a versão antiga.
            </span>
          </div>

          <p class="rotulo">o que você escreveu</p>

          <div class="linha-campo">
            <b>Prova 2 — normalização e SQL</b>
            <span>BD · 29 ago · 19:00</span>
          </div>

          <p class="cache-aviso">
            Nada foi perdido: a edição está guardada no aparelho e sobe sozinha quando a conexão
            voltar. Você não precisa digitar de novo.
          </p>

          <button class="botao" type="button" data-ir="home">Tentar de novo</button>
        </div>
      </div>

"""

# --------------------------------------------------------------------------
# Os cartões da home. Cada um existe porque um teste precisa dele.
# --------------------------------------------------------------------------
CARTOES_HOME = """
          <!-- Meu registro: o unico que abre a edicao (Testes 03 e 05). -->
          <div class="ev ev--prova" data-ir="editar-evento" role="button" tabindex="0">
            <div class="ev-data"><span class="ev-dia">29</span><span class="ev-mes">ago</span></div>
            <div class="ev-corpo">
              <div class="ev-topo">
                <span class="chip" style="--c: var(--m-bd)">BD</span>
                <span class="ev-tipo"><span class="glyph glyph--prova"></span>19:00</span>
              </div>
              <p class="ev-titulo">Prova 2 — normalização e SQL</p>
              <p class="ev-rodape">Otávio · agora</p>
            </div>
          </div>

          <!-- Registro da Marina: abre em LEITURA, nao em edicao (Testes 04 e 05). -->
          <div class="ev ev--entrega" data-ir="ver-evento" role="button" tabindex="0">
            <div class="ev-data"><span class="ev-dia">27</span><span class="ev-mes">ago</span></div>
            <div class="ev-corpo">
              <div class="ev-topo">
                <span class="chip" style="--c: var(--m-esoft)">ESOFT</span>
                <span class="ev-tipo"><span class="glyph glyph--entrega"></span>entrega</span>
              </div>
              <p class="ev-titulo">Diagrama de casos de uso</p>
              <p class="ev-rodape">Marina · há 3 dias</p>
            </div>
          </div>

          <!-- Duplicata proposital: e o objeto do Teste 06. Sao dois cartoes
               identicos, e achar qual apagar faz parte da tarefa. -->
          <div class="ev ev--entrega" data-ir="confirmar-exclusao" role="button" tabindex="0">
            <div class="ev-data"><span class="ev-dia">30</span><span class="ev-mes">ago</span></div>
            <div class="ev-corpo">
              <div class="ev-topo">
                <span class="chip" style="--c: var(--m-redes)">REDES</span>
                <span class="ev-tipo"><span class="glyph glyph--entrega"></span>23:59</span>
              </div>
              <p class="ev-titulo">Seminário de Redes</p>
              <p class="ev-rodape">Otávio · há 2 dias</p>
            </div>
          </div>

          <div class="ev ev--entrega" data-ir="confirmar-exclusao" role="button" tabindex="0">
            <div class="ev-data"><span class="ev-dia">30</span><span class="ev-mes">ago</span></div>
            <div class="ev-corpo">
              <div class="ev-topo">
                <span class="chip" style="--c: var(--m-redes)">REDES</span>
                <span class="ev-tipo"><span class="glyph glyph--entrega"></span>23:59</span>
              </div>
              <p class="ev-titulo">Seminário de Redes</p>
              <p class="ev-rodape">Otávio · há 2 dias</p>
            </div>
          </div>

"""

# (âncora, substituto, quantas vezes deve casar)
EDICOES = [
    # 1. As telas novas entram antes do calendário, entre as irmãs .tela.
    ('      <!-- ==================== CALENDARIO ==================== -->',
     TELAS_NOVAS + '      <!-- ==================== CALENDARIO ==================== -->',
     1),

    # 2. Os cartões entram antes do botão de adicionar, no fim da lista da home.
    ('          <button class="add-linha" type="button" data-ir="novo-evento">',
     CARTOES_HOME + '          <button class="add-linha" type="button" data-ir="novo-evento">',
     1),

    # 3. "Cadastrar" -> "Adicionar": a troca já foi feita no app e nunca chegou
    #    ao mockup. Protótipo e app com palavras diferentes para o mesmo botão é
    #    o tipo de coisa que o teste de usabilidade pega — e seria um falso
    #    positivo, culpa do material, não do produto.
    ('+&nbsp;&nbsp;Cadastrar prova ou entrega',
     '+&nbsp;&nbsp;Adicionar prova ou entrega',
     1),
    ('<button class="botao" type="button" data-ir="home">Cadastrar</button>',
     '<button class="botao" type="button" data-ir="home">Adicionar</button>',
     1),

    # 4. O formulário de novo evento vinha em setembro; o calendário e os
    #    cartões são de agosto. O participante lê as duas coisas na mesma sessão.
    ('<input class="campo--linha" type="date" aria-label="Data" value="2026-09-10">',
     '<input class="campo--linha" type="date" aria-label="Data" value="2026-08-29">',
     1),

    # 5. O calendário precisa mostrar os mesmos registros da home, senão o
    #    Teste 04 falha pelo calendário mesmo tendo passado pela lista.
    ("    27: { tipo: 'entrega', cor: 'm-esoft', sigla: 'ESOFT', titulo: 'Diagrama de casos de uso', hora: 'entrega' }",
     "    27: { tipo: 'entrega', cor: 'm-esoft', sigla: 'ESOFT', titulo: 'Diagrama de casos de uso', hora: 'entrega' },\n"
     "    29: { tipo: 'prova', cor: 'm-bd', sigla: 'BD', titulo: 'Prova 2 — normalização e SQL', hora: '19:00' },\n"
     "    30: { tipo: 'entrega', cor: 'm-redes', sigla: 'REDES', titulo: 'Seminário de Redes', hora: '23:59' }",
     1),
]


def main() -> None:
    html = ALVO.read_text(encoding="utf-8")

    if 'data-tela="editar-evento"' in html:
        sys.exit("As telas novas já estão no arquivo. Nada a fazer.")

    for ancora, substituto, esperado in EDICOES:
        achados = html.count(ancora)
        if achados != esperado:
            sys.exit(
                f"ÂNCORA NÃO BATE ({achados} de {esperado} esperados). "
                f"Nada foi gravado.\n  {ancora[:90]}"
            )
        html = html.replace(ancora, substituto, esperado)

    ALVO.write_text(html, encoding="utf-8")
    print("telas-v3.html atualizado:")
    print("  + 4 telas: editar-evento, ver-evento, confirmar-exclusao, erro")
    print("  + 4 cartões navegáveis na home")
    print("  ~ Cadastrar -> Adicionar (mockup alinhado ao app)")
    print("  ~ datas de setembro -> agosto")
    print("  + 2 registros no calendário (29 e 30)")


if __name__ == "__main__":
    main()
