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
import { TransferirPage } from './transferir.page';

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
      nome: 'Ana Beatriz',
      papel: 'ALUNO',
      entrouEm: '2026-09-01T13:00:00Z',
    },
    {
      usuarioId: 'u3',
      nome: 'Bruno',
      papel: 'ALUNO',
      entrouEm: '2026-09-01T14:00:00Z',
    },
  ],
};

describe('TransferirPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<TransferirPage>;
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
        { provide: AuthService, useValue: { usuario: eu } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    irPara = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(TransferirPage);
  });

  afterEach(() => backend.verify());

  async function abrir(turma: object = TURMA): Promise<void> {
    fixture.detectChanges();
    backend.expectOne(`${environment.apiUrl}/turmas/minha`).flush(turma);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function pessoas(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.candidato'));
  }

  it('lista quem pode receber, e nunca voce mesmo', async () => {
    // Passar a liderança para si mesmo não é uma operação: é um botão que não
    // faz nada, e um botão que não faz nada ensina a desconfiar dos outros.
    await abrir();

    const nomes = pessoas().map((b) => b.textContent!);
    expect(nomes.length).toBe(2);
    expect(nomes.join(' ')).toContain('Ana Beatriz');
    expect(nomes.join(' ')).toContain('Bruno');
    expect(nomes.join(' ')).not.toContain('Otávio');
  });

  it('escolher alguem pergunta antes de trocar o cargo', async () => {
    await abrir();
    pessoas()[0].click();
    fixture.detectChanges();

    backend.expectNone(`${environment.apiUrl}/turmas/lideranca/transferir`);
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Ana Beatriz');
    expect(texto)
      .withContext('quem confirma precisa saber que perde o cargo na hora')
      .toContain('deixa de ser');
  });

  it('confirmado, manda o id de quem recebe e volta para a turma', async () => {
    await abrir();
    pessoas()[0].click();
    fixture.detectChanges();

    (
      Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ) as HTMLButtonElement[]
    )
      .find((b) => b.textContent!.includes('Passar a liderança'))!
      .click();

    const req = backend.expectOne(
      `${environment.apiUrl}/turmas/lideranca/transferir`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ novoLiderUsuarioId: 'u2' });
    req.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(irPara).toHaveBeenCalledWith('/tabs/turma');
  });

  it('quem NAO e o lider nao ve candidato nenhum', async () => {
    // O servidor recusa, mas oferecer a ação a quem vai levar 403 é convidar ao
    // erro e depois culpar a pessoa.
    eu.set({ id: 'u2', nome: 'Ana Beatriz', email: 'ana@exemplo.com' });
    await abrir();

    expect(pessoas().length).toBe(0);
    expect(fixture.nativeElement.textContent as string).toContain('só o líder');
  });

  it('falha ao transferir aparece na tela e o cargo nao muda', async () => {
    await abrir();
    pessoas()[0].click();
    fixture.detectChanges();
    (
      Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ) as HTMLButtonElement[]
    )
      .find((b) => b.textContent!.includes('Passar a liderança'))!
      .click();

    backend
      .expectOne(`${environment.apiUrl}/turmas/lideranca/transferir`)
      .flush(
        { detail: 'Servidor fora do ar.' },
        { status: 500, statusText: 'Server Error' },
      );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.pf-erro')).not.toBeNull();
    expect(irPara).not.toHaveBeenCalled();
  });
});
