import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { erroHttpInterceptor } from '../../core/http-error.interceptor';
import { EditarMaterialPage } from './editar-material.page';

const MATERIAL = {
  id: 'mat-1',
  tipo: 'AULA',
  titulo: 'Slides da aula 3',
  url: 'https://drive.google.com/a.pdf',
  arquivoRef: null,
  dataAula: '2026-09-02',
  materiaId: 'm1',
  autoria: {
    autorId: 'u1',
    autorNome: 'Otávio',
    criadoEm: '2026-09-01T12:00:00Z',
    atualizadoEm: '2026-09-01T12:00:00Z',
  },
  version: 2,
  visivelTurma: true,
  excluidoEm: null,
};

describe('EditarMaterialPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<EditarMaterialPage>;
  let irPara: jasmine.Spy;
  const eu = signal<{ id: string; nome: string; email: string } | null>({
    id: 'u1',
    nome: 'Otávio',
    email: 'voce@exemplo.com',
  });

  beforeEach(() => {
    eu.set({ id: 'u1', nome: 'Otávio', email: 'voce@exemplo.com' });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { usuario: eu } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: new Map([['id', 'mat-1']]) } },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    irPara = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(EditarMaterialPage);
  });

  afterEach(() => backend.verify());

  async function abrir(material: object = MATERIAL): Promise<void> {
    fixture.detectChanges();
    backend.expectOne(`${environment.apiUrl}/materiais/mat-1`).flush(material);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function botao(texto: string): HTMLButtonElement | undefined {
    return (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
    ).find((b) => b.textContent!.includes(texto));
  }

  it('preenche os campos com o que ja existe', async () => {
    // Editar sem prefill obriga a redigitar tudo — e quem esquecer um campo o
    // apaga, porque PATCH aqui SUBSTITUI o objeto inteiro.
    await abrir();

    expect(
      (fixture.nativeElement.querySelector('input[name="titulo"]') as HTMLInputElement).value,
    ).toBe('Slides da aula 3');
    expect(
      (fixture.nativeElement.querySelector('input[name="url"]') as HTMLInputElement).value,
    ).toBe('https://drive.google.com/a.pdf');
    expect(
      (fixture.nativeElement.querySelector('input[name="dataAula"]') as HTMLInputElement).value,
    ).toBe('2026-09-02');
  });

  it('salvar manda o objeto inteiro com If-Match', async () => {
    await abrir();
    botao('Salvar')!.click();

    const req = backend.expectOne(`${environment.apiUrl}/materiais/mat-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.headers.get('If-Match')).toBe('2');
    expect(req.request.body).toEqual({
      materiaId: 'm1',
      tipo: 'AULA',
      titulo: 'Slides da aula 3',
      url: 'https://drive.google.com/a.pdf',
      dataAula: '2026-09-02',
    });
    req.flush({ id: 'mat-1' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(irPara).toHaveBeenCalledWith('/tabs/materias/m1');
  });

  it('apagar pergunta antes e usa If-Match', async () => {
    await abrir();
    botao('Apagar')!.click();
    fixture.detectChanges();
    backend.expectNone(`${environment.apiUrl}/materiais/mat-1`);

    botao('Sim, apagar')!.click();
    const req = backend.expectOne(`${environment.apiUrl}/materiais/mat-1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.headers.get('If-Match')).toBe('2');
    req.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('quem NAO e o autor nao edita nem apaga', async () => {
    eu.set({ id: 'outra', nome: 'Ana', email: 'ana@exemplo.com' });
    await abrir();

    expect(botao('Salvar')).toBeUndefined();
    expect(botao('Apagar')).toBeUndefined();
    expect(fixture.nativeElement.textContent as string).toContain('quem criou');
  });

  it('link invalido nao vai para o servidor', async () => {
    await abrir();
    const url = fixture.nativeElement.querySelector('input[name="url"]') as HTMLInputElement;
    url.value = 'drive.google.com/sem-esquema';
    url.dispatchEvent(new Event('input'));
    botao('Salvar')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    backend.expectNone(`${environment.apiUrl}/materiais/mat-1`);
    expect(fixture.nativeElement.querySelector('.pf-erro')!.textContent).toContain('http');
  });
});
