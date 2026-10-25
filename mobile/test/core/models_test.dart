import 'package:flutter_test/flutter_test.dart';
import 'package:projetofans/data/models.dart';

void main() {
  test('campo opcional omitido pelo backend vira null', () {
    final m = Materia.fromJson({
      'id': 'm1',
      'nome': 'Banco de Dados',
      'sigla': 'BD',
      'corHex': '#0369A1',
    });
    expect(m.sala, isNull);
    expect(m.professor, isNull);
  });

  test('POST /turmas/entrar só com id, turmaId e papel é lido', () {
    final membro = Membro.fromJson({'id': 'x', 'turmaId': 't1', 'papel': 'ALUNO'});
    expect(membro.turmaId, 't1');
    expect(membro.papel, PapelMembro.aluno);
    expect(membro.usuarioId, isNull);
    expect(membro.entrouEm, isNull);
  });

  test('sessão sem turmaId e sem tipoConta é aluno sem turma', () {
    final sessao = SessaoResponse.fromJson({
      'jwt': 'j',
      'usuario': {'id': 'u', 'nome': 'n', 'email': 'e'},
    });
    expect(sessao.turmaId, isNull);
    expect(ehContaDocente(sessao.usuario), isFalse);
  });

  test('professor pendente conta como docente: o tipo decide, não o status', () {
    final u = Usuario.fromJson({
      'id': 'u',
      'nome': 'n',
      'email': 'e',
      'tipoConta': 'PROFESSOR',
      'docenteStatus': 'PENDENTE',
    });
    expect(ehContaDocente(u), isTrue);
    expect(statusDocente(u), DocenteStatus.pendente);
  });

  test('cadastro de aluno não manda tipoConta; professor manda', () {
    expect(
      const RegistrarRequest(nome: 'n', email: 'e', senha: 's').toJson().containsKey('tipoConta'),
      isFalse,
    );
    expect(
      const RegistrarRequest(
        nome: 'n',
        email: 'e',
        senha: 's',
        tipoConta: TipoConta.professor,
      ).toJson()['tipoConta'],
      'PROFESSOR',
    );
  });

  test('CriarEventoRequest manda hora e sala como null explícito', () {
    final corpo = const CriarEventoRequest(
      materiaId: 'm1',
      tipo: TipoEvento.prova,
      titulo: 'Prova 2',
      data: '2026-09-10',
    ).toJson();
    expect(corpo.containsKey('hora'), isTrue);
    expect(corpo['hora'], isNull);
    expect(corpo.containsKey('sala'), isTrue);
    expect(corpo['tipo'], 'PROVA');
  });

  test('config de lembretes: campo ausente vira o padrão e alarme inválido é descartado', () {
    final config = ConfigLembretes.fromJson({
      'vespera': false,
      'personalizados': {
        'e1': {'modo': 'RELATIVO', 'horasAntes': 2},
        'e2': {'modo': 'DESCONHECIDO'},
      },
    });
    expect(config.noDia, isTrue);
    expect(config.vespera, isFalse);
    expect(config.umaHora, isTrue);
    expect(config.personalizados.keys, ['e1']);
  });

  test('campo obrigatório ausente lança FormatException', () {
    expect(() => Evento.fromJson({}), throwsFormatException);
  });
}
