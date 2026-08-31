import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { erroHttpInterceptor } from '../../core/http-error.interceptor';
import type { Evento } from '../../data/models';
import { CalendarioPage } from './calendario.page';

function evento(id: string, tipo: 'PROVA' | 'ENTREGA', data: string): Evento {
  return {
    id,
    tipo,
    titulo: `evento ${id}`,
    data,
    hora: null,
    materiaId: 'm1',
    materiaSigla: 'BD',
    materiaCorHex: '#0369A1',
    autoria: {
      autorId: 'u1',
      autorNome: 'Otavio',
      criadoEm: '2026-08-30T12:00:00Z',
      atualizadoEm: '2026-08-30T12:00:00Z',
    },
    version: 1,
    visivelTurma: true,
    excluidoEm: null,
  };
}

describe('CalendarioPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<CalendarioPage>;

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
    fixture = TestBed.createComponent(CalendarioPage);
  });

  afterEach(() => backend.verify());

  async function abrir(responder: (r: ReturnType<HttpTestingController['expectOne']>) => void) {
    fixture.detectChanges();
    responder(backend.expectOne((r) => r.url.endsWith('/eventos')));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function titulos(): string[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('app-evento-card .titulo') as NodeListOf<HTMLElement>,
    ).map((e) => e.textContent!.trim());
  }

  it('o calendario renderiza o periodo na ordem que o servidor devolveu', async () => {
    await abrir((r) =>
      r.flush([
        evento('entrega-cedo', 'ENTREGA', '2026-08-03'),
        evento('prova-depois', 'PROVA', '2026-08-19'),
      ]),
    );

    expect(titulos()).toEqual(['evento entrega-cedo', 'evento prova-depois']);
  });

  it('falha ao carregar o calendario nao vira mes vazio', async () => {
    await abrir((r) => r.error(new ProgressEvent('error')));

    const aviso = fixture.nativeElement.querySelector('.pf-aviso') as HTMLElement | null;
    expect(aviso).not.toBeNull();
    expect(aviso!.textContent).toContain('Sem conexão');
    expect(fixture.nativeElement.querySelector('.pf-vazio'))
      .withContext('erro e estado vazio sao telas diferentes')
      .toBeNull();
  });
});
