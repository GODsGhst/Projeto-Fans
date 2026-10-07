import { TestBed } from '@angular/core/testing';

import type { Perfil, Usuario } from '../data/models';
import { NotificacoesService } from '../notifications/notificacoes.service';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { StorageService } from './storage.service';

/**
 * Perder a sessao tem de cancelar os lembretes. O alarme agendado no aparelho
 * nao sabe que a conta saiu: sem isto, os avisos da conta anterior tocavam por
 * semanas — no celular de quem so trocou de conta.
 */
describe('AuthService e os lembretes', () => {
  let esquecer: jasmine.Spy<() => Promise<void>>;
  let auth: AuthService;

  beforeEach(() => {
    esquecer = jasmine.createSpy('esquecer').and.resolveTo();
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: {} },
        {
          provide: StorageService,
          useValue: {
            limparSessao: async () => {},
            limpar: async () => {},
          },
        },
        { provide: NotificacoesService, useValue: { esquecer } },
      ],
    });
    auth = TestBed.inject(AuthService);
    auth.definirSessao(
      'jwt',
      { id: 'u1', nome: 'Otavio', email: 'o@exemplo.com' },
      't1',
    );
  });

  it('sair() cancela os lembretes', async () => {
    await auth.sair();

    expect(esquecer).toHaveBeenCalledTimes(1);
    expect(auth.autenticado()).toBeFalse();
  });

  it('cair por 401 (encerrarSessao) tambem cancela os lembretes', () => {
    auth.encerrarSessao();

    expect(esquecer).toHaveBeenCalledTimes(1);
    expect(auth.autenticado()).toBeFalse();
  });

  it('falha ao cancelar vai para o console e nao trava a saida', async () => {
    // Sem `await`, como o apagar da sessao: o 401 nao espera disco para
    // redirecionar, e um plugin que falha nao pode prender a pessoa logada.
    spyOn(console, 'error');
    esquecer.and.rejectWith(new Error('plugin caiu'));

    await expectAsync(auth.sair()).toBeResolved();
    auth.encerrarSessao();
    await new Promise((r) => setTimeout(r));

    expect(console.error).toHaveBeenCalledTimes(2);
  });
});

/**
 * O lider removeu a pessoa: a conta segue valida, a turma nao. O que era DA
 * turma e vive no aparelho (lembretes e snapshot) sai junto.
 */
describe('AuthService.registrarTurma(null)', () => {
  let esquecer: jasmine.Spy<() => Promise<void>>;
  let limpar: jasmine.Spy<() => Promise<void>>;
  let gravarSessao: jasmine.Spy;
  let auth: AuthService;

  beforeEach(() => {
    esquecer = jasmine.createSpy('esquecer').and.resolveTo();
    limpar = jasmine.createSpy('limpar').and.resolveTo();
    gravarSessao = jasmine.createSpy('gravarSessao').and.resolveTo();
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: {} },
        {
          provide: StorageService,
          useValue: { gravarSessao, limpar, limparSessao: async () => {} },
        },
        { provide: NotificacoesService, useValue: { esquecer } },
      ],
    });
    auth = TestBed.inject(AuthService);
    auth.definirSessao(
      'jwt',
      { id: 'u1', nome: 'Otavio', email: 'o@exemplo.com' },
      't1',
    );
  });

  it('tira o vinculo mas mantem a sessao, gravando a ausencia em disco', async () => {
    await auth.registrarTurma(null);

    expect(auth.temTurma()).toBeFalse();
    expect(auth.autenticado()).toBeTrue();
    expect(gravarSessao).toHaveBeenCalledWith(
      'jwt',
      { id: 'u1', nome: 'Otavio', email: 'o@exemplo.com' },
      null,
    );
  });

  it('cancela os lembretes e apaga o snapshot da turma que ela perdeu', async () => {
    await auth.registrarTurma(null);

    expect(esquecer).toHaveBeenCalledTimes(1);
    expect(limpar).toHaveBeenCalledTimes(1);
  });

  it('entrar numa turma NAO apaga nada', async () => {
    await auth.registrarTurma('t2');

    expect(esquecer).not.toHaveBeenCalled();
    expect(limpar).not.toHaveBeenCalled();
    expect(auth.turmaId()).toBe('t2');
  });
});

/**
 * Docente e uma conta que a interface trata diferente (painel, varias turmas) —
 * e quem decide e o TIPO, nao o status. Professor pendente que caisse no app de
 * aluno "perderia" as outras turmas ate ser aprovado (spec 2.9).
 */
describe('AuthService e a conta docente', () => {
  const ALUNO: Usuario = { id: 'u1', nome: 'Otavio', email: 'o@exemplo.com' };
  const PROF: Usuario = {
    ...ALUNO,
    tipoConta: 'PROFESSOR',
    docenteStatus: 'PENDENTE',
  };

  let api: { get: jasmine.Spy; post: jasmine.Spy; patch: jasmine.Spy };
  let storage: {
    lerSessao: jasmine.Spy;
    gravarSessao: jasmine.Spy;
    limparSessao: jasmine.Spy;
    limpar: jasmine.Spy;
  };
  let auth: AuthService;

  beforeEach(() => {
    api = {
      get: jasmine.createSpy('get'),
      post: jasmine.createSpy('post'),
      patch: jasmine.createSpy('patch'),
    };
    storage = {
      lerSessao: jasmine.createSpy('lerSessao').and.resolveTo(null),
      gravarSessao: jasmine.createSpy('gravarSessao').and.resolveTo(),
      limparSessao: jasmine.createSpy('limparSessao').and.resolveTo(),
      limpar: jasmine.createSpy('limpar').and.resolveTo(),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: api },
        { provide: StorageService, useValue: storage },
        {
          provide: NotificacoesService,
          useValue: { esquecer: async () => {} },
        },
      ],
    });
    auth = TestBed.inject(AuthService);
  });

  it('ehDocente: aluno e sessao antiga (sem tipoConta) nao, docente sim — em qualquer status', () => {
    expect(auth.ehDocente()).withContext('sem sessao').toBeFalse();

    auth.definirSessao('jwt', ALUNO, 't1');
    expect(auth.ehDocente()).withContext('sessao antiga').toBeFalse();

    auth.definirSessao('jwt', { ...ALUNO, tipoConta: 'ALUNO' }, 't1');
    expect(auth.ehDocente()).withContext('aluno').toBeFalse();

    for (const status of ['PENDENTE', 'APROVADO', 'RECUSADO'] as const) {
      auth.definirSessao(
        'jwt',
        { ...ALUNO, tipoConta: 'PROFESSOR', docenteStatus: status },
        't1',
      );
      expect(auth.ehDocente()).withContext(`professor ${status}`).toBeTrue();
    }
    auth.definirSessao('jwt', { ...ALUNO, tipoConta: 'COORDENADOR' }, 't1');
    expect(auth.ehDocente()).withContext('coordenador').toBeTrue();
  });

  it('registrar como aluno manda o corpo de sempre, sem tipoConta', async () => {
    api.post.and.resolveTo({ jwt: 'j', usuario: ALUNO });

    await auth.registrar('Otavio', 'o@exemplo.com', 'senha-de-oito');

    expect(api.post).toHaveBeenCalledWith('/auth/registrar', {
      nome: 'Otavio',
      email: 'o@exemplo.com',
      senha: 'senha-de-oito',
    });
  });

  it('registrar como docente manda o tipoConta escolhido', async () => {
    api.post.and.resolveTo({ jwt: 'j', usuario: PROF });

    await auth.registrar('Marcos', 'm@exemplo.com', 'senha-de-oito', 'PROFESSOR');

    expect(api.post).toHaveBeenCalledWith('/auth/registrar', {
      nome: 'Marcos',
      email: 'm@exemplo.com',
      senha: 'senha-de-oito',
      tipoConta: 'PROFESSOR',
    });
    expect(auth.ehDocente()).toBeTrue();
  });

  it('restaurar atualiza tipo e status guardados pelo GET /eu, sem segurar a abertura', async () => {
    // O admin aprova com o app fechado: o status gravado no aparelho envelhece.
    storage.lerSessao.and.resolveTo({ jwt: 'jwt', usuario: PROF, turmaId: 't1' });
    let responder!: (p: Perfil) => void;
    api.get.and.returnValue(new Promise<Perfil>((r) => (responder = r)));

    await auth.restaurar();

    // Chegou aqui com o GET /eu ainda no ar: a abertura nao espera a rede.
    expect(api.get).toHaveBeenCalledWith('/eu');
    expect(auth.autenticado()).toBeTrue();
    expect(auth.usuario()!.docenteStatus).toBe('PENDENTE');

    responder({
      ...PROF,
      docenteStatus: 'APROVADO',
      adminPlataforma: false,
      temSenha: true,
    });
    await new Promise((r) => setTimeout(r));

    expect(auth.usuario()!.docenteStatus).toBe('APROVADO');
    expect(storage.gravarSessao).toHaveBeenCalledWith(
      'jwt',
      jasmine.objectContaining({ tipoConta: 'PROFESSOR', docenteStatus: 'APROVADO' }),
      't1',
    );
  });

  it('restaurar migra sessao antiga: sem tipoConta vira ALUNO depois do GET /eu', async () => {
    storage.lerSessao.and.resolveTo({ jwt: 'jwt', usuario: ALUNO, turmaId: 't1' });
    api.get.and.resolveTo({
      ...ALUNO,
      tipoConta: 'ALUNO',
      adminPlataforma: false,
      temSenha: true,
    });

    await auth.restaurar();
    await new Promise((r) => setTimeout(r));

    expect(auth.usuario()!.tipoConta).toBe('ALUNO');
  });

  it('GET /eu que falha nao desloga e mantem o ultimo tipo conhecido', async () => {
    // Sem rede ao abrir o app e o caso normal deste produto (snapshot offline).
    spyOn(console, 'warn');
    storage.lerSessao.and.resolveTo({ jwt: 'jwt', usuario: PROF, turmaId: 't1' });
    api.get.and.rejectWith(new Error('Sem conexão'));

    await auth.restaurar();
    await new Promise((r) => setTimeout(r));

    expect(auth.autenticado()).toBeTrue();
    expect(auth.usuario()).toEqual(PROF);
    expect(storage.gravarSessao).not.toHaveBeenCalled();
  });

  it('sair durante o GET /eu nao ressuscita a sessao', async () => {
    storage.lerSessao.and.resolveTo({ jwt: 'jwt', usuario: PROF, turmaId: 't1' });
    let responder!: (p: Perfil) => void;
    api.get.and.returnValue(new Promise<Perfil>((r) => (responder = r)));
    await auth.restaurar();

    await auth.sair();
    responder({
      ...PROF,
      docenteStatus: 'APROVADO',
      adminPlataforma: false,
      temSenha: true,
    });
    await new Promise((r) => setTimeout(r));

    expect(auth.autenticado()).toBeFalse();
    expect(storage.gravarSessao).not.toHaveBeenCalled();
  });

  it('renomear nao perde tipoConta nem docenteStatus da sessao', async () => {
    // Montar o usuario da sessao a mao ({id, nome, email}) derrubava o docente
    // para a interface de aluno a cada renomeacao.
    auth.definirSessao('jwt-velho', PROF, 't1');
    api.patch.and.resolveTo({
      jwt: 'jwt-novo',
      perfil: { ...PROF, nome: 'Marcos T.', adminPlataforma: false, temSenha: true },
    });

    await auth.atualizarNome('Marcos T.');

    expect(auth.usuario()).toEqual({ ...PROF, nome: 'Marcos T.' });
    expect(auth.ehDocente()).toBeTrue();
  });
});
