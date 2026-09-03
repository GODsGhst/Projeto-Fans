import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { StorageFake, configurarTeste } from './auth-teste';
import { EntrarTurmaPage } from './entrar-turma.page';

describe('EntrarTurmaPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<EntrarTurmaPage>;
  let irPara: jasmine.Spy;

  beforeEach(() => {
    backend = configurarTeste(new StorageFake());
    irPara = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(EntrarTurmaPage);
    fixture.detectChanges();
  });

  afterEach(() => backend.verify());

  function clicar(rotulo: string): void {
    const alvo = (
      Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ) as HTMLButtonElement[]
    ).find((b) => b.textContent!.trim() === rotulo);
    expect(alvo).withContext(`botao "${rotulo}"`).toBeDefined();
    alvo!.click();
  }

  function enviarCodigo(codigo: string) {
    const campo = fixture.nativeElement.querySelector(
      '.campo--codigo',
    ) as HTMLInputElement;
    campo.value = codigo;
    campo.dispatchEvent(new Event('input'));
    clicar('Entrar na turma');
    return backend.expectOne(`${environment.apiUrl}/turmas/entrar`);
  }

  async function assentar(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function erroNaTela(): string {
    const p = fixture.nativeElement.querySelector(
      '.pf-erro',
    ) as HTMLElement | null;
    return p === null ? '' : p.textContent!.trim();
  }

  it('codigo valido entra na turma e vai para as abas', async () => {
    const req = enviarCodigo('turma01');
    // O codigo vai em caixa alta: o servidor compara literal.
    expect(req.request.body).toEqual({ codigoConvite: 'TURMA01' });

    req.flush({
      id: 'm1',
      usuarioId: 'u1',
      turmaId: 't1',
      papel: 'ALUNO',
      entrouEm: '2026-09-01T12:00:00Z',
    });
    await assentar();

    expect(irPara).toHaveBeenCalledWith('/tabs/home');
    expect(erroNaTela()).toBe('');
  });

  it('codigo de turma invalido mostra erro e mantem a pessoa na tela', async () => {
    // O backend responde 404, nunca 403: quem chuta codigo nao pode aprender
    // nada sobre quais existem.
    const req = enviarCodigo('ZZZZZZ');
    req.flush(
      { detail: 'Registro nao encontrado' },
      { status: 404, statusText: 'Not Found' },
    );
    await assentar();

    expect(erroNaTela()).toContain('Registro nao encontrado');
    expect(irPara).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.campo--codigo'))
      .withContext('a pessoa continua na tela para corrigir o codigo')
      .not.toBeNull();
  });

  it('criar turma nova MOSTRA o codigo de convite antes de ir para as abas', async () => {
    clicar('Criar uma turma nova');
    fixture.detectChanges();

    const nome = fixture.nativeElement.querySelector(
      'input[name="nome"]',
    ) as HTMLInputElement;
    const semestre = fixture.nativeElement.querySelector(
      'input[name="semestre"]',
    ) as HTMLInputElement;
    nome.value = 'Fans 2026';
    semestre.value = '2026.2';
    clicar('Criar turma');

    const req = backend.expectOne(`${environment.apiUrl}/turmas`);
    expect(req.request.body).toEqual({ nome: 'Fans 2026', semestre: '2026.2' });
    req.flush({
      id: 't1',
      nome: 'Fans 2026',
      semestre: '2026.2',
      codigoConvite: 'ABC12345',
    });
    await assentar();

    // O motivo desta tela existir. Sem o codigo na mao, quem cria a turma vira
    // lider de uma turma que nao consegue convidar ninguem: o codigo esta no
    // banco, passou pela mao do app, e a pessoa nunca o ve.
    const mostrado = fixture.nativeElement.querySelector(
      '[data-testid="codigo-convite"]',
    );
    expect(mostrado)
      .withContext('o codigo tem de aparecer na tela, nao so na resposta HTTP')
      .not.toBeNull();
    expect(mostrado!.textContent!.trim()).toBe('ABC12345');

    // E NAO navega sozinho: sair daqui sem ler o codigo e perde-lo.
    expect(irPara).not.toHaveBeenCalled();

    clicar('Continuar');
    await assentar();
    expect(irPara).toHaveBeenCalledWith('/tabs/home');
  });

  it('sair desta conta limpa a sessao e volta para o login', async () => {
    // A saida do beco. Quem chega nesta tela ja tem sessao gravada em disco (o
    // cadastro grava antes de existir turma). Sem isto, entrar com o e-mail
    // errado so se resolve reinstalando o app: o botao de voltar do Ionic navega
    // sem limpar a sessao, e a guarda traz a pessoa de volta.
    clicar('Sair desta conta');
    await assentar();

    expect(irPara).toHaveBeenCalledWith('/login');
  });
});
