import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { environment } from '../../../environments/environment';
import { erroHttpInterceptor } from '../../core/http-error.interceptor';
import { StorageService } from '../../core/storage.service';
import type { SnapshotLocal } from '../../core/storage.service';
import type { Materia } from '../../data/models';
import { MateriasPage } from './materias.page';

function materia(id: string, sigla: string, nome: string): Materia {
  return { id, nome, sigla, corHex: '#0369A1' };
}

class StorageFake implements Pick<StorageService, 'ler' | 'gravar' | 'limpar' | 'mesclar'> {
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
  async mesclar(parcial: { materias?: SnapshotLocal['materias'] }): Promise<void> {
    this.snapshot = {
      eventos: this.snapshot?.eventos ?? [],
      materias: parcial.materias ?? this.snapshot?.materias ?? [],
      ultimoSync: new Date().toISOString(),
    };
  }
}

describe('MateriasPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<MateriasPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
        { provide: StorageService, useValue: new StorageFake() },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MateriasPage);
  });

  afterEach(() => backend.verify());

  async function abrir(responder: (r: ReturnType<HttpTestingController['expectOne']>) => void) {
    fixture.detectChanges();
    responder(backend.expectOne(`${environment.apiUrl}/materias`));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function textos(seletor: string): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll(seletor)).map((e) =>
      (e as HTMLElement).textContent!.trim(),
    );
  }

  it('lista as materias na ordem que veio do servidor', async () => {
    await abrir((r) =>
      r.flush([
        materia('m1', 'BD', 'Banco de Dados'),
        materia('m2', 'CALC2', 'Cálculo 2'),
        materia('m3', 'REDES', 'Redes'),
      ]),
    );

    expect(textos('.nome')).toEqual(['Banco de Dados', 'Cálculo 2', 'Redes']);
    // Cor + sigla sempre juntas: nunca so a bolinha colorida.
    expect(textos('app-materia-chip')).toEqual(['BD', 'CALC2', 'REDES']);
    expect(fixture.nativeElement.querySelector('.pf-vazio')).toBeNull();
  });

  it('sem materia nenhuma a tela mostra o estado vazio', async () => {
    await abrir((r) => r.flush([]));

    expect(fixture.nativeElement.querySelector('.pf-vazio')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.pf-aviso'))
      .withContext('lista vazia de verdade nao mostra aviso de falha')
      .toBeNull();
  });

  it('falha ao buscar as materias nao vira "nao ha materias"', async () => {
    await abrir((r) => r.error(new ProgressEvent('error')));

    expect(fixture.nativeElement.querySelector('.pf-aviso')!.textContent).toContain(
      'Sem conexão',
    );
    expect(fixture.nativeElement.querySelector('.pf-vazio'))
      .withContext('falhar ao buscar NAO e "nao ha materias"')
      .toBeNull();
  });
});
