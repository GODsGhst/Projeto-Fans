import { TestBed } from '@angular/core/testing';

import { StorageService } from './storage.service';
import type { SnapshotLocal } from './storage.service';

describe('StorageService', () => {
  let storage: StorageService;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    storage = TestBed.inject(StorageService);
    await storage.limpar();
  });

  afterEach(async () => storage.limpar());

  it('StorageService faz round-trip de snapshot', async () => {
    const snapshot: SnapshotLocal = {
      eventos: [
        {
          eventoId: 'e1',
          tipo: 'PROVA',
          titulo: 'Prova 2 — normalizacao',
          data: '2026-09-01',
          hora: '19:00',
          materiaSigla: 'BD',
          materiaCorHex: '#0369A1',
          autoria: {
            autorId: 'u1',
            autorNome: 'Otavio',
            criadoEm: '2026-08-30T12:00:00Z',
            atualizadoEm: '2026-08-30T12:00:00Z',
          },
          feitoPeloUsuario: false,
        },
      ],
      materias: [
        { id: 'm1', nome: 'Banco de Dados', sigla: 'BD', corHex: '#0369A1' },
      ],
      ultimoSync: '2026-08-30T12:05:00Z',
    };

    expect(await storage.ler())
      .withContext('comeca vazio')
      .toBeNull();

    await storage.gravar(snapshot);
    expect(await storage.ler()).toEqual(snapshot);

    await storage.limpar();
    expect(await storage.ler()).toBeNull();
  });
});
