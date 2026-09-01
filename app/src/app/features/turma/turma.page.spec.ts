import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { environment } from '../../../environments/environment';
import { erroHttpInterceptor } from '../../core/http-error.interceptor';
import { TurmaPage } from './turma.page';

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

describe('TurmaPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<TurmaPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TurmaPage);
  });

  afterEach(() => backend.verify());

  async function abrir(
    responder: (r: ReturnType<HttpTestingController['expectOne']>) => void,
  ): Promise<void> {
    fixture.detectChanges();
    responder(backend.expectOne(`${environment.apiUrl}/turmas/minha`));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function textos(seletor: string): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll(seletor)).map((e) =>
      (e as HTMLElement).textContent!.trim(),
    );
  }

  it('mostra o codigo de convite em destaque, com botao de copiar', async () => {
    // O codigo e a unica coisa que separa a turma de qualquer pessoa com o link,
    // e tambem a unica forma de entrar nela. Ele nao pode ficar so no POST.
    await abrir((r) => r.flush(TURMA));

    expect(
      fixture.nativeElement.querySelector('[data-testid="codigo-convite"]')!.textContent!.trim(),
    ).toBe('93EB9244');
    expect(textos('button')).toContain('Copiar código');
  });

  it('lista quem esta na turma, com o lider marcado', async () => {
    await abrir((r) => r.flush(TURMA));

    expect(textos('.membro .nome')).toEqual(['Otávio', 'Ana Beatriz', 'Bruno']);
    // Lider e papel, nao posto: uma marca so, na pessoa certa.
    expect(textos('.membro .papel')).toEqual(['líder']);
  });

  it('falha ao carregar NAO vira turma vazia', async () => {
    await abrir((r) => r.error(new ProgressEvent('error')));

    expect(fixture.nativeElement.querySelector('.pf-aviso')!.textContent).toContain('Sem conexão');
    expect(fixture.nativeElement.querySelector('.membro'))
      .withContext('sem resposta nao ha lista de membros a mostrar')
      .toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="codigo-convite"]'))
      .withContext('codigo inventado seria pior que codigo nenhum')
      .toBeNull();
  });
});
