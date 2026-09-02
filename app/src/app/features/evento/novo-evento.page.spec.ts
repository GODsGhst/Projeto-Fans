import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { environment } from '../../../environments/environment';
import { erroHttpInterceptor } from '../../core/http-error.interceptor';
import { StorageService } from '../../core/storage.service';
import type { SnapshotLocal } from '../../core/storage.service';
import type { Materia } from '../../data/models';
import { NovoEventoPage } from './novo-evento.page';

const BD: Materia = { id: 'm1', nome: 'Banco de Dados', sigla: 'BD', corHex: '#0369A1' };
const CALC: Materia = { id: 'm2', nome: 'Cálculo 2', sigla: 'CALC2', corHex: '#1D4ED8' };

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
  async mesclar(parcial: Partial<Omit<SnapshotLocal, 'ultimoSync'>>): Promise<void> {
    this.snapshot = {
      eventos: parcial.eventos ?? this.snapshot?.eventos ?? [],
      materias: parcial.materias ?? this.snapshot?.materias ?? [],
      ultimoSync: new Date().toISOString(),
    };
  }
}

describe('NovoEventoPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<NovoEventoPage>;
  let irPara: jasmine.Spy;

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
    irPara = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(NovoEventoPage);
  });

  afterEach(() => backend.verify());

  async function assentar(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Abre a tela e responde o `GET /materias` que ela dispara. */
  async function abrir(
    responder: (r: ReturnType<HttpTestingController['expectOne']>) => void,
  ): Promise<void> {
    fixture.detectChanges();
    responder(backend.expectOne(`${environment.apiUrl}/materias`));
    await assentar();
  }

  function campo(rotulo: string): HTMLInputElement {
    return fixture.nativeElement.querySelector(`input[aria-label="${rotulo}"]`);
  }

  function preencher(titulo: string, data: string, hora = ''): void {
    campo('Título').value = titulo;
    campo('Data').value = data;
    campo('Hora').value = hora;
  }

  function cadastrar(): void {
    (fixture.nativeElement.querySelector('.botao') as HTMLButtonElement).click();
  }

  function erroNaTela(): string {
    const p = fixture.nativeElement.querySelector('.pf-erro') as HTMLElement | null;
    return p === null ? '' : p.textContent!.trim();
  }

  it('sem materia cadastrada a tela explica e leva para criar materia', async () => {
    // Sem materia nao existe evento possivel, e um seletor vazio nao explica
    // nada — a pessoa fica olhando uma lista em branco sem saber o que fazer.
    await abrir((r) => r.flush([]));

    expect(fixture.nativeElement.querySelector('.chips-pick'))
      .withContext('seletor vazio nao pode aparecer')
      .toBeNull();
    expect(fixture.nativeElement.querySelector('.botao'))
      .withContext('nao ha o que cadastrar sem materia')
      .toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/tabs/materias/nova"]')).not.toBeNull();
  });

  it('falha ao buscar as materias NAO vira "nenhuma materia cadastrada"', async () => {
    await abrir((r) => r.error(new ProgressEvent('error')));

    expect(fixture.nativeElement.querySelector('.pf-aviso')!.textContent).toContain('Sem conexão');
    expect(fixture.nativeElement.querySelector('a[href="/tabs/materias/nova"]'))
      .withContext('falhar ao perguntar nao e "a turma nao tem materia"')
      .toBeNull();
  });

  it('hora em branco vai como null — hora e opcional e comum', async () => {
    await abrir((r) => r.flush([BD, CALC]));

    preencher('Prova 2 — normalização', '2026-09-10');
    cadastrar();

    const req = backend.expectOne(`${environment.apiUrl}/eventos`);
    expect(req.request.body).toEqual({
      materiaId: 'm1',
      tipo: 'PROVA',
      titulo: 'Prova 2 — normalização',
      data: '2026-09-10',
      hora: null,
      sala: null,
    });

    req.flush({});
    await assentar();
    await assentar();
  });

  it('tipo, materia e hora escolhidos vao no corpo', async () => {
    await abrir((r) => r.flush([BD, CALC]));

    (
      fixture.nativeElement.querySelector('.seg button[data-tipo="ENTREGA"]') as HTMLButtonElement
    ).click();
    (
      fixture.nativeElement.querySelector(
        '.chips-pick button[data-materia="m2"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    preencher('Lista 4', '2026-09-12', '19:30');
    cadastrar();

    const req = backend.expectOne(`${environment.apiUrl}/eventos`);
    expect(req.request.body).toEqual({
      materiaId: 'm2',
      tipo: 'ENTREGA',
      titulo: 'Lista 4',
      data: '2026-09-12',
      hora: '19:30',
      sala: null,
    });

    req.flush({});
    await assentar();
    await assentar();
  });

  it('titulo ou data em branco nao vira requisicao', async () => {
    await abrir((r) => r.flush([BD]));

    preencher('   ', '2026-09-10');
    cadastrar();
    // OnPush: sem isto o erro existe no signal e nao no DOM.
    fixture.detectChanges();

    backend.expectNone(`${environment.apiUrl}/eventos`);
    expect(erroNaTela()).not.toBe('');
  });

  it('falha ao cadastrar aparece na tela e a pessoa fica onde esta', async () => {
    await abrir((r) => r.flush([BD]));

    preencher('Prova 1', '2026-09-10');
    cadastrar();
    backend
      .expectOne(`${environment.apiUrl}/eventos`)
      .flush({ detail: 'Deu ruim' }, { status: 500, statusText: 'Server Error' });
    await assentar();

    expect(erroNaTela()).not.toBe('');
    expect(irPara).not.toHaveBeenCalled();
  });

  it('depois de adicionar, abre a atividade criada', async () => {
    // Antes voltava para a Home, e a pessoa tinha de procurar o proprio registro
    // numa lista. Abrir o que ela acabou de descrever confirma que existe — e o
    // passo seguinte, anexar o material, esta nessa tela.
    await abrir((r) => r.flush([BD]));
    preencher('Prova 2', '2026-09-10');
    cadastrar();

    backend.expectOne(`${environment.apiUrl}/eventos`).flush({ id: 'ev-9' });
    await assentar();

    expect(irPara).toHaveBeenCalledWith('/tabs/eventos/ev-9');
  });
});
