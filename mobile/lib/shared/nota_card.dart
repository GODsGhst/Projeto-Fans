import 'package:flutter/material.dart';

import 'estilos.dart';
import 'selo.dart';
import 'tema.dart';
import 'tipos.dart';

/// Anotacao presa a um dia. As duas variantes nunca podem se parecer:
///
///   turma   = regua SOLIDA em accent, fundo rule-soft, "da turma · todos veem"
///   pessoal = regua TRACEJADA em ink-3, sem fundo,     "pessoal · só você"
///
/// O rotulo textual faz parte da regra. Nao remover.
///
/// Autoria e selo so existem na nota da turma, e o selo so pode ser de coordenacao.
/// As asserts guardam isso no construtor (spec, armadilha 52). Em release a guarda vem do backend.
class NotaCard extends StatelessWidget {
  const NotaCard({
    super.key,
    required this.alcance,
    required this.texto,
    this.autoria,
    this.autoriaSelo,
  }) : assert(
         autoria == null || alcance == AlcanceNota.turma,
         'Nota pessoal nao tem autoria',
       ),
       assert(
         autoriaSelo == null || autoriaSelo == TipoSelo.coordenacao,
         'Selo de nota so pode ser de coordenacao',
       );

  final AlcanceNota alcance;

  /// Texto livre do usuario.
  final String texto;

  /// Assinatura pronta ('Otávio · há 1 dia'). Ausente ou vazia = sem linha.
  final String? autoria;
  final TipoSelo? autoriaSelo;

  @override
  Widget build(BuildContext context) {
    final c = Cores.de(context);
    final turma = alcance == AlcanceNota.turma;
    final corRegua = turma ? c.accent : c.ink3;
    final rotulo = turma ? 'da turma · todos veem' : 'pessoal · só você';

    return ClipRRect(
      borderRadius: BorderRadius.circular(Raio.sm),
      child: ColoredBox(
        color: turma ? c.ruleSoft : Colors.transparent,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                width: 3,
                child: turma
                    ? ColoredBox(color: corRegua)
                    : CustomPaint(
                        painter: Tracejado(
                          caminho: (t) => Path()
                            ..moveTo(1.5, 0)
                            ..lineTo(1.5, t.height),
                          cor: corRegua,
                          espessura: 3,
                        ),
                      ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 9, 12, 9),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: 4,
                    children: [
                      Text(
                        rotulo.toUpperCase(),
                        style: estiloMono(
                          size: 10,
                          letterSpacing: 0.9,
                          color: corRegua,
                        ),
                      ),
                      Text(
                        texto,
                        style: TextStyle(
                          fontSize: 14,
                          height: 1.4,
                          color: turma ? c.ink : c.ink2,
                        ),
                      ),
                      if (autoria case final a? when a.isNotEmpty)
                        Wrap(
                          spacing: 6,
                          runSpacing: 2,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Text(
                              '${prefixoDoSelo(autoriaSelo)}$a',
                              style: TextStyle(fontSize: 11, color: c.ink3),
                            ),
                            Selo(selo: autoriaSelo),
                          ],
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
