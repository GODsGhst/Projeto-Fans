import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from './app.routes';
import { erroHttpInterceptor } from './core/http-error.interceptor';
import { StorageService } from './core/storage.service';
import { StorageFake, USUARIO } from './features/auth/auth-teste';

/**
 * A guarda das abas. Duas falhas possiveis e opostas: deixar entrar quem nao tem
 * sessao, e expulsar quem tem — esta segunda acontece quando a guarda roda antes
 * de `restaurar()` terminar, e transformaria toda reabertura do app num login.
 */
describe('rotas do app', () => {
  let router: Router;
  let storage: StorageFake;

  beforeEach(() => {
    storage = new StorageFake();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideIonicAngular(),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
        { provide: StorageService, useValue: storage },
      ],
    });
    router = TestBed.inject(Router);
  });

  it('quem nao esta autenticado e tenta uma rota de tabs vai para /login', async () => {
    await router.navigateByUrl('/tabs/home');
    expect(router.url).toBe('/login');
  });

  it('quem TEM sessao restaurada E turma nao e expulso no boot', async () => {
    storage.sessao = { jwt: 'jwt-123', usuario: USUARIO, turmaId: 't1' };

    await router.navigateByUrl('/tabs/home');
    expect(router.url).toBe('/tabs/home');
  });

  it('quem tem sessao e NAO tem turma vai para /entrar-turma, nunca para as abas', async () => {
    // O beco sem saida que este teste fecha: o cadastro grava a sessao em disco
    // ANTES de existir turma. Quem fechasse o app entre o cadastro e a entrada na
    // turma voltava autenticado e sem vinculo. Uma guarda que so olhasse o token
    // liberava as abas, e o TurmaScopeResolver respondia 404 em toda rota — sem
    // botao de sair e sem link para a tela de turma, so reinstalar resolvia.
    storage.sessao = { jwt: 'jwt-123', usuario: USUARIO };

    await router.navigateByUrl('/tabs/home');
    expect(router.url).toBe('/entrar-turma');
  });

  it('as telas de entrada ficam fora das abas', async () => {
    for (const rota of ['/login', '/cadastro', '/entrar-turma', '/recuperar']) {
      await router.navigateByUrl(rota);
      expect(router.url).withContext(`${rota} nao exige sessao`).toBe(rota);
    }
  });
});
