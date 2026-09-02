import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { environment } from '../../../environments/environment';
import { erroHttpInterceptor } from '../../core/http-error.interceptor';
import { AnexarMaterialPage } from './anexar-material.page';

const AUTORIA = {
  autorId: 'u1',
  autorNome: 'Otávio',
  criadoEm: '2026-08-30T12:00:00Z',
  atualizadoEm: '2026-08-30T12:00:00Z',
};

function material(id: string, titulo: string, tipo: 'AULA' | 'ADICIONAL' = 'AULA') {
  return {
    id,
    materiaId: 'm1',
    tipo,
    titulo,
    url: 'https://exemplo.com/a.pdf',
    arquivoRef: null,
    autoria: AUTORIA,
    version: 1,
    visivelTurma: true,
    excluidoEm: null,
  };
}

describe('AnexarMaterialPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<AnexarMaterialPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', 'e1']]) } } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AnexarMaterialPage);
  });

  afterEach(() => backend.verify());

  /** Abre a tela: ela pergunta a prova, descobre a materia, e pede os materiais dela. */
  async function abrir(jaAnexados: string[] = []): Promise<void> {
    fixture.detectChanges();
    backend.expectOne(`${environment.apiUrl}/eventos/e1`).flush({
      id: 'e1',
      materiaId: 'm1',
      tipo: 'PROVA',
      titulo: 'Prova 2',
      data: '2026-09-10',
      hora: null,
      materiaSigla: 'BD',
      materiaCorHex: '#0369A1',
      autoria: AUTORIA,
      version: 1,
      visivelTurma: true,
      excluidoEm: null,
      materiais: jaAnexados.map((id) => material(id, `anexado ${id}`)),
    });
    await fixture.whenStable();
    fixture.detectChanges();

    backend.expectOne(`${environment.apiUrl}/materias/m1`).flush({
      materia: { id: 'm1', nome: 'Banco de Dados', sigla: 'BD', corHex: '#0369A1' },
      materiaisAula: [material('mat-1', 'Slides da aula 3')],
      materiaisAdicionais: [material('mat-2', 'Lista extra', 'ADICIONAL')],
      eventos: [],
    });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function linhas(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.anexavel'));
  }

  it('lista o material da materia, nao o da turma inteira', async () => {
    await abrir();
    expect(linhas().length).toBe(2);
    expect(linhas()[0].textContent).toContain('Slides da aula 3');
  });

  it('tocar num material anexa ele a esta prova', async () => {
    await abrir();
    linhas()[0].click();

    const req = backend.expectOne(`${environment.apiUrl}/eventos/e1/materiais/mat-1`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(linhas()[0].getAttribute('aria-pressed'))
      .withContext('o que acabou de ser anexado tem de aparecer anexado')
      .toBe('true');
  });

  it('o que ja esta anexado aparece marcado, e tocar desanexa', async () => {
    await abrir(['mat-1']);
    expect(linhas()[0].getAttribute('aria-pressed')).toBe('true');

    linhas()[0].click();
    const req = backend.expectOne(`${environment.apiUrl}/eventos/e1/materiais/mat-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(linhas()[0].getAttribute('aria-pressed')).toBe('false');
  });

  it('materia sem material explica e leva para adicionar', async () => {
    fixture.detectChanges();
    backend.expectOne(`${environment.apiUrl}/eventos/e1`).flush({
      id: 'e1', materiaId: 'm1', tipo: 'PROVA', titulo: 'Prova 2', data: '2026-09-10',
      hora: null, materiaSigla: 'BD', materiaCorHex: '#0369A1', autoria: AUTORIA,
      version: 1, visivelTurma: true, excluidoEm: null, materiais: [],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    backend.expectOne(`${environment.apiUrl}/materias/m1`).flush({
      materia: { id: 'm1', nome: 'Banco de Dados', sigla: 'BD', corHex: '#0369A1' },
      materiaisAula: [], materiaisAdicionais: [], eventos: [],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(linhas().length).toBe(0);
    const link = fixture.nativeElement.querySelector('a[href="/tabs/materias/m1/material/novo"]');
    expect(link).withContext('nao ha o que anexar — tem de oferecer criar').not.toBeNull();
  });

  it('falha ao anexar aparece na tela e o estado nao muda', async () => {
    await abrir();
    linhas()[0].click();
    backend
      .expectOne(`${environment.apiUrl}/eventos/e1/materiais/mat-1`)
      .flush({ detail: 'Servidor fora do ar.' }, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.pf-erro')).not.toBeNull();
    expect(linhas()[0].getAttribute('aria-pressed'))
      .withContext('anexo que falhou nao pode parecer anexado')
      .toBe('false');
  });
});
