import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { environment } from '../../../environments/environment';
import { erroHttpInterceptor } from '../../core/http-error.interceptor';
import { StorageService } from '../../core/storage.service';
import type { SnapshotLocal } from '../../core/storage.service';
import type { Materia } from '../../data/models';
import { SyncRepository } from '../../data/sync.repository';
import { NovoEventoPage } from './novo-evento.page';

const BD: Materia = {
  id: 'm1',
  nome: 'Banco de Dados',
  sigla: 'BD',
  corHex: '#0369A1',
};
const CALC: Materia = {
  id: 'm2',
  nome: 'Cálculo 2',
  sigla: 'CALC2',
  corHex: '#1D4ED8',
};

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
  async mesclar(
    parcial: Partial<Omit<SnapshotLocal, 'ultimoSync'>>,
  ): Promise<void> {
    this.snapshot = {
      eventos: parcial.eventos ?? this.snapshot?.eventos ?? [],
      materias: parcial.materias ?? this.snapshot?.materias ?? [],
      ultimoSync: new Date().toISOString(),
    };
  }
}

/** Fica fora do beforeEach para o teste de edição poder mexer antes de criar. */
const rotaParams = new Map<string, string>();

describe('NovoEventoPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<NovoEventoPage>;
  let irPara: jasmine.Spy;
  let sync: jasmine.SpyObj<SyncRepository>;

  beforeEach(() => {
    // O `/sync` e do SyncRepository (testado a parte); aqui importa se a tela o
    // pede depois de salvar.
    sync = jasmine.createSpyObj<SyncRepository>('sync', ['reagendarAvisos']);
    sync.reagendarAvisos.and.resolveTo();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
        { provide: StorageService, useValue: new StorageFake() },
        { provide: SyncRepository, useValue: sync },
        // O `id` da rota é o que separa adicionar de editar. `Map` de propósito:
        // cada teste ajusta o seu, e o padrão (vazio) é o modo de adicionar.
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: rotaParams } },
        },
      ],
    });
    rotaParams.clear();
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
    (
      fixture.nativeElement.querySelector('.botao') as HTMLButtonElement
    ).click();
  }

  function erroNaTela(): string {
    const p = fixture.nativeElement.querySelector(
      '.pf-erro',
    ) as HTMLElement | null;
    return p === null ? '' : p.textContent!.trim();
  }

  it('sem materia cadastrada a tela explica e leva para criar materia', async () => {
    // Sem materia nao existe evento possivel, e um seletor vazio nao explica
    // nada — a pessoa fica olhando uma lista em branco sem saber o que fazer.
    await abrir((r) => r.flush([]));

    expect(fixture.nativeElement.querySelector('.chips-pick'))
      .withContext('seletor vazio nao pode aparecer')
      .toBeNull();
    expect(fixture.nativeElement.querySelector('button.botao'))
      .withContext(
        'nao ha o que cadastrar sem materia — e `button` porque a distincao real e essa',
      )
      .toBeNull();
    expect(
      fixture.nativeElement.querySelector('a[href="/tabs/materias/nova"]'),
    ).not.toBeNull();
  });

  it('falha ao buscar as materias NAO vira "nenhuma materia cadastrada"', async () => {
    await abrir((r) => r.error(new ProgressEvent('error')));

    expect(
      fixture.nativeElement.querySelector('.pf-aviso')!.textContent,
    ).toContain('Sem conexão');
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
      fixture.nativeElement.querySelector(
        '.seg button[data-tipo="ENTREGA"]',
      ) as HTMLButtonElement
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
      .flush(
        { detail: 'Deu ruim' },
        { status: 500, statusText: 'Server Error' },
      );
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

  it('depois de adicionar, baixa o /sync de novo (forcado) para o aviso do evento novo nascer', async () => {
    // Os lembretes saem de uma lista baixada ANTES deste evento existir. Sem
    // baixar de novo, o alarme marcado na tela seguinte era gravado, a tela
    // dizia "Vai tocar" e nada tocava.
    await abrir((r) => r.flush([BD]));
    preencher('Prova 2', '2026-09-10');
    cadastrar();
    expect(sync.reagendarAvisos).not.toHaveBeenCalled();

    backend.expectOne(`${environment.apiUrl}/eventos`).flush({ id: 'ev-9' });
    await assentar();

    expect(sync.reagendarAvisos).toHaveBeenCalledOnceWith(true);
    // Antes de navegar: a tela seguinte ja nasce com a lista nova a caminho.
    expect(sync.reagendarAvisos).toHaveBeenCalledBefore(irPara);
  });

  it('cadastro que falha nao baixa o /sync: nao ha evento novo', async () => {
    await abrir((r) => r.flush([BD]));
    preencher('Prova 1', '2026-09-10');
    cadastrar();
    backend
      .expectOne(`${environment.apiUrl}/eventos`)
      .flush({ detail: 'Deu ruim' }, { status: 500, statusText: 'Server Error' });
    await assentar();

    expect(sync.reagendarAvisos).not.toHaveBeenCalled();
  });

  it('em modo de edicao carrega o evento, preenche os campos e manda PATCH com If-Match', async () => {
    // A mesma página atende adicionar e editar porque é o MESMO formulário: seis
    // campos, a mesma validação, a mesma lista de matérias. Duas páginas seriam
    // 150 linhas de quase-cópia, e a cópia divergiria na primeira mudança de
    // campo — foi assim que a sala quase não entrou na edição.
    rotaParams.set('id', 'e1');

    const outra = TestBed.createComponent(NovoEventoPage);
    outra.detectChanges();

    // Duas: o componente do beforeEach já pediu as matérias, e este pede de
    // novo. Responder as duas é o que mantém o afterEach limpo.
    for (const r of backend.match(`${environment.apiUrl}/materias`))
      r.flush([BD, CALC]);
    backend.expectOne(`${environment.apiUrl}/eventos/e1`).flush({
      id: 'e1',
      tipo: 'ENTREGA',
      titulo: 'Lista 4',
      data: '2026-09-12',
      // Com segundos, como o LocalTime do backend chega de verdade.
      hora: '19:30:00',
      sala: 'A-101',
      materiaId: CALC.id,
      materiaSigla: CALC.sigla,
      materiaCorHex: CALC.corHex,
      autoria: {
        autorId: 'u1',
        autorNome: 'Otavio',
        criadoEm: '2026-08-30T12:00:00Z',
        atualizadoEm: '2026-08-30T12:00:00Z',
      },
      version: 3,
      visivelTurma: true,
      excluidoEm: null,
      materiais: [],
    });
    await outra.whenStable();
    outra.detectChanges();

    const campo = (sel: string) =>
      outra.nativeElement.querySelector(sel) as HTMLInputElement;
    expect(campo('input[type="text"]').value)
      .withContext('editar sem os campos preenchidos obriga a redigitar tudo')
      .toBe('Lista 4');
    expect(campo('input[type="date"]').value).toBe('2026-09-12');
    expect(campo('input[type="time"]').value)
      .withContext('sem o corte o campo mostra e devolve os segundos')
      .toBe('19:30');

    (
      Array.from(
        outra.nativeElement.querySelectorAll('button'),
      ) as HTMLButtonElement[]
    )
      .find((b) => b.textContent!.includes('Salvar'))!
      .click();

    const req = backend.expectOne(`${environment.apiUrl}/eventos/e1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.headers.get('If-Match'))
      .withContext('sem If-Match a edicao passa por cima da de outra pessoa')
      .toBe('3');
    expect(req.request.body.titulo).toBe('Lista 4');
    expect(req.request.body.hora).toBe('19:30');
    expect(req.request.body.sala)
      .withContext(
        'PATCH substitui o objeto inteiro: campo omitido vira null no servidor',
      )
      .toBe('A-101');
    req.flush({ id: 'e1' });
    await outra.whenStable();
    outra.detectChanges();

    expect(irPara).toHaveBeenCalledWith('/tabs/eventos/e1');
    // Mudar data ou hora muda quando os avisos tocam.
    expect(sync.reagendarAvisos).toHaveBeenCalledOnceWith(true);
  });
});
