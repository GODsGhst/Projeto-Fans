import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { StorageFake, USUARIO, configurarTeste } from './auth-teste';
import { EntrarTurmaPage } from './entrar-turma.page';

/** O que `GET /turmas/minha` devolve para quem ja tem turma. */
const MINHA_TURMA = {
  id: 't1',
  nome: 'Fans 2026',
  semestre: '2026.2',
  codigoConvite: 'ABC12345',
  membros: [],
};

const JA_TEM_TURMA = { detail: 'Voce ja esta numa turma' };

describe('EntrarTurmaPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<EntrarTurmaPage>;
  let irPara: jasmine.Spy;
  let storage: StorageFake;

  beforeEach(() => {
    storage = new StorageFake();
    backend = configurarTeste(storage);
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
    // Uma volta de macrotarefa antes: o 409 encadeia GET -> registrarTurma ->
    // navegar, so de microtarefas, e `whenStable` sozinho devolvia antes do fim.
    await new Promise((r) => setTimeout(r));
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

  function criarTurma(nome: string): void {
    clicar('Criar uma turma nova');
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('input[name="nome"]') as HTMLInputElement).value =
      nome;
    clicar('Criar turma');
  }

  it('409 ao ENTRAR: ja tem turma, entao cura a sessao e abre a Home', async () => {
    // Um aluno, uma turma. O servidor ja tem o vinculo; a sessao do aparelho e
    // que nao sabe. Sem a cura, a guarda devolve a pessoa para esta tela e o 409
    // se repete a cada toque, sem saida.
    const auth = TestBed.inject(AuthService);
    auth.definirSessao('jwt', USUARIO); // so para a sessao ser gravada em disco

    enviarCodigo('turma01').flush(JA_TEM_TURMA, {
      status: 409,
      statusText: 'Conflict',
    });
    await assentar();
    backend.expectOne(`${environment.apiUrl}/turmas/minha`).flush(MINHA_TURMA);
    await assentar();

    expect(auth.turmaId()).toBe('t1');
    expect(storage.sessao?.turmaId)
      .withContext('gravado em disco, para sobreviver a fechar o app')
      .toBe('t1');
    expect(irPara).toHaveBeenCalledWith('/tabs/home');
    expect(erroNaTela())
      .withContext('a pessoa ja tem turma: nao ha erro a mostrar')
      .toBe('');
  });

  it('409 ao CRIAR: ja tem turma, entao cura a sessao e abre a Home sem mostrar codigo', async () => {
    const auth = TestBed.inject(AuthService);
    auth.definirSessao('jwt', USUARIO);

    criarTurma('Outra turma');
    backend.expectOne(`${environment.apiUrl}/turmas`).flush(JA_TEM_TURMA, {
      status: 409,
      statusText: 'Conflict',
    });
    await assentar();
    backend.expectOne(`${environment.apiUrl}/turmas/minha`).flush(MINHA_TURMA);
    await assentar();

    expect(auth.turmaId()).toBe('t1');
    expect(storage.sessao?.turmaId).toBe('t1');
    expect(irPara).toHaveBeenCalledWith('/tabs/home');
    expect(
      fixture.nativeElement.querySelector('[data-testid="codigo-convite"]'),
    )
      .withContext('nao criou turma nenhuma: mostrar um codigo seria inventar')
      .toBeNull();
  });

  it('409 e a leitura da turma falha: erro na tela e nada de Home', async () => {
    // Abrir a Home sem o vinculo gravado so devolveria a pessoa para esta tela.
    const auth = TestBed.inject(AuthService);
    auth.definirSessao('jwt', USUARIO);

    enviarCodigo('turma01').flush(JA_TEM_TURMA, {
      status: 409,
      statusText: 'Conflict',
    });
    await assentar();
    backend
      .expectOne(`${environment.apiUrl}/turmas/minha`)
      .flush({}, { status: 500, statusText: 'Server Error' });
    await assentar();

    expect(erroNaTela()).toContain('servidor');
    expect(irPara).not.toHaveBeenCalled();
    expect(auth.turmaId()).toBeNull();
  });

  it('campos de 16px ou mais e botoes sem zoom de duplo toque (iPhone)', () => {
    // Com o zoom liberado, o Safari da zoom sozinho ao focar um campo abaixo de
    // 16px (eram 15px) e a tela pulava a cada toque no formulario. O estilo e do
    // `auth.scss` (.campo--linha) e do `global.scss` (campo solto, botao); ambos
    // entram no karma.
    // Mede uma COPIA no body: dentro do `ion-content` (que no karma nao chega a
    // hidratar o slot) o navegador nao renderiza os filhos e devolve estilo vazio.
    // A copia leva junto o atributo `_ngcontent-*`, entao o CSS do componente casa.
    // Nao usa `.campo--codigo`: ele tem 22px proprios e passaria sem a correcao.
    clicar('Criar uma turma nova');
    fixture.detectChanges();
    const copia = (seletor: string): HTMLElement =>
      document.body.appendChild(
        (fixture.nativeElement.querySelector(seletor) as HTMLElement).cloneNode(
          true,
        ) as HTMLElement,
      );
    const campo = copia('input[name="nome"]');
    const botao = copia('button.botao');
    const solto = document.body.appendChild(document.createElement('input'));

    expect(parseFloat(getComputedStyle(campo).fontSize))
      .withContext('.campo--linha: 15px faz o Safari dar zoom ao focar')
      .toBeGreaterThanOrEqual(16);
    expect(parseFloat(getComputedStyle(solto).fontSize))
      .withContext('input sem classe: vale o global.scss')
      .toBeGreaterThanOrEqual(16);
    expect(getComputedStyle(botao).touchAction)
      .withContext('duplo toque num botao nao pode virar zoom')
      .toBe('manipulation');
    [campo, botao, solto].forEach((e) => e.remove());
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
