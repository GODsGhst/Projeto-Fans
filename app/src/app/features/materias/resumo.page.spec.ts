import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { environment } from '../../../environments/environment';
import { ChaveIaService } from '../../core/chave-ia.service';
import { erroHttpInterceptor } from '../../core/http-error.interceptor';
import type { Material } from '../../data/models';
import { ResumoPage } from './resumo.page';

const MATERIAL: Material = {
  id: 'm1',
  tipo: 'AULA',
  titulo: 'Slides da aula 3',
  url: 'https://exemplo.com/aula3.pdf',
  arquivoRef: null,
  materiaId: 'mat1',
  autoria: {
    autorId: 'u2',
    autorNome: 'Ana',
    criadoEm: '2026-09-01T12:00:00Z',
    atualizadoEm: '2026-09-01T12:00:00Z',
  },
  version: 1,
  visivelTurma: true,
  excluidoEm: null,
  resumo: null,
  resumoEm: null,
};

describe('ResumoPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<ResumoPage>;

  function montar(chave: string): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: new Map([['id', 'm1']]) } },
        },
        {
          provide: ChaveIaService,
          useValue: {
            ler: () => Promise.resolve(chave),
            gravar: () => Promise.resolve(),
            mascarada: () => Promise.resolve(''),
          },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ResumoPage);
  }

  afterEach(() => backend.verify());

  async function abrir(material: Material): Promise<void> {
    fixture.detectChanges();
    backend.expectOne(`${environment.apiUrl}/materiais/m1`).flush(material);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /**
   * Clica e espera. `gerar()` le a chave do disco ANTES de mandar o pedido,
   * entao o POST ainda nao saiu no instante do clique.
   */
  async function clicar(texto: string): Promise<void> {
    botao(texto)!.click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function botao(texto: string): HTMLButtonElement | undefined {
    return (
      Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ) as HTMLButtonElement[]
    ).find((b) => b.textContent!.includes(texto));
  }

  it('abrir a tela NAO gera resumo — gerar custa dinheiro de quem colou a chave', async () => {
    montar('sk-ant-abc');
    await abrir(MATERIAL);

    // Se a tela gerasse sozinha, abrir por engano cobraria da chave da pessoa.
    backend.expectNone(`${environment.apiUrl}/materiais/m1/resumo`);
    expect(botao('Gerar resumo')).toBeDefined();
  });

  it('gerar manda a chave no header, e nunca no corpo', async () => {
    montar('sk-ant-abc');
    await abrir(MATERIAL);
    await clicar('Gerar resumo');

    const req = backend.expectOne(`${environment.apiUrl}/materiais/m1/resumo`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('X-IA-Key')).toBe('sk-ant-abc');
    expect(JSON.stringify(req.request.body)).not.toContain('sk-ant');
    req.flush({
      ...MATERIAL,
      resumo: 'Fala de derivadas.',
      resumoEm: '2026-09-03T12:00:00Z',
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent as string).toContain(
      'Fala de derivadas.',
    );
  });

  it('com resumo pronto ele aparece sem custar nada, e refazer e outro botao', async () => {
    montar('sk-ant-abc');
    await abrir({
      ...MATERIAL,
      resumo: 'Ja resumido.',
      resumoEm: '2026-09-02T12:00:00Z',
    });

    backend.expectNone(`${environment.apiUrl}/materiais/m1/resumo`);
    expect(fixture.nativeElement.textContent as string).toContain(
      'Ja resumido.',
    );
    expect(botao('Refazer o resumo')).toBeDefined();
  });

  it('refazer avisa o servidor que e para gastar de novo', async () => {
    montar('sk-ant-abc');
    await abrir({
      ...MATERIAL,
      resumo: 'Ja resumido.',
      resumoEm: '2026-09-02T12:00:00Z',
    });
    await clicar('Refazer o resumo');

    const req = backend.expectOne((r) =>
      r.url.includes('/materiais/m1/resumo'),
    );
    expect(req.request.url).toContain('refazer=true');
    req.flush({
      ...MATERIAL,
      resumo: 'Outro.',
      resumoEm: '2026-09-03T12:00:00Z',
    });
    await fixture.whenStable();
  });

  it('sem chave no aparelho, a tela manda para Ajustes em vez de falhar no servidor', async () => {
    montar('');
    await abrir(MATERIAL);

    expect(botao('Gerar resumo')).toBeUndefined();
    expect(
      fixture.nativeElement.querySelector('a[href="/tabs/ajustes"]'),
    ).not.toBeNull();
  });

  it('a tela sempre diz que o texto e de IA', async () => {
    // Sem isso o resumo passa a ser lido como se fosse do professor.
    montar('sk-ant-abc');
    await abrir({
      ...MATERIAL,
      resumo: 'Ja resumido.',
      resumoEm: '2026-09-02T12:00:00Z',
    });

    expect(fixture.nativeElement.textContent as string).toContain('IA');
  });

  it('erro do servidor aparece e a tela continua utilizavel', async () => {
    montar('sk-ant-abc');
    await abrir(MATERIAL);
    await clicar('Gerar resumo');

    backend
      .expectOne(`${environment.apiUrl}/materiais/m1/resumo`)
      .flush(
        { detail: 'A IA recusou a sua chave. Confira em Ajustes.' },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.pf-erro')!.textContent,
    ).toContain('recusou');
    expect(botao('Gerar resumo')).toBeDefined();
  });
});
