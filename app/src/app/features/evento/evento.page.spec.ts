import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { environment } from '../../../environments/environment';
import { erroHttpInterceptor } from '../../core/http-error.interceptor';
import type { EventoDetalhe, Material } from '../../data/models';
import { AuthService } from '../../core/auth.service';
import { SyncRepository } from '../../data/sync.repository';
import { TurmaRepository } from '../../data/turma.repository';
import { NotificacoesService } from '../../notifications/notificacoes.service';
import {
  LEMBRETES_PADRAO,
  TIMEZONE_PADRAO,
  instantePersonalizado,
} from '../../notifications/reagendador';
import type { AlarmePersonalizado } from '../../notifications/reagendador';
import { EventoPage } from './evento.page';

const AUTORIA = {
  autorId: 'u1',
  autorNome: 'Otavio',
  criadoEm: '2026-08-31T12:00:00Z',
  atualizadoEm: '2026-08-31T12:00:00Z',
};

function material(id: string, titulo: string, url: string): Material {
  return {
    id,
    tipo: 'AULA',
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

function detalhe(materiais: Material[]): EventoDetalhe {
  return {
    id: 'e1',
    tipo: 'PROVA',
    titulo: 'Prova 2 — normalização',
    data: '2026-09-10',
    hora: '19:00',
    materiaId: 'm1',
    materiaSigla: 'BD',
    materiaCorHex: '#0369A1',
    autoria: AUTORIA,
    version: 1,
    visivelTurma: true,
    excluidoEm: null,
    materiais,
  };
}

/** Se quem está olhando é o líder da turma. Muda por teste. */
const liderancaMinha = signal(false);

/** Materias em que quem olha tem poder de docente (professor nelas, ou coordenacao). */
const alcancaEm = signal<string[]>([]);

const usuarioAtual = signal<{ id: string; nome: string; email: string } | null>(
  {
    id: 'u1',
    nome: 'Otavio',
    email: 'voce@exemplo.com',
  },
);

describe('EventoPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<EventoPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
        // A tela precisa saber QUEM está olhando para decidir se oferece editar
        // e apagar. `u1` é o mesmo id de AUTORIA, então por padrão quem abre é o
        // autor; o teste do não-autor troca isso.
        { provide: AuthService, useValue: { usuario: usuarioAtual, turmaId: () => 't1' } },
        {
          provide: TurmaRepository,
          useValue: {
            souLider: liderancaMinha,
            alcanca: (materiaId: string | null) =>
              materiaId !== null && alcancaEm().includes(materiaId),
            garantirCarregada: () => Promise.resolve(),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'e1' }) } },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EventoPage);
  });

  afterEach(() => {
    backend.verify();
    usuarioAtual.set({ id: 'u1', nome: 'Otavio', email: 'voce@exemplo.com' });
    liderancaMinha.set(false);
    alcancaEm.set([]);
  });

  async function abrir(
    responder: (r: ReturnType<HttpTestingController['expectOne']>) => void,
  ) {
    fixture.detectChanges();
    responder(backend.expectOne(`${environment.apiUrl}/eventos/e1`));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function textos(seletor: string): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll(seletor)).map(
      (e) => (e as HTMLElement).textContent!.trim(),
    );
  }

  it('material nao vinculado nao aparece na tela do evento', async () => {
    // `GET /eventos/{id}` ja devolve SOMENTE o que esta vinculado. A tela nao
    // pode buscar material por materia para "completar" a lista: despejar a
    // materia inteira na tela de uma prova e exatamente o que o nao-negociavel
    // 11 proibe.
    await abrir((r) =>
      r.flush(
        detalhe([material('mat-vinculado', 'Formas normais', 'x/fn.pdf')]),
      ),
    );

    expect(textos('app-material-linha .titulo')).toEqual(['Formas normais']);
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Trabalho de outra aula',
    );
    backend.expectNone((r) => r.url.includes('/materia'));
  });

  it('evento sem material vinculado diz isso, e nao some com a lista', async () => {
    await abrir((r) => r.flush(detalhe([])));

    expect(
      fixture.nativeElement.querySelectorAll('app-material-linha').length,
    ).toBe(0);
    expect(fixture.nativeElement.querySelector('.pf-vazio')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.pf-aviso'))
      .withContext('evento sem material nao mostra aviso de falha')
      .toBeNull();
  });

  it('evento oculto ou excluido responde 404 e a tela diz que nao existe mais', async () => {
    // Mudanca do backend de 2026-08-31: registro oculto ou logicamente
    // excluido responde 404 para quem nao e o autor. Isso nao e "deu erro" —
    // e "isso nao existe mais".
    await abrir((r) =>
      r.flush(
        { detail: 'Isso não existe mais.' },
        { status: 404, statusText: 'Not Found' },
      ),
    );

    const sumiu = fixture.nativeElement.querySelector(
      '.pf-sumiu',
    ) as HTMLElement | null;
    expect(sumiu).not.toBeNull();
    expect(sumiu!.textContent).toContain('Isso não existe mais.');
    expect(fixture.nativeElement.querySelector('.pf-aviso'))
      .withContext('404 nao e falha generica')
      .toBeNull();
    expect(fixture.nativeElement.querySelector('app-evento-card')).toBeNull();
  });

  it('falha de rede nao vira evento sem material', async () => {
    await abrir((r) => r.error(new ProgressEvent('error')));

    expect(
      fixture.nativeElement.querySelector('.pf-aviso')!.textContent,
    ).toContain('Sem conexão');
    expect(fixture.nativeElement.querySelector('.pf-vazio'))
      .withContext('falhar ao buscar NAO e "nao ha material vinculado"')
      .toBeNull();
    expect(fixture.nativeElement.querySelector('.pf-sumiu')).toBeNull();
  });

  it('anexar material aparece com e sem material, e o link leva ao id certo', async () => {
    // Dois defeitos que este teste prende. O botao tinha nascido DENTRO do
    // bloco que so renderiza quando ja ha material — aparecia so para quem ja
    // tinha resolvido o problema. E o template lia um `id` que nao existia na
    // classe (era variavel local do construtor), entao o link saia como
    // "/tabs/eventos//anexar" e nao levava a lugar nenhum.
    await abrir((r) => r.flush(detalhe([])));

    const link = fixture.nativeElement.querySelector(
      'a.anexar',
    ) as HTMLAnchorElement | null;
    expect(link)
      .withContext('sem material e justamente quando anexar importa')
      .not.toBeNull();
    expect(link!.getAttribute('href')).toBe('/tabs/eventos/e1/anexar');
  });

  it('a prova em outra sala diz onde e — a de sempre nao vira ruido', async () => {
    // Caso real: a prova caiu na sala do 2o periodo. Sem isto, quem confia no app
    // vai para a sala errada. E o contrario tambem importa: a esmagadora maioria
    // das provas e na sala de sempre, e repetir isso em todas viraria ruido que
    // ninguem le — entao a linha so aparece quando ha excecao.
    await abrir((r) => r.flush({ ...detalhe([]), sala: 'A-101' }));
    expect(fixture.nativeElement.querySelector('.sala')!.textContent).toContain(
      'A-101',
    );
  });

  it('sem sala propria, nao aparece linha de sala', async () => {
    await abrir((r) => r.flush(detalhe([])));
    expect(fixture.nativeElement.querySelector('.sala')).toBeNull();
  });

  it('o autor pode editar e apagar o que criou', async () => {
    // A tela de cadastrar promete, com estas palavras: "Só você pode editar ou
    // apagar depois". Prometia e não existia — nem editar nem apagar em lugar
    // nenhum do app. Promessa escrita na tela e sem porta é a pior forma de
    // mentir, porque quem lê confia.
    await abrir((r) => r.flush(detalhe([])));

    const acoes = Array.from(
      fixture.nativeElement.querySelectorAll('.do-autor a, .do-autor button'),
    ) as HTMLElement[];
    const textos = acoes.map((a) => a.textContent!.trim());

    expect(textos).toContain('Editar');
    expect(textos).toContain('Apagar');
    expect(
      fixture.nativeElement.querySelector('a[href="/tabs/eventos/e1/editar"]'),
    ).not.toBeNull();
  });

  it('quem NAO e o autor nao ve editar nem apagar', async () => {
    // "Só você" é a regra, e o servidor a aplica — mas mostrar o botão para quem
    // vai levar 403 é convidar ao erro e depois culpar a pessoa.
    usuarioAtual.set({
      id: 'outra-pessoa',
      nome: 'Ana',
      email: 'ana@exemplo.com',
    });
    await abrir((r) => r.flush(detalhe([])));

    expect(fixture.nativeElement.querySelector('.do-autor')).toBeNull();
  });

  it('apagar pergunta antes, e so entao chama o servidor', async () => {
    await abrir((r) => r.flush(detalhe([])));

    const apagar = () =>
      (
        Array.from(
          fixture.nativeElement.querySelectorAll('button'),
        ) as HTMLButtonElement[]
      ).find((b) => b.textContent!.trim() === 'Apagar')!;
    apagar().click();
    fixture.detectChanges();

    // Nada foi para o servidor ainda: o primeiro toque só pergunta.
    backend.expectNone(`${environment.apiUrl}/eventos/e1`);
    expect(fixture.nativeElement.textContent as string).toContain(
      'Apagar mesmo',
    );

    (
      Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ) as HTMLButtonElement[]
    )
      .find((b) => b.textContent!.trim() === 'Sim, apagar')!
      .click();

    const req = backend.expectOne(`${environment.apiUrl}/eventos/e1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.headers.get('If-Match'))
      .withContext(
        'sem If-Match o servidor apaga por cima de uma edicao de outra pessoa',
      )
      .toBe('1');
    req.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('desistir de apagar nao manda nada', async () => {
    await abrir((r) => r.flush(detalhe([])));

    (
      Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ) as HTMLButtonElement[]
    )
      .find((b) => b.textContent!.trim() === 'Apagar')!
      .click();
    fixture.detectChanges();
    (
      Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ) as HTMLButtonElement[]
    )
      .find((b) => b.textContent!.trim() === 'Cancelar')!
      .click();
    fixture.detectChanges();

    backend.expectNone(`${environment.apiUrl}/eventos/e1`);
    expect(fixture.nativeElement.textContent as string).not.toContain(
      'Apagar mesmo',
    );
  });

  it('o lider pode ocultar da turma, com motivo', async () => {
    // As telas dizem que "o líder só oculta o que não devia estar ali". A API de
    // moderação inteira existia no servidor e o app nunca chamou nenhuma rota
    // dela — o papel existia nos dados e não tinha um único botão.
    liderancaMinha.set(true);
    usuarioAtual.set({ id: 'outro', nome: 'Ana', email: 'ana@exemplo.com' });
    await abrir((r) => r.flush(detalhe([])));

    const ocultar = () =>
      (
        Array.from(
          fixture.nativeElement.querySelectorAll('button'),
        ) as HTMLButtonElement[]
      ).find((b) => b.textContent!.includes('Ocultar'));
    expect(ocultar())
      .withContext('o lider precisa de um jeito de tirar da lista')
      .toBeDefined();

    ocultar()!.click();
    fixture.detectChanges();
    // Pergunta primeiro: ocultar mexe no que a turma inteira vê.
    backend.expectNone(`${environment.apiUrl}/moderacao/evento/e1/ocultar`);

    const motivo = fixture.nativeElement.querySelector(
      'input[name="motivo"]',
    ) as HTMLInputElement;
    motivo.value = 'foto indevida';
    motivo.dispatchEvent(new Event('input'));
    (
      Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ) as HTMLButtonElement[]
    )
      .find((b) => b.textContent!.trim() === 'Ocultar da turma')!
      .click();

    const req = backend.expectOne(
      `${environment.apiUrl}/moderacao/evento/e1/ocultar`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ motivo: 'foto indevida' });
    req.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    // NAO navega para fora: ocultar tira o evento da vista do proprio lider, e
    // ao sair desta tela ele leva 404. Ficar aqui deixa o desfazer a um toque.
    // Se tivesse navegado para fora, este aviso nao estaria em tela.
    expect(fixture.nativeElement.textContent as string).toContain(
      'Ocultado. Desfazer',
    );
  });

  it('desfazer devolve o evento a turma enquanto a janela esta aberta', async () => {
    liderancaMinha.set(true);
    usuarioAtual.set({ id: 'outro', nome: 'Ana', email: 'ana@exemplo.com' });
    await abrir((r) => r.flush(detalhe([])));
    (
      Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ) as HTMLButtonElement[]
    )
      .find((b) => b.textContent!.includes('Ocultar'))!
      .click();
    fixture.detectChanges();
    (
      Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ) as HTMLButtonElement[]
    )
      .find((b) => b.textContent!.trim() === 'Ocultar da turma')!
      .click();
    backend
      .expectOne(`${environment.apiUrl}/moderacao/evento/e1/ocultar`)
      .flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    (
      Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ) as HTMLButtonElement[]
    )
      .find((b) => b.textContent!.trim() === 'Desfazer')!
      .click();

    const volta = backend.expectOne(
      `${environment.apiUrl}/moderacao/evento/e1/reexibir`,
    );
    expect(volta.request.method).toBe('POST');
    volta.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    // Voltou ao estado normal: o botao de ocultar esta de volta.
    expect(
      (
        Array.from(
          fixture.nativeElement.querySelectorAll('button'),
        ) as HTMLButtonElement[]
      ).find((b) => b.textContent!.includes('Ocultar')),
    ).toBeDefined();
  });

  it('o "Desfazer" do ocultar dura ~8 s; depois, o aviso aponta para "Ocultados" na turma', async () => {
    liderancaMinha.set(true);
    usuarioAtual.set({ id: 'outro', nome: 'Ana', email: 'ana@exemplo.com' });
    jasmine.clock().install();
    try {
      await abrir((r) => r.flush(detalhe([])));
      const botoes = () =>
        Array.from(
          fixture.nativeElement.querySelectorAll('button'),
        ) as HTMLButtonElement[];
      botoes()
        .find((b) => b.textContent!.includes('Ocultar'))!
        .click();
      fixture.detectChanges();
      botoes()
        .find((b) => b.textContent!.trim() === 'Ocultar da turma')!
        .click();
      backend
        .expectOne(`${environment.apiUrl}/moderacao/evento/e1/ocultar`)
        .flush(null);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(
        botoes().find((b) => b.textContent!.trim() === 'Desfazer'),
      ).toBeDefined();
      expect(
        fixture.nativeElement.querySelector('.alerta--desfazer').textContent,
      ).toContain('Ocultado.');

      jasmine.clock().tick(8000);
      fixture.detectChanges();

      expect(botoes().find((b) => b.textContent!.trim() === 'Desfazer'))
        .withContext('passada a janela o botao some')
        .toBeUndefined();
      const aviso = fixture.nativeElement.querySelector('.alerta')
        .textContent as string;
      expect(aviso)
        .withContext('mas o caminho de volta continua dito: nao fica sem saida')
        .toContain('Ocultados');
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('quem nao criou descobre a regra ANTES de procurar o botao', async () => {
    // Esconder os botoes ja evitava o 403. Mas ausencia de botao e silencio: a
    // pessoa nao aprende a regra e fica procurando a opcao que nao existe.
    liderancaMinha.set(false);
    usuarioAtual.set({ id: 'outro', nome: 'Ana', email: 'ana@exemplo.com' });
    await abrir((r) => r.flush(detalhe([])));

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('só essa pessoa');
    expect(
      (
        Array.from(
          fixture.nativeElement.querySelectorAll('button, a'),
        ) as HTMLElement[]
      ).find((b) => b.textContent!.trim() === 'Editar'),
    ).toBeUndefined();
  });

  it('quem nao e lider nao ve ocultar', async () => {
    liderancaMinha.set(false);
    usuarioAtual.set({ id: 'outro', nome: 'Ana', email: 'ana@exemplo.com' });
    await abrir((r) => r.flush(detalhe([])));

    const textos = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).map((b) => (b as HTMLButtonElement).textContent!);
    expect(textos.join(' ')).not.toContain('Ocultar');
  });

  describe('docente: professor na materia dele e coordenacao', () => {
    const botoes = () =>
      (
        Array.from(
          fixture.nativeElement.querySelectorAll('button, a'),
        ) as HTMLElement[]
      ).map((b) => b.textContent!.trim());

    beforeEach(() => {
      // Nao e o autor (o autor e `u1`) e nao e lider: o poder vem so do alcance.
      usuarioAtual.set({ id: 'prof', nome: 'Marcos', email: 'm@exemplo.com' });
    });

    it('quem alcanca a materia corrige e oculta, e NUNCA ve apagar em post alheio', async () => {
      alcancaEm.set(['m1']);
      await abrir((r) => r.flush(detalhe([])));

      const rotulos = botoes();
      expect(rotulos).toContain('Editar');
      expect(rotulos).toContain('Ocultar da turma');
      expect(rotulos).toContain('Pedir que apague');
      // Excluir registro alheio nao existe para docente (spec 5.1). A tela nem
      // oferece: ver o botao e levar 403 ensinaria a desconfiar dela.
      expect(rotulos).not.toContain('Apagar');
      expect(
        fixture.nativeElement.querySelector('a[href="/tabs/eventos/e1/editar"]'),
      ).not.toBeNull();
      // A regra e dita: a autoria continua de quem postou.
      expect(fixture.nativeElement.textContent).toContain('editado por');
    });

    it('materia que ele NAO leciona: aqui ele e aluno, sem editar nem ocultar', async () => {
      // O poder segue a materia: Prof. Marcos em BD nao mexe em prova de CALC.
      alcancaEm.set(['outra-materia']);
      await abrir((r) => r.flush(detalhe([])));

      const rotulos = botoes();
      expect(rotulos).not.toContain('Editar');
      expect(rotulos).not.toContain('Ocultar da turma');
      expect(fixture.nativeElement.textContent).toContain('só essa pessoa');
    });

    it('o proprio autor com alcance nao ganha "Pedir que apague" no que ele mesmo postou', async () => {
      usuarioAtual.set({ id: 'u1', nome: 'Otavio', email: 'o@exemplo.com' });
      alcancaEm.set(['m1']);
      await abrir((r) => r.flush(detalhe([])));

      const rotulos = botoes();
      expect(rotulos).toContain('Apagar');
      expect(rotulos).not.toContain('Ocultar da turma');
      expect(rotulos).not.toContain('Pedir que apague');
    });

    it('403 do servidor vira mensagem, nao tela quebrada', async () => {
      // Permissao velha no app (a conta foi recusada ou contestada depois): o
      // servidor decide de verdade, e a pessoa le o motivo.
      alcancaEm.set(['m1']);
      await abrir((r) => r.flush(detalhe([])));
      (
        Array.from(
          fixture.nativeElement.querySelectorAll('button'),
        ) as HTMLButtonElement[]
      )
        .find((b) => b.textContent!.trim() === 'Ocultar da turma')!
        .click();
      fixture.detectChanges();
      (
        Array.from(
          fixture.nativeElement.querySelectorAll('button'),
        ) as HTMLButtonElement[]
      )
        .find((b) => b.textContent!.trim() === 'Ocultar da turma')!
        .click();

      backend
        .expectOne(`${environment.apiUrl}/moderacao/evento/e1/ocultar`)
        .flush(
          { detail: 'Sem permissão nesta matéria' },
          { status: 403, statusText: 'Forbidden' },
        );
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('Ocultado.');
    });
  });

  describe('selo e "editado por" na autoria', () => {
    it('autoria com selo mostra "Prof." e o selo; editado por outra pessoa vira linha propria', async () => {
      await abrir((r) =>
        r.flush({
          ...detalhe([]),
          autoria: {
            ...AUTORIA,
            autorSelo: 'PROFESSOR',
            editadoPorNome: 'Helena',
            editadoPorSelo: 'COORDENACAO',
          },
        }),
      );

      const card = fixture.nativeElement.querySelector('app-evento-card')!;
      const rodapes = Array.from(card.querySelectorAll('.rodape')).map((e) =>
        (e as HTMLElement).textContent!.replace(/\s+/g, ' ').trim(),
      );
      expect(rodapes[0]).toContain('Prof. Otavio');
      expect(rodapes[0]).toContain('Professor');
      expect(rodapes[1]).toContain('editado por Coord. Helena');
      expect(rodapes[1]).toContain('Coordenação');
    });

    it('sem selo e sem correcao, a autoria e so o nome — nem prefixo nem linha extra', async () => {
      await abrir((r) => r.flush(detalhe([])));

      const card = fixture.nativeElement.querySelector('app-evento-card')!;
      expect(card.querySelector('app-selo')).toBeNull();
      expect(card.querySelectorAll('.rodape').length).toBe(1);
      expect(card.textContent).not.toContain('Prof.');
      expect(card.textContent).not.toContain('editado por');
    });

    it('material com selo e correcao mostra os dois na linha', async () => {
      await abrir((r) =>
        r.flush(
          detalhe([
            {
              ...material('mt1', 'Slides', 'https://x.test/a.pdf'),
              autoria: {
                ...AUTORIA,
                autorSelo: 'COORDENACAO',
                editadoPorNome: 'Marcos',
                editadoPorSelo: 'PROFESSOR',
              },
            },
          ]),
        ),
      );

      const linha = (
        fixture.nativeElement.querySelector('app-material-linha') as HTMLElement
      ).textContent!.replace(/\s+/g, ' ');
      expect(linha).toContain('Coord. Otavio');
      expect(linha).toContain('editado por Prof. Marcos');
    });
  });

  it('motivo em branco ainda oculta — explicar e util, nao obrigatorio', async () => {
    // O servidor aceita motivo nulo. Exigir texto faria o líder inventar um para
    // conseguir agir, e motivo inventado é pior que motivo ausente: ele fica no
    // registro de moderação como se fosse verdade.
    liderancaMinha.set(true);
    await abrir((r) => r.flush(detalhe([])));

    (
      Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ) as HTMLButtonElement[]
    )
      .find((b) => b.textContent!.includes('Ocultar'))!
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
      `${environment.apiUrl}/moderacao/evento/e1/ocultar`,
    );
    expect(req.request.body).toEqual({ motivo: null });
    req.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('o lider pode PEDIR que o autor apague, e isso nao apaga nada', async () => {
    // Ocultar tira da lista; pedir e outra coisa — o lider acha que aquilo nao
    // devia existir, mas quem apaga e sempre quem criou. Sao dois botoes porque
    // sao duas decisoes diferentes, e juntar as duas num so faria o lider apagar
    // sem querer o que so queria tirar da vista.
    liderancaMinha.set(true);
    usuarioAtual.set({ id: 'outro', nome: 'Ana', email: 'ana@exemplo.com' });
    await abrir((r) => r.flush(detalhe([])));

    const pedir = () =>
      (
        Array.from(
          fixture.nativeElement.querySelectorAll('button'),
        ) as HTMLButtonElement[]
      ).find((b) => b.textContent!.includes('Pedir que apague'));
    expect(pedir()).toBeDefined();

    pedir()!.click();
    fixture.detectChanges();
    backend.expectNone(
      `${environment.apiUrl}/moderacao/evento/e1/pedir-exclusao`,
    );

    const motivo = fixture.nativeElement.querySelector(
      'input[name="motivo"]',
    ) as HTMLInputElement;
    motivo.value = 'duplicado';
    motivo.dispatchEvent(new Event('input'));
    (
      Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ) as HTMLButtonElement[]
    )
      .find((b) => b.textContent!.trim() === 'Enviar o pedido')!
      .click();

    const req = backend.expectOne(
      `${environment.apiUrl}/moderacao/evento/e1/pedir-exclusao`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ motivo: 'duplicado' });
    req.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent as string)
      .withContext('o lider precisa saber que pediu, nao que apagou')
      .toContain('Pedido enviado');
  });
});

describe('EventoPage — lembrete personalizado', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<EventoPage>;
  let avisos: jasmine.SpyObj<NotificacoesService> & { suportado: boolean };
  let sync: jasmine.SpyObj<SyncRepository>;
  /** So desinstala o que este arquivo instalou: `uninstall` sem `install` troca os timers por nativos. */
  let relogioFalso = false;

  /** Longe no futuro: o instante calculado nao pode virar "ja passou" com o tempo. */
  const NO_FUTURO = {
    ...detalhe([]),
    data: '2030-10-11',
    hora: '19:00:00',
  };

  /**
   * `comAparelho` falso usa o servico DE VERDADE, sem plugin — o mesmo caminho
   * do site. Verdadeiro troca o servico por um falso que diz "estou no app".
   */
  async function abrir(
    evento: object,
    comAparelho: boolean,
    gravados: Record<string, AlarmePersonalizado> = {},
    exato: 'granted' | 'denied' = 'granted',
  ): Promise<HTMLElement> {
    avisos = Object.assign(
      jasmine.createSpyObj<NotificacoesService>('avisos', [
        'config',
        'salvarAlarme',
        'estadoExato',
        'permitirExato',
      ]),
      { suportado: true },
    );
    avisos.config.and.resolveTo({
      ...LEMBRETES_PADRAO,
      personalizados: gravados,
    });
    avisos.salvarAlarme.and.resolveTo();
    avisos.estadoExato.and.resolveTo(exato);
    avisos.permitirExato.and.resolveTo('granted');
    // O `/sync` de verdade e do SyncRepository (testado a parte): aqui so
    // importa se a tela o pede, e como.
    sync = jasmine.createSpyObj<SyncRepository>('sync', ['reagendarAvisos']);
    sync.reagendarAvisos.and.resolveTo();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { usuario: usuarioAtual, turmaId: () => 't1' } },
        {
          provide: TurmaRepository,
          useValue: {
            souLider: liderancaMinha,
            alcanca: (materiaId: string | null) =>
              materiaId !== null && alcancaEm().includes(materiaId),
            garantirCarregada: () => Promise.resolve(),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'e1' }) } },
        },
        ...(comAparelho
          ? [
              { provide: NotificacoesService, useValue: avisos },
              { provide: SyncRepository, useValue: sync },
            ]
          : []),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EventoPage);
    fixture.detectChanges();
    backend.expectOne(`${environment.apiUrl}/eventos/e1`).flush(evento);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => {
    if (relogioFalso) {
      jasmine.clock().uninstall();
      relogioFalso = false;
    }
    backend.verify();
  });

  function botao(tela: HTMLElement, texto: string): HTMLButtonElement {
    return Array.from(tela.querySelectorAll('button')).find(
      (b) => b.textContent!.trim() === texto,
    )!;
  }

  function previa(tela: HTMLElement): string {
    return tela.querySelector('.previa')!.textContent!.trim();
  }

  async function mudar(el: HTMLInputElement | HTMLSelectElement, valor: string) {
    el.value = valor;
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input'));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('no site diz que lembrete e coisa do app', async () => {
    const tela = await abrir(NO_FUTURO, false);

    expect(tela.querySelector('.lembrete')!.textContent).toContain(
      'Lembretes funcionam no app Android',
    );
    expect(botao(tela, 'Marcar um lembrete')).toBeUndefined();
  });

  it('relativo: a tela mostra QUANDO vai tocar, antes de salvar', async () => {
    const tela = await abrir(NO_FUTURO, true);
    botao(tela, 'Marcar um lembrete').click();
    fixture.detectChanges();

    // Padrao: 1 dia antes da prova de sex, 11 out, 19:00.
    expect(previa(tela)).toBe('Vai tocar qui, 10 out, 19:00.');

    await mudar(tela.querySelector('input[type="number"]')!, '36');
    await mudar(tela.querySelector('select')!, 'horas');
    expect(previa(tela)).toBe('Vai tocar qui, 10 out, 07:00.');
  });

  it('relativo sem hora no evento conta das 7h do dia, e a tela avisa', async () => {
    const semHora: Record<string, unknown> = { ...NO_FUTURO };
    delete semHora['hora'];
    const tela = await abrir(semHora, true);
    botao(tela, 'Marcar um lembrete').click();
    fixture.detectChanges();

    await mudar(tela.querySelector('input[type="number"]')!, '36');
    await mudar(tela.querySelector('select')!, 'horas');

    expect(tela.textContent).toContain('conta a partir das 7h do dia');
    // 11/10 07:00 menos 36 h = 09/10 19:00.
    expect(previa(tela)).toBe('Vai tocar qua, 9 out, 19:00.');
  });

  it('data e hora exatas: hora de parede de Sao Paulo', async () => {
    const tela = await abrir(NO_FUTURO, true);
    botao(tela, 'Marcar um lembrete').click();
    fixture.detectChanges();
    botao(tela, 'Data e hora').click();
    fixture.detectChanges();

    await mudar(
      tela.querySelector('input[type="datetime-local"]')!,
      '2030-10-09T19:00',
    );
    expect(previa(tela)).toBe('Vai tocar qua, 9 out, 19:00.');

    botao(tela, 'Salvar lembrete').click();
    await fixture.whenStable();

    // O rotulo "qua, 9 out, 19:00" sozinho nao prova nada: numa maquina ja em
    // Sao Paulo ele sai igual com `new Date(valor)`, que usa o fuso da maquina.
    // O que vai para o disco e a hora de PAREDE, e o INSTANTE que dela resulta
    // e 19:00 de SP = 22:00 UTC (UTC-3), em qualquer maquina.
    const [id, gravado] = avisos.salvarAlarme.calls.mostRecent().args;
    expect(id).toBe('e1');
    expect(gravado).toEqual({
      modo: 'EXATO',
      data: '2030-10-09',
      hora: '19:00',
    });
    expect(
      instantePersonalizado(gravado!, NO_FUTURO, TIMEZONE_PADRAO)!.getTime(),
    ).toBe(Date.UTC(2030, 9, 9, 22, 0));
  });

  it('passado nao salva, e a tela diz', async () => {
    const tela = await abrir(NO_FUTURO, true);
    botao(tela, 'Marcar um lembrete').click();
    fixture.detectChanges();
    botao(tela, 'Data e hora').click();
    fixture.detectChanges();

    await mudar(
      tela.querySelector('input[type="datetime-local"]')!,
      '2020-01-01T10:00',
    );

    expect(previa(tela)).toBe('Esse horário já passou — não vai tocar.');
    expect(botao(tela, 'Salvar lembrete').disabled).toBeTrue();
  });

  it('salvar grava um por evento, e remover apaga', async () => {
    const tela = await abrir(NO_FUTURO, true);
    botao(tela, 'Marcar um lembrete').click();
    fixture.detectChanges();
    await mudar(tela.querySelector('input[type="number"]')!, '36');
    await mudar(tela.querySelector('select')!, 'horas');

    botao(tela, 'Salvar lembrete').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(avisos.salvarAlarme).toHaveBeenCalledWith('e1', {
      modo: 'RELATIVO',
      horasAntes: 36,
    });
    expect(tela.querySelector('.lembrete .alerta')!.textContent).toContain(
      'Vai tocar qui, 10 out, 07:00',
    );

    botao(tela, 'Remover lembrete').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(avisos.salvarAlarme).toHaveBeenCalledWith('e1', null);
    expect(botao(tela, 'Marcar um lembrete')).toBeDefined();
  });

  it('o alarme ja gravado no aparelho aparece ao abrir', async () => {
    const tela = await abrir(NO_FUTURO, true, {
      e1: { modo: 'EXATO', data: '2030-10-09', hora: '19:00' },
    });

    expect(tela.querySelector('.lembrete .alerta')!.textContent).toContain(
      'Vai tocar qua, 9 out, 19:00',
    );
  });

  it('salvar e remover baixam o /sync de novo, forcado — o evento pode ser mais novo que a lista', async () => {
    // O aparelho so agenda evento que esta na ultima lista do /sync. Sem baixar
    // de novo, o alarme era gravado, a tela dizia "Vai tocar" e nada tocava.
    const tela = await abrir(NO_FUTURO, true);
    botao(tela, 'Marcar um lembrete').click();
    fixture.detectChanges();

    botao(tela, 'Salvar lembrete').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(sync.reagendarAvisos).toHaveBeenCalledOnceWith(true);

    botao(tela, 'Remover lembrete').click();
    await fixture.whenStable();
    expect(sync.reagendarAvisos).toHaveBeenCalledTimes(2);
    expect(sync.reagendarAvisos.calls.mostRecent().args).toEqual([true]);
  });

  describe('alarme no horario exato', () => {
    const AVISO = 'pode atrasar o lembrete em até 1 hora';

    it('negado: avisa que o lembrete pode chegar 1 hora depois e oferece o botao', async () => {
      const tela = await abrir(NO_FUTURO, true, {}, 'denied');

      expect(tela.querySelector('.lembrete')!.textContent).toContain(AVISO);

      botao(tela, 'Permitir horário exato').click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(avisos.permitirExato).toHaveBeenCalled();
      expect(tela.querySelector('.lembrete')!.textContent).not.toContain(AVISO);
      expect(botao(tela, 'Permitir horário exato')).toBeUndefined();
    });

    it('permitido: nao avisa nada', async () => {
      const tela = await abrir(NO_FUTURO, true, {}, 'granted');

      expect(tela.querySelector('.lembrete')!.textContent).not.toContain(AVISO);
      expect(botao(tela, 'Permitir horário exato')).toBeUndefined();
    });

    it('ao salvar o alarme a tela le o sistema de novo, e o aviso sai se a pessoa ja permitiu', async () => {
      // A permissao pode ter mudado desde que a tela abriu (a pessoa foi aos
      // ajustes do Android e voltou).
      const tela = await abrir(NO_FUTURO, true, {}, 'denied');
      expect(tela.querySelector('.lembrete')!.textContent).toContain(AVISO);

      avisos.estadoExato.and.resolveTo('granted');
      botao(tela, 'Marcar um lembrete').click();
      fixture.detectChanges();
      botao(tela, 'Salvar lembrete').click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(tela.querySelector('.lembrete')!.textContent).not.toContain(AVISO);
    });
  });

  describe('o relogio da tela', () => {
    /** Um alarme exato as 19:00 de SP, com a tela aberta a 20 s dessa hora. */
    async function abrirPertoDoAlarme(): Promise<HTMLElement> {
      // Antes de abrir: o intervalo e criado no construtor, e so o relogio
      // falso consegue dispara-lo sem esperar 30 s de verdade.
      jasmine.clock().install();
      relogioFalso = true;
      jasmine.clock().mockDate(new Date('2030-10-09T21:59:40Z')); // 18:59:40 em SP
      const tela = await abrir(NO_FUTURO, true);
      botao(tela, 'Marcar um lembrete').click();
      fixture.detectChanges();
      botao(tela, 'Data e hora').click();
      fixture.detectChanges();
      await mudar(
        tela.querySelector('input[type="datetime-local"]')!,
        '2030-10-09T19:00',
      );
      expect(previa(tela)).toBe('Vai tocar qua, 9 out, 19:00.');
      expect(botao(tela, 'Salvar lembrete').disabled).toBeFalse();
      return tela;
    }

    it('a previa vira "ja passou" sozinha, sem a pessoa mexer em nada', async () => {
      // `previa` e `podeSalvar` liam `Date.now()` dentro de `computed`, que nao
      // recalcula: a tela aberta por minutos seguia oferecendo salvar um
      // alarme que ja tinha passado.
      const tela = await abrirPertoDoAlarme();

      jasmine.clock().tick(30_000); // 19:00:10 em SP
      fixture.detectChanges();

      expect(previa(tela)).toBe('Esse horário já passou — não vai tocar.');
      expect(botao(tela, 'Salvar lembrete').disabled).toBeTrue();
    });

    it('salvar confere o relogio de novo: entre dois tiques o horario pode ter passado', async () => {
      const tela = await abrirPertoDoAlarme();

      // O relogio anda sem o tique de 30 s disparar (o celular dormiu): o botao
      // ainda esta habilitado, com a conta velha.
      jasmine.clock().mockDate(new Date('2030-10-09T22:00:10Z'));
      botao(tela, 'Salvar lembrete').click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(avisos.salvarAlarme).not.toHaveBeenCalled();
      expect(previa(tela)).toBe('Esse horário já passou — não vai tocar.');
    });

    it('o intervalo sai quando a tela e destruida', async () => {
      // `setInterval` solto vaza: cada visita a um evento deixaria um tique a
      // mais acordando um componente que ja nao existe.
      spyOn(window, 'setInterval').and.returnValue(4242 as never);
      const parar = spyOn(window, 'clearInterval');
      await abrir(NO_FUTURO, true);

      fixture.destroy();

      expect(parar).toHaveBeenCalledWith(4242);
    });
  });
});
