import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { erroHttpInterceptor } from '../core/http-error.interceptor';
import { StorageService } from '../core/storage.service';
import type { SnapshotLocal } from '../core/storage.service';
import { environment } from '../../environments/environment';
import { PLUGIN_NOTIFICACOES } from '../notifications/notificacoes.service';
import type { PluginNotificacoes } from '../notifications/notificacoes.service';
import { HomeRepository } from './home.repository';
import type { ItemHome } from './models';

/**
 * Os dois primeiros testes existem porque replicar ordenacao ou teto no cliente e
 * a violacao mais provavel desta camada. O ultimo impede o pior bug possivel do
 * app: exibir "nao ha provas" quando a verdade e "falhei ao buscar as provas".
 */
function item(id: string, data: string, tipo: 'PROVA' | 'ENTREGA'): ItemHome {
  return {
    eventoId: id,
    tipo,
    titulo: `evento ${id}`,
    data,
    hora: null,
    materiaSigla: 'BD',
    materiaCorHex: '#0369A1',
    autoria: {
      autorId: 'u1',
      autorNome: 'Otavio',
      criadoEm: '2026-08-30T12:00:00Z',
      atualizadoEm: '2026-08-30T12:00:00Z',
    },
    feitoPeloUsuario: false,
  };
}

class StorageFake implements Pick<
  StorageService,
  'ler' | 'gravar' | 'limpar' | 'mesclar'
> {
  snapshot: SnapshotLocal | null = null;
  async ler(): Promise<SnapshotLocal | null> {
    return this.snapshot;
  }
  async gravar(s: SnapshotLocal): Promise<void> {
    this.snapshot = s;
  }
  async limpar(): Promise<void> {
    this.snapshot = null;
  }
  async mesclar(parcial: {
    eventos?: SnapshotLocal['eventos'];
  }): Promise<void> {
    this.snapshot = {
      eventos: parcial.eventos ?? this.snapshot?.eventos ?? [],
      materias: this.snapshot?.materias ?? [],
      ultimoSync: new Date().toISOString(),
    };
  }
}

describe('HomeRepository', () => {
  let backend: HttpTestingController;
  let repo: HomeRepository;
  let storage: StorageFake;

  beforeEach(() => {
    storage = new StorageFake();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
        { provide: StorageService, useValue: storage },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    repo = TestBed.inject(HomeRepository);
  });

  afterEach(() => backend.verify());

  it('HomeRepository preserva a ordem que o servidor devolveu', async () => {
    // Uma ENTREGA amanha antes de uma PROVA daqui a dez dias. Ordem e urgencia,
    // nunca tipo: se o cliente agrupar prova no topo, este teste vira vermelho.
    const doServidor = [
      item('entrega-amanha', '2026-08-31', 'ENTREGA'),
      item('prova-em-dez', '2026-09-09', 'PROVA'),
      item('entrega-depois', '2026-09-10', 'ENTREGA'),
    ];

    const pronto = repo.carregar();
    backend.expectOne(`${environment.apiUrl}/home`).flush(doServidor);
    await pronto;

    expect(repo.itens().map((i) => i.eventoId)).toEqual([
      'entrega-amanha',
      'prova-em-dez',
      'entrega-depois',
    ]);
    expect(repo.erro()).toBeNull();
  });

  it('HomeRepository nao corta nem reordena a lista', async () => {
    // Sete itens fora de ordem de data. O teto de 6 e a ordenacao sao do servidor:
    // o cliente entrega exatamente o que recebeu, inclusive quando parece errado.
    const doServidor = [
      item('a', '2026-09-05', 'ENTREGA'),
      item('b', '2026-09-01', 'PROVA'),
      item('c', '2026-09-03', 'ENTREGA'),
      item('d', '2026-09-02', 'PROVA'),
      item('e', '2026-09-07', 'ENTREGA'),
      item('f', '2026-09-04', 'PROVA'),
      item('g', '2026-09-06', 'ENTREGA'),
    ];

    const pronto = repo.carregar();
    backend.expectOne(`${environment.apiUrl}/home`).flush(doServidor);
    await pronto;

    expect(repo.itens().length).withContext('nao corta no teto de 6').toBe(7);
    expect(repo.itens().map((i) => i.eventoId)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
    ]);
  });

  it('erro de rede NAO devolve lista vazia como sucesso', async () => {
    storage.snapshot = null;

    const pronto = repo.carregar();
    backend
      .expectOne(`${environment.apiUrl}/home`)
      .error(new ProgressEvent('error'));
    await pronto;

    expect(repo.itens())
      .withContext('sem snapshot, nao ha o que mostrar')
      .toEqual([]);
    expect(repo.erro())
      .withContext(
        'lista vazia sem erro seria "nao ha provas" mentindo sobre "falhei ao buscar"',
      )
      .not.toBeNull();
    expect(repo.offline()).toBeTrue();
  });

  it('offline com snapshot serve o cache com a hora do ultimo sync', async () => {
    storage.snapshot = {
      eventos: [item('do-cache', '2026-09-01', 'PROVA')],
      materias: [],
      ultimoSync: '2026-08-30T09:15:00Z',
    };

    const pronto = repo.carregar();
    backend
      .expectOne(`${environment.apiUrl}/home`)
      .error(new ProgressEvent('error'));
    await pronto;

    expect(repo.itens().map((i) => i.eventoId)).toEqual(['do-cache']);
    expect(repo.offline()).toBeTrue();
    expect(repo.ultimoSync()).toBe('2026-08-30T09:15:00Z');
    expect(repo.erro()).not.toBeNull();
  });
});

describe('HomeRepository e os lembretes', () => {
  let backend: HttpTestingController;
  let repo: HomeRepository;
  let plugin: jasmine.SpyObj<PluginNotificacoes>;

  beforeEach(() => {
    // Com plugin: e o caso do aparelho, o unico em que o /sync e chamado.
    plugin = jasmine.createSpyObj<PluginNotificacoes>('plugin', [
      'checkPermissions',
      'getPending',
      'cancel',
      'schedule',
    ]);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
        { provide: StorageService, useValue: new StorageFake() },
        { provide: PLUGIN_NOTIFICACOES, useValue: plugin },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    repo = TestBed.inject(HomeRepository);
  });

  afterEach(() => backend.verify());

  it('o /sync sai junto com o /home, e a falha dele nao quebra a Home', async () => {
    spyOn(console, 'error');
    const pronto = repo.carregar();

    // Em paralelo: o /sync ja saiu antes de o /home responder.
    const sync = backend.expectOne(`${environment.apiUrl}/sync`);
    backend
      .expectOne(`${environment.apiUrl}/home`)
      .flush([item('a', '2026-09-01', 'PROVA')]);
    sync.error(new ProgressEvent('error'));
    await pronto;
    await new Promise((r) => setTimeout(r));

    expect(repo.itens().map((i) => i.eventoId)).toEqual(['a']);
    expect(repo.erro()).toBeNull();
    expect(repo.offline()).toBeFalse();
    // Falhou o /sync: os avisos de antes continuam — nada cancelado.
    expect(plugin.cancel).not.toHaveBeenCalled();
    expect(plugin.schedule).not.toHaveBeenCalled();
  });

  it('voltar para a Home em seguida nao baixa a turma inteira de novo', async () => {
    // Antes cada entrada na Home (e cada `resume`) baixava o /sync completo,
    // mesmo com o que ja estava agendado valendo.
    plugin.getPending.and.resolveTo({ notifications: [] });
    const sync = `${environment.apiUrl}/sync`;
    const turma = { eventosAlterados: [], materias: [], servidorEm: 'x' };

    const primeira = repo.carregar();
    backend.expectOne(sync).flush(turma);
    backend.expectOne(`${environment.apiUrl}/home`).flush([]);
    await primeira;
    // O /sync termina atras da Home; so conta como "bom" depois de entregue
    // aos lembretes, que e quando `getPending` (o cancelar) roda.
    for (let i = 0; i < 100 && plugin.getPending.calls.count() === 0; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    await new Promise((r) => setTimeout(r));

    const segunda = repo.carregar();
    backend.expectNone(sync);
    backend.expectOne(`${environment.apiUrl}/home`).flush([]);
    await segunda;
  });
});
