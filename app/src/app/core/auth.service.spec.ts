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
