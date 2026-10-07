import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

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

describe('TurmaRepository: ferramentas do lider', () => {
  let backend: HttpTestingController;
  let repo: TurmaRepository;
  let auth: AuthService;
  let storage: StorageFake;
  let irPara: jasmine.Spy;
  const URL_TURMA = `${environment.apiUrl}/turmas/minha`;

  const COM_ANA: MinhaTurma = {
    ...TURMA,
    membros: [
      ...TURMA.membros,
      {
        usuarioId: 'u2',
        nome: 'Ana',
        papel: 'ALUNO',
        entrouEm: '2026-08-02T12:00:00Z',
      },
    ],
  };

  beforeEach(async () => {
    storage = new StorageFake();
    backend = configurarTeste(storage);
    auth = TestBed.inject(AuthService);
    auth.definirSessao('jwt', USUARIO, 't1');
    irPara = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    repo = TestBed.inject(TurmaRepository);
    const pronto = repo.carregar();
    backend.expectOne(URL_TURMA).flush(COM_ANA);
    await pronto;
  });

  afterEach(() => backend.verify());

  it('removerMembro: DELETE na rota certa, tira da lista e rele a turma', async () => {
    const pronto = repo.removerMembro('u2');
    const del = backend.expectOne(`${URL_TURMA}/membros/u2`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
    await new Promise((r) => setTimeout(r));

    expect(repo.turma()?.membros.map((m) => m.usuarioId))
      .withContext('o DELETE deu certo: a lista ja nao tem a Ana')
      .toEqual(['u1']);

    backend.expectOne(URL_TURMA).flush(TURMA);
    await pronto;
    expect(repo.turma()).toEqual(TURMA);
  });

  it('removerMembro: se a releitura falhar, a Ana continua fora da lista', async () => {
    const pronto = repo.removerMembro('u2');
    backend
      .expectOne(`${URL_TURMA}/membros/u2`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await new Promise((r) => setTimeout(r));
    backend
      .expectOne(URL_TURMA)
      .flush(null, { status: 500, statusText: 'Server Error' });
    await pronto;

    expect(repo.erro()).not.toBeNull();
    expect(repo.turma()?.membros.map((m) => m.usuarioId)).toEqual(['u1']);
  });

  it('removerMembro: 409 sobe para a tela e a lista nao muda', async () => {
    const pronto = repo.removerMembro('u1');
    backend.expectOne(`${URL_TURMA}/membros/u1`).flush(
      { detail: 'Transfira a liderança antes de sair' },
      { status: 409, statusText: 'Conflict' },
    );

    await expectAsync(pronto).toBeRejectedWithError(/Transfira a liderança/);
    expect(repo.turma()?.membros.length).toBe(2);
  });

  it('gerarNovoCodigo: POST e a turma devolvida substitui a de antes', async () => {
    const pronto = repo.gerarNovoCodigo();
    const req = backend.expectOne(`${URL_TURMA}/codigo`);
    expect(req.request.method).toBe('POST');
    req.flush({ ...COM_ANA, codigoConvite: 'NOVO0001' });
    await pronto;

    expect(repo.turma()?.codigoConvite).toBe('NOVO0001');
    expect(repo.turma()?.membros.length)
      .withContext('quem ja entrou continua')
      .toBe(2);
  });

  describe('quem o lider removeu (GET /turmas/minha vira 404)', () => {
    async function removido(): Promise<void> {
      const pronto = repo.carregar();
      // O codigo e o que distingue "voce saiu da turma" de um 404 qualquer.
      backend.expectOne(URL_TURMA).flush(
        { detail: 'Registro nao encontrado', codigo: 'SEM_TURMA' },
        { status: 404, statusText: 'Not Found' },
      );
      await pronto;
    }

    it('esquece a turma, nao fica preso em aviso de erro', async () => {
      await removido();

      expect(repo.turma()).toBeNull();
      expect(repo.souLider()).toBeFalse();
      expect(repo.erro())
        .withContext('um aviso numa tela vazia e o beco sem saida')
        .toBeNull();
      expect(repo.carregando()).toBeFalse();
    });

    it('a sessao fica sem turma (em memoria e em disco) mas continua logada', async () => {
      await removido();

      expect(auth.temTurma()).toBeFalse();
      expect(auth.autenticado()).toBeTrue();
      expect(storage.sessao?.turmaId)
        .withContext('reabrir o app nao pode trazer a turma de volta')
        .toBeNull();
      expect(storage.sessao?.jwt).toBe('jwt');
    });

    it('leva para a tela de entrar na turma', async () => {
      await removido();

      expect(irPara).toHaveBeenCalledWith('/entrar-turma');
    });

    it('falha ao gravar a sessao vai para o console e nao prende a pessoa', async () => {
      spyOn(console, 'error');
      spyOn(auth, 'registrarTurma').and.rejectWith(new Error('disco cheio'));

      await removido();

      expect(console.error).toHaveBeenCalled();
      expect(irPara).toHaveBeenCalledWith('/entrar-turma');
    });

    it('404 SEM codigo (proxy, portal cativo) NAO derruba o vinculo: vira aviso comum', async () => {
      const pronto = repo.carregar();
      backend
        .expectOne(URL_TURMA)
        .flush('<html>Not Found</html>', { status: 404, statusText: 'Not Found' });
      await pronto;

      expect(auth.temTurma()).toBeTrue();
      expect(irPara).not.toHaveBeenCalled();
      expect(repo.erro()).not.toBeNull();
      expect(repo.turma())
        .withContext('a turma que ja estava em tela continua valendo')
        .not.toBeNull();
    });

    it('perder o vinculo por OUTRA rota tambem esquece a turma em memoria', async () => {
      // O removido que so abriu a Home: o interceptor chama registrarTurma(null)
      // e a turma antiga nao pode ficar para o papel de lider da proxima.
      expect(repo.souLider()).toBeTrue();

      await auth.registrarTurma(null);
      TestBed.tick();

      expect(repo.turma()).toBeNull();
      expect(repo.souLider()).toBeFalse();
    });

    it('outros erros NAO derrubam o vinculo', async () => {
      const pronto = repo.carregar();
      backend
        .expectOne(URL_TURMA)
        .flush(null, { status: 500, statusText: 'Server Error' });
      await pronto;

      expect(auth.temTurma()).toBeTrue();
      expect(irPara).not.toHaveBeenCalled();
      expect(repo.turma()).not.toBeNull();
    });
  });
});
