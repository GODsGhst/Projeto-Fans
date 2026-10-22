import 'package:flutter/material.dart';

import 'estilos.dart';
import 'tema.dart';
import 'tipos.dart';

/// "Professor " / "Coordenação " do nome, com espaco final. Sem selo, ''. Fica junto do desenho para nao divergir.
String prefixoDoSelo(TipoSelo? selo) => switch (selo) {
  TipoSelo.professor => 'Prof. ',
  TipoSelo.coordenacao => 'Coord. ',
  null => '',
};

/// Selo de autoria: "esta pessoa tem poder aqui". Texto, forma e contorno de 1px. Nunca so cor.
/// Nulo = nada renderizado. Quem chama so mostra o selo dentro do bloco de autoria (armadilha 4).
///
/// `naProva` troca as cores para o bloco solido da prova (Professor na tinta do bloco, Coordenacao no teal de prova).
class Selo extends StatelessWidget {
  const Selo({super.key, required this.selo, this.naProva = false});

  final TipoSelo? selo;
  final bool naProva;

  @override
  Widget build(BuildContext context) {
    final s = selo;
    if (s == null) return const SizedBox.shrink();
    final c = Cores.de(context);
    final professor = s == TipoSelo.professor;
    final cor = professor
        ? (naProva ? c.provaFg : c.ink)
        : (naProva ? c.seloCoordProva : c.accent);
    return Container(
      padding: const EdgeInsets.fromLTRB(4, 1, 7, 1),
      decoration: BoxDecoration(
        border: Border.all(color: cor),
        borderRadius: BorderRadius.circular(Raio.sm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icone(
            tipo: professor ? TipoIcone.capelo : TipoIcone.escudo,
            cor: cor,
            tamanho: 12,
          ),
          const SizedBox(width: 4),
          Text(
            professor ? 'Professor' : 'Coordenação',
            maxLines: 1,
            softWrap: false,
            style: TextStyle(
              color: cor,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              height: 1.5,
              letterSpacing: -0.044,
            ),
          ),
        ],
      ),
    );
  }
}
