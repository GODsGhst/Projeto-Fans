import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { environment } from '../../../environments/environment';
import { StorageFake, configurarTeste } from './auth-teste';
import { RecuperarPage } from './recuperar.page';

describe('RecuperarPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<RecuperarPage>;

  beforeEach(() => {
    backend = configurarTeste(new StorageFake());
    fixture = TestBed.createComponent(RecuperarPage);
    fixture.detectChanges();
  });

  afterEach(() => backend.verify());

  function enviar() {
    const campo = fixture.nativeElement.querySelector('input[type="email"]') as HTMLInputElement;
    campo.value = 'voce@exemplo.com';
    campo.dispatchEvent(new Event('input'));
    (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
    ).find((b) => b.textContent!.trim() === 'Enviar link')!.click();
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

    expect(fixture.nativeElement.querySelector('.pf-erro')!.textContent).toContain('Sem conexão');
  });
});
