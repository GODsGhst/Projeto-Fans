import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { StorageFake, USUARIO, configurarTeste } from './auth-teste';
import { CadastroPage } from './cadastro.page';

describe('CadastroPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<CadastroPage>;
  let storage: StorageFake;
  let irPara: jasmine.Spy;

  beforeEach(() => {
    storage = new StorageFake();
    backend = configurarTeste(storage);
    irPara = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(CadastroPage);
    fixture.detectChanges();
  });

  afterEach(() => backend.verify());

  it('o botao diz que o servidor esta acordando quando a espera passa de 4s', () => {
    // O bug relatado em 2026-09-01: o botao ficou em "Criando…" por 45 s porque o
    // plano gratuito do Render dorme e paga cold start. O codigo estava certo, mas
    // um rotulo que nao muda por 45 s le como app travado, e a pessoa fecha.
    jasmine.clock().install();
    try {
      const req = enviar();
      fixture.detectChanges();
      expect(botao().textContent!.trim()).toBe('Criando…');

      jasmine.clock().tick(4000);
      fixture.detectChanges();
      expect(botao().textContent!.trim())
        .withContext('depois de 4s o rotulo tem de explicar a demora')
        .toBe('Acordando o servidor…');

      req.flush({ jwt: 'j', usuario: USUARIO });
    } finally {
      jasmine.clock().uninstall();
    }
  });

  function botao(): HTMLButtonElement {
    return (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
    ).find((b) => /Criar conta|Criando|Acordando/.test(b.textContent!))!;
  }

  function digitar(seletor: string, valor: string): void {
    const campo = fixture.nativeElement.querySelector(seletor) as HTMLInputElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  function enviar() {
    digitar('input[type="text"]', 'Otavio');
    digitar('input[type="email"]', 'voce@exemplo.com');
    digitar('input[type="password"]', 'senha-de-oito');
    (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
    ).find((b) => b.textContent!.trim() === 'Criar conta')!.click();
    return backend.expectOne(`${environment.apiUrl}/auth/registrar`);
  }

  async function assentar(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function erroNaTela(): string {
    const p = fixture.nativeElement.querySelector('.pf-erro') as HTMLElement | null;
    return p === null ? '' : p.textContent!.trim();
  }

  it('cadastro leva para a tela de entrar na turma, nao direto para as abas', async () => {
    // Quem acabou de se cadastrar nao tem vinculo de turma. Cair nas abas agora
    // seria 404 em todas elas, sem a pessoa entender por que.
    const req = enviar();
    expect(req.request.body).toEqual({
      nome: 'Otavio',
      email: 'voce@exemplo.com',
      senha: 'senha-de-oito',
    });

    req.flush({ jwt: 'jwt-123', usuario: USUARIO });
    await assentar();

    expect(irPara).toHaveBeenCalledWith('/entrar-turma');
    expect(irPara).not.toHaveBeenCalledWith('/tabs/home');
    expect(storage.sessao?.jwt).withContext('a sessao ja vale: /turmas/entrar exige Bearer').toBe(
      'jwt-123',
    );
  });

  it('e-mail ja cadastrado mostra a mensagem do servidor e mantem a pessoa na tela', async () => {
    const req = enviar();
    req.flush({ detail: 'Ja existe conta com este e-mail' }, { status: 409, statusText: 'Conflict' });
    await assentar();

    expect(erroNaTela()).toContain('Ja existe conta com este e-mail');
    expect(irPara).not.toHaveBeenCalled();
  });
});
