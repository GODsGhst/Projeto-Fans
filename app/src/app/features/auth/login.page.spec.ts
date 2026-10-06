import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { StorageFake, USUARIO, configurarTeste } from './auth-teste';
import { LoginPage } from './login.page';

describe('LoginPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<LoginPage>;
  let storage: StorageFake;
  let auth: AuthService;
  let irPara: jasmine.Spy;

  beforeEach(() => {
    storage = new StorageFake();
    backend = configurarTeste(storage);
    auth = TestBed.inject(AuthService);
    irPara = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
  });

  afterEach(() => backend.verify());

  function digitar(seletor: string, valor: string): void {
    const campo = fixture.nativeElement.querySelector(
      seletor,
    ) as HTMLInputElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  function clicar(rotulo: string): void {
    const botoes = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    const alvo = botoes.find((b) => b.textContent!.trim() === rotulo);
    expect(alvo).withContext(`botao "${rotulo}"`).toBeDefined();
    alvo!.click();
  }

  function erroNaTela(): string {
    const p = fixture.nativeElement.querySelector(
      '.pf-erro',
    ) as HTMLElement | null;
    return p === null ? '' : p.textContent!.trim();
  }

  /** Preenche, envia e devolve a requisicao pendente de `POST /auth/login`. */
  function enviar(senha = 'senha-certa') {
    digitar('input[type="email"]', 'voce@exemplo.com');
    digitar('input[type="password"]', senha);
    clicar('Entrar');
    return backend.expectOne(`${environment.apiUrl}/auth/login`);
  }

  async function assentar(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('entrar com credencial valida guarda a sessao e vai para as abas', async () => {
    const req = enviar();
    expect(req.request.body).toEqual({
      email: 'voce@exemplo.com',
      senha: 'senha-certa',
    });

    req.flush({ jwt: 'jwt-123', usuario: USUARIO });
    await assentar();

    expect(auth.autenticado()).withContext('sessao em memoria').toBeTrue();
    expect(storage.sessao?.jwt)
      .withContext('sessao gravada no aparelho')
      .toBe('jwt-123');
    expect(irPara).toHaveBeenCalledWith('/tabs/home');
    expect(erroNaTela()).toBe('');
  });

  it('senha errada mostra a mensagem do servidor e NAO navega', async () => {
    const req = enviar('senha-errada');
    req.flush(
      { detail: 'E-mail ou senha invalidos' },
      { status: 401, statusText: 'Unauthorized' },
    );
    await assentar();

    expect(erroNaTela()).toContain('E-mail ou senha invalidos');
    expect(irPara).not.toHaveBeenCalledWith('/tabs/home');
    expect(auth.autenticado()).toBeFalse();
    expect(storage.sessao).toBeNull();
  });

  it('falha de rede mostra mensagem diferente de senha errada', async () => {
    const req = enviar();
    req.error(new ProgressEvent('error'));
    await assentar();

    // "Nao consegui falar com o servidor" e "sua senha esta errada" sao coisas
    // opostas: uma pede tentar de novo, a outra pede corrigir o que foi digitado.
    expect(erroNaTela()).toContain('Sem conexão');
    expect(erroNaTela()).not.toContain('senha invalidos');
    expect(irPara).not.toHaveBeenCalledWith('/tabs/home');
  });

  it('sem Client ID do Google, o botao e o aviso do Google nao aparecem', () => {
    // Botao desabilitado com explicacao embaixo era lido como "o app quebrou".
    // Enquanto nao ha projeto no Google Cloud, a tela simplesmente nao oferece.
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).not.toContain('Google');
  });
});
