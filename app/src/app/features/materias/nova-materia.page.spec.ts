import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { environment } from '../../../environments/environment';
import { erroHttpInterceptor } from '../../core/http-error.interceptor';
import { StorageService } from '../../core/storage.service';
import type { SnapshotLocal } from '../../core/storage.service';
import { NovaMateriaPage, PALETA } from './nova-materia.page';

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
    materias?: SnapshotLocal['materias'];
  }): Promise<void> {
    this.snapshot = {
      eventos: this.snapshot?.eventos ?? [],
      materias: parcial.materias ?? this.snapshot?.materias ?? [],
      ultimoSync: new Date().toISOString(),
    };
  }
}

describe('NovaMateriaPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<NovaMateriaPage>;
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
    fixture = TestBed.createComponent(NovaMateriaPage);
    fixture.detectChanges();
  });

  afterEach(() => backend.verify());

  function cores(): HTMLButtonElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.cores-pick button'),
    );
  }

  function preencher(nome: string, sigla: string): void {
    const campoNome = fixture.nativeElement.querySelector(
      'input[aria-label="Nome da matéria"]',
    ) as HTMLInputElement;
    const campoSigla = fixture.nativeElement.querySelector(
      'input[aria-label="Sigla"]',
    ) as HTMLInputElement;
    campoNome.value = nome;
    campoSigla.value = sigla;
  }

  function criar(): void {
    (
      fixture.nativeElement.querySelector('.botao') as HTMLButtonElement
    ).click();
  }

  async function assentar(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function erroNaTela(): string {
    const p = fixture.nativeElement.querySelector(
      '.pf-erro',
    ) as HTMLElement | null;
    return p === null ? '' : p.textContent!.trim();
  }

  it('a grade traz as 12 cores da paleta, e nenhuma outra', () => {
    // O backend recusa qualquer hex fora da paleta com 400. Um seletor livre de
    // cor produziria uma sigla ilegivel e o dano seria permanente: cor de
    // materia se escolhe uma vez e fica.
    expect(PALETA.length).toBe(12);
    expect(cores().length).toBe(12);
    expect(cores().map((b) => b.getAttribute('data-cor'))).toEqual(
      PALETA.map((c) => c.hex),
    );
  });

  it('a cor escolhida ganha anel, e so uma por vez', () => {
    cores()[4].click();
    fixture.detectChanges();

    const marcadas = cores().filter(
      (b) => b.getAttribute('aria-pressed') === 'true',
    );
    expect(marcadas.length).toBe(1);
    expect(marcadas[0].getAttribute('data-cor')).toBe(PALETA[4].hex);
  });

  it('envia nome, sigla em caixa alta e a cor escolhida', async () => {
    preencher('  Banco de Dados  ', ' bd ');
    cores()[1].click();
    fixture.detectChanges();
    criar();

    const req = backend.expectOne(`${environment.apiUrl}/materias`);
    expect(req.request.body).toEqual({
      nome: 'Banco de Dados',
      sigla: 'BD',
      corHex: PALETA[1].hex,
      sala: null,
      professor: null,
    });

    req.flush({
      id: 'm1',
      nome: 'Banco de Dados',
      sigla: 'BD',
      corHex: PALETA[1].hex,
    });
    await assentar();

    backend
      .expectOne(
        (r) => r.method === 'GET' && r.url === `${environment.apiUrl}/materias`,
      )
      .flush([]);
    await assentar();
  });

  it('campo em branco nao vira requisicao', () => {
    preencher('  ', 'BD');
    criar();
    // OnPush: sem isto o erro existe no signal e nao no DOM.
    fixture.detectChanges();

    backend.expectNone(`${environment.apiUrl}/materias`);
    expect(erroNaTela()).not.toBe('');
    expect(irPara).not.toHaveBeenCalled();
  });

  it('sigla repetida na turma mostra a mensagem do servidor', async () => {
    preencher('Banco de Dados', 'BD');
    criar();

    backend
      .expectOne(`${environment.apiUrl}/materias`)
      .flush(
        { detail: 'Ja existe uma materia com a sigla BD nesta turma.' },
        { status: 409, statusText: 'Conflict' },
      );
    await assentar();

    expect(erroNaTela()).toContain('sigla BD');
    expect(irPara)
      .withContext('quem levou 409 continua na tela para corrigir a sigla')
      .not.toHaveBeenCalled();
  });

  it('depois de criar, a lista de materias e recarregada antes de voltar', async () => {
    // Voltar para uma tela que ainda diz "nenhuma materia cadastrada" faz a
    // pessoa cadastrar de novo.
    preencher('Redes', 'REDES');
    criar();

    backend.expectOne(`${environment.apiUrl}/materias`).flush({
      id: 'm9',
      nome: 'Redes',
      sigla: 'REDES',
      corHex: PALETA[0].hex,
    });
    await assentar();

    backend
      .expectOne(
        (r) => r.method === 'GET' && r.url === `${environment.apiUrl}/materias`,
      )
      .flush([
        { id: 'm9', nome: 'Redes', sigla: 'REDES', corHex: PALETA[0].hex },
      ]);
    await assentar();
    // Mais um: depois do GET o repositorio ainda grava o snapshot,
    // e essa promessa nao e rastreada pelo whenStable.
    await assentar();

    expect(irPara).toHaveBeenCalledWith('/tabs/materias');
    expect(erroNaTela()).toBe('');
  });
});

/**
 * A mesma pagina edita a materia (so o lider): o `id` na rota liga o modo. Mesmo
 * formulario, mesma paleta — o que muda e de onde vem o valor inicial e para onde
 * vai o botao.
 */
describe('NovaMateriaPage (editar)', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<NovaMateriaPage>;
  let irPara: jasmine.Spy;
  const URL_MATERIA = `${environment.apiUrl}/materias/m1`;

  const DETALHE = {
    materia: {
      id: 'm1',
      nome: 'Banco de Dados',
      sigla: 'BD',
      corHex: PALETA[3].hex,
      sala: 'B-204',
      professor: 'prof. Marcos',
    },
    materiaisAula: [],
    materiaisAdicionais: [],
    eventos: [],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
        { provide: StorageService, useValue: new StorageFake() },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'm1' }) } },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    irPara = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(NovaMateriaPage);
  });

  afterEach(() => backend.verify());

  async function assentar(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function abrir(): Promise<void> {
    fixture.detectChanges();
    backend.expectOne(URL_MATERIA).flush(DETALHE);
    await assentar();
  }

  function campo(rotulo: string): HTMLInputElement {
    return fixture.nativeElement.querySelector(
      `input[aria-label="${rotulo}"]`,
    ) as HTMLInputElement;
  }

  function salvar(): void {
    (fixture.nativeElement.querySelector('.botao') as HTMLButtonElement).click();
  }

  function erroNaTela(): string {
    const p = fixture.nativeElement.querySelector(
      '.pf-erro',
    ) as HTMLElement | null;
    return p === null ? '' : p.textContent!.trim();
  }

  it('abre com os valores atuais e a cor atual marcada, como "Editar matéria"', async () => {
    await abrir();

    expect(campo('Nome da matéria').value).toBe('Banco de Dados');
    expect(campo('Sigla').value).toBe('BD');
    expect(campo('Sala habitual').value).toBe('B-204');
    expect(campo('Professor').value).toBe('prof. Marcos');
    const marcadas = Array.from(
      fixture.nativeElement.querySelectorAll('.cores-pick button'),
    ).filter(
      (b) => (b as HTMLElement).getAttribute('aria-pressed') === 'true',
    ) as HTMLElement[];
    expect(marcadas.map((b) => b.getAttribute('data-cor'))).toEqual([
      PALETA[3].hex,
    ]);
    expect(fixture.nativeElement.textContent).toContain('Editar matéria');
    expect(fixture.nativeElement.querySelector('.botao').textContent.trim())
      .toBe('Salvar');
  });

  it('a paleta e a mesma de cadastrar: 12 cores', async () => {
    await abrir();

    expect(
      fixture.nativeElement.querySelectorAll('.cores-pick button').length,
    ).toBe(PALETA.length);
  });

  it('nao mostra o formulario antes de ler a materia: salvar em branco apagaria tudo', () => {
    fixture.detectChanges();

    expect(campo('Nome da matéria')).toBeNull();
    expect(fixture.nativeElement.querySelector('.botao')).toBeNull();
    backend.expectOne(URL_MATERIA).flush(DETALHE);
  });

  it('falha ao ler a materia mostra o erro e nao oferece formulario', async () => {
    fixture.detectChanges();
    backend
      .expectOne(URL_MATERIA)
      .flush(null, { status: 500, statusText: 'Server Error' });
    await assentar();

    expect(erroNaTela()).not.toBe('');
    expect(campo('Nome da matéria')).toBeNull();
  });

  it('salvar manda PATCH com os cinco campos, recarrega a lista e volta para a materia', async () => {
    await abrir();
    campo('Nome da matéria').value = '  Banco de Dados II ';
    campo('Sigla').value = 'bd2';
    campo('Sala habitual').value = '';
    (
      fixture.nativeElement.querySelectorAll(
        '.cores-pick button',
      )[7] as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    salvar();

    const req = backend.expectOne(URL_MATERIA);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.headers.has('If-Match'))
      .withContext('materia nao tem version: nada de If-Match')
      .toBeFalse();
    expect(req.request.body).toEqual({
      nome: 'Banco de Dados II',
      sigla: 'BD2',
      corHex: PALETA[7].hex,
      sala: null,
      professor: 'prof. Marcos',
    });
    req.flush({ id: 'm1', nome: 'Banco de Dados II', sigla: 'BD2', corHex: PALETA[7].hex });
    await assentar();

    backend
      .expectOne(
        (r) => r.method === 'GET' && r.url === `${environment.apiUrl}/materias`,
      )
      .flush([]);
    await assentar();
    await assentar();

    expect(irPara).toHaveBeenCalledWith('/tabs/materias/m1');
  });

  it('sigla repetida (409) mostra a mensagem do servidor e fica no formulario', async () => {
    await abrir();
    salvar();

    backend.expectOne(URL_MATERIA).flush(
      { detail: 'Ja existe uma materia com a sigla BD nesta turma.' },
      { status: 409, statusText: 'Conflict' },
    );
    await assentar();

    expect(erroNaTela()).toContain('sigla BD');
    expect(irPara).not.toHaveBeenCalled();
  });

  it('nao-lider que chega pelo link leva 403 e ve o motivo', async () => {
    await abrir();
    salvar();

    backend.expectOne(URL_MATERIA).flush(
      { detail: 'Só o líder pode fazer isso.' },
      { status: 403, statusText: 'Forbidden' },
    );
    await assentar();

    expect(erroNaTela()).toContain('líder');
  });
});
