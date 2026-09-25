import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ErroApi } from './http-error.interceptor';
import { INTERCEPTORES } from './interceptores';
import { TETO_DE_ESPERA_MS } from './timeout.interceptor';

describe('INTERCEPTORES (a lista que o main.ts usa)', () => {
  it('estourar o teto de espera vira ErroApi DEMOROU, nao TimeoutError cru', fakeAsync(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors(INTERCEPTORES)),
        provideHttpClientTesting(),
      ],
    });
    const backend = TestBed.inject(HttpTestingController);
    let erro: unknown = null;
    TestBed.inject(HttpClient)
      .get('/lento')
      .subscribe({ error: (e: unknown) => (erro = e) });

    const pendente = backend.expectOne('/lento');
    tick(TETO_DE_ESPERA_MS);

    expect(pendente.cancelled).withContext('o timeout cancela a requisicao').toBeTrue();
    expect(erro instanceof ErroApi).withContext(String(erro)).toBeTrue();
    expect((erro as ErroApi).classe).toBe('DEMOROU');
    expect((erro as ErroApi).podeTentarNovamente).toBeTrue();
    backend.verify();
  }));
});
