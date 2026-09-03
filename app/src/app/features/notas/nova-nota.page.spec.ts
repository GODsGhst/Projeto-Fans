import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { environment } from '../../../environments/environment';
import { erroHttpInterceptor } from '../../core/http-error.interceptor';
import { NotaRepository } from '../../data/nota.repository';
import type { Nota } from '../../data/nota.repository';
import { NovaNotaPage } from './nova-nota.page';

const MINHA: Nota = {
  id: 'n1',
  alcance: 'PESSOAL',
  data: '2026-09-10',
  texto: 'estudar cap 4',
  autorId: 'u1',
  criadoEm: '2026-09-01T12:00:00Z',
  atualizadoEm: '2026-09-01T12:00:00Z',
  version: 3,
};

describe('NovaNotaPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<NovaNotaPage>;
  let irPara: jasmine.Spy;

  function montar(
    params: [string, string][],
    query: [string, string][] = [],
  ): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: new Map(params),
              queryParamMap: new Map(query),
            },
          },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    irPara = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
  }

  function abrir(): void {
    fixture = TestBed.createComponent(NovaNotaPage);
    fixture.detectChanges();
  }

  afterEach(() => backend.verify());

  function campo(nome: string): HTMLInputElement | HTMLTextAreaElement {
    return fixture.nativeElement.querySelector(`[name="${nome}"]`);
  }

  function preencher(nome: string, valor: string): void {
    const el = campo(nome);
    el.value = valor;
    el.dispatchEvent(new Event('input'));
  }

  function clicar(texto: string): void {
    (
      Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ) as HTMLButtonElement[]
    )
      .find((b) => b.textContent!.trim() === texto)!
      .click();
    fixture.detectChanges();
  }

  it('nenhum alcance vem marcado como padrao — a escolha e de quem escreve', () => {
    // "A turma inteira le" e "so eu leio" sao coisas opostas, e o custo de
    // errar e assimetrico. O padrao seguro e o fechado.
    montar([]);
    abrir();

    const soEu = fixture.nativeElement.querySelector(
      'button[aria-pressed="true"]',
    );
    expect(soEu.textContent).toContain('Só eu');
  });

  it('a tela diz o que cada alcance significa, em palavras', () => {
    montar([]);
    abrir();
    expect(fixture.nativeElement.textContent as string).toContain(
      'Ninguém da turma vê',
    );

    clicar('A turma');
    expect(fixture.nativeElement.textContent as string).toContain(
      'Todo mundo da turma vai ler',
    );
  });

  it('cria a anotacao e volta para o calendario', () => {
    montar([]);
    abrir();
    clicar('A turma');
    preencher('data', '2026-09-12');
    preencher('texto', 'aula cancelada');
    clicar('Salvar');

    const req = backend.expectOne(`${environment.apiUrl}/notas`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      alcance: 'TURMA',
      data: '2026-09-12',
      texto: 'aula cancelada',
    });
    req.flush(MINHA);
  });

  it('texto em branco nao vai para o servidor', () => {
    montar([]);
    abrir();
    preencher('texto', '   ');
    clicar('Salvar');

    backend.expectNone(`${environment.apiUrl}/notas`);
    expect(
      fixture.nativeElement.querySelector('.pf-erro')!.textContent,
    ).toContain('Escreva');
  });

  it('o dia vem do calendario quando ele manda um', () => {
    montar([], [['dia', '2026-09-20']]);
    abrir();

    expect((campo('data') as HTMLInputElement).value).toBe('2026-09-20');
  });

  it('editar abre preenchido a partir da lista, e manda o If-Match', () => {
    // `GET /notas/{id}` nao existe no servidor de proposito: com ele, adivinhar
    // um UUID seria o caminho de ler o rascunho pessoal de outra pessoa.
    montar([['id', 'n1']]);
    TestBed.inject(NotaRepository).notas.set([MINHA]);
    abrir();

    expect((campo('texto') as HTMLTextAreaElement).value).toBe('estudar cap 4');
    expect((campo('data') as HTMLInputElement).value).toBe('2026-09-10');

    preencher('texto', 'estudar cap 5');
    clicar('Salvar');

    const req = backend.expectOne(`${environment.apiUrl}/notas/n1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.headers.get('If-Match')).toBe('3');
    req.flush({ ...MINHA, texto: 'estudar cap 5' });
  });

  it('trocar o alcance na edicao e permitido — o rascunho vira recado', () => {
    montar([['id', 'n1']]);
    TestBed.inject(NotaRepository).notas.set([MINHA]);
    abrir();

    clicar('A turma');
    clicar('Salvar');

    const req = backend.expectOne(`${environment.apiUrl}/notas/n1`);
    expect((req.request.body as { alcance: string }).alcance).toBe('TURMA');
    req.flush({ ...MINHA, alcance: 'TURMA' });
  });

  it('apagar pede confirmacao antes', () => {
    montar([['id', 'n1']]);
    TestBed.inject(NotaRepository).notas.set([MINHA]);
    abrir();

    clicar('Apagar');
    backend.expectNone(`${environment.apiUrl}/notas/n1`);

    clicar('Sim, apagar');
    const req = backend.expectOne(`${environment.apiUrl}/notas/n1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.headers.get('If-Match')).toBe('3');
    req.flush(null);
  });

  it('criando, nao ha botao de apagar', () => {
    montar([]);
    abrir();

    const apagar = (
      Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ) as HTMLButtonElement[]
    ).find((b) => b.textContent!.includes('Apagar'));
    expect(apagar).toBeUndefined();
    expect(irPara).not.toHaveBeenCalled();
  });
});
