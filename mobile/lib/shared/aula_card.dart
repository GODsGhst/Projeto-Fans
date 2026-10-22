import 'package:flutter/material.dart';

import 'estilos.dart';
import 'materia_chip.dart';
import 'tema.dart';
import 'tipos.dart';

/// Uma aula da grade: sala, materia, horario, nome, detalhe e entrega vinculada.
/// So a aula em andamento (`agora`) ganha o trilho de accent. O destaque nao muda o tamanho do cartao.
class AulaCard extends StatelessWidget {
  const AulaCard({
    super.key,
    required this.materia,
    required this.nome,
    required this.hora,
    required this.sala,
    this.detalhe,
    this.atividade,
    this.agora = false,
  });

  final MateriaVisual materia;
  final String nome;

  /// 'HH:mm–HH:mm' (en dash) ou 'dia · HH:mm'.
  final String hora;
  final String sala;

  /// Texto pronto do chamador ('agora · prof. Marcos'). Ausente ou vazio = sem linha.
  final String? detalhe;

  /// 'entregar hoje · Lista 4'. Ausente ou vazio = sem linha.
  final String? atividade;
  final bool agora;

  @override
  Widget build(BuildContext context) {
    final c = Cores.de(context);
    final corAtividade = agora ? c.accent : c.ink2;

    final conteudo = Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: c.surface,
              border: Border.all(color: c.rule),
              borderRadius: BorderRadius.circular(Raio.sm),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              spacing: 1,
              children: [
                Icone(tipo: TipoIcone.sala, cor: c.ink3, tamanho: 20),
                // Sala longa corta com reticencias. O quadrado de 46px nao tem folga (armadilha 22).
                Text(
                  sala,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: estiloMono(
                    size: 8.5,
                    peso: FontWeight.w500,
                    letterSpacing: 0.34,
                    color: c.ink2,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 4,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    MateriaChip(sigla: materia.sigla, cor: materia.cor),
                    Text(
                      hora,
                      style: estiloMono(
                        size: 11,
                        letterSpacing: 0.66,
                        color: c.ink2,
                        tabular: true,
                      ),
                    ),
                  ],
                ),
                Text(
                  nome,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    height: 1.25,
                    letterSpacing: -0.12,
                    color: c.ink,
                  ),
                ),
                if (detalhe case final d? when d.isNotEmpty)
                  Text(d, style: TextStyle(fontSize: 11, color: c.ink3)),
                if (atividade case final a? when a.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Glifo(cor: corAtividade, cheio: false),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            a.toUpperCase(),
                            style: estiloMono(
                              size: 10,
                              letterSpacing: 0.9,
                              color: corAtividade,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );

    // Trilho de 2px dentro da borda, recortado pelo raio. Nao cria box-shadow (armadilha 30).
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: agora ? c.accent : c.rule),
        borderRadius: BorderRadius.circular(Raio.md),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(Raio.md - 1),
        child: Stack(
          children: [
            conteudo,
            if (agora)
              Positioned(
                left: 0,
                top: 0,
                bottom: 0,
                width: 2,
                child: ColoredBox(
                  key: const ValueKey('trilho-agora'),
                  color: c.accent,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
