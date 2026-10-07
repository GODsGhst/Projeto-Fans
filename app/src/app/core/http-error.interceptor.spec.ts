import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthService, ROTA_LOGIN } from './auth.service';
import { StorageService } from './storage.service';
import { ErroApi, erroHttpInterceptor } from './http-error.interceptor';

describe('erroHttpInterceptor', () => {
  let backend: HttpTestingController;
  let http: HttpClient;
  let auth: AuthService;
  let irPara: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
        {
          provide: StorageService,
          useValue: {
            gravarSessao: async () => undefined,
            limparSessao: async () => undefined,
            limpar: async () => undefined,
          },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    http = TestBed.inject(HttpClient);
    auth = TestBed.inject(AuthService);
    irPara = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
  });

  afterEach(() => backend.verify());

  function capturar(url: string): { erro: ErroApi | null } {
    const capturado: { erro: ErroApi | null } = { erro: null };
    http.get(url).subscribe({
      next: () => fail('a resposta de erro nao pode chegar como sucesso'),
      error: (e: unknown) => {
        capturado.erro = e as ErroApi;
      },
    });
    return capturado;
  }

  it('interceptor de erro mapeia 401 para logout', () => {
    auth.definirSessao('jwt-de-teste', {
      id: 'u1',
      nome: 'Otavio',
      email: 'o@x.com',
    });
    expect(auth.token()).toBe('jwt-de-teste');

    const capturado = capturar('/protegido');
    backend
      .expectOne('/protegido')
      .flush(
        { detail: 'expirado' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(capturado.erro instanceof ErroApi).toBeTrue();
    expect(capturado.erro!.classe).toBe('AUTH');
    expect(auth.token()).withContext('401 limpa o token').toBeNull();
    expect(auth.usuario()).toBeNull();
    expect(irPara).toHaveBeenCalledWith(ROTA_LOGIN);
  });

  it('interceptor de erro mapeia 409 para conflito sinalizado', () => {
    const capturado = capturar('/eventos/1');
    backend
      .expectOne('/eventos/1')
      .flush(
        { detail: 'alguem editou isso' },
        { status: 409, statusText: 'Conflict' },
      );

    expect(capturado.erro instanceof ErroApi).toBeTrue();
    expect(capturado.erro!.classe).toBe('CONFLITO');
    expect(capturado.erro!.status).toBe(409);
    expect(capturado.erro!.recarregarRegistro)
      .withContext('409 avisa e manda recarregar o registro')
      .toBeTrue();
  });

  describe('404 SEM_TURMA: quem o lider removeu', () => {
    beforeEach(() => {
      auth.definirSessao(
        'jwt',
        { id: 'u1', nome: 'Otavio', email: 'o@x.com' },
        't1',
      );
    });

    it('o ErroApi carrega o codigo que o servidor mandou', () => {
      const capturado = capturar('/turmas/minha');
      backend
        .expectOne('/turmas/minha')
        .flush(
          { detail: 'Registro nao encontrado', codigo: 'SEM_TURMA' },
          { status: 404, statusText: 'Not Found' },
        );

      expect(capturado.erro!.codigo).toBe('SEM_TURMA');
      expect(capturado.erro!.classe).toBe('NAO_ENCONTRADO');
    });

    it('de QUALQUER rota: esquece a turma, continua logado e vai para entrar-turma', () => {
      // /home, /sync, /materias... — o removido nao precisa abrir a tela da turma
      // para perder o vinculo local.
      for (const rota of ['/home', '/sync', '/materias']) {
        auth.definirSessao('jwt', auth.usuario()!, 't1');
        irPara.calls.reset();

        capturar(rota);
        backend
          .expectOne(rota)
          .flush(
            { detail: 'Registro nao encontrado', codigo: 'SEM_TURMA' },
            { status: 404, statusText: 'Not Found' },
          );

        expect(auth.temTurma()).withContext(rota).toBeFalse();
        expect(auth.autenticado()).withContext(rota).toBeTrue();
        expect(irPara).withContext(rota).toHaveBeenCalledWith('/entrar-turma');
      }
    });

    it('404 SEM o codigo (proxy, portal cativo, servidor acordando) NAO derruba o vinculo', () => {
      const corpos: (string | object | null)[] = [
        '<html>502 Bad Gateway</html>',
        { detail: 'Registro nao encontrado' },
        null,
      ];
      for (const corpo of corpos) {
        const capturado = capturar('/home');
        backend
          .expectOne('/home')
          .flush(corpo, { status: 404, statusText: 'Not Found' });

        expect(capturado.erro!.status).toBe(404);
        expect(capturado.erro!.codigo).toBeNull();
      }
      expect(auth.temTurma())
        .withContext('apagar turma, lembretes e snapshot por um tropeco de rede e perda de dado')
        .toBeTrue();
      expect(irPara).not.toHaveBeenCalled();
    });

    it('falha ao gravar a sessao vai para o console e nao impede a saida', async () => {
      spyOn(console, 'error');
      spyOn(auth, 'registrarTurma').and.rejectWith(new Error('disco cheio'));

      capturar('/home');
      backend
        .expectOne('/home')
        .flush(
          { codigo: 'SEM_TURMA' },
          { status: 404, statusText: 'Not Found' },
        );
      await Promise.resolve();

      expect(console.error).toHaveBeenCalled();
      expect(irPara).toHaveBeenCalledWith('/entrar-turma');
    });
  });
});
