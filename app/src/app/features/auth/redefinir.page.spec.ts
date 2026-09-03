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
import { RedefinirPage } from './redefinir.page';

describe('RedefinirPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<RedefinirPage>;
  let irPara: jasmine.Spy;

  function montar(token: string | null): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: new Map([['token', token]]) },
          },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    irPara = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(RedefinirPage);
    fixture.detectChanges();
  }

  afterEach(() => backend.verify());

  function campo(nome: string): HTMLInputElement {
    return fixture.nativeElement.querySelector(`input[name="${nome}"]`);
  }

  function preencher(nome: string, valor: string): void {
    campo(nome).value = valor;
    campo(nome).dispatchEvent(new Event('input'));
  }

  function salvar(): void {
    (
      Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ) as HTMLButtonElement[]
    )
      .find((b) => b.textContent!.includes('Salvar'))!
      .click();
    fixture.detectChanges();
  }

  it('com token no link, o campo de token nem aparece', () => {
    montar('tok-123');
    expect(campo('token')).toBeNull();
  });

  it('sem token no link, da para colar o token a mao', () => {
    // O link do e-mail e a via normal. Mas o app roda no perfil de teste, onde o
    // token so existe no log do servidor — e cliente de e-mail quebra link.
    montar(null);
    expect(campo('token')).not.toBeNull();
  });

  it('manda o token do link com a senha nova e volta para o login', async () => {
    montar('tok-123');
    preencher('senha', 'segredo12');
    preencher('confirma', 'segredo12');
    salvar();

    const req = backend.expectOne(`${environment.apiUrl}/auth/senha/reset`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      token: 'tok-123',
      novaSenha: 'segredo12',
    });
    req.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(irPara).toHaveBeenCalledWith('/login');
  });

  it('senhas diferentes nem chegam ao servidor', () => {
    // O backend nao tem como pegar isto: ele recebe uma senha so. Se a tela
    // deixasse passar, a conta ficaria com a senha digitada errada.
    montar('tok-123');
    preencher('senha', 'segredo12');
    preencher('confirma', 'segredo13');
    salvar();

    backend.expectNone(`${environment.apiUrl}/auth/senha/reset`);
    expect(
      fixture.nativeElement.querySelector('.pf-erro')!.textContent,
    ).toContain('iguais');
  });

  it('senha curta demais nem chega ao servidor', () => {
    montar('tok-123');
    preencher('senha', 'curta');
    preencher('confirma', 'curta');
    salvar();

    backend.expectNone(`${environment.apiUrl}/auth/senha/reset`);
    expect(
      fixture.nativeElement.querySelector('.pf-erro')!.textContent,
    ).toContain('8');
  });

  it('token expirado aparece com o recado do servidor, e a tela nao sai do ar', async () => {
    montar('tok-velho');
    preencher('senha', 'segredo12');
    preencher('confirma', 'segredo12');
    salvar();

    backend
      .expectOne(`${environment.apiUrl}/auth/senha/reset`)
      .flush(
        { detail: 'Token de reset expirado ou já usado' },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.pf-erro')!.textContent,
    ).toContain('expirado');
    expect(irPara).not.toHaveBeenCalled();
    expect(campo('senha')).not.toBeNull();
  });
});
