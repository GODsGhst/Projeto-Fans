import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { environment } from '../../../environments/environment';
import { erroHttpInterceptor } from '../../core/http-error.interceptor';
import { NovoMaterialPage } from './novo-material.page';

describe('NovoMaterialPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<NovoMaterialPage>;
  let irPara: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: new Map([['id', 'm1']]) } },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    // O TestBed nao registra as rotas do app; sem isto, toda navegacao bem
    // sucedida estoura "Cannot match any routes" e derruba o teste ao lado.
    irPara = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(NovoMaterialPage);
    fixture.detectChanges();
  });

  afterEach(() => backend.verify());

  function preencher(titulo: string, url: string): void {
    const campo = (nome: string) =>
      fixture.nativeElement.querySelector(`input[name="${nome}"]`) as HTMLInputElement;
    campo('titulo').value = titulo;
    campo('titulo').dispatchEvent(new Event('input'));
    campo('url').value = url;
    campo('url').dispatchEvent(new Event('input'));
  }

  function enviar(): void {
    (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
    ).find((b) => b.textContent!.includes('Adicionar'))!.click();
  }

  async function assentar(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('o material vai com a materia da rota, o tipo escolhido, o titulo e o link', async () => {
    preencher('Slides da aula 3', 'https://drive.google.com/arquivo');
    enviar();

    const req = backend.expectOne(`${environment.apiUrl}/materiais`);
    expect(req.request.body).toEqual({
      materiaId: 'm1',
      tipo: 'AULA',
      titulo: 'Slides da aula 3',
      url: 'https://drive.google.com/arquivo',
      dataAula: null,
    });
    req.flush({ id: 'x' });
    await assentar();
  });

  it('sem link nao envia nada — material sem link nao serve para estudar', async () => {
    // A API exige `url`: `arquivo_ref` (upload de arquivo) e a Task 15 e ainda
    // nao existe. Deixar passar em branco levaria um 400 em ingles, que nao diz
    // a quem esta na tela qual campo faltou.
    preencher('Slides da aula 3', '   ');
    enviar();
    await assentar();

    backend.expectNone(`${environment.apiUrl}/materiais`);
    expect(fixture.nativeElement.querySelector('.pf-erro')!.textContent).toContain('link');
  });

  it('link que nao e endereco nao vai para o servidor', async () => {
    preencher('Slides', 'drive.google.com/arquivo');
    enviar();
    await assentar();

    backend.expectNone(`${environment.apiUrl}/materiais`);
    expect(fixture.nativeElement.querySelector('.pf-erro')!.textContent).toContain('http');
  });

  it('depois de adicionar, volta para a materia', async () => {
    preencher('Slides', 'https://exemplo.com/a.pdf');
    enviar();
    backend.expectOne(`${environment.apiUrl}/materiais`).flush({ id: 'x' });
    await assentar();

    expect(irPara).toHaveBeenCalledWith('/tabs/materias/m1');
  });

  it('falha ao adicionar aparece na tela e a pessoa fica onde esta', async () => {
    preencher('Slides', 'https://exemplo.com/a.pdf');
    enviar();
    backend
      .expectOne(`${environment.apiUrl}/materiais`)
      .flush({ detail: 'Servidor fora do ar.' }, { status: 500, statusText: 'Server Error' });
    await assentar();

    expect(fixture.nativeElement.querySelector('.pf-erro')).not.toBeNull();
    expect(irPara).not.toHaveBeenCalled();
  });
});
