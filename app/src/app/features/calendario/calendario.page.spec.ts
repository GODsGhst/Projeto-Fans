import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { signal } from '@angular/core';

import { AuthService } from '../../core/auth.service';

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
        // `souLider` compara quem eu sou com os membros da turma. Sem isto o
        // AuthService real le do disco, devolve null, e o papel nunca resolve.
        {
          provide: AuthService,
          useValue: {
            usuario: signal({ id: 'u1', nome: 'Eu', email: 'eu@exemplo.com' }),
          },
        },
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
    papel: 'LIDER' | 'ALUNO' = 'ALUNO',
  ) {
    // O Ionic chama isto ao entrar na aba; o TestBed nao chama sozinho.
    fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
    responder(backend.expectOne((r) => r.url.endsWith('/eventos')));
    backend.expectOne((r) => r.url.endsWith('/notas')).flush(notas);
    // A tela tambem pergunta o papel: so o lider ve "Ocultar da turma". O papel
    // e lido a cada entrada, nunca guardado — a lideranca se transfere.
    const turma = backend.match((r) => r.url.endsWith('/turmas/minha'));
    for (const req of turma) {
      req.flush({
        id: 't1',
        nome: 'Fans',
        semestre: null,
        codigoConvite: 'X',
        membros: [
          {
            usuarioId: 'u1',
            nome: 'Eu',
            papel: papel,
            entrouEm: '2026-08-01T12:00:00Z',
          },
        ],
      });
    }
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
          visivelTurma: true,
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
          visivelTurma: true,
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
    for (const req of backend.match((r) => r.url.endsWith('/turmas/minha'))) {
      req.flush(null, { status: 500, statusText: 'Server Error' });
    }
    await fixture.whenStable();
    fixture.detectChanges();

    expect(titulos().length).toBe(1);
  });
  it('so o lider ve "Ocultar da turma" numa anotacao da turma', async () => {
    // O papel e lido a cada entrada, nunca guardado na sessao: a lideranca se
    // transfere, e uma sessao antiga ofereceria o botao a quem ja nao e lider.
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
          visivelTurma: true,
        },
      ],
      'LIDER',
    );

    expect(
      (
        Array.from(
          fixture.nativeElement.querySelectorAll('button'),
        ) as HTMLButtonElement[]
      ).find((b) => b.textContent!.includes('Ocultar da turma')),
    ).toBeDefined();
  });

  it('aluno comum nao ve o botao de ocultar', async () => {
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
          visivelTurma: true,
        },
      ],
      'ALUNO',
    );

    expect(
      (
        Array.from(
          fixture.nativeElement.querySelectorAll('button'),
        ) as HTMLButtonElement[]
      ).find((b) => b.textContent!.includes('Ocultar da turma')),
    ).toBeUndefined();
  });

  it('a minha anotacao oculta diz por que ninguem viu', async () => {
    // Sem este aviso o autor ve a anotacao normal e conclui que a turma
    // ignorou o recado — quando a turma nunca chegou a ver.
    await abrir(
      (r) => r.flush([]),
      [
        {
          id: 'n-minha',
          alcance: 'TURMA',
          data: '2026-08-13',
          texto: 'meu recado',
          autorId: 'u1',
          criadoEm: '2026-08-01T12:00:00Z',
          atualizadoEm: '2026-08-01T12:00:00Z',
          version: 0,
          visivelTurma: false,
        },
      ],
    );

    expect(fixture.nativeElement.textContent as string).toContain(
      'tirou esta anotação da lista',
    );
  });
});
