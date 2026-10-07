import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { erroHttpInterceptor } from '../../core/http-error.interceptor';
import { EditarTurmaPage } from './editar-turma.page';

const EU = { id: 'u1', nome: 'Otávio', email: 'voce@exemplo.com' };

const TURMA = {
  id: 't1',
  nome: 'Fans 2026.2',
  semestre: '2026.2',
  codigoConvite: '93EB9244',
  membros: [
    {
      usuarioId: 'u1',
      nome: 'Otávio',
      papel: 'LIDER',
      entrouEm: '2026-09-01T12:00:00Z',
    },
    {
      usuarioId: 'u2',
      nome: 'Ana',
      papel: 'ALUNO',
      entrouEm: '2026-09-01T13:00:00Z',
    },
  ],
};

describe('EditarTurmaPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<EditarTurmaPage>;
  let irPara: jasmine.Spy;
  const eu = signal<typeof EU | null>(EU);

  beforeEach(() => {
    eu.set(EU);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { usuario: eu, turmaId: () => 't1' } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    irPara = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(EditarTurmaPage);
  });

  afterEach(() => backend.verify());

  async function abrir(): Promise<void> {
    fixture.detectChanges();
    backend.expectOne(`${environment.apiUrl}/turmas/minha`).flush(TURMA);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function campo(nome: string): HTMLInputElement {
    return fixture.nativeElement.querySelector(`input[name="${nome}"]`);
  }

  it('abre preenchido com o que a turma tem hoje', async () => {
    await abrir();
    expect(campo('nome').value).toBe('Fans 2026.2');
    expect(campo('semestre').value).toBe('2026.2');
  });

  it('salvar manda nome e semestre, e o codigo NAO vai junto', async () => {
    // O código identifica a turma e está anotado no celular de todo mundo.
    // Mandá-lo aqui abriria a porta para trocá-lo na virada de semestre — e isso
    // expulsaria a turma inteira do próprio grupo.
    await abrir();
    campo('nome').value = 'Fans';
    campo('nome').dispatchEvent(new Event('input'));
    campo('semestre').value = '2027.1';
    campo('semestre').dispatchEvent(new Event('input'));
    (
      Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ) as HTMLButtonElement[]
    )
      .find((b) => b.textContent!.includes('Salvar'))!
      .click();

    const req = backend.expectOne(`${environment.apiUrl}/turmas/minha`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ nome: 'Fans', semestre: '2027.1' });
    expect(Object.keys(req.request.body as object)).not.toContain(
      'codigoConvite',
    );
    req.flush({ ...TURMA, nome: 'Fans', semestre: '2027.1' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(irPara).toHaveBeenCalledWith('/tabs/turma');
  });

  it('semestre vazio vai como null — turma sem periodo e valida', async () => {
    await abrir();
    campo('semestre').value = '';
    campo('semestre').dispatchEvent(new Event('input'));
    (
      Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ) as HTMLButtonElement[]
    )
      .find((b) => b.textContent!.includes('Salvar'))!
      .click();

    const req = backend.expectOne(`${environment.apiUrl}/turmas/minha`);
    expect((req.request.body as { semestre: unknown }).semestre).toBeNull();
    req.flush({ ...TURMA, semestre: null });
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('quem NAO e o lider nao ve o formulario', async () => {
    eu.set({ id: 'u2', nome: 'Ana', email: 'ana@exemplo.com' });
    await abrir();

    expect(campo('nome')).toBeNull();
    expect(fixture.nativeElement.textContent as string).toContain('só o líder');
  });

  it('nome em branco nao vai para o servidor', async () => {
    await abrir();
    campo('nome').value = '   ';
    campo('nome').dispatchEvent(new Event('input'));
    (
      Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ) as HTMLButtonElement[]
    )
      .find((b) => b.textContent!.includes('Salvar'))!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();

    backend.expectNone(`${environment.apiUrl}/turmas/minha`);
    expect(
      fixture.nativeElement.querySelector('.pf-erro')!.textContent,
    ).toContain('nome');
  });
});
