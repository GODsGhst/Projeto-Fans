import 'package:fans_lab/models/evento.dart';
import 'package:fans_lab/models/evento_detalhe.dart';
import 'package:fans_lab/models/formatos.dart';
import 'package:fans_lab/models/item_home.dart';
import 'package:fans_lab/models/materia.dart';
import 'package:fans_lab/models/rascunho_evento.dart';
import 'package:fans_lab/models/sessao.dart';
import 'package:fans_lab/models/tipo_evento.dart';
import 'package:flutter_test/flutter_test.dart';

// JSON de exemplo no formato da §5 do brief. Nenhum teste aqui usa rede ou disco.

final _autoria = <String, dynamic>{
  'autorId': 'a0000000-0000-4000-8000-000000000001',
  'autorNome': 'Ana',
  'autorSelo': null,
  'criadoEm': '2026-10-20T13:00:00Z',
  'atualizadoEm': null,
  'editadoPorNome': null,
  'editadoPorSelo': null,
};

final _itemHomeJson = <String, dynamic>{
  'eventoId': 'e0000000-0000-4000-8000-000000000001',
  'tipo': 'PROVA',
  'titulo': 'Prova 2',
  'data': '2026-10-25',
  'hora': '19:00:00',
  'materiaSigla': 'BD',
  'materiaCorHex': '#1D4ED8',
  'autoria': _autoria,
  'feitoPeloUsuario': false,
};

final _eventoJson = <String, dynamic>{
  'id': 'e0000000-0000-4000-8000-000000000002',
  'tipo': 'ENTREGA',
  'titulo': 'Lista 3',
  'data': '2026-10-28',
  'hora': null,
  'sala': null,
  'materiaId': 'm0000000-0000-4000-8000-000000000001',
  'materiaSigla': 'BD',
  'materiaCorHex': '#1D4ED8',
  'autoria': _autoria,
  'version': 3,
  'visivelTurma': true,
  'excluidoEm': null,
};

RascunhoEvento _rascunho({int? localId}) => RascunhoEvento(
  localId: localId,
  materiaId: 'm1',
  materiaSigla: 'BD',
  materiaCorHex: '#1D4ED8',
  tipo: TipoEvento.prova,
  titulo: 'Prova 2',
  data: DateTime(2026, 10, 25),
  hora: '19:00',
  sala: 'B-10',
  criadoEm: DateTime.utc(2026, 10, 22, 15),
  ultimoErro: 'timeout',
);

void main() {
  group('helpers de formato', () {
    test('dataIso tem zero à esquerda e lerData devolve a mesma data', () {
      expect(dataIso(DateTime(2026, 3, 5)), '2026-03-05');
      expect(lerData('2026-10-25'), DateTime(2026, 10, 25));
    });

    test('horaCurta corta os segundos e preserva null', () {
      expect(horaCurta('19:00:00'), '19:00');
      expect(horaCurta('19:00'), '19:00');
      expect(horaCurta(null), isNull);
    });

    test('lerData recusa data que o DateTime.parse rolaria em silêncio', () {
      expect(() => lerData('2026-02-30'), throwsA(isA<FormatException>()));
      expect(() => lerData('ontem'), throwsA(isA<FormatException>()));
    });
  });

  group('ItemHome', () {
    test('fromJson lê todos os campos', () {
      final item = ItemHome.fromJson(_itemHomeJson);
      expect(item.eventoId, 'e0000000-0000-4000-8000-000000000001');
      expect(item.tipo, TipoEvento.prova);
      expect(item.titulo, 'Prova 2');
      expect(item.data, DateTime(2026, 10, 25));
      expect(item.hora, '19:00');
      expect(item.materiaSigla, 'BD');
      expect(item.materiaCorHex, '#1D4ED8');
      expect(item.autoria.autorNome, 'Ana');
      expect(item.autoria.criadoEm, DateTime.utc(2026, 10, 20, 13));
      expect(item.feitoPeloUsuario, isFalse);
    });

    test('hora null continua null', () {
      final item = ItemHome.fromJson({..._itemHomeJson, 'hora': null});
      expect(item.hora, isNull);
    });

    test(
      'toMap não tem chave de feito e fromMap ida e volta preserva tudo',
      () {
        final item = ItemHome.fromJson(_itemHomeJson);
        final map = item.toMap(2);

        expect(
          map.keys,
          unorderedEquals([
            'evento_id',
            'posicao',
            'tipo',
            'titulo',
            'data',
            'hora',
            'materia_sigla',
            'materia_cor_hex',
            'autoria_json',
          ]),
        );
        expect(map['tipo'], 'PROVA');
        expect(map['data'], '2026-10-25');
        expect(map['hora'], '19:00');

        final volta = ItemHome.fromMap(map);
        expect(volta.eventoId, item.eventoId);
        expect(volta.tipo, item.tipo);
        expect(volta.titulo, item.titulo);
        expect(volta.data, item.data);
        expect(volta.hora, item.hora);
        expect(volta.materiaSigla, item.materiaSigla);
        expect(volta.materiaCorHex, item.materiaCorHex);
        expect(volta.autoria.autorId, item.autoria.autorId);
        expect(volta.autoria.autorNome, item.autoria.autorNome);
        expect(volta.autoria.criadoEm, item.autoria.criadoEm);
        expect(volta.feitoPeloUsuario, isFalse);
      },
    );

    test('fromMap com feito: true marca feitoPeloUsuario', () {
      final map = ItemHome.fromJson(_itemHomeJson).toMap(0);
      expect(ItemHome.fromMap(map, feito: true).feitoPeloUsuario, isTrue);
    });

    test('copyWith muda só feitoPeloUsuario e não altera o original', () {
      final item = ItemHome.fromJson(_itemHomeJson);
      final feito = item.copyWith(feitoPeloUsuario: true);
      expect(feito.feitoPeloUsuario, isTrue);
      expect(feito.titulo, item.titulo);
      expect(item.feitoPeloUsuario, isFalse);
    });
  });

  group('Evento e EventoDetalhe', () {
    test('Evento.fromJson lê o evento com hora e excluidoEm nulos', () {
      final ev = Evento.fromJson(_eventoJson);
      expect(ev.id, 'e0000000-0000-4000-8000-000000000002');
      expect(ev.tipo, TipoEvento.entrega);
      expect(ev.hora, isNull);
      expect(ev.version, 3);
      expect(ev.visivelTurma, isTrue);
      expect(ev.excluidoEm, isNull);
      expect(ev.autoria.autorNome, 'Ana');
    });

    test('EventoDetalhe.fromJson com 1 material vinculado', () {
      final det = EventoDetalhe.fromJson({
        ..._eventoJson,
        'materiais': [
          {
            'id': 'mt0000000-0000-4000-8000-000000000001',
            'tipo': 'LINK',
            'titulo': 'Slides aula 3',
            'url': 'https://exemplo.com/slides-3',
            'dataAula': '2026-10-10',
            'autoria': _autoria,
          },
        ],
      });
      expect(det.evento.id, 'e0000000-0000-4000-8000-000000000002');
      expect(det.evento.version, 3);
      expect(det.materiais, hasLength(1));
      final mat = det.materiais.single;
      expect(mat.titulo, 'Slides aula 3');
      expect(mat.tipo, 'LINK');
      expect(mat.url, 'https://exemplo.com/slides-3');
      expect(mat.dataAula, DateTime(2026, 10, 10));
    });
  });

  group('Sessao', () {
    test('fromJson do AuthResponse com turmaId null, e toJson volta igual', () {
      final s = Sessao.fromJson({
        'jwt': 'eyJ.payload.sig',
        'usuario': {
          'id': 'u1',
          'nome': 'Otávio',
          'email': 'o@x.com',
          'tipoConta': 'ALUNO',
          'docenteStatus': null,
        },
        'turmaId': null,
      });
      expect(s.jwt, 'eyJ.payload.sig');
      expect(s.usuario.nome, 'Otávio');
      expect(s.turmaId, isNull);

      final volta = Sessao.fromJson(s.toJson());
      expect(volta.jwt, 'eyJ.payload.sig');
      expect(volta.usuario.email, 'o@x.com');
      expect(volta.turmaId, isNull);
    });
  });

  group('Materia', () {
    test('fromJson e toMap -> fromMap ida e volta', () {
      final m = Materia.fromJson({
        'id': 'm1',
        'nome': 'Banco de Dados',
        'sigla': 'BD',
        'corHex': '#1D4ED8',
        'sala': 'B-204',
        'professor': null,
      });
      expect(
        m.toMap().keys,
        unorderedEquals([
          'id',
          'nome',
          'sigla',
          'cor_hex',
          'sala',
          'professor',
        ]),
      );

      final volta = Materia.fromMap(m.toMap());
      expect(volta.id, 'm1');
      expect(volta.nome, 'Banco de Dados');
      expect(volta.sigla, 'BD');
      expect(volta.corHex, '#1D4ED8');
      expect(volta.sala, 'B-204');
      expect(volta.professor, isNull);
    });
  });

  group('RascunhoEvento', () {
    test('toMap -> fromMap ida e volta preserva tudo', () {
      final map = _rascunho(localId: 7).toMap();
      expect(map['local_id'], 7);
      expect(map['tipo'], 'PROVA');
      expect(map['data'], '2026-10-25');
      expect(map['sincronizado'], 0);
      expect(map['criado_em'], '2026-10-22T15:00:00.000Z');

      final volta = RascunhoEvento.fromMap(map);
      expect(volta.localId, 7);
      expect(volta.materiaId, 'm1');
      expect(volta.materiaSigla, 'BD');
      expect(volta.materiaCorHex, '#1D4ED8');
      expect(volta.tipo, TipoEvento.prova);
      expect(volta.titulo, 'Prova 2');
      expect(volta.data, DateTime(2026, 10, 25));
      expect(volta.hora, '19:00');
      expect(volta.sala, 'B-10');
      expect(volta.criadoEm, DateTime.utc(2026, 10, 22, 15));
      expect(volta.sincronizado, isFalse);
      expect(volta.ultimoErro, 'timeout');
    });

    test('toMap omite local_id quando null', () {
      expect(_rascunho().toMap().containsKey('local_id'), isFalse);
    });

    test('toCriarJson tem exatamente as chaves do POST', () {
      expect(_rascunho(localId: 7).toCriarJson(), {
        'materiaId': 'm1',
        'tipo': 'PROVA',
        'titulo': 'Prova 2',
        'data': '2026-10-25',
        'hora': '19:00',
        'sala': 'B-10',
      });
    });

    test('copyWith limparErro zera o erro; sem ele, mantém o erro', () {
      final r = _rascunho(localId: 7);
      expect(r.copyWith(limparErro: true).ultimoErro, isNull);

      final ok = r.copyWith(localId: 9, sincronizado: true);
      expect(ok.localId, 9);
      expect(ok.sincronizado, isTrue);
      expect(ok.ultimoErro, 'timeout');
    });
  });

  group('JSON inválido lança FormatException', () {
    test('sem titulo', () {
      final json = Map<String, dynamic>.from(_itemHomeJson)..remove('titulo');
      expect(() => ItemHome.fromJson(json), throwsA(isA<FormatException>()));
    });

    test('tipo desconhecido', () {
      expect(
        () => ItemHome.fromJson({..._itemHomeJson, 'tipo': 'XPTO'}),
        throwsA(isA<FormatException>()),
      );
    });

    test('version como string', () {
      expect(
        () => Evento.fromJson({..._eventoJson, 'version': '3'}),
        throwsA(isA<FormatException>()),
      );
    });
  });
}
