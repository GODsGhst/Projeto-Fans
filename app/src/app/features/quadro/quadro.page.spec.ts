import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { environment } from '../../../environments/environment';
import { erroHttpInterceptor } from '../../core/http-error.interceptor';
import type {
  Evento,
  ItemHome,
  Material,
  MeuQuadro,
  NaoListados,
} from '../../data/models';
import { QuadroPage } from './quadro.page';

const AUTORIA = {
  autorId: 'u1',
  autorNome: 'Otavio',
  criadoEm: '2026-08-30T12:00:00Z',
  atualizadoEm: '2026-08-30T12:00:00Z',
};

function item(
  id: string,
  titulo: string,
  feitoPeloUsuario = false,
  tipo: 'PROVA' | 'ENTREGA' = 'ENTREGA',
): ItemHome {
  return {
    eventoId: id,
    tipo,
    titulo,
    data: '2026-09-10',
    hora: null,
    materiaSigla: 'BD',
    materiaCorHex: '#0369A1',
    autoria: AUTORIA,
    feitoPeloUsuario,
  };
}

function evento(titulo: string, patch: Partial<Evento> = {}): Evento {
  return {
    id: 'ev-oculto',
    tipo: 'PROVA',
    titulo,
    data: '2026-09-12',
    hora: null,
    materiaId: 'm1',
    materiaSigla: 'ALG',
    materiaCorHex: '#B91C1C',
    autoria: AUTORIA,
    version: 1,
    visivelTurma: false,
    excluidoEm: null,
    ...patch,
  };
}

function material(titulo: string, patch: Partial<Material> = {}): Material {
  return {
    id: 'mat-oculto',
    tipo: 'ADICIONAL',
    titulo,
    url: 'https://exemplo.test/resumo.pdf',
    arquivoRef: null,
    materiaId: 'm1',
    autoria: AUTORIA,
    version: 1,
    visivelTurma: false,
    excluidoEm: null,
    ...patch,
  };
}

const VAZIO: NaoListados = { eventos: [], materiais: [] };

describe('QuadroPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<QuadroPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(QuadroPage);
  });

  afterEach(() => backend.verify());

  /** Cria a tela e responde as duas chamadas que ela dispara ao abrir. */
  async function abrir(
    quadro: (r: ReturnType<HttpTestingController['expectOne']>) => void,
    naoListados: (r: ReturnType<HttpTestingController['expectOne']>) => void,
    // Pedido de exclusao e raro: quase todo mundo nunca tem nenhum, entao o
    // padrao e lista vazia e so o teste que fala deles responde outra coisa.
    // Sem isto o `verify()` acusa a chamada pendente em TODO teste da tela.
    pedidos: (r: ReturnType<HttpTestingController['expectOne']>) => void = (
      r,
    ) => r.flush([]),
  ) {
    // O Ionic chama isto ao entrar na aba; o TestBed nao chama sozinho.
    fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
    quadro(backend.expectOne(`${environment.apiUrl}/meu-quadro`));
    naoListados(backend.expectOne(`${environment.apiUrl}/nao-listados`));
    pedidos(backend.expectOne(`${environment.apiUrl}/moderacao/pedidos`));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function coluna(indice: number): string[] {
    const colunas = fixture.nativeElement.querySelectorAll('.coluna');
    return Array.from(
      (colunas[indice] as HTMLElement).querySelectorAll(
        'app-mini-card .titulo',
      ),
    ).map((e) => (e as HTMLElement).textContent!.trim());
  }

  it('as duas colunas saem do servidor, nao de filtro no cliente', async () => {
    // O item de "feito" vem com feitoPeloUsuario=false de proposito: se a pagina
    // remontar as colunas por conta propria em vez de usar as listas que o
    // servidor mandou, ele cai na coluna errada e isto fica vermelho.
    const quadro: MeuQuadro = {
      aFazer: [item('e1', 'Lista 4'), item('e2', 'Prova 2')],
      feito: [item('e3', 'Diagrama', false)],
    };

    await abrir(
      (r) => r.flush(quadro),
      (r) => r.flush(VAZIO),
    );

    expect(coluna(0)).toEqual(['Lista 4', 'Prova 2']);
    expect(coluna(1)).toEqual(['Diagrama']);
  });

  it('nao listados nao aparece quando nao ha nada', async () => {
    await abrir(
      (r) => r.flush({ aFazer: [item('e1', 'Lista 4')], feito: [] }),
      (r) => r.flush(VAZIO),
    );

    expect(fixture.nativeElement.querySelector('.nao-listados'))
      .withContext('a maioria das pessoas nunca ve esta secao')
      .toBeNull();
  });

  it('nao listados separa o que o lider ocultou do que o autor excluiu', async () => {
    const ocultos: NaoListados = {
      eventos: [
        evento('Prova de grafos'),
        evento('Prova velha', {
          id: 'ev-excluido',
          visivelTurma: true,
          excluidoEm: '2026-08-20T10:00:00Z',
        }),
      ],
      materiais: [material('Resumo de grafos')],
    };

    await abrir(
      (r) => r.flush({ aFazer: [], feito: [] }),
      (r) => r.flush(ocultos),
    );

    const secao = fixture.nativeElement.querySelector(
      '.nao-listados',
    ) as HTMLElement | null;
    expect(secao).not.toBeNull();
    expect(secao!.textContent).toContain('oculto pelo líder');
    expect(secao!.textContent).toContain('excluído');
    // Material oculto tambem e do autor: some do feed e ele precisa saber.
    expect(secao!.textContent).toContain('Resumo de grafos');
  });

  it('falha ao carregar o quadro nao vira quadro vazio', async () => {
    // "Nada pendente." e "nao consegui buscar o que esta pendente" sao telas
    // opostas. Esta e a segunda, e ela nao pode se parecer com a primeira.
    await abrir(
      (r) => r.error(new ProgressEvent('error')),
      (r) => r.error(new ProgressEvent('error')),
    );

    expect(
      fixture.nativeElement.querySelector('.pf-aviso')!.textContent,
    ).toContain('Sem conexão');
    expect(fixture.nativeElement.querySelector('.kanban'))
      .withContext('sem dado nao ha kanban: coluna vazia aqui seria mentira')
      .toBeNull();
  });

  it('falha so em nao-listados nao esconde o quadro', async () => {
    await abrir(
      (r) => r.flush({ aFazer: [item('e1', 'Lista 4')], feito: [] }),
      (r) => r.error(new ProgressEvent('error')),
    );

    expect(coluna(0)).toEqual(['Lista 4']);
    expect(
      fixture.nativeElement.querySelector('.aviso-nao-listados')!.textContent,
    ).toContain('não listados');
    expect(fixture.nativeElement.querySelector('.nao-listados'))
      .withContext(
        'falhar ao buscar os ocultos nao e "voce nao tem nenhum oculto"',
      )
      .toBeNull();
  });

  it('marcar feito manda estado pessoal e rele o quadro', async () => {
    await abrir(
      (r) => r.flush({ aFazer: [item('e1', 'Lista 4')], feito: [] }),
      (r) => r.flush(VAZIO),
    );

    (
      fixture.nativeElement.querySelector(
        '.coluna .marcar',
      ) as HTMLButtonElement
    ).click();
    await fixture.whenStable();

    // PUT em /eventos/{id}/estado-pessoal, nunca PATCH no evento: feito e
    // estado pessoal e nao toca no fato compartilhado.
    const put = backend.expectOne(
      `${environment.apiUrl}/eventos/e1/estado-pessoal`,
    );
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ feito: true });
    put.flush(null);

    await fixture.whenStable();
    backend.expectOne(`${environment.apiUrl}/meu-quadro`).flush({
      aFazer: [],
      feito: [item('e1', 'Lista 4', true)],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(coluna(0)).toEqual([]);
    expect(coluna(1)).toEqual(['Lista 4']);
  });

  it('a barra leva para a turma', async () => {
    await abrir(
      (r) => r.flush({ aFazer: [], feito: [] }),
      (r) => r.flush(VAZIO),
    );

    expect(
      fixture.nativeElement.querySelector('a[href="/tabs/turma"]'),
    ).not.toBeNull();
  });

  it('recarregar nao apaga o quadro que ja esta na tela', async () => {
    // Agora que a aba recarrega a cada entrada, um spinner incondicional
    // esvaziaria o kanban a cada troca de aba — e num servidor que dorme isso
    // dura dezenas de segundos com a tela em branco. Some so na primeira carga,
    // quando nao ha nada a preservar.
    await abrir(
      (r) => r.flush({ aFazer: [item('e-1', 'Lista 4')], feito: [] }),
      (r) => r.flush({ eventos: [], materiais: [] }),
    );
    expect(fixture.nativeElement.querySelector('.kanban')).not.toBeNull();

    // volta para a aba: as duas chamadas saem de novo e ficam pendentes
    fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.kanban'))
      .withContext('o quadro tem de continuar visivel enquanto revalida')
      .not.toBeNull();

    backend
      .expectOne(`${environment.apiUrl}/meu-quadro`)
      .flush({ aFazer: [item('e-1', 'Lista 4')], feito: [] });
    backend
      .expectOne(`${environment.apiUrl}/nao-listados`)
      .flush({ eventos: [], materiais: [] });
    // Reentrar na aba recarrega TUDO, pedidos inclusive.
    backend.expectOne(`${environment.apiUrl}/moderacao/pedidos`).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('a acao diz o que a pessoa fez: prova se faz, entrega se entrega', async () => {
    // "marcar como resolvido" e linguagem de sistema de chamado, nao de aluno.
    // Ninguem "resolve" uma prova — faz. E ninguem "resolve" um trabalho —
    // entrega. Uma palavra so para as duas coisas economiza codigo e cobra do
    // leitor a traducao.
    await abrir(
      (r) =>
        r.flush({
          aFazer: [
            item('p1', 'Prova 2', false, 'PROVA'),
            item('e1', 'Lista 4', false, 'ENTREGA'),
          ],
          feito: [],
        }),
      (r) => r.flush({ eventos: [], materiais: [] }),
    );

    const rotulos = (
      Array.from(
        fixture.nativeElement.querySelectorAll('.marcar'),
      ) as HTMLElement[]
    ).map((b) => b.textContent!.trim());

    expect(rotulos[0]).withContext('prova se faz').toContain('feita');
    expect(rotulos[1]).withContext('entrega se entrega').toContain('entregue');
    expect(rotulos.join(' ')).not.toContain('resolvido');
  });

  it('cada acao carrega o vetor de confirmacao, nao so texto', async () => {
    // Alvo de toque de 11px de texto puro nao parece tocavel, e num quadro cheio
    // some entre os cartoes. O simbolo torna a acao visivel antes de ser lida.
    await abrir(
      (r) =>
        r.flush({ aFazer: [item('p1', 'Prova 2', false, 'PROVA')], feito: [] }),
      (r) => r.flush({ eventos: [], materiais: [] }),
    );

    expect(fixture.nativeElement.querySelector('.marcar svg'))
      .withContext('sem o vetor a acao e so uma linha de texto')
      .not.toBeNull();
  });

  it('o pedido do lider para eu apagar algo meu aparece aqui', async () => {
    // O outro lado de "pedir exclusao". Antes, o pedido ficava so no diario de
    // moderacao do servidor: o lider achava que tinha pedido e o autor nunca
    // ficava sabendo. Meu quadro e o lugar certo porque e a unica tela do app
    // que fala de mim, e nao da turma.
    await abrir(
      (r) => r.flush({ aFazer: [], feito: [] }),
      (r) => r.flush({ eventos: [], materiais: [] }),
      (r) =>
        r.flush([
          {
            registroTipo: 'EVENTO',
            registroId: 'e1',
            titulo: 'Prova duplicada',
            motivo: 'ja existe outra igual',
            pedidoPor: 'Lia',
            em: '2026-09-02T18:00:00Z',
          },
        ]),
    );

    const texto = fixture.nativeElement.querySelector('.pedidos')!
      .textContent as string;
    expect(texto).toContain('Prova duplicada');
    expect(texto)
      .withContext('sem o motivo o pedido vira uma ordem sem explicacao')
      .toContain('ja existe outra igual');
    expect(texto)
      .withContext('quem pediu importa: da para conversar com a pessoa')
      .toContain('Lia');
    expect(
      fixture.nativeElement.querySelector(
        '.pedidos a[href="/tabs/eventos/e1"]',
      ),
    )
      .withContext(
        'tem de levar ao registro — pedido sem caminho obriga a procurar',
      )
      .not.toBeNull();
  });

  it('sem pedido nenhum, a secao nao existe', async () => {
    // Quase todo mundo nunca vera esta secao. Uma caixa vazia dizendo "nenhum
    // pedido" seria ruido permanente para explicar uma coisa que nao aconteceu.
    await abrir(
      (r) => r.flush({ aFazer: [], feito: [] }),
      (r) => r.flush({ eventos: [], materiais: [] }),
    );

    expect(fixture.nativeElement.querySelector('.pedidos')).toBeNull();
  });
});
