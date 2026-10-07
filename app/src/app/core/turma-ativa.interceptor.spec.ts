import {
  HttpClient,
  HttpInterceptorFn,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Preferences } from '@capacitor/preferences';
import { provideRouter } from '@angular/router';

import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { INTERCEPTORES } from './interceptores';
import { StorageService } from './storage.service';
import { CABECALHO_TURMA, turmaAtivaInterceptor } from './turma-ativa.interceptor';

const CHAVE = 'pf.turmaAtiva';
const DOCENTE = { id: 'u1', tipoConta: 'PROFESSOR' };
const ALUNO = { id: 'u1', tipoConta: 'ALUNO' };

describe('turmaAtivaInterceptor', () => {
  const eu = signal<object | null>(DOCENTE);
  let backend: HttpTestingController;
  let http: HttpClient;

  /** `lista` e a que o main.ts usa: prova tambem que o interceptor esta REGISTRADO. */
  function montar(lista: HttpInterceptorFn[]): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors(lista)),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { usuario: eu.asReadonly(), token: signal('jwt') },
        },
        { provide: StorageService, useValue: { limpar: async () => undefined } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    http = TestBed.inject(HttpClient);
  }

  /** Deixa a espera pelo disco terminar antes de olhar a requisicao. */
  const assentar = () => new Promise<void>((r) => setTimeout(r, 20));

  beforeEach(async () => {
    eu.set(DOCENTE);
    await Preferences.set({
      key: CHAVE,
      value: JSON.stringify({ usuarioId: 'u1', turmaId: 't9', nome: 'ADS 3A' }),
    });
  });

  afterEach(async () => {
    backend.verify();
    await Preferences.remove({ key: CHAVE });
  });

  it('docente: manda X-Turma-Id da turma ativa, mesmo quando o disco ainda nao respondeu', async () => {
    montar([turmaAtivaInterceptor]);

    // A primeira requisicao do app sai ANTES de o disco ser lido. Sem a espera
    // pelo `pronto` ela iria sem o cabecalho, e o servidor responderia pela turma
    // "mais recente" — dado de outra turma, sem erro.
    http.get(`${environment.apiUrl}/calendario`).subscribe();
    await assentar();

    const req = backend.expectOne(`${environment.apiUrl}/calendario`);
    expect(req.request.headers.get(CABECALHO_TURMA)).toBe('t9');
    req.flush([]);
  });

  it('aluno NUNCA manda o cabecalho, nem com uma turma ativa guardada no aparelho', async () => {
    eu.set(ALUNO);
    montar([turmaAtivaInterceptor]);

    http.get(`${environment.apiUrl}/home`).subscribe();
    await assentar();

    const req = backend.expectOne(`${environment.apiUrl}/home`);
    expect(req.request.headers.has(CABECALHO_TURMA)).toBeFalse();
    req.flush([]);
  });

  it('sessao antiga, sem tipoConta, e aluno: sem cabecalho', async () => {
    eu.set({ id: 'u1' });
    montar([turmaAtivaInterceptor]);

    http.get(`${environment.apiUrl}/home`).subscribe();
    await assentar();

    const req = backend.expectOne(`${environment.apiUrl}/home`);
    expect(req.request.headers.has(CABECALHO_TURMA)).toBeFalse();
    req.flush([]);
  });

  it('para fora da API o cabecalho nao vai (vazaria o id da turma a um terceiro)', async () => {
    montar([turmaAtivaInterceptor]);

    http.get('https://terceiro.exemplo/qualquer-coisa').subscribe();
    await assentar();

    const req = backend.expectOne('https://terceiro.exemplo/qualquer-coisa');
    expect(req.request.headers.has(CABECALHO_TURMA)).toBeFalse();
    req.flush({});
  });

  it('docente sem turma ativa ainda: sem cabecalho (o servidor usa o vinculo mais recente)', async () => {
    await Preferences.remove({ key: CHAVE });
    montar([turmaAtivaInterceptor]);

    http.get(`${environment.apiUrl}/painel`).subscribe();
    await assentar();

    const req = backend.expectOne(`${environment.apiUrl}/painel`);
    expect(req.request.headers.has(CABECALHO_TURMA)).toBeFalse();
    req.flush({ turmas: [] });
  });

  it('esta registrado na lista que o main.ts usa, junto do Authorization', async () => {
    montar(INTERCEPTORES);

    http.get(`${environment.apiUrl}/calendario`).subscribe();
    await assentar();

    const req = backend.expectOne(`${environment.apiUrl}/calendario`);
    expect(req.request.headers.get(CABECALHO_TURMA)).toBe('t9');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt');
    req.flush([]);
  });
});
