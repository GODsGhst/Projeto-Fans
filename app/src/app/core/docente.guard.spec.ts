import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';

import { AuthService } from './auth.service';
import { rotaInicial, soAluno, soDocente } from './docente.guard';

describe('guardas de docente', () => {
  const eu = signal<object | null>(null);

  beforeEach(() => {
    eu.set(null);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { usuario: eu.asReadonly() } },
      ],
    });
  });

  function rodar(guarda: CanActivateFn): boolean | UrlTree {
    return TestBed.runInInjectionContext(
      () =>
        guarda({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot) as
          | boolean
          | UrlTree,
    );
  }

  function url(r: boolean | UrlTree): string | boolean {
    return r instanceof UrlTree ? TestBed.inject(Router).serializeUrl(r) : r;
  }

  it('docente, de qualquer status, entra pelo painel; aluno, pela Home', () => {
    eu.set({ id: 'u1', tipoConta: 'PROFESSOR', docenteStatus: 'PENDENTE' });
    expect(TestBed.runInInjectionContext(rotaInicial)).toBe('/tabs/painel');

    eu.set({ id: 'u1', tipoConta: 'COORDENADOR', docenteStatus: 'RECUSADO' });
    expect(TestBed.runInInjectionContext(rotaInicial)).toBe('/tabs/painel');

    eu.set({ id: 'u1', tipoConta: 'ALUNO' });
    expect(TestBed.runInInjectionContext(rotaInicial)).toBe('/tabs/home');

    // Sessao gravada antes da onda docente: sem tipoConta = aluno.
    eu.set({ id: 'u1' });
    expect(TestBed.runInInjectionContext(rotaInicial)).toBe('/tabs/home');
  });

  it('soAluno: o docente que cai em /tabs/home (login, voltar) vai para o painel', () => {
    eu.set({ id: 'u1', tipoConta: 'PROFESSOR', docenteStatus: 'PENDENTE' });
    expect(url(rodar(soAluno))).toBe('/tabs/painel');

    eu.set({ id: 'u1', tipoConta: 'ALUNO' });
    expect(rodar(soAluno)).toBeTrue();
  });

  it('soDocente: o aluno nao abre o painel (a API responderia 403)', () => {
    eu.set({ id: 'u1', tipoConta: 'ALUNO' });
    expect(url(rodar(soDocente))).toBe('/tabs/home');

    eu.set({ id: 'u1', tipoConta: 'COORDENADOR', docenteStatus: 'PENDENTE' });
    expect(rodar(soDocente)).toBeTrue();
  });
});
