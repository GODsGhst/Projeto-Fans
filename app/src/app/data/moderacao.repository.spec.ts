import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../environments/environment';
import { AuthService } from '../core/auth.service';
import {
  StorageFake,
  USUARIO,
  configurarTeste,
} from '../features/auth/auth-teste';
import { ModeracaoRepository } from './moderacao.repository';
import { TurmaRepository } from './turma.repository';
import type { MinhaTurma } from './turma.repository';

const MEMBRO = { nome: 'x', entrouEm: '2026-08-01T12:00:00Z' } as const;

function turma(liderId: string): MinhaTurma {
  return {
    id: 't1',
    nome: 'Fans 2026',
    semestre: null,
    codigoConvite: 'ABC12345',
    membros: [
      {
        ...MEMBRO,
        usuarioId: 'u1',
        papel: liderId === 'u1' ? 'LIDER' : 'ALUNO',
      },
      {
        ...MEMBRO,
        usuarioId: 'u2',
        papel: liderId === 'u2' ? 'LIDER' : 'ALUNO',
      },
    ],
  };
}

describe('ModeracaoRepository.transferirLideranca', () => {
  let backend: HttpTestingController;
  let turmas: TurmaRepository;
  let repo: ModeracaoRepository;
  const URL_TURMA = `${environment.apiUrl}/turmas/minha`;
  const URL_TRANSFERIR = `${environment.apiUrl}/turmas/lideranca/transferir`;

  beforeEach(async () => {
    backend = configurarTeste(new StorageFake());
    TestBed.inject(AuthService).definirSessao('jwt', USUARIO, 't1');
    turmas = TestBed.inject(TurmaRepository);
    repo = TestBed.inject(ModeracaoRepository);

    // Quem vai transferir ja abriu a turma e se ve como lider.
    const carregada = turmas.carregar();
    backend.expectOne(URL_TURMA).flush(turma('u1'));
    await carregada;
    expect(turmas.souLider()).toBeTrue();
  });

  afterEach(() => backend.verify());

  it('recarrega a turma: o ex-lider deixa de aparecer como lider', async () => {
    const pronta = repo.transferirLideranca('u2');
    backend.expectOne(URL_TRANSFERIR).flush(null);
    await new Promise((r) => setTimeout(r));
    backend.expectOne(URL_TURMA).flush(turma('u2'));
    await pronta;

    expect(turmas.turma()?.membros.find((m) => m.papel === 'LIDER')?.usuarioId)
      .withContext('sem a releitura, o cache seguia com o lider antigo')
      .toBe('u2');
    expect(turmas.souLider()).toBeFalse();
  });

  it('releitura falhou: zera a turma em vez de manter o ex-lider na tela', async () => {
    // `carregar` guarda a falha em `erro` e MANTEM o dado velho, o que e certo
    // para "nao consegui atualizar" e errado aqui, onde o dado velho e
    // justamente o que acabou de deixar de valer.
    const pronta = repo.transferirLideranca('u2');
    backend.expectOne(URL_TRANSFERIR).flush(null);
    await new Promise((r) => setTimeout(r));
    backend
      .expectOne(URL_TURMA)
      .flush({}, { status: 500, statusText: 'Server Error' });
    await pronta; // a transferencia deu certo: nao lanca por causa da releitura

    expect(turmas.turma())
      .withContext('dado velho mostraria o papel que a pessoa acabou de perder')
      .toBeNull();
    expect(turmas.souLider()).toBeFalse();
  });

  it('o POST falhou: a turma carregada fica como esta', async () => {
    const pronta = repo.transferirLideranca('u2');
    backend
      .expectOne(URL_TRANSFERIR)
      .flush({}, { status: 500, statusText: 'Server Error' });

    await expectAsync(pronta).toBeRejected();
    expect(turmas.souLider())
      .withContext('nada mudou no servidor, entao nada muda na tela')
      .toBeTrue();
  });
});
