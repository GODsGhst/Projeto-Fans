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
    // As anotacoes saem na mesma entrada da aba. O padrao e lista vazia: quem
    // testa evento nao devia ter de saber que a tela tambem carrega nota.
    notas: unknown[] = [],
  ) {
    // O Ionic chama isto ao entrar na aba; o TestBed nao chama sozinho.
    fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
    responder(backend.expectOne((r) => r.url.endsWith('/eventos')));
    backend.expectOne((r) => r.url.endsWith('/notas')).flush(notas);
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
  it('a anotacao da turma aparece assinada; a minha, tocavel para editar', async () => {
    // O servidor so assina a nota da TURMA, e a pessoal que ele devolve e
    // sempre a de quem perguntou. Entao "veio sem assinatura" ja significa
    // "e minha" — a tela nao precisa saber quem ela e.
    await abrir(
      (r) => r.flush([]),
      [
        {
          id: 'n-turma',
          alcance: 'TURMA',
          data: '2026-08-12',
          texto: 'aula cancelada quinta',
          autorId: 'u2',
          autorNome: 'Ana',
          criadoEm: '2026-08-01T12:00:00Z',
          atualizadoEm: '2026-08-01T12:00:00Z',
          version: 0,
        },
        {
          id: 'n-minha',
          alcance: 'PESSOAL',
          data: '2026-08-13',
          texto: 'estudar cap 4',
          autorId: 'u1',
          criadoEm: '2026-08-01T12:00:00Z',
          atualizadoEm: '2026-08-01T12:00:00Z',
          version: 0,
        },
      ],
    );

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('aula cancelada quinta');
    expect(texto).toContain('estudar cap 4');
    expect(texto).toContain('Ana');

    // So a minha leva para a tela de editar. A da turma e de quem escreveu.
    const paraEditar = Array.from(
      fixture.nativeElement.querySelectorAll(
        'a.ir',
      ) as NodeListOf<HTMLAnchorElement>,
    )
      .map((a) => a.getAttribute('href'))
      .filter((h) => h!.includes('/notas/'));
    expect(paraEditar).toEqual(['/tabs/notas/n-minha/editar']);
  });

  it('falha ao carregar anotacao nao apaga os eventos do mes', async () => {
    fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
    backend
      .expectOne((r) => r.url.endsWith('/eventos'))
      .flush([evento('c-1', 'PROVA', '2026-08-12')]);
    backend
      .expectOne((r) => r.url.endsWith('/notas'))
      .flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(titulos().length).toBe(1);
  });
});
