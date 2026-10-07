import { TestBed } from '@angular/core/testing';

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
