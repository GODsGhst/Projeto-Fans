import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { environment } from '../../../environments/environment';
import { erroHttpInterceptor } from '../../core/http-error.interceptor';
import type { EventoDetalhe, Material } from '../../data/models';
import { AuthService } from '../../core/auth.service';
import { TurmaRepository } from '../../data/turma.repository';
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

const usuarioAtual = signal<{ id: string; nome: string; email: string } | null>({
  id: 'u1',
  nome: 'Otavio',
  email: 'voce@exemplo.com',
});

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
        { provide: AuthService, useValue: { usuario: usuarioAtual } },
        {
          provide: TurmaRepository,
          useValue: { souLider: liderancaMinha, garantirCarregada: () => Promise.resolve() },
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
  });

  async function abrir(responder: (r: ReturnType<HttpTestingController['expectOne']>) => void) {
    fixture.detectChanges();
    responder(backend.expectOne(`${environment.apiUrl}/eventos/e1`));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function textos(seletor: string): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll(seletor)).map((e) =>
      (e as HTMLElement).textContent!.trim(),
    );
  }

  it('material nao vinculado nao aparece na tela do evento', async () => {
    // `GET /eventos/{id}` ja devolve SOMENTE o que esta vinculado. A tela nao
    // pode buscar material por materia para "completar" a lista: despejar a
    // materia inteira na tela de uma prova e exatamente o que o nao-negociavel
    // 11 proibe.
    await abrir((r) => r.flush(detalhe([material('mat-vinculado', 'Formas normais', 'x/fn.pdf')])));

    expect(textos('app-material-linha .titulo')).toEqual(['Formas normais']);
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Trabalho de outra aula',
    );
    backend.expectNone((r) => r.url.includes('/materia'));
  });

  it('evento sem material vinculado diz isso, e nao some com a lista', async () => {
    await abrir((r) => r.flush(detalhe([])));

    expect(fixture.nativeElement.querySelectorAll('app-material-linha').length).toBe(0);
    expect(fixture.nativeElement.querySelector('.pf-vazio')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.pf-aviso'))
      .withContext('evento sem material nao mostra aviso de falha')
      .toBeNull();
  });

  it('evento oculto ou excluido responde 404 e a tela diz que nao existe mais', async () => {
    // Mudanca do backend de 2026-08-31: registro oculto ou logicamente
    // excluido responde 404 para quem nao e o autor. Isso nao e "deu erro" —
    // e "isso nao existe mais".
    await abrir((r) => r.flush({ detail: 'Isso não existe mais.' }, { status: 404, statusText: 'Not Found' }));

    const sumiu = fixture.nativeElement.querySelector('.pf-sumiu') as HTMLElement | null;
    expect(sumiu).not.toBeNull();
    expect(sumiu!.textContent).toContain('Isso não existe mais.');
    expect(fixture.nativeElement.querySelector('.pf-aviso'))
      .withContext('404 nao e falha generica')
      .toBeNull();
    expect(fixture.nativeElement.querySelector('app-evento-card')).toBeNull();
  });

  it('falha de rede nao vira evento sem material', async () => {
    await abrir((r) => r.error(new ProgressEvent('error')));

    expect(fixture.nativeElement.querySelector('.pf-aviso')!.textContent).toContain(
      'Sem conexão',
    );
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

    const link = fixture.nativeElement.querySelector('a.anexar') as HTMLAnchorElement | null;
    expect(link).withContext('sem material e justamente quando anexar importa').not.toBeNull();
    expect(link!.getAttribute('href')).toBe('/tabs/eventos/e1/anexar');
  });

  it('a prova em outra sala diz onde e — a de sempre nao vira ruido', async () => {
    // Caso real: a prova caiu na sala do 2o periodo. Sem isto, quem confia no app
    // vai para a sala errada. E o contrario tambem importa: a esmagadora maioria
    // das provas e na sala de sempre, e repetir isso em todas viraria ruido que
    // ninguem le — entao a linha so aparece quando ha excecao.
    await abrir((r) => r.flush({ ...detalhe([]), sala: 'A-101' }));
    expect(fixture.nativeElement.querySelector('.sala')!.textContent).toContain('A-101');
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
    expect(fixture.nativeElement.querySelector('a[href="/tabs/eventos/e1/editar"]')).not.toBeNull();
  });

  it('quem NAO e o autor nao ve editar nem apagar', async () => {
    // "Só você" é a regra, e o servidor a aplica — mas mostrar o botão para quem
    // vai levar 403 é convidar ao erro e depois culpar a pessoa.
    usuarioAtual.set({ id: 'outra-pessoa', nome: 'Ana', email: 'ana@exemplo.com' });
    await abrir((r) => r.flush(detalhe([])));

    expect(fixture.nativeElement.querySelector('.do-autor')).toBeNull();
  });

  it('apagar pergunta antes, e so entao chama o servidor', async () => {
    await abrir((r) => r.flush(detalhe([])));

    const apagar = () =>
      (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(
        (b) => b.textContent!.trim() === 'Apagar',
      )!;
    apagar().click();
    fixture.detectChanges();

    // Nada foi para o servidor ainda: o primeiro toque só pergunta.
    backend.expectNone(`${environment.apiUrl}/eventos/e1`);
    expect(fixture.nativeElement.textContent as string).toContain('Apagar mesmo');

    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find((b) => b.textContent!.trim() === 'Sim, apagar')!
      .click();

    const req = backend.expectOne(`${environment.apiUrl}/eventos/e1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.headers.get('If-Match'))
      .withContext('sem If-Match o servidor apaga por cima de uma edicao de outra pessoa')
      .toBe('1');
    req.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('desistir de apagar nao manda nada', async () => {
    await abrir((r) => r.flush(detalhe([])));

    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find((b) => b.textContent!.trim() === 'Apagar')!
      .click();
    fixture.detectChanges();
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find((b) => b.textContent!.trim() === 'Cancelar')!
      .click();
    fixture.detectChanges();

    backend.expectNone(`${environment.apiUrl}/eventos/e1`);
    expect(fixture.nativeElement.textContent as string).not.toContain('Apagar mesmo');
  });

  it('o lider pode ocultar da turma, com motivo', async () => {
    // As telas dizem que "o líder só oculta o que não devia estar ali". A API de
    // moderação inteira existia no servidor e o app nunca chamou nenhuma rota
    // dela — o papel existia nos dados e não tinha um único botão.
    liderancaMinha.set(true);
    usuarioAtual.set({ id: 'outro', nome: 'Ana', email: 'ana@exemplo.com' });
    await abrir((r) => r.flush(detalhe([])));

    const ocultar = () =>
      (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(
        (b) => b.textContent!.includes('Ocultar'),
      );
    expect(ocultar()).withContext('o lider precisa de um jeito de tirar da lista').toBeDefined();

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
      Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
    ).find((b) => b.textContent!.trim() === 'Ocultar da turma')!.click();

    const req = backend.expectOne(`${environment.apiUrl}/moderacao/evento/e1/ocultar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ motivo: 'foto indevida' });
    req.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();
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

  it('motivo em branco ainda oculta — explicar e util, nao obrigatorio', async () => {
    // O servidor aceita motivo nulo. Exigir texto faria o líder inventar um para
    // conseguir agir, e motivo inventado é pior que motivo ausente: ele fica no
    // registro de moderação como se fosse verdade.
    liderancaMinha.set(true);
    await abrir((r) => r.flush(detalhe([])));

    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find((b) => b.textContent!.includes('Ocultar'))!
      .click();
    fixture.detectChanges();
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find((b) => b.textContent!.trim() === 'Ocultar da turma')!
      .click();

    const req = backend.expectOne(`${environment.apiUrl}/moderacao/evento/e1/ocultar`);
    expect(req.request.body).toEqual({ motivo: null });
    req.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();
  });
});
