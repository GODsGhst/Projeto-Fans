import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { environment } from '../../../environments/environment';
import { erroHttpInterceptor } from '../../core/http-error.interceptor';
import { StorageService } from '../../core/storage.service';
import type { SnapshotLocal } from '../../core/storage.service';
import type { ItemHome } from '../../data/models';
import { HomePage } from './home.page';

function item(id: string, tipo: 'PROVA' | 'ENTREGA', data: string): ItemHome {
  return {
    eventoId: id,
    tipo,
    titulo: `evento ${id}`,
    data,
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
  };
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
  async mesclar(parcial: { eventos?: SnapshotLocal['eventos'] }): Promise<void> {
    this.snapshot = {
      eventos: parcial.eventos ?? this.snapshot?.eventos ?? [],
      materias: this.snapshot?.materias ?? [],
      ultimoSync: new Date().toISOString(),
    };
  }
}

describe('HomePage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<HomePage>;
  let storage: StorageFake;

  beforeEach(() => {
    storage = new StorageFake();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
        { provide: StorageService, useValue: storage },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HomePage);
  });

  afterEach(() => backend.verify());

  /** Cria a tela, responde o `GET /home` e espera o carregamento terminar. */
  async function abrir(responder: (r: ReturnType<HttpTestingController['expectOne']>) => void) {
    fixture.detectChanges();
    responder(backend.expectOne(`${environment.apiUrl}/home`));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function textos(seletor: string): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll(seletor)).map((e) =>
      (e as HTMLElement).textContent!.trim(),
    );
  }

  it('a pagina renderiza na ordem do repository', async () => {
    // Uma ENTREGA amanha antes de uma PROVA daqui a dez dias. Ordem e urgencia,
    // nunca tipo: se a pagina agrupar prova no topo, isto fica vermelho.
    await abrir((r) =>
      r.flush([
        item('entrega-amanha', 'ENTREGA', '2026-08-31'),
        item('prova-em-dez', 'PROVA', '2026-09-09'),
        item('entrega-depois', 'ENTREGA', '2026-09-10'),
      ]),
    );

    expect(textos('app-evento-card .titulo')).toEqual([
      'evento entrega-amanha',
      'evento prova-em-dez',
      'evento entrega-depois',
    ]);
    expect(fixture.nativeElement.querySelector('.pf-vazio')).toBeNull();
  });

  it('estado vazio aparece com lista vazia', async () => {
    await abrir((r) => r.flush([]));

    const vazio = fixture.nativeElement.querySelector('.pf-vazio') as HTMLElement | null;
    expect(vazio).not.toBeNull();
    expect(vazio!.textContent).toContain('Nada nos próximos 14 dias.');
    expect(fixture.nativeElement.querySelectorAll('app-evento-card').length).toBe(0);
    expect(fixture.nativeElement.querySelector('.pf-aviso'))
      .withContext('lista vazia de verdade nao mostra aviso de falha')
      .toBeNull();
  });

  it('banner offline aparece com erro de rede', async () => {
    // O pior bug possivel do app seria esta tela parecer com a de cima.
    storage.snapshot = {
      eventos: [item('do-cache', 'PROVA', '2026-09-01')],
      materias: [],
      ultimoSync: '2026-08-30T09:15:00Z',
    };

    await abrir((r) => r.error(new ProgressEvent('error')));

    const aviso = fixture.nativeElement.querySelector('.pf-aviso') as HTMLElement | null;
    expect(aviso).not.toBeNull();
    expect(aviso!.textContent).toContain('Sem conexão');
    expect(fixture.nativeElement.querySelector('.pf-vazio'))
      .withContext('falhar ao buscar NAO e "nao ha provas"')
      .toBeNull();
    expect(textos('app-evento-card .titulo')).toEqual(['evento do-cache']);
  });
  it('falha sem cache nao vira estado vazio', async () => {
    // A tela mais perigosa do app: sem snapshot nao ha o que mostrar, e a
    // tentacao e cair no estado vazio. "Nao ha provas" e "falhei ao buscar as
    // provas" sao telas diferentes, e esta e a segunda.
    storage.snapshot = null;

    await abrir((r) => r.error(new ProgressEvent('error')));

    expect(fixture.nativeElement.querySelector('.pf-aviso')!.textContent).toContain(
      'Sem conexão',
    );
    expect(fixture.nativeElement.querySelector('.pf-vazio'))
      .withContext('sem cache e sem rede, a tela admite a falha em vez de dizer que nao ha nada')
      .toBeNull();
    expect(fixture.nativeElement.querySelectorAll('app-evento-card').length).toBe(0);
  });

  it('a Home oferece cadastrar prova ou entrega, mesmo vazia', async () => {
    // O dono instalou o APK, entrou na turma e nao conseguiu cadastrar nada: o
    // app so lia. Esta e a porta que faltava.
    await abrir((r) => r.flush([]));

    expect(fixture.nativeElement.querySelector('a[href="/tabs/eventos/novo"]')).not.toBeNull();
  });
});
