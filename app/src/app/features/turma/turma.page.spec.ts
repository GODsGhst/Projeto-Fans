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
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    irPara = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(TurmaPage);
  });

  afterEach(() => {
    backend.verify();
    eu.set(OTAVIO);
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
});
