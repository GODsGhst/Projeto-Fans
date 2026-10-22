// Porte de app/src/app/features/evento-vm.spec.ts. A formatação é a única lógica desta camada.

import 'package:flutter_test/flutter_test.dart';
import 'package:projetofans/data/models.dart' as modelos;
import 'package:projetofans/shared/evento_vm.dart';
import 'package:projetofans/shared/tipos.dart';

modelos.ItemHome item({
  String? hora = '23:59',
  modelos.TipoEvento tipo = modelos.TipoEvento.entrega,
  String data = '2026-08-21',
  modelos.Autoria? autoria,
}) => modelos.ItemHome(
  eventoId: 'e1',
  tipo: tipo,
  titulo: 'Lista 4 — normalização',
  data: data,
  hora: hora,
  materiaSigla: 'BD',
  materiaCorHex: '#0369A1',
  autoria:
      autoria ??
      const modelos.Autoria(
        autorId: 'u1',
        autorNome: 'Otávio',
        criadoEm: '2026-08-21T09:00:00Z',
        atualizadoEm: '2026-08-21T09:00:00Z',
      ),
  feitoPeloUsuario: false,
);

void main() {
  final agora = DateTime.parse('2026-08-21T14:00:00Z');

  test('a data ISO vira dia e mês sem andar um dia para trás', () {
    // "2026-08-21" lido como UTC é meia-noite, que no Brasil é dia 20. Este teste existe para o dia do
    // evento nunca andar para trás na tela.
    final vm = EventoVm.deItem(item(data: '2026-08-21'), agora);

    expect(vm.dia, '21');
    expect(vm.mes, 'ago');
  });

  test('evento sem hora mostra o tipo em vez de horário inventado', () {
    final semHora = EventoVm.deItem(
      item(hora: null, tipo: modelos.TipoEvento.prova),
      agora,
    );
    final comHora = EventoVm.deItem(item(hora: '19:00'), agora);

    expect(semHora.quando, 'prova');
    expect(comHora.quando, '19:00');
  });

  test('hora com segundos, como o backend serializa, mostra só HH:mm', () {
    expect(EventoVm.deItem(item(hora: '19:00:00'), agora).quando, '19:00');
    expect(EventoVm.deItem(item(hora: '07:05:30'), agora).quando, '07:05');
    // Hora vazia e hora ausente se comportam igual: rótulo do tipo, nunca "".
    expect(
      EventoVm.deItem(
        item(hora: '', tipo: modelos.TipoEvento.prova),
        agora,
      ).quando,
      'prova',
    );
  });

  test('autoria sempre aparece, mesmo com timestamp ilegível', () {
    // Autoria é o único mecanismo de confiança do app: a linha nunca some nem vira "Otávio · NaN".
    final normal = EventoVm.deItem(item(), agora);
    final quebrado = EventoVm.deItem(
      item(
        autoria: const modelos.Autoria(
          autorId: 'u1',
          autorNome: 'Otávio',
          criadoEm: 'nao-e-data',
          atualizadoEm: 'nao-e-data',
        ),
      ),
      agora,
    );

    expect(normal.autoria, contains('Otávio'));
    expect(normal.autoria, contains('5 h'));
    expect(quebrado.autoria, 'Otávio');
  });

  test('o selo do modelo vira o selo do design system; editado por vem junto', () {
    final vm = EventoVm.deItem(
      item(
        autoria: const modelos.Autoria(
          autorId: 'u1',
          autorNome: 'Ana',
          criadoEm: '2026-08-21T09:00:00Z',
          atualizadoEm: '2026-08-21T09:00:00Z',
          autorSelo: modelos.Selo.professor,
          editadoPorNome: 'Coord.',
          editadoPorSelo: modelos.Selo.coordenacao,
        ),
      ),
      agora,
    );

    expect(vm.autoriaSelo, TipoSelo.professor);
    expect(vm.editadoPor, 'Coord.');
    expect(vm.editadoPorSelo, TipoSelo.coordenacao);
    expect(vm.sala, '', reason: 'item da Home não traz sala');
  });

  test('materia vem como sigla e cor, e o Evento traz sala quando existe', () {
    final evento = modelos.Evento(
      id: 'e9',
      tipo: modelos.TipoEvento.prova,
      titulo: 'P1',
      data: '2026-08-21',
      hora: '08:00',
      materiaId: 'bd',
      materiaSigla: 'BD',
      materiaCorHex: '#0369A1',
      autoria: item().autoria,
      version: 0,
      visivelTurma: true,
      sala: 'Lab 2',
    );

    final vm = EventoVm.deEvento(evento, agora);

    expect(vm.materia, (sigla: 'BD', cor: '#0369A1'));
    expect(vm.tipo, TipoEvento.prova);
    expect(vm.sala, 'Lab 2');
  });

  group('datas por extenso', () {
    test('diaPorExtenso usa o nome do dia e o mês curto, sem zero à esquerda', () {
      // 21 de agosto de 2026 é sexta-feira.
      expect(diaPorExtenso(DateTime(2026, 8, 21, 12)), 'Sexta, 21 ago');
      // 9 de outubro de 2026 é sexta-feira também.
      expect(diaPorExtenso(DateTime(2026, 10, 9, 12)), 'Sexta, 9 out');
      // Domingo: o weekday do Dart é 7 e a tabela começa em Domingo. Erro de índice apareceria aqui.
      expect(diaPorExtenso(DateTime(2026, 8, 23, 12)), 'Domingo, 23 ago');
    });

    test('limitesDoMes são o primeiro e o último dia do mês, inclusive em fevereiro', () {
      final (:de, :ate) = limitesDoMes(DateTime(2026, 2, 14));
      expect(de, '2026-02-01');
      expect(ate, '2026-02-28');
      expect(mesPorExtenso(DateTime(2026, 2, 14)), 'fev');
    });
  });
}
