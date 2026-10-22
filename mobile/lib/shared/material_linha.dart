import 'package:flutter/material.dart';

import 'estilos.dart';
import 'selo.dart';
import 'tema.dart';
import 'tipos.dart';

/// Linha da lista de material: rotulo de formato, titulo e autoria. Sem cartao, sem toque.
/// O link fica na pagina que envolve a linha (so http/https vira link; o VM decide).
///
/// `autoria` e obrigatoria e sem `if`: '' renderiza a linha vazia, como no Ionic.
/// `editado por` leva o lapis, igual ao EventoCard (armadilha 47).
class MaterialLinha extends StatelessWidget {
  const MaterialLinha({
    super.key,
    required this.tipo,
    required this.titulo,
    required this.autoria,
    this.autoriaSelo,
    this.editadoPor,
    this.editadoPorSelo,
  });

  /// Rotulo de formato do VM: 'PDF', 'JPG', 'LINK'. Exibido em caixa alta, em uma linha.
  final String tipo;
  final String titulo;

  /// Assinatura pronta do VM ('Nome · há 1 dia').
  final String autoria;
  final TipoSelo? autoriaSelo;

  /// Quem corrigiu o material, quando nao foi o autor. Ausente ou vazio = sem linha.
  final String? editadoPor;
  final TipoSelo? editadoPorSelo;

  @override
  Widget build(BuildContext context) {
    final c = Cores.de(context);
    final estiloAutoria = TextStyle(fontSize: 11, color: c.ink3);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 42,
            child: Text(
              tipo.toUpperCase(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: estiloMono(
                size: 10,
                letterSpacing: 1.1,
                height: 1.5,
                color: c.ink3,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 2,
              children: [
                Text(
                  titulo,
                  style: TextStyle(fontSize: 13, height: 1.35, color: c.ink),
                ),
                Wrap(
                  spacing: 6,
                  runSpacing: 2,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      '${prefixoDoSelo(autoriaSelo)}$autoria',
                      style: estiloAutoria,
                    ),
                    Selo(selo: autoriaSelo),
                  ],
                ),
                if (editadoPor case final quem? when quem.isNotEmpty)
                  Wrap(
                    spacing: 6,
                    runSpacing: 2,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Icone(tipo: TipoIcone.lapis, cor: c.ink3, tamanho: 13),
                      Text(
                        'editado por ${prefixoDoSelo(editadoPorSelo)}$quem',
                        style: estiloAutoria,
                      ),
                      Selo(selo: editadoPorSelo),
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
