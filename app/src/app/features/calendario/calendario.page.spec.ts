import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
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

  async function abrir(
    responder: (r: ReturnType<HttpTestingController['expectOne']>) => void,
  ) {
    // O Ionic chama isto ao entrar na aba; o TestBed nao chama sozinho.
    fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
    responder(backend.expectOne((r) => r.url.endsWith('/eventos')));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function titulos(): string[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll(
        'app-evento-card .titulo',
      ) as NodeListOf<HTMLElement>,
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

    const aviso = fixture.nativeElement.querySelector(
      '.pf-aviso',
    ) as HTMLElement | null;
    expect(aviso).not.toBeNull();
    expect(aviso!.textContent).toContain('Sem conexão');
    expect(fixture.nativeElement.querySelector('.pf-vazio'))
      .withContext('erro e estado vazio sao telas diferentes')
      .toBeNull();
  });

  it('tocar num evento abre a tela dele', async () => {
    // Mesma porta que faltava na Home (A17). O calendario mostra o evento no
    // dia; tocar nele tem de levar ao evento.
    await abrir((r) =>
      r.flush([
        evento('c-1', 'PROVA', '2026-08-12'),
        evento('c-2', 'ENTREGA', '2026-08-19'),
      ]),
    );

    const destinos = Array.from(
      fixture.nativeElement.querySelectorAll(
        'a.ir',
      ) as NodeListOf<HTMLAnchorElement>,
    ).map((a) => a.getAttribute('href'));

    expect(destinos).toEqual(['/tabs/eventos/c-1', '/tabs/eventos/c-2']);
  });
});
