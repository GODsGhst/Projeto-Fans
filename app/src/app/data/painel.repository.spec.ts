import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../environments/environment';
import { erroHttpInterceptor } from '../core/http-error.interceptor';
import type { Painel, TurmaDoPainel } from './docente.models';
import type { ItemHome } from './models';
import { PainelRepository } from './painel.repository';

const URL_PAINEL = `${environment.apiUrl}/painel`;

function item(id: string, data: string): ItemHome {
  return {
    eventoId: id,
    tipo: 'PROVA',
    titulo: `evento ${id}`,
    data,
    hora: null,
    materiaSigla: 'BD',
    materiaCorHex: '#0369A1',
    autoria: {
      autorId: 'u1',
      autorNome: 'Ana',
      criadoEm: '2026-10-01T12:00:00Z',
      atualizadoEm: '2026-10-01T12:00:00Z',
    },
    feitoPeloUsuario: false,
  };
}

function turma(id: string, proximos: ItemHome[]): TurmaDoPainel {
  return {
    turmaId: id,
    nome: `Turma ${id}`,
    papel: 'PROFESSOR',
    selo: 'PROFESSOR',
    contestado: false,
    lecionadas: [],
    proximos,
  };
}

describe('PainelRepository', () => {
  let backend: HttpTestingController;
  let repo: PainelRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    repo = TestBed.inject(PainelRepository);
  });

  afterEach(() => backend.verify());

  it('entrega turmas e proximos exatamente como o servidor mandou', async () => {
    // Fora de ordem de data e com 7 itens (o teto e 6): ordem, janela e teto sao
    // do servidor. Se o cliente "arrumar", este teste fica vermelho.
    const doServidor: Painel = {
      turmas: [
        turma('b', [item('z', '2026-10-09'), item('y', '2026-10-07')]),
        turma('a', [
          ...['1', '2', '3', '4', '5', '6', '7'].map((n) => item(n, '2026-10-08')),
        ]),
      ],
    };

    const pronto = repo.carregar();
    backend.expectOne(URL_PAINEL).flush(doServidor);
    await pronto;

    expect(repo.painel()!.turmas.map((t) => t.turmaId)).toEqual(['b', 'a']);
    expect(repo.painel()!.turmas[0].proximos.map((i) => i.eventoId)).toEqual([
      'z',
      'y',
    ]);
    expect(repo.painel()!.turmas[1].proximos.length).toBe(7);
    expect(repo.erro()).toBeNull();
    expect(repo.carregando()).toBeFalse();
  });

  it('falha NAO vira "nenhuma turma": o painel fica nulo e o erro aparece', async () => {
    const pronto = repo.carregar();
    backend.expectOne(URL_PAINEL).error(new ProgressEvent('error'));
    await pronto;

    expect(repo.painel())
      .withContext('lista vazia seria "voce nao tem turma" mentindo sobre "falhei"')
      .toBeNull();
    expect(repo.erro()).not.toBeNull();
  });

  it('falhar numa segunda carga mantem o painel que ja estava na tela', async () => {
    const primeira = repo.carregar();
    backend.expectOne(URL_PAINEL).flush({ turmas: [turma('a', [])] });
    await primeira;

    const segunda = repo.carregar();
    backend.expectOne(URL_PAINEL).error(new ProgressEvent('error'));
    await segunda;

    expect(repo.painel()!.turmas.map((t) => t.turmaId)).toEqual(['a']);
    expect(repo.erro()).not.toBeNull();
  });

  it('conta ALUNO (403) mostra a mensagem do servidor, sem painel', async () => {
    const pronto = repo.carregar();
    backend
      .expectOne(URL_PAINEL)
      .flush({ detail: 'Só docente tem painel.' }, { status: 403, statusText: 'Forbidden' });
    await pronto;

    expect(repo.painel()).toBeNull();
    expect(repo.erro()).toBe('Só docente tem painel.');
  });
});
