import 'package:flutter/material.dart';

import 'estilos.dart';
import 'materia_chip.dart';
import 'selo.dart';
import 'tema.dart';
import 'tipos.dart';

/// Cartao de prova ou entrega. "Prova pesa mais que entrega" por TINTA, nunca por cor:
///
///   prova   = bloco solido (prova-bg), titulo 700, glifo cheio
///   entrega = contorno 1px, sem fundo,  titulo 600, glifo vazado
///
/// O tipo tambem vai em texto oculto, lido por leitor de tela. Quando `quando` ja e o proprio
/// rotulo ('prova' ou 'entrega', sem hora), so o rotulo e anunciado, sem repetir.
class EventoCard extends StatelessWidget {
  const EventoCard({
    super.key,
    required this.tipo,
    required this.dia,
    required this.mes,
    required this.titulo,
    required this.quando,
    this.materia,
    this.autoria,
    this.autoriaSelo,
    this.editadoPor,
    this.editadoPorSelo,
  });

  final TipoEvento tipo;

  /// '08'. Vem do split da data, sem Date.
  final String dia;

  /// 'ago'. Abreviacao pt-BR minuscula; exibida em caixa alta.
  final String mes;

  final String titulo;

  /// 'HH:mm', ou 'prova' / 'entrega' quando nao ha hora.
  final String quando;

  /// Ausente = sem chip nem cor. O cartao continua legivel.
  final MateriaVisual? materia;

  /// Assinatura pronta do VM ('Nome · há 2 dias'). Ausente ou vazia = sem linha de autoria.
  final String? autoria;
  final TipoSelo? autoriaSelo;

  /// Quem corrigiu, quando nao foi o autor. Ausente ou vazio = sem linha.
  final String? editadoPor;
  final TipoSelo? editadoPorSelo;

  @override
  Widget build(BuildContext context) {
    final c = Cores.de(context);
    final prova = tipo == TipoEvento.prova;
    final corTexto = prova ? c.provaFg : c.ink;
    final corSecundaria = prova ? c.provaFg2 : c.ink3;
    final rotulo = prova ? 'Prova' : 'Entrega';
    final anuncio = quando.toLowerCase() == rotulo.toLowerCase()
        ? rotulo
        : '$rotulo — $quando';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: prova ? c.provaBg : Colors.transparent,
        border: Border.all(color: prova ? c.provaBg : c.rule),
        borderRadius: BorderRadius.circular(Raio.md),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 44,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  dia,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: corTexto,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    height: 1,
                    letterSpacing: -0.6,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
                Opacity(
                  opacity: 0.62,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      mes.toUpperCase(),
                      textAlign: TextAlign.center,
                      style: estiloMono(
                        size: 10,
                        letterSpacing: 1,
                        color: corTexto,
                        tabular: true,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 5,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    if (materia case final m?)
                      MateriaChip(sigla: m.sigla, cor: m.cor),
                    Semantics(
                      label: anuncio,
                      excludeSemantics: true,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Glifo(cor: corSecundaria, cheio: prova),
                          const SizedBox(width: 5),
                          Text(
                            quando.toUpperCase(),
                            style: estiloMono(
                              size: 10,
                              letterSpacing: 1.1,
                              color: corSecundaria,
                              tabular: true,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                Text(
                  titulo,
                  style: TextStyle(
                    color: corTexto,
                    fontSize: 16,
                    fontWeight: prova ? FontWeight.w700 : FontWeight.w600,
                    height: 1.3,
                    letterSpacing: -0.128,
                  ),
                ),
                if (autoria case final a? when a.isNotEmpty)
                  Wrap(
                    spacing: 7,
                    runSpacing: 3,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        '${prefixoDoSelo(autoriaSelo)}$a',
                        style: TextStyle(fontSize: 13, color: corSecundaria),
                      ),
                      Selo(selo: autoriaSelo, naProva: prova),
                    ],
                  ),
                if (editadoPor case final quem? when quem.isNotEmpty)
                  Wrap(
                    spacing: 7,
                    runSpacing: 3,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Icone(
                        tipo: TipoIcone.lapis,
                        cor: corSecundaria,
                        tamanho: 13,
                      ),
                      Text(
                        'editado por ${prefixoDoSelo(editadoPorSelo)}$quem',
                        style: TextStyle(fontSize: 13, color: corSecundaria),
                      ),
                      Selo(selo: editadoPorSelo, naProva: prova),
                    ],
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
