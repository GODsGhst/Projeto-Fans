import 'package:flutter/material.dart';

import 'materia_chip.dart';
import 'tema.dart';
import 'tipos.dart';

/// Cartao compacto do Meu quadro. Mesma gramatica de tinta da Home: prova solida, entrega contornada.
/// `feito` e estado pessoal: esmaece o cartao todo (chip incluido) e risca o titulo. Nao muda nada para a turma.
/// `aviso` aparece so na secao Nao listados.
class MiniCard extends StatelessWidget {
  const MiniCard({
    super.key,
    required this.materia,
    required this.titulo,
    required this.tipo,
    this.feito = false,
    this.aviso,
  });

  final MateriaVisual materia;
  final String titulo;
  final TipoEvento tipo;
  final bool feito;

  /// 'oculto pelo líder · só você vê' e parecidos. Ausente ou vazio = sem linha.
  final String? aviso;

  @override
  Widget build(BuildContext context) {
    final c = Cores.de(context);
    final prova = tipo == TipoEvento.prova;
    final rotulo = prova ? 'Prova' : 'Entrega';

    final cartao = Container(
      padding: const EdgeInsets.fromLTRB(9, 8, 9, 8),
      decoration: BoxDecoration(
        color: prova ? c.provaBg : null,
        border: Border.all(color: prova ? c.provaBg : c.rule),
        borderRadius: BorderRadius.circular(Raio.sm),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 5,
        children: [
          MateriaChip(sigla: materia.sigla, cor: materia.cor),
          // O tipo e anunciado como no EventoCard. O visual so mostra o bloco solido.
          Semantics(
            label: '$rotulo — $titulo',
            child: Text(
              titulo,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                height: 1.3,
                color: prova ? c.provaFg : c.ink,
                decoration: feito ? TextDecoration.lineThrough : null,
              ),
            ),
          ),
          // Aviso no bloco solido usa prova-fg-2. Com ink-3 ele fica abaixo de 4,5:1 (armadilha 37).
          if (aviso case final a? when a.isNotEmpty)
            Text(
              a,
              style: estiloMono(
                size: 9,
                letterSpacing: 0.54,
                height: 1.3,
                color: prova ? c.provaFg2 : c.ink3,
              ),
            ),
        ],
      ),
    );

    return Opacity(opacity: feito ? 0.55 : 1, child: cartao);
  }
}
