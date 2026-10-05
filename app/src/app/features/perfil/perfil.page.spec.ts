import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import type { Perfil } from '../../data/models';
import { StorageFake, USUARIO, configurarTeste } from '../auth/auth-teste';
import { PerfilPage } from './perfil.page';

const PERFIL: Perfil = { ...USUARIO, adminPlataforma: false, temSenha: true };

describe('PerfilPage', () => {
  let backend: HttpTestingController;
  let storage: StorageFake;
  let auth: AuthService;
  let irPara: jasmine.Spy;
  let fixture: ComponentFixture<PerfilPage>;

  beforeEach(() => {
    storage = new StorageFake();
    backend = configurarTeste(storage);
    auth = TestBed.inject(AuthService);
    auth.definirSessao('jwt-velho', USUARIO, 't1');
    irPara = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(PerfilPage);
    // O Ionic chama isto ao entrar na aba; o TestBed nao chama sozinho.
    fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
  });

  afterEach(() => backend.verify());

  async function assentar(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function abrir(perfil: Perfil = PERFIL): Promise<void> {
    backend.expectOne(`${environment.apiUrl}/eu`).flush(perfil);
    await assentar();
  }

  function campo(nome: string): HTMLInputElement {
    return fixture.nativeElement.querySelector(`input[name="${nome}"]`);
  }

  function digitar(nome: string, valor: string): void {
    campo(nome).value = valor;
    campo(nome).dispatchEvent(new Event('input'));
  }

  function clicar(rotulo: string): void {
    (
      Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ) as HTMLButtonElement[]
    )
      .find((b) => b.textContent!.trim() === rotulo)!
      .click();
  }

  function texto(): string {
    return fixture.nativeElement.textContent as string;
  }

  function erro(): string | null {
    return fixture.nativeElement.querySelector('.pf-erro')?.textContent ?? null;
  }

  it('carrega e mostra inicial, nome, e-mail e o selo de admin', async () => {
    await abrir({ ...PERFIL, adminPlataforma: true });

    expect(
      fixture.nativeElement.querySelector('.pf-avatar').textContent.trim(),
    ).toBe('O');
    expect(texto()).toContain('Otavio');
    expect(texto()).toContain('voce@exemplo.com');
    expect(texto()).toContain('Admin da plataforma');
    expect(campo('nome').value).toBe('Otavio');
  });

  it('falha ao carregar aparece na tela, e sair continua ao alcance', async () => {
    // Perfil que nao carrega nao pode trancar ninguem numa sessao: o botao de
    // sair nao depende do GET /eu.
    backend
      .expectOne(`${environment.apiUrl}/eu`)
      .error(new ProgressEvent('error'));
    await assentar();

    const aviso = fixture.nativeElement.querySelector('.pf-aviso')!;
    expect(aviso.textContent).toContain('Sem conexão');
    expect(aviso.getAttribute('role')).toBe('alert');
    expect(texto()).toContain('Sair da conta');

    // A pagina fica viva entre as abas: sem o botao, a falha da primeira
    // abertura ficava na tela ate matar o app.
    clicar('Tentar de novo');
    backend.expectOne(`${environment.apiUrl}/eu`).flush(PERFIL);
    await assentar();

    expect(fixture.nativeElement.querySelector('.pf-aviso')).toBeNull();
    expect(campo('nome').value).toBe('Otavio');
  });

  it('voltar para a aba recarrega o perfil', async () => {
    await abrir();
    fixture.componentInstance.ionViewWillEnter();
    backend
      .expectOne(`${environment.apiUrl}/eu`)
      .flush({ ...PERFIL, nome: 'Renomeado em outro aparelho' });
    await assentar();

    expect(texto()).toContain('Renomeado em outro aparelho');
  });

  it('inicial de nome que comeca com emoji e o emoji inteiro, nao meia surrogate', async () => {
    await abrir({ ...PERFIL, nome: '  🎓 Formanda' });

    expect(
      fixture.nativeElement.querySelector('.pf-avatar').textContent.trim(),
    ).toBe('🎓');
  });

  it('salvar nome manda o nome aparado e troca jwt e usuario na sessao, sem perder a turma', async () => {
    await abrir();
    digitar('nome', '  Otávio Neves  ');
    clicar('Salvar nome');

    const req = backend.expectOne(`${environment.apiUrl}/eu`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ nome: 'Otávio Neves' });
    req.flush({ jwt: 'jwt-novo', perfil: { ...PERFIL, nome: 'Otávio Neves' } });
    await assentar();

    // O JWT carrega o nome: guardar o perfil e manter o token velho deixaria o
    // nome antigo circulando em toda requisicao.
    expect(auth.token()).toBe('jwt-novo');
    expect(auth.usuario()!.nome).toBe('Otávio Neves');
    expect(storage.sessao).toEqual({
      jwt: 'jwt-novo',
      usuario: { ...USUARIO, nome: 'Otávio Neves' },
      turmaId: 't1',
    });
    expect(texto()).toContain('Nome atualizado');
  });

  it('nome em branco nao chama a api', async () => {
    await abrir();
    digitar('nome', '   ');
    clicar('Salvar nome');
    await assentar();

    backend.expectNone(`${environment.apiUrl}/eu`);
    expect(erro()).toContain('em branco');
  });

  for (const status of [400, 500]) {
    it(`PATCH do nome com ${status} mostra o erro e nao mexe na sessao`, async () => {
      await abrir();
      digitar('nome', 'Otávio');
      clicar('Salvar nome');
      backend
        .expectOne(`${environment.apiUrl}/eu`)
        .flush(
          { detail: 'Nome inválido' },
          { status, statusText: 'Erro' },
        );
      await assentar();

      expect(erro()).toContain(
        status === 400 ? 'Nome inválido' : 'Deu problema no servidor',
      );
      expect(auth.token()).toBe('jwt-velho');
      expect(texto()).not.toContain('Nome atualizado');
    });
  }

  it('sair com o PATCH do nome no ar nao ressuscita a sessao', async () => {
    // PC compartilhado: a resposta que chega depois do "sair" nao pode gravar
    // jwt nem usuario de volta, ou o proximo a sentar acha a conta logada.
    await abrir();
    digitar('nome', 'Otávio');
    clicar('Salvar nome');
    const req = backend.expectOne(`${environment.apiUrl}/eu`);
    await auth.sair();
    req.flush({ jwt: 'jwt-novo', perfil: { ...PERFIL, nome: 'Otávio' } });
    await assentar();

    expect(auth.token()).toBeNull();
    expect(auth.usuario()).toBeNull();
    expect(storage.sessao).toBeNull();
  });

  it('Enter salva o nome, e o form da senha leva o e-mail como username', async () => {
    // requestSubmit e o que o Enter num campo faz. Se o preventDefault faltasse,
    // o form recarregaria a pagina e o Karma acusaria "full page reload".
    await abrir();
    digitar('nome', 'Otávio');
    campo('nome').form!.requestSubmit();
    backend
      .expectOne(`${environment.apiUrl}/eu`)
      .flush({ jwt: 'jwt-novo', perfil: { ...PERFIL, nome: 'Otávio' } });
    await assentar();
    expect(texto()).toContain('Nome atualizado');

    const usuario = campo('senhaAtual').form!.querySelector(
      'input[autocomplete="username"]',
    ) as HTMLInputElement;
    expect(usuario.value).toBe('voce@exemplo.com');
  });

  for (const [caso, atual, nova, motivo] of [
    ['senha atual vazia', '', 'senha-nova-1', 'senha atual'],
    ['nova com menos de 8', 'senha-velha', 'curta', 'pelo menos 8'],
    ['nova so de espacos', 'senha-velha', '          ', 'só espaços'],
    ['nova com mais de 72', 'senha-velha', 'a'.repeat(73), 'máximo 72'],
  ]) {
    it(`${caso} nao chama a api`, async () => {
      await abrir();
      digitar('senhaAtual', atual);
      digitar('novaSenha', nova);
      digitar('confirmarSenha', nova);
      clicar('Trocar senha');
      await assentar();

      backend.expectNone(`${environment.apiUrl}/eu/senha`);
      expect(erro()).toContain(motivo);
    });
  }

  it('senha com confirmacao diferente nao chama a api', async () => {
    await abrir();
    digitar('senhaAtual', 'senha-velha');
    digitar('novaSenha', 'senha-nova-1');
    digitar('confirmarSenha', 'senha-nova-2');
    clicar('Trocar senha');
    await assentar();

    backend.expectNone(`${environment.apiUrl}/eu/senha`);
    expect(
      fixture.nativeElement.querySelector('.pf-erro')!.textContent,
    ).toContain('confirmação');
  });

  it('senha atual errada mostra o erro do servidor e NAO desloga', async () => {
    // 400, nunca 401: 401 passaria pelo interceptor como sessao expirada.
    await abrir();
    digitar('senhaAtual', 'errada');
    digitar('novaSenha', 'senha-nova-1');
    digitar('confirmarSenha', 'senha-nova-1');
    clicar('Trocar senha');

    const req = backend.expectOne(`${environment.apiUrl}/eu/senha`);
    expect(req.request.body).toEqual({
      senhaAtual: 'errada',
      novaSenha: 'senha-nova-1',
    });
    req.flush(
      { detail: 'Senha atual incorreta' },
      { status: 400, statusText: 'Bad Request' },
    );
    await assentar();

    expect(
      fixture.nativeElement.querySelector('.pf-erro')!.textContent,
    ).toContain('Senha atual incorreta');
    expect(auth.autenticado()).toBeTrue();
  });

  it('trocar a senha com sucesso limpa os campos e confirma', async () => {
    await abrir();
    digitar('senhaAtual', 'senha-velha');
    digitar('novaSenha', 'senha-nova-1');
    digitar('confirmarSenha', 'senha-nova-1');
    clicar('Trocar senha');

    // O servidor derruba todo token anterior e devolve um novo para quem trocou:
    // sem guardar esse token, a proxima requisicao voltaria 401 e deslogaria.
    backend
      .expectOne(`${environment.apiUrl}/eu/senha`)
      .flush({ jwt: 'jwt-pos-senha' });
    await assentar();

    for (const nome of ['senhaAtual', 'novaSenha', 'confirmarSenha']) {
      expect(campo(nome).value).withContext(nome).toBe('');
    }
    expect(texto()).toContain('Senha trocada');
    expect(auth.token()).toBe('jwt-pos-senha');
    expect(storage.sessao?.jwt).toBe('jwt-pos-senha');
  });

  it('conta so do Google nao ve a secao de senha', async () => {
    await abrir({ ...PERFIL, temSenha: false });

    expect(campo('senhaAtual')).toBeNull();
    expect(texto()).toContain('entra pelo Google');
    expect(texto()).not.toContain('Admin da plataforma');
  });

  it('sair encerra a sessao e vai para o login', async () => {
    await abrir();
    const sair = spyOn(auth, 'sair').and.callThrough();
    clicar('Sair da conta');
    await assentar();

    expect(sair).toHaveBeenCalled();
    expect(storage.sessao).toBeNull();
    expect(irPara).toHaveBeenCalledWith('/login');
  });
});
