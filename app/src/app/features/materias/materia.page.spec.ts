import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { environment } from '../../../environments/environment';
import { erroHttpInterceptor } from '../../core/http-error.interceptor';
import type { Evento, Material, MateriaDetalhe, TipoMaterial } from '../../data/models';
import { MateriaPage } from './materia.page';

const AUTORIA = {
  autorId: 'u1',
  autorNome: 'Otavio',
  criadoEm: '2026-08-31T12:00:00Z',
  atualizadoEm: '2026-08-31T12:00:00Z',
};

function material(id: string, tipo: TipoMaterial, titulo: string, url: string): Material {
  return {
    id,
    tipo,
    titulo,
    url,
    arquivoRef: null,
    materiaId: 'm1',
    autoria: AUTORIA,
    version: 1,
    visivelTurma: true,
    excluidoEm: null,
  };
}

function evento(id: string, titulo: string): Evento {
  return {
    id,
    tipo: 'PROVA',
    titulo,
    data: '2026-09-10',
    hora: null,
    materiaId: 'm1',
    materiaSigla: 'BD',
    materiaCorHex: '#0369A1',
    autoria: AUTORIA,
    version: 1,
    visivelTurma: true,
    excluidoEm: null,
  };
}

function detalhe(parcial: Partial<MateriaDetalhe> = {}): MateriaDetalhe {
  return {
    materia: { id: 'm1', nome: 'Banco de Dados', sigla: 'BD', corHex: '#0369A1' },
    materiaisAula: [],
    materiaisAdicionais: [],
    eventos: [],
    ...parcial,
  };
}

describe('MateriaPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<MateriaPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'm1' }) } },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MateriaPage);
  });

  afterEach(() => backend.verify());

  async function abrir(responder: (r: ReturnType<HttpTestingController['expectOne']>) => void) {
    fixture.detectChanges();
    responder(backend.expectOne(`${environment.apiUrl}/materias/m1`));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function textos(seletor: string): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll(seletor)).map((e) =>
      (e as HTMLElement).textContent!.trim(),
    );
  }

  it('material de aula e material adicional aparecem separados', async () => {
    // R4: os dois tipos existem para nao se misturarem. Se a tela juntasse
    // tudo numa lista so, o tipo nao serviria para nada.
    await abrir((r) =>
      r.flush(
        detalhe({
          materiaisAula: [material('a1', 'AULA', 'Formas normais', 'https://x/fn.pdf')],
          materiaisAdicionais: [
            material('x1', 'ADICIONAL', 'Lista extra', 'https://x/extra.pdf'),
          ],
        }),
      ),
    );

    expect(textos('app-material-linha.aula .titulo')).toEqual(['Formas normais']);
    expect(textos('app-material-linha.adicional .titulo')).toEqual(['Lista extra']);
  });

  it('os eventos da materia aparecem junto', async () => {
    await abrir((r) => r.flush(detalhe({ eventos: [evento('e1', 'Prova 2 — normalização')] })));

    expect(textos('app-evento-card .titulo')).toEqual(['Prova 2 — normalização']);
  });

  it('materia sem material e sem evento mostra o estado vazio', async () => {
    await abrir((r) => r.flush(detalhe()));

    expect(fixture.nativeElement.querySelector('.pf-vazio')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.pf-aviso'))
      .withContext('materia vazia de verdade nao mostra aviso de falha')
      .toBeNull();
  });

  it('falha ao buscar a materia nao vira materia vazia', async () => {
    await abrir((r) => r.error(new ProgressEvent('error')));

    expect(fixture.nativeElement.querySelector('.pf-aviso')!.textContent).toContain(
      'Sem conexão',
    );
    expect(fixture.nativeElement.querySelector('.pf-vazio'))
      .withContext('falhar ao buscar NAO e "esta materia nao tem nada"')
      .toBeNull();
  });

  it('o material abre — o link estava guardado e nenhuma tela o usava', async () => {
    // O material aparecia com titulo, tipo e autoria, e nao tinha como abrir:
    // `materialVm` descartava a `url` e o componente da linha nao tinha href.
    // Material que nao abre nao serve para estudar, que e a unica razao de ele
    // existir.
    await abrir((r) =>
      r.flush({
        materia: { id: 'm1', nome: 'Banco de Dados', sigla: 'BD', corHex: '#0369A1' },
        materiaisAula: [material('a1', 'AULA', 'Formas normais', 'https://x/fn.pdf')],
        materiaisAdicionais: [],
        eventos: [],
      }),
    );

    const links = Array.from(
      fixture.nativeElement.querySelectorAll('a.abrir') as NodeListOf<HTMLAnchorElement>,
    );
    expect(links.length).withContext('todo material tem de ser abrivel').toBeGreaterThan(0);
    expect(links[0].getAttribute('href')).toMatch(/^https?:\/\//);
    expect(links[0].getAttribute('target'))
      .withContext('sai do app para o navegador, senao a pessoa perde a tela')
      .toBe('_blank');
    expect(links[0].getAttribute('rel')).toContain('noopener');
  });

  it('a materia diz onde e com quem, e o material diz de que aula', async () => {
    // Campo que grava e ninguem ve e campo que nao existe. A sala e o professor
    // sao a primeira coisa que alguem procura ao abrir a materia, e "de que
    // aula" e o que faltava para achar o material certo numa lista longa.
    await abrir((r) =>
      r.flush({
        materia: {
          id: 'm1', nome: 'Banco de Dados', sigla: 'BD', corHex: '#0369A1',
          sala: 'B-204', professor: 'prof. Marcos',
        },
        materiaisAula: [
          { ...material('a1', 'AULA', 'Formas normais', 'https://x/fn.pdf'),
            dataAula: '2026-09-02' },
        ],
        materiaisAdicionais: [],
        eventos: [],
      }),
    );

    const cabecalho = fixture.nativeElement.querySelector('.onde-e-quem')!.textContent as string;
    expect(cabecalho).toContain('B-204');
    expect(cabecalho).toContain('prof. Marcos');

    expect(fixture.nativeElement.querySelector('.da-aula')!.textContent)
      .withContext('a data identifica a aula sem precisar de entidade de aula')
      .toContain('2 set');
  });

  it('materia sem sala nem professor nao mostra a linha vazia', async () => {
    // O backend OMITE campo nulo, entao aqui eles chegam como `undefined`. Uma
    // linha com separador e nada em volta seria pior que linha nenhuma.
    await abrir((r) =>
      r.flush({
        materia: { id: 'm1', nome: 'Banco de Dados', sigla: 'BD', corHex: '#0369A1' },
        materiaisAula: [],
        materiaisAdicionais: [],
        eventos: [],
      }),
    );

    expect(fixture.nativeElement.querySelector('.onde-e-quem')).toBeNull();
  });
});
