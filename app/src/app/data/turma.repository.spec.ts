import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../environments/environment';
import { AuthService } from '../core/auth.service';
import {
  StorageFake,
  USUARIO,
  configurarTeste,
} from '../features/auth/auth-teste';
import { TurmaRepository } from './turma.repository';
import type { MinhaTurma } from './turma.repository';

/** O usuario da sessao (`u1`) e o lider desta turma. */
const TURMA: MinhaTurma = {
  id: 't1',
  nome: 'Fans 2026',
  semestre: '2026.2',
  codigoConvite: 'ABC12345',
  membros: [
    {
      usuarioId: 'u1',
      nome: 'Otavio',
      papel: 'LIDER',
      entrouEm: '2026-08-01T12:00:00Z',
    },
  ],
};

describe('TurmaRepository', () => {
  let backend: HttpTestingController;
  let repo: TurmaRepository;
  let auth: AuthService;

  beforeEach(() => {
    backend = configurarTeste(new StorageFake());
    auth = TestBed.inject(AuthService);
    auth.definirSessao('jwt', USUARIO, 't1');
    repo = TestBed.inject(TurmaRepository);
  });

  afterEach(() => backend.verify());

  async function carregar(
    resposta: MinhaTurma | null = TURMA,
    falha = false,
  ): Promise<void> {
    const pronto = repo.carregar();
    const req = backend.expectOne(`${environment.apiUrl}/turmas/minha`);
    if (falha) {
      req.flush({}, { status: 500, statusText: 'Server Error' });
    } else {
      req.flush(resposta);
    }
    await pronto;
  }

  it('sair da conta zera a turma: a proxima conta nao herda o papel da anterior', async () => {
    await carregar();
    TestBed.tick();
    expect(repo.turma())
      .withContext('logado, a turma carregada nao pode ser apagada')
      .not.toBeNull();
    expect(repo.souLider()).toBeTrue();

    await auth.sair();
    TestBed.tick();

    expect(repo.turma())
      .withContext('o repositorio vive ate fechar o app; a sessao nao')
      .toBeNull();
  });

  it('sessao encerrada pelo 401 tambem zera a turma e o aviso de erro', async () => {
    await carregar(null, true);
    expect(repo.erro()).not.toBeNull();
    await carregar();

    auth.encerrarSessao();
    TestBed.tick();

    expect(repo.turma()).toBeNull();
    expect(repo.erro()).toBeNull();
  });

  it('depois de zerada, a proxima tela busca a turma de novo', async () => {
    await carregar();
    await auth.sair();
    TestBed.tick();
    auth.definirSessao('jwt-2', { ...USUARIO, id: 'u9' }, 't1');

    const pronto = repo.garantirCarregada();
    backend.expectOne(`${environment.apiUrl}/turmas/minha`).flush(TURMA);
    await pronto;

    expect(repo.turma()?.id).toBe('t1');
    expect(repo.souLider())
      .withContext('u9 nao esta na lista de membros: nao e lider')
      .toBeFalse();
  });
});
