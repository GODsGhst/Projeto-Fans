import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'tema.dart';

/// Equivalentes Flutter das classes globais de app/src/global.scss (.botao, .pf-*, .alerta,
/// .pf-avatar) e dos desenhos SVG inline dos componentes (sala, lapis, capelo, escudo).

enum EstiloBotao { primario, fantasma, fio }

/// `.botao` com os modificadores. `primario` e `fantasma` ocupam a largura; `fio` e a largura do conteudo.
/// `onPressed` nulo = desabilitado: continua visivel, com opacidade 0,45 e sem recuo.
class Botao extends StatefulWidget {
  const Botao({
    super.key,
    required this.rotulo,
    required this.onPressed,
    this.estilo = EstiloBotao.primario,
    this.pilula = false,
  });

  final String rotulo;
  final VoidCallback? onPressed;
  final EstiloBotao estilo;
  final bool pilula;

  @override
  State<Botao> createState() => _BotaoState();
}

class _BotaoState extends State<Botao> {
  bool _pressionado = false;
  bool _focado = false;

  ({
    Color cor,
    Color fundo,
    bool borda,
    double tamanho,
    FontWeight peso,
    EdgeInsets padding,
  })
  _visual(Cores c) => switch (widget.estilo) {
    EstiloBotao.primario => (
      cor: c.accentInk,
      fundo: c.accent,
      borda: false,
      tamanho: 14.5,
      peso: FontWeight.w700,
      padding: const EdgeInsets.all(14),
    ),
    EstiloBotao.fantasma => (
      cor: c.ink,
      fundo: Colors.transparent,
      borda: true,
      tamanho: 14.5,
      peso: FontWeight.w700,
      padding: const EdgeInsets.all(14),
    ),
    EstiloBotao.fio => (
      cor: c.ink2,
      fundo: Colors.transparent,
      borda: true,
      tamanho: 13.5,
      peso: FontWeight.w600,
      padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 14),
    ),
  };

  @override
  Widget build(BuildContext context) {
    final c = Cores.de(context);
    final v = _visual(c);
    final habilitado = widget.onPressed != null;
    final fio = widget.estilo == EstiloBotao.fio;
    final raio = widget.pilula ? Raio.pilula : Raio.md;

    // .botao:active recua 0,98; .botao--fio.botao--pilula:active recua 0,92.
    final escala = _pressionado && habilitado
        ? (fio && widget.pilula ? Mola.pressForte : Mola.press)
        : 1.0;

    final corpo = DecoratedBox(
      decoration: BoxDecoration(
        color: v.fundo,
        border: v.borda ? Border.all(color: c.rule) : null,
        borderRadius: BorderRadius.circular(raio),
      ),
      child: Padding(
        padding: v.padding,
        child: Text(
          widget.rotulo,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: v.cor,
            fontSize: v.tamanho,
            fontWeight: v.peso,
          ),
        ),
      ),
    );

    // Anel de foco: 2px accent, offset 3px, fora do elemento (sem mexer no layout).
    final comFoco = Stack(
      clipBehavior: Clip.none,
      children: [
        fio ? corpo : SizedBox(width: double.infinity, child: corpo),
        if (_focado)
          Positioned(
            left: -5,
            top: -5,
            right: -5,
            bottom: -5,
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  border: Border.all(color: c.accent, width: 2),
                  borderRadius: BorderRadius.circular(raio + 5),
                ),
              ),
            ),
          ),
      ],
    );

    return Opacity(
      opacity: habilitado ? 1 : 0.45,
      child: Semantics(
        button: true,
        enabled: habilitado,
        child: FocusableActionDetector(
          enabled: habilitado,
          mouseCursor: habilitado
              ? SystemMouseCursors.click
              : SystemMouseCursors.forbidden,
          onShowFocusHighlight: (foco) => setState(() => _focado = foco),
          actions: <Type, Action<Intent>>{
            ActivateIntent: CallbackAction<Intent>(
              onInvoke: (_) {
                widget.onPressed?.call();
                return null;
              },
            ),
          },
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTapDown: (_) => setState(() => _pressionado = true),
            onTapUp: (_) => setState(() => _pressionado = false),
            onTapCancel: () => setState(() => _pressionado = false),
            onTap: widget.onPressed,
            child: AnimatedScale(
              scale: escala,
              duration: MediaQuery.disableAnimationsOf(context)
                  ? Duration.zero
                  : Mola.duracao,
              curve: Mola.curva,
              child: comFoco,
            ),
          ),
        ),
      ),
    );
  }
}

/// .pf-rotulo: rotulo de grupo em mono 11px, caixa alta, com fio de 1px ocupando o resto da linha.
class PfRotulo extends StatelessWidget {
  const PfRotulo({super.key, required this.texto});

  final String texto;

  @override
  Widget build(BuildContext context) {
    final c = Cores.de(context);
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          Text(
            texto.toUpperCase(),
            style: estiloMono(size: 11, letterSpacing: 1.21, color: c.ink3),
          ),
          const SizedBox(width: 7),
          Expanded(child: Container(height: 1, color: c.rule)),
        ],
      ),
    );
  }
}

/// .pf-pilha: coluna vertical de uma tela, espacamento 8, padding 12/16/16.
class PfPilha extends StatelessWidget {
  const PfPilha({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 8,
      children: children,
    ),
  );
}

/// .pf-vazio: duas linhas de texto, sem botao, sem icone, sem skeleton. Vazio nao e falha.
class PfVazio extends StatelessWidget {
  const PfVazio({super.key, required this.titulo, required this.detalhe});

  final String titulo;
  final String detalhe;

  @override
  Widget build(BuildContext context) {
    final c = Cores.de(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 26, horizontal: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 8,
        children: [
          Text(
            titulo,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: c.ink,
            ),
          ),
          Text(
            detalhe,
            style: TextStyle(fontSize: 15, height: 1.5, color: c.ink3),
          ),
        ],
      ),
    );
  }
}

/// .pf-aviso: estado da tela (carregando, sem conexao, falha de carregamento). Tracejado.
/// `erro` liga o role alert.
class PfAviso extends StatelessWidget {
  const PfAviso({super.key, required this.texto, this.erro = false});

  final String texto;
  final bool erro;

  @override
  Widget build(BuildContext context) {
    final c = Cores.de(context);
    return Semantics(
      liveRegion: erro,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: c.ruleSoft,
          borderRadius: BorderRadius.circular(Raio.sm),
        ),
        child: CustomPaint(
          painter: Tracejado(
            caminho: (t) => Path()
              ..addRRect(
                RRect.fromRectAndRadius(
                  Offset.zero & t,
                  const Radius.circular(Raio.sm),
                ).deflate(0.5),
              ),
            cor: c.rule,
            espessura: 1,
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
            child: Text(
              texto,
              style: TextStyle(fontSize: 12.5, height: 1.4, color: c.ink2),
            ),
          ),
        ),
      ),
    );
  }
}

/// .pf-erro: falha de uma acao. Solido, borda ink-3, role alert. Nunca tracejado.
class PfErro extends StatelessWidget {
  const PfErro({super.key, required this.texto});

  final String texto;

  @override
  Widget build(BuildContext context) {
    final c = Cores.de(context);
    return Semantics(
      liveRegion: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: c.ruleSoft,
          border: Border.all(color: c.ink3),
          borderRadius: BorderRadius.circular(Raio.sm),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
          child: Text(
            texto,
            style: TextStyle(fontSize: 13, height: 1.4, color: c.ink),
          ),
        ),
      ),
    );
  }
}

/// .alerta (aviso neutro de formulario) e .alerta--desfazer (com `acao`, por exemplo um Botao fio).
/// Com `acao`, o texto ganha liveRegion, como o role status de "Ocultado.".
class Alerta extends StatelessWidget {
  const Alerta({super.key, required this.texto, this.acao});

  final String texto;
  final Widget? acao;

  @override
  Widget build(BuildContext context) {
    final c = Cores.de(context);
    final a = acao;
    final msg = Semantics(
      liveRegion: a != null,
      child: Text(
        texto,
        style: TextStyle(fontSize: 12.5, height: 1.42, color: c.ink2),
      ),
    );
    return DecoratedBox(
      decoration: BoxDecoration(
        color: c.ruleSoft,
        border: Border.all(color: c.rule),
        borderRadius: BorderRadius.circular(Raio.sm),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
        child: a == null
            ? msg
            : Row(
                children: [
                  Expanded(child: msg),
                  const SizedBox(width: 10),
                  a,
                ],
              ),
      ),
    );
  }
}

/// .pf-cache-aviso: explicacao de regra, texto corrido sem caixa. Nao reusa o tracejado de proposito.
class PfCacheAviso extends StatelessWidget {
  const PfCacheAviso({super.key, required this.texto});

  final String texto;

  @override
  Widget build(BuildContext context) {
    final c = Cores.de(context);
    return Text(
      texto,
      style: TextStyle(fontSize: 12.5, height: 1.45, color: c.ink2),
    );
  }
}

/// .pf-avatar: inicial em circulo accent. Sem nome, '?'.
class PfAvatar extends StatelessWidget {
  const PfAvatar({super.key, required this.nome, this.tamanho = 24});

  final String nome;
  final double tamanho;

  /// Primeiro code point do nome sem espacos, em maiusculas. Nao e grafema: e o que o Ionic faz (armadilha 75).
  static String inicial(String nome) {
    final limpo = nome.trim();
    if (limpo.isEmpty) return '?';
    return String.fromCharCodes([limpo.runes.first]).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final c = Cores.de(context);
    return Container(
      width: tamanho,
      height: tamanho,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: c.accent, shape: BoxShape.circle),
      child: Text(
        inicial(nome),
        style: TextStyle(
          color: c.accentInk,
          fontSize: tamanho > 24 ? 13 : 12,
          fontWeight: FontWeight.w700,
          height: 1,
        ),
      ),
    );
  }
}

/// Glifo da gramatica de tinta. Cheio e quadrado = prova. Vazado e redondo = entrega e atividade de aula.
/// Herda a cor do tipo (prova-fg-2 ou ink-3), como currentColor no CSS.
class Glifo extends StatelessWidget {
  const Glifo({super.key, required this.cor, required this.cheio});

  final Color cor;
  final bool cheio;

  @override
  Widget build(BuildContext context) => Container(
    width: 8,
    height: 8,
    decoration: cheio
        ? BoxDecoration(
            color: cor,
            border: Border.all(color: cor, width: 1.5),
            borderRadius: BorderRadius.circular(1),
          )
        : BoxDecoration(
            border: Border.all(color: cor, width: 1.5),
            shape: BoxShape.circle,
          ),
  );
}

enum TipoIcone { sala, lapis, capelo, escudo }

/// Icones SVG inline do spec (armadilha 23), em viewBox 24. Nao sao Ionicons: reproduzidos com os mesmos caminhos.
class Icone extends StatelessWidget {
  const Icone({
    super.key,
    required this.tipo,
    required this.cor,
    required this.tamanho,
  });

  final TipoIcone tipo;
  final Color cor;
  final double tamanho;

  @override
  Widget build(BuildContext context) => CustomPaint(
    size: Size.square(tamanho),
    painter: _IconePainter(tipo, cor),
  );
}

class _IconePainter extends CustomPainter {
  _IconePainter(this.tipo, this.cor);

  final TipoIcone tipo;
  final Color cor;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 24);
    final traco = Paint()
      ..color = cor
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    switch (tipo) {
      case TipoIcone.sala:
        traco.strokeWidth = 1.4;
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromLTWH(3, 3.2, 18, 10),
            const Radius.circular(1.2),
          ),
          traco,
        );
        canvas.drawPath(
          Path()
            ..moveTo(6.4, 7)
            ..lineTo(13.4, 7)
            ..moveTo(6.4, 9.8)
            ..lineTo(11, 9.8),
          traco,
        );
        canvas.drawPath(
          Path()
            ..addRect(Rect.fromLTRB(4, 17.4, 10, 20.6))
            ..addRect(Rect.fromLTRB(14, 17.4, 20, 20.6)),
          traco,
        );
        canvas.drawPath(
          Path()
            ..moveTo(7, 17.4)
            ..lineTo(7, 15.7)
            ..moveTo(17, 17.4)
            ..lineTo(17, 15.7),
          traco,
        );
      case TipoIcone.capelo:
        traco.strokeWidth = 1.9;
        canvas.drawPath(
          Path()
            ..moveTo(2.5, 9.5)
            ..lineTo(12, 5)
            ..lineTo(21.5, 9.5)
            ..lineTo(12, 14)
            ..close(),
          traco,
        );
        canvas.drawPath(
          Path()
            ..moveTo(6.5, 11.8)
            ..lineTo(6.5, 16)
            ..cubicTo(6.5, 17.4, 9, 18.8, 12, 18.8)
            ..cubicTo(15, 18.8, 17.5, 17.4, 17.5, 16)
            ..lineTo(17.5, 11.8),
          traco,
        );
      case TipoIcone.escudo:
        final escudo = Path()
          ..moveTo(12, 3)
          ..lineTo(20, 6)
          ..lineTo(20, 11.5)
          ..cubicTo(20, 15.9, 16.8, 19.3, 12, 21)
          ..cubicTo(7.2, 19.3, 4, 15.9, 4, 11.5)
          ..lineTo(4, 6)
          ..close();
        canvas.drawPath(
          escudo,
          Paint()
            ..color = cor
            ..style = PaintingStyle.fill,
        );
        traco.strokeWidth = 1.6;
        canvas.drawPath(escudo, traco);
      case TipoIcone.lapis:
        traco.strokeWidth = 2;
        canvas.drawPath(
          Path()
            ..moveTo(4, 20)
            ..lineTo(8, 20)
            ..lineTo(19, 9)
            ..lineTo(15, 5)
            ..lineTo(4, 16)
            ..close(),
          traco,
        );
        canvas.drawPath(
          Path()
            ..moveTo(13.5, 6.5)
            ..lineTo(17.5, 10.5),
          traco,
        );
    }
  }

  @override
  bool shouldRepaint(_IconePainter antigo) =>
      antigo.tipo != tipo || antigo.cor != cor;
}

/// Borda ou regua tracejada. Flutter nao tem `dashed` em Border, entao pinta-se o caminho em tracos.
/// O padrao exato do navegador nao esta especificado (armadilha 28): traco 4, vao 3.
class Tracejado extends CustomPainter {
  Tracejado({
    required this.caminho,
    required this.cor,
    required this.espessura,
  });

  final Path Function(Size tamanho) caminho;
  final Color cor;
  final double espessura;

  static const _traco = 4.0;
  static const _vao = 3.0;

  @override
  void paint(Canvas canvas, Size size) {
    final pincel = Paint()
      ..color = cor
      ..style = PaintingStyle.stroke
      ..strokeWidth = espessura;
    for (final trecho in caminho(size).computeMetrics()) {
      var pos = 0.0;
      while (pos < trecho.length) {
        canvas.drawPath(
          trecho.extractPath(pos, math.min(pos + _traco, trecho.length)),
          pincel,
        );
        pos += _traco + _vao;
      }
    }
  }

  @override
  bool shouldRepaint(Tracejado antigo) => true;
}
