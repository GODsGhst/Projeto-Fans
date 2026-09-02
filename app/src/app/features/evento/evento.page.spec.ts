import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { environment } from '../../../environments/environment';
import { erroHttpInterceptor } from '../../core/http-error.interceptor';
import type { EventoDetalhe, Material } from '../../data/models';
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
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'e1' }) } },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EventoPage);
  });

  afterEach(() => backend.verify());

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
});
