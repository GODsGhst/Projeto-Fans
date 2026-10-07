import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { environment } from '../../../environments/environment';
import { erroHttpInterceptor } from '../../core/http-error.interceptor';
import { AuthService } from '../../core/auth.service';
import { StorageService } from '../../core/storage.service';
import { TurmaAtivaService } from '../../core/turma-ativa.service';
import { TurmaPage, convite } from './turma.page';

const TURMA = {
  id: 't1',
  nome: 'Fans 2026.2',
  semestre: '2026.2',
  codigoConvite: '93EB9244',
  membros: [
    {
      usuarioId: 'u1',
      nome: 'Otávio',
      papel: 'LIDER',
      entrouEm: '2026-09-01T12:00:00Z',
    },
    {
      usuarioId: 'u2',
      nome: 'Ana Beatriz',
      papel: 'ALUNO',
      entrouEm: '2026-09-01T13:00:00Z',
    },
    {
      usuarioId: 'u3',
      nome: 'Bruno',
      papel: 'ALUNO',
      entrouEm: '2026-09-01T14:00:00Z',
    },
  ],
};

describe('convite', () => {
  it('a mensagem carrega o codigo e o nome da turma', () => {
    // Este e o defeito possivel: mensagem bonita que chega sem o codigo, e quem
    // recebe tem de voltar e perguntar como entra.
    const m = convite({ nome: 'Fans 2026.2', codigoConvite: '93EB9244' });

    expect(m.text)
      .withContext('sem o codigo nao convida ninguem')
      .toContain('93EB9244');
    expect(m.text)
      .withContext('e precisa dizer de que turma se trata')
      .toContain('Fans 2026.2');
    expect(m.title).toContain('Fans 2026.2');
  });
});

const OTAVIO = { id: 'u1', nome: 'Otávio', email: 'voce@exemplo.com' };
const eu = signal<{ id: string; nome: string; email: string } | null>(OTAVIO);
const URL_TURMA = `${environment.apiUrl}/turmas/minha`;
const URL_MATERIAS = `${environment.apiUrl}/materias`;
/** O nome da turma ativa do DOCENTE; nulo = aluno (nunca escolheu turma). */
const nomeAtivo = signal<string | null>(null);
const URL_OCULTADOS = `${environment.apiUrl}/moderacao/ocultados`;

describe('TurmaPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<TurmaPage>;
  let registrarTurma: jasmine.Spy;
  let irPara: jasmine.Spy;

  beforeEach(() => {
    registrarTurma = jasmine.createSpy('registrarTurma').and.resolveTo();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { usuario: eu, turmaId: () => 't1', registrarTurma } },
        { provide: TurmaAtivaService, useValue: { nome: nomeAtivo } },
        // A lista de materias (que o professor le para declarar) grava um snapshot
        // no disco; aqui ele nao e o assunto e nao pode vazar entre testes.
        {
          provide: StorageService,
          useValue: { ler: async () => null, mesclar: async () => undefined },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    irPara = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(TurmaPage);
  });

  afterEach(() => {
    backend.verify();
    eu.set(OTAVIO);
    nomeAtivo.set(null);
  });

  /**
   * `ionViewWillEnter` e o que o Ionic chama ao entrar na aba; o TestBed nao
   * chama sozinho. O lider tambem pergunta o que esta oculto, entao a fixture
   * responde essa segunda chamada — quem nao e lider nao a faz, e o `verify`
   * do afterEach prova isso.
   */
  async function abrir(
    responder: (r: ReturnType<HttpTestingController['expectOne']>) => void,
    ocultados: unknown[] = [],
  ): Promise<void> {
    fixture.detectChanges();
    fixture.componentInstance.ionViewWillEnter();
    responder(backend.expectOne(URL_TURMA));
    await fixture.whenStable();
    for (const r of backend.match(URL_OCULTADOS)) {
      r.flush(ocultados);
    }
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function assentar(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function botao(rotulo: string): HTMLButtonElement | undefined {
    return (
      Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ) as HTMLButtonElement[]
    ).find((b) => b.textContent!.trim() === rotulo);
  }

  /** Os botoes da pergunta de remocao, pelo testid: "Remover" tambem e o rotulo da linha. */
  function confirmar(testid: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector(
      `[data-testid="${testid}"]`,
    ) as HTMLButtonElement;
  }

  function textos(seletor: string): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll(seletor)).map(
      (e) => (e as HTMLElement).textContent!.trim(),
    );
  }

  it('mostra o codigo de convite em destaque, com botao de copiar', async () => {
    // O codigo e a unica coisa que separa a turma de qualquer pessoa com o link,
    // e tambem a unica forma de entrar nela. Ele nao pode ficar so no POST.
    await abrir((r) => r.flush(TURMA));

    expect(
      fixture.nativeElement
        .querySelector('[data-testid="codigo-convite"]')!
        .textContent!.trim(),
    ).toBe('93EB9244');
    expect(textos('button')).toContain('Copiar código');
  });

  it('lista quem esta na turma, com o lider marcado', async () => {
    await abrir((r) => r.flush(TURMA));

    expect(textos('.membro .nome')).toEqual(['Otávio', 'Ana Beatriz', 'Bruno']);
    // Lider e papel, nao posto: uma marca so, na pessoa certa.
    expect(textos('.membro .papel')).toEqual(['líder']);
  });

  it('falha ao carregar NAO vira turma vazia', async () => {
    await abrir((r) => r.error(new ProgressEvent('error')));

    expect(
      fixture.nativeElement.querySelector('.pf-aviso')!.textContent,
    ).toContain('Sem conexão');
    expect(fixture.nativeElement.querySelector('.membro'))
      .withContext('sem resposta nao ha lista de membros a mostrar')
      .toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="codigo-convite"]'),
    )
      .withContext('codigo inventado seria pior que codigo nenhum')
      .toBeNull();
  });

  it('ha um botao de compartilhar, e sem compartilhamento o codigo cai no clipboard', async () => {
    // No navegador do teste o `Share` do Capacitor nao existe e a chamada falha
    // — que e exatamente o caminho de fallback que precisa funcionar. Nao ha spy
    // aqui de proposito: `Share` e um proxy do registerPlugin e spyOn nao o
    // intercepta, entao um teste com spy passaria sem provar nada.
    const copia = spyOn(navigator.clipboard, 'writeText').and.resolveTo();
    await abrir((r) => r.flush(TURMA));

    const botao = (
      Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ) as HTMLButtonElement[]
    ).find((b) => b.textContent!.includes('Compartilhar'));
    expect(botao)
      .withContext('sem botao de compartilhar nao ha como convidar')
      .toBeDefined();

    botao!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(copia)
      .withContext(
        'falhar o compartilhamento tem de deixar a pessoa com o codigo mesmo assim',
      )
      .toHaveBeenCalledWith('93EB9244');
    expect(fixture.nativeElement.textContent as string).toContain('Copiado');
  });

  it('so o lider ve a porta para passar a lideranca', async () => {
    // A própria tela diz que o líder "transfere a liderança". A frase estava lá
    // e não havia botão nenhum. E para quem não é líder o botão não aparece nem
    // desabilitado: cinza convida a perguntar "por que não posso?", e a resposta
    // já está escrita logo abaixo.
    await abrir((r) => r.flush(TURMA));
    expect(
      fixture.nativeElement.querySelector('a[href="/tabs/turma/transferir"]'),
    )
      .withContext('sou o LIDER da fixture — a porta tem de estar aqui')
      .not.toBeNull();

    eu.set({ id: 'u2', nome: 'Ana Beatriz', email: 'ana@exemplo.com' });
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('a[href="/tabs/turma/transferir"]'),
    ).toBeNull();
  });

  describe('ferramentas do lider', () => {
    const ALUNO = { id: 'u2', nome: 'Ana Beatriz', email: 'ana@exemplo.com' };
    const URL_REMOVER = `${environment.apiUrl}/turmas/minha/membros/u2`;
    const URL_CODIGO = `${environment.apiUrl}/turmas/minha/codigo`;

    const OCULTADO_MATERIAL = {
      registroTipo: 'MATERIAL',
      registroId: 'mat1',
      titulo: 'Lista 3 (errada)',
      autorId: 'u3',
      autorNome: 'Bruno',
      ocultadoEm: '2026-09-20T12:00:00Z',
    };

    it('so o lider ve Remover, Gerar novo codigo e Ocultados', async () => {
      // O servidor recusaria (403), e oferecer o que vai falhar ensina a
      // desconfiar da tela. Nem desabilitado: cinza convida a perguntar por que.
      eu.set(ALUNO);
      await abrir((r) => r.flush(TURMA));

      expect(botao('Remover')).toBeUndefined();
      expect(botao('Gerar novo código')).toBeUndefined();
      expect(textos('.pf-rotulo')).not.toContain('ocultados');
    });

    it('o lider ve Remover em cada membro, menos nele mesmo', async () => {
      await abrir((r) => r.flush(TURMA));

      const nomes = Array.from(
        fixture.nativeElement.querySelectorAll('button.remover[aria-label^="Remover"]'),
      ).map((b) => (b as HTMLElement).getAttribute('aria-label'));
      expect(nomes).toEqual(['Remover Ana Beatriz', 'Remover Bruno']);
    });

    it('pergunta antes de remover e nao chama nada ate confirmar', async () => {
      await abrir((r) => r.flush(TURMA));

      fixture.nativeElement
        .querySelector('button[aria-label="Remover Ana Beatriz"]')
        .click();
      fixture.detectChanges();

      backend.expectNone(URL_REMOVER);
      const aviso = fixture.nativeElement.querySelector('.alerta')
        .textContent as string;
      expect(aviso).toContain('Ana Beatriz');
      expect(aviso).toContain('perde o acesso');
      expect(aviso).toContain('O que ele postou continua');
      expect(aviso)
        .withContext('remover nao bane: a pessoa pode voltar com o codigo atual')
        .toContain('pode voltar com o código atual');
      expect(confirmar('remover-confirmar').textContent!.trim()).toBe('Remover');
      expect(confirmar('remover-e-trocar-codigo').textContent!.trim()).toBe(
        'Remover e gerar novo código',
      );

      botao('Cancelar')!.click();
      fixture.detectChanges();
      backend.expectNone(URL_REMOVER);
      expect(fixture.nativeElement.querySelector('.alerta')).toBeNull();
    });

    it('confirmar remove pela rota certa e recarrega a turma', async () => {
      await abrir((r) => r.flush(TURMA));
      fixture.nativeElement
        .querySelector('button[aria-label="Remover Ana Beatriz"]')
        .click();
      fixture.detectChanges();

      confirmar('remover-confirmar').click();
      const req = backend.expectOne(URL_REMOVER);
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
      await fixture.whenStable();

      // Depois da acao, a tela relê a turma em vez de confiar no que supoe.
      backend.expectOne(URL_TURMA).flush({
        ...TURMA,
        membros: TURMA.membros.filter((m) => m.usuarioId !== 'u2'),
      });
      await assentar();

      expect(textos('.membro .nome')).toEqual(['Otávio', 'Bruno']);
      expect(fixture.nativeElement.querySelector('.alerta'))
        .withContext('a pergunta fecha depois de remover')
        .toBeNull();
    });

    it('remover que falha mostra o motivo do servidor e a pessoa continua na lista', async () => {
      await abrir((r) => r.flush(TURMA));
      fixture.nativeElement
        .querySelector('button[aria-label="Remover Bruno"]')
        .click();
      fixture.detectChanges();
      confirmar('remover-confirmar').click();

      backend.expectOne(`${environment.apiUrl}/turmas/minha/membros/u3`).flush(
        { detail: 'Transfira a liderança antes de sair' },
        { status: 409, statusText: 'Conflict' },
      );
      await assentar();

      expect(
        fixture.nativeElement.querySelector('.pf-erro').textContent,
      ).toContain('Transfira a liderança');
      expect(textos('.membro .nome'))
        .withContext('falhou: ninguem saiu, e a tela nao pode sugerir o contrario')
        .toContain('Bruno');
    });

    it('"Remover e gerar novo codigo": DELETE, releitura e POST do codigo, nessa ordem', async () => {
      // Remover nao bane: o removido ainda tem o codigo anotado. Sem esta saida o
      // lider tinha de lembrar de ir gerar o codigo depois.
      await abrir((r) => r.flush(TURMA));
      fixture.nativeElement
        .querySelector('button[aria-label="Remover Ana Beatriz"]')
        .click();
      fixture.detectChanges();

      confirmar('remover-e-trocar-codigo').click();
      const del = backend.expectOne(URL_REMOVER);
      expect(del.request.method).toBe('DELETE');
      backend.expectNone(URL_CODIGO);
      del.flush(null, { status: 204, statusText: 'No Content' });
      await fixture.whenStable();

      const SEM_ANA = TURMA.membros.filter((m) => m.usuarioId !== 'u2');
      backend.expectOne(URL_TURMA).flush({ ...TURMA, membros: SEM_ANA });
      await fixture.whenStable();
      await assentar();

      const troca = backend.expectOne(URL_CODIGO);
      expect(troca.request.method).toBe('POST');
      troca.flush({ ...TURMA, membros: SEM_ANA, codigoConvite: 'NOVO0001' });
      await assentar();

      expect(textos('.membro .nome')).toEqual(['Otávio', 'Bruno']);
      expect(
        fixture.nativeElement.querySelector('[data-testid="codigo-convite"]')
          .textContent.trim(),
      ).toBe('NOVO0001');
      expect(fixture.nativeElement.querySelector('.pf-erro')).toBeNull();
    });

    it('"Remover" sozinho NAO troca o codigo', async () => {
      await abrir((r) => r.flush(TURMA));
      fixture.nativeElement
        .querySelector('button[aria-label="Remover Ana Beatriz"]')
        .click();
      fixture.detectChanges();

      confirmar('remover-confirmar').click();
      backend
        .expectOne(URL_REMOVER)
        .flush(null, { status: 204, statusText: 'No Content' });
      await fixture.whenStable();
      backend
        .expectOne(URL_TURMA)
        .flush({ ...TURMA, membros: TURMA.membros.filter((m) => m.usuarioId !== 'u2') });
      await assentar();

      backend.expectNone(URL_CODIGO);
      expect(textos('.membro .nome')).toEqual(['Otávio', 'Bruno']);
    });

    it('removeu mas o codigo novo falhou: avisa que a pessoa saiu e que o codigo antigo vale', async () => {
      await abrir((r) => r.flush(TURMA));
      fixture.nativeElement
        .querySelector('button[aria-label="Remover Ana Beatriz"]')
        .click();
      fixture.detectChanges();

      confirmar('remover-e-trocar-codigo').click();
      backend
        .expectOne(URL_REMOVER)
        .flush(null, { status: 204, statusText: 'No Content' });
      await fixture.whenStable();
      const SEM_ANA = TURMA.membros.filter((m) => m.usuarioId !== 'u2');
      backend.expectOne(URL_TURMA).flush({ ...TURMA, membros: SEM_ANA });
      await fixture.whenStable();
      await assentar();
      backend
        .expectOne(URL_CODIGO)
        .flush(null, { status: 500, statusText: 'Server Error' });
      // Uma volta de macrotarefa: o erro atravessa interceptor, repositorio e
      // pagina em varias passagens de microtarefa, e o whenStable sozinho nao as espera.
      await new Promise((r) => setTimeout(r));
      await assentar();

      // A linha da Ana (e a pergunta com ela) ja sumiu: o aviso mora fora dela.
      expect(textos('.membro .nome')).toEqual(['Otávio', 'Bruno']);
      const aviso = fixture.nativeElement.querySelector('.pf-erro')
        .textContent as string;
      expect(aviso).toContain('saiu da turma');
      expect(aviso).toContain('código novo não foi gerado');
      expect(
        fixture.nativeElement.querySelector('[data-testid="codigo-convite"]')
          .textContent.trim(),
      ).toBe('93EB9244');
    });

    it('gerar novo codigo pergunta, chama a rota e mostra o codigo novo na hora', async () => {
      const copia = spyOn(navigator.clipboard, 'writeText').and.resolveTo();
      await abrir((r) => r.flush(TURMA));
      // "Copiado" do codigo antigo nao pode sobreviver ao codigo novo.
      botao('Copiar código')!.click();
      await assentar();
      expect(copia).toHaveBeenCalledWith('93EB9244');
      expect(botao('Copiado ✓')).toBeDefined();

      botao('Gerar novo código')!.click();
      fixture.detectChanges();
      backend.expectNone(URL_CODIGO);
      expect(fixture.nativeElement.querySelector('.alerta').textContent)
        .toContain('O código antigo para de funcionar');

      botao('Gerar novo código')!.click();
      const req = backend.expectOne(URL_CODIGO);
      expect(req.request.method).toBe('POST');
      req.flush({ ...TURMA, codigoConvite: 'NOVO0001' });
      await assentar();

      expect(
        fixture.nativeElement.querySelector('[data-testid="codigo-convite"]')
          .textContent.trim(),
      ).toBe('NOVO0001');
      expect(botao('Copiar código'))
        .withContext('o codigo mudou: ainda nao foi copiado')
        .toBeDefined();
      expect(textos('.membro .nome'))
        .withContext('quem ja entrou continua')
        .toEqual(['Otávio', 'Ana Beatriz', 'Bruno']);
    });

    it('gerar codigo que falha mostra o erro e o codigo antigo continua na tela', async () => {
      await abrir((r) => r.flush(TURMA));
      botao('Gerar novo código')!.click();
      fixture.detectChanges();
      botao('Gerar novo código')!.click();

      backend.expectOne(URL_CODIGO).flush(
        { detail: 'Só o líder pode.' },
        { status: 403, statusText: 'Forbidden' },
      );
      await assentar();

      expect(
        fixture.nativeElement.querySelector('.pf-erro').textContent,
      ).toContain('Só o líder pode');
      expect(
        fixture.nativeElement.querySelector('[data-testid="codigo-convite"]')
          .textContent.trim(),
      ).toBe('93EB9244');
    });

    it('Ocultados lista o que esta oculto, com tipo, autor e data', async () => {
      await abrir((r) => r.flush(TURMA), [OCULTADO_MATERIAL]);

      expect(textos('.pf-rotulo')).toContain('ocultados');
      expect(textos('.membro .nome')).toContain('Lista 3 (errada)');
      const detalhe = textos('.membro .desde').find((t) => t.includes('material'))!;
      expect(detalhe).toContain('Bruno');
      expect(detalhe).toContain('ocultado em');
      expect(botao('Reexibir')).toBeDefined();
    });

    it('ocultado sem data mostra "sem data", nunca Invalid Date', async () => {
      await abrir((r) => r.flush(TURMA), [
        { ...OCULTADO_MATERIAL, ocultadoEm: null },
      ]);

      const texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain('sem data');
      expect(texto).not.toContain('Invalid Date');
    });

    it('nada oculto mostra o estado vazio', async () => {
      await abrir((r) => r.flush(TURMA), []);

      expect(fixture.nativeElement.textContent).toContain('Nada oculto');
      expect(botao('Reexibir')).toBeUndefined();
    });

    it('falha ao listar os ocultados NAO vira "Nada oculto"', async () => {
      fixture.detectChanges();
      fixture.componentInstance.ionViewWillEnter();
      backend.expectOne(URL_TURMA).flush(TURMA);
      await fixture.whenStable();
      backend
        .expectOne(URL_OCULTADOS)
        .flush(null, { status: 500, statusText: 'Server Error' });
      await assentar();

      expect(fixture.nativeElement.textContent).not.toContain('Nada oculto');
      expect(
        fixture.nativeElement.querySelector('.pf-aviso').textContent,
      ).toContain('servidor');
    });

    it('Reexibir chama a rota do tipo certo e recarrega a lista', async () => {
      await abrir((r) => r.flush(TURMA), [OCULTADO_MATERIAL]);

      botao('Reexibir')!.click();
      const req = backend.expectOne(
        `${environment.apiUrl}/moderacao/material/mat1/reexibir`,
      );
      expect(req.request.method).toBe('POST');
      req.flush(null);
      await fixture.whenStable();

      backend.expectOne(URL_OCULTADOS).flush([]);
      await assentar();

      expect(textos('.membro .nome')).not.toContain('Lista 3 (errada)');
      expect(fixture.nativeElement.textContent).toContain('Nada oculto');
    });

    it('Reexibir que falha (500) mostra o erro, o item continua e a lista NAO e relida', async () => {
      await abrir((r) => r.flush(TURMA), [OCULTADO_MATERIAL]);

      botao('Reexibir')!.click();
      backend
        .expectOne(`${environment.apiUrl}/moderacao/material/mat1/reexibir`)
        .flush(null, { status: 500, statusText: 'Server Error' });
      await assentar();

      expect(
        fixture.nativeElement.querySelector('.pf-erro').textContent,
      ).toContain('servidor');
      expect(textos('.membro .nome')).toContain('Lista 3 (errada)');
      backend.expectNone(URL_OCULTADOS);
    });

    it('Reexibir 404 (a anotacao virou pessoal): mostra o erro E relê a lista de ocultados', async () => {
      // O item que a pessoa tocou nao e mais da turma. Deixar a linha ali so
      // convidava a tentar de novo o que vai dar 404 para sempre.
      await abrir((r) => r.flush(TURMA), [OCULTADO_MATERIAL]);

      botao('Reexibir')!.click();
      backend
        .expectOne(`${environment.apiUrl}/moderacao/material/mat1/reexibir`)
        .flush(
          { detail: 'Registro nao encontrado' },
          { status: 404, statusText: 'Not Found' },
        );
      await fixture.whenStable();

      backend.expectOne(URL_OCULTADOS).flush([]);
      await assentar();

      expect(
        fixture.nativeElement.querySelector('.pf-erro').textContent,
      ).toContain('nao encontrado');
      expect(textos('.membro .nome')).not.toContain('Lista 3 (errada)');
      expect(fixture.nativeElement.textContent).toContain('Nada oculto');
    });

    it('quem foi removido (404 SEM_TURMA) vai para a tela de entrar na turma, nao fica em erro', async () => {
      await abrir((r) =>
        r.flush(
          { detail: 'Registro nao encontrado', codigo: 'SEM_TURMA' },
          { status: 404, statusText: 'Not Found' },
        ),
      );

      expect(registrarTurma)
        .withContext('a sessao esquece a turma')
        .toHaveBeenCalledWith(null);
      expect(irPara).toHaveBeenCalledWith('/entrar-turma');
      expect(fixture.nativeElement.querySelector('.pf-aviso'))
        .withContext('aviso de erro numa tela de que ele esta saindo e o beco sem saida')
        .toBeNull();
    });

    it('404 sem o codigo (proxy, portal cativo) NAO tira ninguem da turma', async () => {
      await abrir((r) =>
        r.flush('<html>Not Found</html>', {
          status: 404,
          statusText: 'Not Found',
        }),
      );

      expect(registrarTurma).not.toHaveBeenCalled();
      expect(irPara).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('.pf-aviso')).not.toBeNull();
    });
  });

  describe('docentes na turma', () => {
    const MARCOS = { id: 'u4', nome: 'Marcos', email: 'marcos@exemplo.com' };
    const URL_CONTESTAR = `${URL_TURMA}/docentes/u4/contestar`;
    const URL_RESTAURAR = `${URL_TURMA}/docentes/u5/restaurar`;
    const ALUNO = { id: 'u2', nome: 'Ana Beatriz', email: 'ana@exemplo.com' };

    const MATERIAS = [
      { id: 'm-bd', nome: 'Banco de Dados', sigla: 'BD', corHex: '#0369A1' },
      { id: 'm-es', nome: 'Engenharia de Software', sigla: 'ENG SW', corHex: '#B45309' },
      { id: 'm-calc', nome: 'Cálculo', sigla: 'CALC', corHex: '#1D4ED8' },
    ];

    /** Lider, aluna, um professor com poder, uma coordenadora e uma professora contestada. */
    const DOCENTES = {
      ...TURMA,
      meuAlcance: { tipo: 'NENHUM', materiaIds: [] },
      membros: [
        ...TURMA.membros.slice(0, 2),
        {
          usuarioId: 'u4',
          nome: 'Marcos',
          papel: 'PROFESSOR',
          entrouEm: '2026-09-02T12:00:00Z',
          selo: 'PROFESSOR',
          contestado: false,
          lecionadas: ['BD', 'ENG SW'],
        },
        {
          usuarioId: 'u6',
          nome: 'Helena',
          papel: 'COORDENADOR',
          entrouEm: '2026-09-02T13:00:00Z',
          selo: 'COORDENACAO',
          contestado: false,
          lecionadas: [],
        },
        {
          usuarioId: 'u5',
          nome: 'Lúcia',
          papel: 'PROFESSOR',
          entrouEm: '2026-09-02T14:00:00Z',
          contestado: true,
          lecionadas: ['CALC'],
        },
      ],
    };

    const membro = (nome: string): HTMLElement =>
      (
        Array.from(
          fixture.nativeElement.querySelectorAll('.membro'),
        ) as HTMLElement[]
      ).find((m) => m.querySelector('.nome')!.textContent!.includes(nome))!;

    describe('a lista mostra o poder de cada um', () => {
      it('selo, materias declaradas e marca "contestado" — para todo membro, nao so o lider', async () => {
        eu.set(ALUNO);
        await abrir((r) => r.flush(DOCENTES));

        expect(membro('Marcos').querySelector('app-selo')!.textContent).toContain(
          'Professor',
        );
        expect(membro('Marcos').querySelector('.leciona')!.textContent).toContain(
          'leciona BD, ENG SW',
        );
        expect(membro('Helena').querySelector('app-selo')!.textContent).toContain(
          'Coordenação',
        );
        expect(membro('Helena').querySelector('.leciona')!.textContent).toContain(
          'turma inteira',
        );
        // Contestada: sem selo, com a marca que diz por que.
        expect(membro('Lúcia').querySelector('app-selo')).toBeNull();
        expect(membro('Lúcia').querySelector('.tag')!.textContent).toContain(
          'contestado',
        );
        // Aluno nao tem nada disso.
        expect(membro('Ana').querySelector('app-selo')).toBeNull();
        expect(membro('Ana').querySelector('.leciona')).toBeNull();
        expect(membro('Ana').querySelector('.tag')).toBeNull();
      });
    });

    describe('contestar e restaurar (lider)', () => {
      const botaoDe = (rotulo: string) =>
        fixture.nativeElement.querySelector(
          `button[aria-label="${rotulo}"]`,
        ) as HTMLButtonElement | null;

      it('o lider ve Contestar nos docentes e Restaurar so no contestado; aluno e lider ficam de fora', async () => {
        await abrir((r) => r.flush(DOCENTES));

        expect(botaoDe('Contestar Marcos')).not.toBeNull();
        expect(botaoDe('Contestar Helena')).not.toBeNull();
        expect(botaoDe('Restaurar Lúcia')).not.toBeNull();
        expect(botaoDe('Contestar Lúcia'))
          .withContext('ja contestada: o botao vira Restaurar')
          .toBeNull();
        expect(botaoDe('Restaurar Marcos')).toBeNull();
        expect(botaoDe('Contestar Ana Beatriz')).toBeNull();
        expect(botaoDe('Contestar Otávio')).toBeNull();
      });

      it('quem nao e lider nao ve Contestar nem Restaurar', async () => {
        eu.set(ALUNO);
        await abrir((r) => r.flush(DOCENTES));

        expect(botaoDe('Contestar Marcos')).toBeNull();
        expect(botaoDe('Restaurar Lúcia')).toBeNull();
      });

      it('pergunta antes (o que perde, e que so o lider desfaz) e nao chama nada ate confirmar', async () => {
        await abrir((r) => r.flush(DOCENTES));

        botaoDe('Contestar Marcos')!.click();
        fixture.detectChanges();

        backend.expectNone(URL_CONTESTAR);
        const aviso = fixture.nativeElement.querySelector('.alerta')
          .textContent as string;
        expect(aviso).toContain('Marcos');
        expect(aviso).toContain('perde o poder e o selo');
        expect(aviso)
          .withContext('contestar nao e banir: so tira o poder DAQUI')
          .toContain('Nas outras turmas');
        expect(aviso).toContain('Restaurar');

        botao('Cancelar')!.click();
        fixture.detectChanges();
        backend.expectNone(URL_CONTESTAR);
        expect(fixture.nativeElement.querySelector('.alerta')).toBeNull();
      });

      it('confirmar contesta pela rota certa, relê a turma e a linha perde o selo', async () => {
        await abrir((r) => r.flush(DOCENTES));
        botaoDe('Contestar Marcos')!.click();
        fixture.detectChanges();

        confirmar('contestar-confirmar').click();
        const req = backend.expectOne(URL_CONTESTAR);
        expect(req.request.method).toBe('POST');
        req.flush(null, { status: 204, statusText: 'No Content' });
        // Aguarda a requisicao GET ser disparada: yield para a promise de
        // contestacao resolver, entao o recarregar disparar o GET.
        for (let i = 0; i < 10; i++) {
          await Promise.resolve();
        }
        fixture.detectChanges();

        backend.expectOne(URL_TURMA).flush({
          ...DOCENTES,
          membros: DOCENTES.membros.map((m) =>
            m.usuarioId === 'u4' ? { ...m, selo: null, contestado: true } : m,
          ),
        });
        await assentar();

        expect(membro('Marcos').querySelector('app-selo')).toBeNull();
        expect(membro('Marcos').querySelector('.tag')!.textContent).toContain(
          'contestado',
        );
        expect(botaoDe('Restaurar Marcos'))
          .withContext('o botao troca de lado')
          .not.toBeNull();
        expect(fixture.nativeElement.querySelector('.alerta'))
          .withContext('a pergunta fecha depois de contestar')
          .toBeNull();
      });

      it('Restaurar nao pergunta (so devolve o que contestar tirou) e relê a turma', async () => {
        await abrir((r) => r.flush(DOCENTES));

        botaoDe('Restaurar Lúcia')!.click();
        const req = backend.expectOne(URL_RESTAURAR);
        expect(req.request.method).toBe('POST');
        req.flush(null, { status: 204, statusText: 'No Content' });
        // Aguarda a requisicao GET ser disparada: yield para a promise de
        // restauracao resolver, entao o recarregar disparar o GET.
        for (let i = 0; i < 10; i++) {
          await Promise.resolve();
        }
        fixture.detectChanges();

        backend.expectOne(URL_TURMA).flush({
          ...DOCENTES,
          membros: DOCENTES.membros.map((m) =>
            m.usuarioId === 'u5' ? { ...m, selo: 'PROFESSOR', contestado: false } : m,
          ),
        });
        await assentar();

        expect(membro('Lúcia').querySelector('.tag')).toBeNull();
        expect(membro('Lúcia').querySelector('app-selo')!.textContent).toContain(
          'Professor',
        );
      });

      it('contestar que falha mostra o motivo e a pergunta continua aberta', async () => {
        await abrir((r) => r.flush(DOCENTES));
        botaoDe('Contestar Marcos')!.click();
        fixture.detectChanges();
        confirmar('contestar-confirmar').click();

        backend.expectOne(URL_CONTESTAR).flush(
          { detail: 'Só o líder contesta' },
          { status: 403, statusText: 'Forbidden' },
        );
        await assentar();

        expect(
          fixture.nativeElement.querySelector('.pf-erro').textContent,
        ).toContain('Só o líder contesta');
        expect(confirmar('contestar-confirmar'))
          .withContext('a pessoa continua com o poder: a tela nao sugere o contrario')
          .not.toBeNull();
        expect(membro('Marcos').querySelector('app-selo')).not.toBeNull();
      });
    });

    describe('"matérias que eu leciono" (professor)', () => {
      const caixas = () =>
        Array.from(
          fixture.nativeElement.querySelectorAll('.vinc input[type="checkbox"]'),
        ) as HTMLInputElement[];

      /** Professor entra: turma, depois as materias que ele vai marcar. */
      async function abrirComoProfessor(
        turma: object = DOCENTES,
        eu_: object = MARCOS,
      ): Promise<void> {
        eu.set(eu_ as typeof OTAVIO);
        fixture.detectChanges();
        fixture.componentInstance.ionViewWillEnter();
        backend.expectOne(URL_TURMA).flush(turma);
        await fixture.whenStable();
        backend.expectOne(URL_MATERIAS).flush(MATERIAS);
        await assentar();
      }

      it('uma caixa por materia da turma, ja marcadas as que ele declarou', async () => {
        await abrirComoProfessor();

        const rotulos = textos('.vinc label');
        expect(rotulos.length).toBe(3);
        expect(rotulos[0]).toContain('Banco de Dados');
        expect(rotulos[1]).toContain('Engenharia de Software');
        expect(rotulos[2]).toContain('Cálculo');
        expect(caixas().map((c) => c.checked)).toEqual([true, true, false]);
      });

      it('so o professor tem o bloco — e so ele pede as materias', async () => {
        // O `verify` do afterEach acusa um GET /materias que o aluno, o lider ou a
        // coordenacao nao tinham motivo para fazer.
        eu.set(ALUNO);
        await abrir((r) => r.flush(DOCENTES));
        expect(fixture.nativeElement.querySelector('.vinc')).toBeNull();
      });

      it('Salvar manda o conjunto inteiro (substitui) e relê a turma', async () => {
        await abrirComoProfessor();

        // Tira ENG SW, poe CALC.
        caixas()[1].click();
        caixas()[2].click();
        fixture.detectChanges();
        backend.expectNone(`${URL_TURMA}/lecionadas`);

        botao('Salvar matérias')!.click();
        const req = backend.expectOne(`${URL_TURMA}/lecionadas`);
        expect(req.request.method).toBe('PUT');
        expect(req.request.body).toEqual({ materiaIds: ['m-bd', 'm-calc'] });
        req.flush(null, { status: 204, statusText: 'No Content' });
        // Aguarda a requisicao GET ser disparada: yield para a promise de
        // declaracao resolver, entao o recarregar disparar o GET.
        for (let i = 0; i < 10; i++) {
          await Promise.resolve();
        }
        fixture.detectChanges();

        backend.expectOne(URL_TURMA).flush(DOCENTES);
        await assentar();

        expect(botao('Salvo ✓'))
          .withContext('feedback de que gravou')
          .toBeDefined();
      });

      it('salvar que falha mostra o motivo e mantem as marcas para tentar de novo', async () => {
        await abrirComoProfessor();
        caixas()[2].click();
        fixture.detectChanges();

        botao('Salvar matérias')!.click();
        backend.expectOne(`${URL_TURMA}/lecionadas`).flush(
          { detail: 'Matéria não encontrada' },
          { status: 404, statusText: 'Not Found' },
        );
        await assentar();

        expect(
          fixture.nativeElement.querySelector('.pf-erro').textContent,
        ).toContain('Matéria não encontrada');
        expect(caixas().map((c) => c.checked)).toEqual([true, true, true]);
      });

      it('professor contestado: a nota diz que a declaracao nao vale ate o lider restaurar', async () => {
        await abrirComoProfessor(
          {
            ...DOCENTES,
            membros: DOCENTES.membros.map((m) =>
              m.usuarioId === 'u4' ? { ...m, selo: null, contestado: true } : m,
            ),
          },
          MARCOS,
        );

        expect(fixture.nativeElement.textContent as string).toContain(
          'elas não valem até ele restaurar',
        );
      });

      it('conta pendente declara, e a nota diz que fica guardada ate a aprovacao', async () => {
        await abrirComoProfessor(DOCENTES, {
          ...MARCOS,
          tipoConta: 'PROFESSOR',
          docenteStatus: 'PENDENTE',
        });

        expect(fixture.nativeElement.textContent as string).toContain(
          'passa a valer quando sua conta for aprovada',
        );
        // Pendente nao tem alcance (meuAlcance NENHUM), mas a declaracao guardada
        // continua marcada: so o alcance a faria sumir da tela.
        expect(caixas().map((c) => c.checked)).toEqual([true, true, false]);
      });
    });

    describe('titulo da turma', () => {
      it('docente ve o nome da turma ativa enquanto a turma carrega; aluno ve o de sempre', async () => {
        nomeAtivo.set('ADS 3A');
        fixture.detectChanges();
        expect(textos('ion-title')).toEqual(['ADS 3A']);

        // Chegou: vale o nome lido, que e o mais fresco (o lider pode ter renomeado).
        fixture.componentInstance.ionViewWillEnter();
        backend.expectOne(URL_TURMA).flush(TURMA);
        await fixture.whenStable();
        for (const r of backend.match(URL_OCULTADOS)) r.flush([]);
        await assentar();
        expect(textos('ion-title')).toEqual(['Fans 2026.2']);
      });

      it('aluno: sem turma ativa guardada, o titulo continua "A turma" ate carregar', () => {
        fixture.detectChanges();
        expect(textos('ion-title')).toEqual(['A turma']);
      });
    });
  });
});
