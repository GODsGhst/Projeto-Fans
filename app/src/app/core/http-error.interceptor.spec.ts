import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthService, ROTA_LOGIN } from './auth.service';
import { ErroApi, erroHttpInterceptor } from './http-error.interceptor';

describe('erroHttpInterceptor', () => {
  let backend: HttpTestingController;
  let http: HttpClient;
  let auth: AuthService;
  let irPara: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    http = TestBed.inject(HttpClient);
    auth = TestBed.inject(AuthService);
    irPara = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
  });

  afterEach(() => backend.verify());

  function capturar(url: string): { erro: ErroApi | null } {
    const capturado: { erro: ErroApi | null } = { erro: null };
    http.get(url).subscribe({
      next: () => fail('a resposta de erro nao pode chegar como sucesso'),
      error: (e: unknown) => {
        capturado.erro = e as ErroApi;
      },
    });
    return capturado;
  }

  it('interceptor de erro mapeia 401 para logout', () => {
    auth.definirSessao('jwt-de-teste', {
      id: 'u1',
      nome: 'Otavio',
      email: 'o@x.com',
    });
    expect(auth.token()).toBe('jwt-de-teste');

    const capturado = capturar('/protegido');
    backend
      .expectOne('/protegido')
      .flush(
        { detail: 'expirado' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(capturado.erro instanceof ErroApi).toBeTrue();
    expect(capturado.erro!.classe).toBe('AUTH');
    expect(auth.token()).withContext('401 limpa o token').toBeNull();
    expect(auth.usuario()).toBeNull();
    expect(irPara).toHaveBeenCalledWith(ROTA_LOGIN);
  });

  it('interceptor de erro mapeia 409 para conflito sinalizado', () => {
    const capturado = capturar('/eventos/1');
    backend
      .expectOne('/eventos/1')
      .flush(
        { detail: 'alguem editou isso' },
        { status: 409, statusText: 'Conflict' },
      );

    expect(capturado.erro instanceof ErroApi).toBeTrue();
    expect(capturado.erro!.classe).toBe('CONFLITO');
    expect(capturado.erro!.status).toBe(409);
    expect(capturado.erro!.recarregarRegistro)
      .withContext('409 avisa e manda recarregar o registro')
      .toBeTrue();
  });
});
