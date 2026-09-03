import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { environment } from '../../../environments/environment';
import { StorageFake, configurarTeste } from './auth-teste';
import { RecuperarPage } from './recuperar.page';

describe('RecuperarPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<RecuperarPage>;

  // Os testes abaixo descrevem a tela COM recuperacao no ar. O deploy de hoje
  // roda sem SMTP e a flag e `false`; ligar aqui mantem esses testes cobrindo o
  // comportamento que volta assim que houver e-mail de verdade — em vez de eles
  // sumirem junto com a tela e ninguem notar que quebraram.
  const flagOriginal = environment.recuperacaoPorEmail;

  beforeEach(() => {
    environment.recuperacaoPorEmail = true;
    backend = configurarTeste(new StorageFake());
    fixture = TestBed.createComponent(RecuperarPage);
    fixture.detectChanges();
  });

  afterEach(() => {
    environment.recuperacaoPorEmail = flagOriginal;
  });

  afterEach(() => backend.verify());

  function enviar() {
    const campo = fixture.nativeElement.querySelector(
      'input[type="email"]',
    ) as HTMLInputElement;
    campo.value = 'voce@exemplo.com';
    campo.dispatchEvent(new Event('input'));
    (
      Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ) as HTMLButtonElement[]
    )
      .find((b) => b.textContent!.trim() === 'Enviar link')!
      .click();
    return backend.expectOne(`${environment.apiUrl}/auth/senha/esqueci`);
  }

  async function assentar(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('confirma o envio sem dizer se a conta existe', async () => {
    const req = enviar();
    expect(req.request.body).toEqual({ email: 'voce@exemplo.com' });

    req.flush(null, { status: 204, statusText: 'No Content' });
    await assentar();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Se existe conta com esse e-mail');
    expect(fixture.nativeElement.querySelector('.pf-erro')).toBeNull();
  });

  it('falha de rede aparece na tela, nao em silencio', async () => {
    const req = enviar();
    req.error(new ProgressEvent('error'));
    await assentar();

    expect(
      fixture.nativeElement.querySelector('.pf-erro')!.textContent,
    ).toContain('Sem conexão');
  });

  it('sem SMTP a tela nao pede e-mail nenhum — ela explica e manda criar outra conta', async () => {
    // O deploy roda no perfil `teste`, onde o LogEmailSender so escreve o link no
    // log do servidor. Um formulario que aceita o e-mail e responde "ja esta a
    // caminho" quando nada foi mandado e a mesma mentira, so mais educada: quem
    // esqueceu a senha fica esperando um e-mail que nunca existiu.
    environment.recuperacaoPorEmail = false;
    const outra = TestBed.createComponent(RecuperarPage);
    outra.detectChanges();

    expect(outra.nativeElement.querySelector('input[type="email"]'))
      .withContext('sem envio possivel, nao ha o que perguntar')
      .toBeNull();
    const texto = outra.nativeElement.textContent as string;
    expect(texto).toContain('ainda não está no ar');
    expect(texto)
      .withContext('tem de dizer o que fazer, nao so que nao da')
      .toContain('crie outra conta');
    expect(texto).not.toContain('já está a caminho');
  });
});
