import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
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
import type {
  Evento,
  Material,
  MateriaDetalhe,
  TipoMaterial,
} from '../../data/models';
import { TurmaRepository } from '../../data/turma.repository';
import { MateriaPage } from './materia.page';

const AUTORIA = {
  autorId: 'u1',
  autorNome: 'Otavio',
  criadoEm: '2026-08-31T12:00:00Z',
  atualizadoEm: '2026-08-31T12:00:00Z',
};

function material(
  id: string,
  tipo: TipoMaterial,
  titulo: string,
  url: string,
): Material {
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
    materia: {
      id: 'm1',
      nome: 'Banco de Dados',
      sigla: 'BD',
      corHex: '#0369A1',
    },
    materiaisAula: [],
    materiaisAdicionais: [],
    eventos: [],
    ...parcial,
  };
}

describe('MateriaPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<MateriaPage>;
  // O papel vem do repositorio da turma; aqui ele e so um sinal que o teste liga.
  const souLider = signal(false);
  // Materias em que a pessoa tem poder de docente (professor nelas, ou coordenacao).
  const alcancaEm = signal<string[]>([]);
  let irPara: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
        // A lista de materias (recarregada ao apagar) grava um snapshot no disco;
        // aqui ele nao e o assunto, e nao pode vazar de um teste para outro.
        {
          provide: StorageService,
          useValue: {
            ler: async () => null,
            mesclar: async () => undefined,
          },
        },
        {
          provide: TurmaRepository,
          useValue: {
            souLider,
            alcanca: (materiaId: string | null) =>
              materiaId !== null && alcancaEm().includes(materiaId),
            garantirCarregada: () => Promise.resolve(),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'm1' }) } },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    irPara = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(MateriaPage);
  });

  afterEach(() => {
    backend.verify();
    souLider.set(false);
    alcancaEm.set([]);
  });

  async function abrir(
    responder: (r: ReturnType<HttpTestingController['expectOne']>) => void,
  ) {
    fixture.detectChanges();
    // O Ionic chama isto ao entrar na tela; o TestBed nao chama sozinho.
    fixture.componentInstance.ionViewWillEnter();
    responder(backend.expectOne(`${environment.apiUrl}/materias/m1`));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Deixa as promessas encadeadas andarem sem depender de setTimeout (o relogio pode estar falso). */
  async function microtarefas(): Promise<void> {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  }

  function textos(seletor: string): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll(seletor)).map(
      (e) => (e as HTMLElement).textContent!.trim(),
    );
  }

  it('material de aula e material adicional aparecem separados', async () => {
    // R4: os dois tipos existem para nao se misturarem. Se a tela juntasse
    // tudo numa lista so, o tipo nao serviria para nada.
    await abrir((r) =>
      r.flush(
        detalhe({
          materiaisAula: [
            material('a1', 'AULA', 'Formas normais', 'https://x/fn.pdf'),
          ],
          materiaisAdicionais: [
            material('x1', 'ADICIONAL', 'Lista extra', 'https://x/extra.pdf'),
          ],
        }),
      ),
    );

    expect(textos('app-material-linha.aula .titulo')).toEqual([
      'Formas normais',
    ]);
    expect(textos('app-material-linha.adicional .titulo')).toEqual([
      'Lista extra',
    ]);
  });

  it('os eventos da materia aparecem junto', async () => {
    await abrir((r) =>
      r.flush(detalhe({ eventos: [evento('e1', 'Prova 2 — normalização')] })),
    );

    expect(textos('app-evento-card .titulo')).toEqual([
      'Prova 2 — normalização',
    ]);
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

    expect(
      fixture.nativeElement.querySelector('.pf-aviso')!.textContent,
    ).toContain('Sem conexão');
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
        materia: {
          id: 'm1',
          nome: 'Banco de Dados',
          sigla: 'BD',
          corHex: '#0369A1',
        },
        materiaisAula: [
          material('a1', 'AULA', 'Formas normais', 'https://x/fn.pdf'),
        ],
        materiaisAdicionais: [],
        eventos: [],
      }),
    );

    const links = Array.from(
      fixture.nativeElement.querySelectorAll(
        'a.abrir',
      ) as NodeListOf<HTMLAnchorElement>,
    );
    expect(links.length)
      .withContext('todo material tem de ser abrivel')
      .toBeGreaterThan(0);
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
          id: 'm1',
          nome: 'Banco de Dados',
          sigla: 'BD',
          corHex: '#0369A1',
          sala: 'B-204',
          professor: 'prof. Marcos',
        },
        materiaisAula: [
          {
            ...material('a1', 'AULA', 'Formas normais', 'https://x/fn.pdf'),
            dataAula: '2026-09-02',
          },
        ],
        materiaisAdicionais: [],
        eventos: [],
      }),
    );

    const cabecalho = fixture.nativeElement.querySelector('.onde-e-quem')!
      .textContent as string;
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
        materia: {
          id: 'm1',
          nome: 'Banco de Dados',
          sigla: 'BD',
          corHex: '#0369A1',
        },
        materiaisAula: [],
        materiaisAdicionais: [],
        eventos: [],
      }),
    );

    expect(fixture.nativeElement.querySelector('.onde-e-quem')).toBeNull();
  });

  describe('docente: professor que leciona a materia, ou coordenacao', () => {
    const COM_MATERIAL = detalhe({
      materiaisAula: [
        material('a1', 'AULA', 'Formas normais', 'https://x/fn.pdf'),
      ],
    });
    const links = () =>
      Array.from(fixture.nativeElement.querySelectorAll('a.editar')).map((a) =>
        (a as HTMLAnchorElement).getAttribute('href'),
      );
    const rotulos = () =>
      (
        Array.from(
          fixture.nativeElement.querySelectorAll('button'),
        ) as HTMLButtonElement[]
      ).map((b) => b.textContent!.trim());

    it('quem alcanca a materia ve Editar e Ocultar no material de OUTRA pessoa', async () => {
      alcancaEm.set(['m1']);
      await abrir((r) => r.flush(COM_MATERIAL));

      expect(links()).toContain('/tabs/materiais/a1/editar');
      expect(rotulos()).toContain('Ocultar');
    });

    it('materia que ele nao leciona: sem Editar nem Ocultar (aqui ele e aluno)', async () => {
      alcancaEm.set(['outra-materia']);
      await abrir((r) => r.flush(COM_MATERIAL));

      expect(links()).not.toContain('/tabs/materiais/a1/editar');
      expect(rotulos()).not.toContain('Ocultar');
    });

    it('ocultar pelo poder de docente usa a mesma rota de moderacao do lider', async () => {
      alcancaEm.set(['m1']);
      await abrir((r) => r.flush(COM_MATERIAL));

      (
        Array.from(
          fixture.nativeElement.querySelectorAll('button'),
        ) as HTMLButtonElement[]
      )
        .find((b) => b.textContent!.trim() === 'Ocultar')!
        .click();
      fixture.detectChanges();
      (
        Array.from(
          fixture.nativeElement.querySelectorAll('button'),
        ) as HTMLButtonElement[]
      )
        .find((b) => b.textContent!.trim() === 'Ocultar da turma')!
        .click();

      const req = backend.expectOne(
        `${environment.apiUrl}/moderacao/material/a1/ocultar`,
      );
      expect(req.request.method).toBe('POST');
      req.flush(null);
      // Aguarda a requisicao GET ser disparada (promise de moderacao resolvida,
      // carregar iniciado). Sem isto o expectOne vem antes da requisicao ser feita.
      await microtarefas();
      // Recarrega a materia em seguida: quem decide o que e visivel e o servidor.
      backend.expectOne(`${environment.apiUrl}/materias/m1`).flush(detalhe());
      await fixture.whenStable();
    });

    it('selo e "editado por" aparecem no material e no evento da materia', async () => {
      await abrir((r) =>
        r.flush(
          detalhe({
            materiaisAula: [
              {
                ...material('a1', 'AULA', 'Slides', 'https://x/s.pdf'),
                autoria: {
                  ...AUTORIA,
                  autorSelo: 'PROFESSOR',
                  editadoPorNome: 'Helena',
                  editadoPorSelo: 'COORDENACAO',
                },
              },
            ],
            eventos: [
              {
                ...evento('e1', 'Prova 1'),
                autoria: { ...AUTORIA, autorSelo: 'COORDENACAO' },
              },
            ],
          }),
        ),
      );

      const linha = (
        fixture.nativeElement.querySelector('app-material-linha') as HTMLElement
      ).textContent!.replace(/\s+/g, ' ');
      expect(linha).toContain('Prof. Otavio');
      expect(linha).toContain('editado por Coord. Helena');
      const card = fixture.nativeElement.querySelector(
        'app-evento-card',
      ) as HTMLElement;
      expect(card.textContent).toContain('Coord. Otavio');
      expect(card.querySelector('app-selo')!.textContent).toContain(
        'Coordenação',
      );
    });
  });

  describe('ocultar material (lider)', () => {
    const COM_MATERIAL = detalhe({
      materiaisAula: [
        material('a1', 'AULA', 'Formas normais', 'https://x/fn.pdf'),
      ],
    });

    function botao(rotulo: string): HTMLButtonElement | undefined {
      return (
        Array.from(
          fixture.nativeElement.querySelectorAll('button'),
        ) as HTMLButtonElement[]
      ).find((b) => b.textContent!.trim() === rotulo);
    }

    it('so o lider ve o botao de ocultar', async () => {
      // A tela de editar promete "o lider pode ocultar" e nao havia botao. Ao
      // aluno comum ele nao aparece: o servidor recusaria, e oferecer o que vai
      // falhar ensina a desconfiar da tela.
      await abrir((r) => r.flush(COM_MATERIAL));
      expect(botao('Ocultar')).toBeUndefined();

      souLider.set(true);
      fixture.detectChanges();
      expect(botao('Ocultar')).toBeDefined();
    });

    it('pergunta antes, oculta pela rota de moderacao e recarrega a materia', async () => {
      souLider.set(true);
      await abrir((r) => r.flush(COM_MATERIAL));

      botao('Ocultar')!.click();
      fixture.detectChanges();
      backend.expectNone(`${environment.apiUrl}/moderacao/material/a1/ocultar`);
      expect(fixture.nativeElement.querySelector('.alerta').textContent)
        .withContext('a pergunta diz qual material sai')
        .toContain('Formas normais');

      botao('Ocultar da turma')!.click();
      const req = backend.expectOne(
        `${environment.apiUrl}/moderacao/material/a1/ocultar`,
      );
      expect(req.request.method).toBe('POST');
      req.flush(null);

      // O servidor ja nao manda o oculto (R14); a tela recarrega em vez de
      // filtrar por conta propria.
      await new Promise((r) => setTimeout(r));
      backend.expectOne(`${environment.apiUrl}/materias/m1`).flush(detalhe());
      await fixture.whenStable();
      fixture.detectChanges();

      expect(textos('app-material-linha .titulo')).toEqual([]);
      expect(fixture.nativeElement.querySelector('.pf-erro')).toBeNull();
    });

    it('falha ao ocultar aparece na tela e o material continua', async () => {
      souLider.set(true);
      await abrir((r) => r.flush(COM_MATERIAL));
      botao('Ocultar')!.click();
      fixture.detectChanges();
      botao('Ocultar da turma')!.click();

      backend
        .expectOne(`${environment.apiUrl}/moderacao/material/a1/ocultar`)
        .flush(
          { detail: 'Servidor fora do ar.' },
          { status: 500, statusText: 'Server Error' },
        );
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.pf-erro'))
        .withContext('falha de moderacao nunca em silencio')
        .not.toBeNull();
      expect(textos('app-material-linha .titulo')).toEqual(['Formas normais']);
    });

    describe('desfazer', () => {
      const URL_OCULTAR = `${environment.apiUrl}/moderacao/material/a1/ocultar`;
      const URL_REEXIBIR = `${environment.apiUrl}/moderacao/material/a1/reexibir`;
      const URL_MATERIA = `${environment.apiUrl}/materias/m1`;

      /** Abre como lider, oculta o material a1 e deixa a recarga da materia responder. */
      async function ocultarA1(): Promise<void> {
        souLider.set(true);
        await abrir((r) => r.flush(COM_MATERIAL));
        botao('Ocultar')!.click();
        fixture.detectChanges();
        botao('Ocultar da turma')!.click();
        backend.expectOne(URL_OCULTAR).flush(null);
        await microtarefas();
        backend.expectOne(URL_MATERIA).flush(detalhe());
        await microtarefas();
        fixture.detectChanges();
      }

      it('logo depois de ocultar mostra "Ocultado. Desfazer"', async () => {
        await ocultarA1();

        expect(
          (fixture.nativeElement.querySelector('.alerta--desfazer')
            .textContent as string),
        ).toContain('Ocultado.');
        expect(botao('Desfazer')).toBeDefined();
      });

      it('Desfazer chama reexibir e traz o material de volta', async () => {
        await ocultarA1();

        botao('Desfazer')!.click();
        const req = backend.expectOne(URL_REEXIBIR);
        expect(req.request.method).toBe('POST');
        req.flush(null);
        await microtarefas();
        // Recarrega em vez de recolocar na lista por conta propria (R14).
        backend.expectOne(URL_MATERIA).flush(COM_MATERIAL);
        await microtarefas();
        fixture.detectChanges();

        expect(textos('app-material-linha .titulo')).toEqual(['Formas normais']);
        expect(botao('Desfazer'))
          .withContext('desfeito: o aviso ja cumpriu o papel')
          .toBeUndefined();
      });

      it('o aviso some sozinho depois de ~8 s', async () => {
        jasmine.clock().install();
        try {
          await ocultarA1();
          expect(botao('Desfazer')).toBeDefined();

          jasmine.clock().tick(7999);
          fixture.detectChanges();
          expect(botao('Desfazer'))
            .withContext('com 1 ms de sobra o desfazer ainda tem de estar la')
            .toBeDefined();

          jasmine.clock().tick(1);
          fixture.detectChanges();
          expect(botao('Desfazer')).toBeUndefined();
        } finally {
          jasmine.clock().uninstall();
        }
      });

      it('Desfazer que falha mostra o erro, e a janela continua para tentar de novo', async () => {
        await ocultarA1();

        botao('Desfazer')!.click();
        backend.expectOne(URL_REEXIBIR).flush(
          { detail: 'Servidor fora do ar.' },
          { status: 500, statusText: 'Server Error' },
        );
        await microtarefas();
        fixture.detectChanges();

        expect(
          fixture.nativeElement.querySelector('.pf-erro'),
        ).withContext('desfazer que falha nunca em silencio').not.toBeNull();
        expect(botao('Desfazer')).toBeDefined();
      });
    });
  });

  describe('editar e apagar a materia (lider)', () => {
    const URL_MATERIA = `${environment.apiUrl}/materias/m1`;

    function botao(rotulo: string): HTMLButtonElement | undefined {
      return (
        Array.from(
          fixture.nativeElement.querySelectorAll('button'),
        ) as HTMLButtonElement[]
      ).find((b) => b.textContent!.trim() === rotulo);
    }

    function linkEditar(): HTMLAnchorElement | undefined {
      return (
        Array.from(
          fixture.nativeElement.querySelectorAll('a'),
        ) as HTMLAnchorElement[]
      ).find((a) => a.textContent!.trim() === 'Editar matéria');
    }

    it('so o lider ve Editar e Apagar', async () => {
      await abrir((r) => r.flush(detalhe()));
      expect(linkEditar()).toBeUndefined();
      expect(botao('Apagar matéria')).toBeUndefined();

      souLider.set(true);
      fixture.detectChanges();
      expect(linkEditar()).toBeDefined();
      expect(botao('Apagar matéria')).toBeDefined();
    });

    it('Editar leva ao formulario da propria materia', async () => {
      souLider.set(true);
      await abrir((r) => r.flush(detalhe()));

      expect(linkEditar()!.getAttribute('href')).toBe(
        '/tabs/materias/m1/editar',
      );
    });

    it('matéria que falhou ao carregar nao oferece apagar o que nao se ve', async () => {
      souLider.set(true);
      await abrir((r) => r.error(new ProgressEvent('error')));

      expect(linkEditar()).toBeUndefined();
      expect(botao('Apagar matéria')).toBeUndefined();
    });

    it('pergunta antes de apagar e nao chama nada ate confirmar', async () => {
      souLider.set(true);
      await abrir((r) => r.flush(detalhe()));

      botao('Apagar matéria')!.click();
      fixture.detectChanges();

      backend.expectNone(URL_MATERIA);
      expect(fixture.nativeElement.querySelector('.alerta').textContent)
        .withContext('a pergunta diz qual materia vai embora')
        .toContain('Banco de Dados');

      botao('Cancelar')!.click();
      fixture.detectChanges();
      backend.expectNone(URL_MATERIA);
      expect(fixture.nativeElement.querySelector('.alerta')).toBeNull();
    });

    it('confirmar apaga pela rota certa, recarrega a lista e volta para as materias', async () => {
      souLider.set(true);
      await abrir((r) => r.flush(detalhe()));
      botao('Apagar matéria')!.click();
      fixture.detectChanges();

      botao('Apagar matéria')!.click();
      const del = backend.expectOne(URL_MATERIA);
      expect(del.request.method).toBe('DELETE');
      del.flush(null, { status: 204, statusText: 'No Content' });
      await microtarefas();

      // Antes de voltar: senao a aba ainda mostra a materia que acabou de sumir.
      backend
        .expectOne(
          (r) => r.method === 'GET' && r.url === `${environment.apiUrl}/materias`,
        )
        .flush([]);
      await microtarefas();

      expect(irPara).toHaveBeenCalledWith('/tabs/materias');
    });

    it('materia com conteudo (409) mostra a mensagem do servidor e fica na tela', async () => {
      souLider.set(true);
      await abrir((r) => r.flush(detalhe()));
      botao('Apagar matéria')!.click();
      fixture.detectChanges();
      botao('Apagar matéria')!.click();

      backend.expectOne(URL_MATERIA).flush(
        { detail: 'Mova ou apague as provas e materiais antes' },
        { status: 409, statusText: 'Conflict' },
      );
      await microtarefas();
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('.pf-erro').textContent,
      ).toContain('Mova ou apague as provas e materiais antes');
      expect(irPara).not.toHaveBeenCalled();
    });
  });
});
