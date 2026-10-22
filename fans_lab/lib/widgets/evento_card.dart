import 'package:flutter/material.dart';

import 'package:fans_lab/models/item_home.dart';
import 'package:fans_lab/models/tipo_evento.dart';
import 'package:fans_lab/widgets/cores.dart';
import 'package:fans_lab/widgets/materia_chip.dart';
import 'package:fans_lab/widgets/tempo_relativo.dart';

/// Cartão de prova ou entrega. Prova = bloco sólido; entrega = contorno 1px.
/// A diferença é de peso de tinta, não de cor: a cor é da matéria.
class EventoCard extends StatelessWidget {
  const EventoCard({
    super.key,
    required this.tipo,
    required this.titulo,
    required this.data,
    this.hora,
    required this.materiaSigla,
    required this.materiaCorHex,
    required this.autoriaTexto,
    this.feito = false,
    this.onTap,
  });

  factory EventoCard.deItem(ItemHome item, {VoidCallback? onTap}) => EventoCard(
    tipo: item.tipo,
    titulo: item.titulo,
    data: item.data,
    hora: item.hora,
    materiaSigla: item.materiaSigla,
    materiaCorHex: item.materiaCorHex,
    autoriaTexto: '${item.autoria.autorNome} · ${tempoRelativo(item.autoria.criadoEm)}',
    feito: item.feitoPeloUsuario,
    onTap: onTap,
  );

  final TipoEvento tipo;
  final String titulo;
  final DateTime data;
  final String? hora;
  final String materiaSigla;
  final String materiaCorHex;
  final String autoriaTexto;
  final bool feito;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final cores = Theme.of(context).extension<CoresFans>()!;
    final ehProva = tipo == TipoEvento.prova;
    final corTexto = ehProva ? cores.provaFg : cores.ink;
    final corSecundaria = ehProva ? cores.provaFg2 : cores.ink3;
    final tipoRotulo = ehProva ? 'Prova' : 'Entrega';
    final rotulo = '$tipoRotulo de $materiaSigla: $titulo, '
        '${data.day} de ${mesAbrev(data.month).toLowerCase()}, $autoriaTexto'
        '${feito ? ', feito' : ''}';

    final marcador = ehProva
        ? Container(
            width: 8,
            height: 8,
            color: corSecundaria,
          )
        : Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: corSecundaria, width: 1.5),
            ),
          );

    return Semantics(
      label: rotulo,
      button: onTap != null,
      excludeSemantics: true,
      child: Container(
        key: ValueKey('evento-card-${tipo.name}'),
        margin: const EdgeInsets.symmetric(vertical: 6),
        decoration: BoxDecoration(
          color: ehProva ? cores.provaBg : cores.surface,
          borderRadius: BorderRadius.circular(14),
          border: ehProva ? null : Border.all(color: cores.rule, width: 1),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(14),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 48,
                      child: Column(
                        children: [
                          Text(
                            '${data.day}',
                            style: TextStyle(
                              fontSize: 26,
                              fontWeight: FontWeight.bold,
                              color: corTexto,
                            ),
                          ),
                          Text(
                            mesAbrev(data.month),
                            style: TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 11,
                              letterSpacing: 1.5,
                              color: corSecundaria,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              MateriaChip(sigla: materiaSigla, corHex: materiaCorHex),
                              const SizedBox(width: 8),
                              marcador,
                              const SizedBox(width: 4),
                              Text(
                                hora ?? (ehProva ? 'prova' : 'entrega'),
                                style: TextStyle(
                                  fontFamily: 'monospace',
                                  fontSize: 13,
                                  color: corSecundaria,
                                ),
                              ),
                              if (feito) ...[
                                const SizedBox(width: 4),
                                Icon(Icons.check_circle, size: 16, color: corSecundaria),
                              ],
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            titulo,
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w600,
                              color: corTexto,
                              decoration: feito ? TextDecoration.lineThrough : null,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            autoriaTexto,
                            style: TextStyle(fontSize: 13, color: corSecundaria),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
