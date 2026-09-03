import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { environment } from '../../../environments/environment';
import { erroHttpInterceptor } from '../../core/http-error.interceptor';
import { AuthService } from '../../core/auth.service';
import { TurmaPage, convite } from './turma.page';

const TURMA = {
  id: 't1',
  nome: 'Fans 2026.2',
  semestre: '2026.2',
  codigoConvite: '93EB9244',
  membros: [
    {
      usuarioId: 'u1',
      nome: 'Otávio',
      papel: 'LIDER',
      entrouEm: '2026-09-01T12:00:00Z',
    },
    {
      usuarioId: 'u2',
      nome: 'Ana Beatriz',
      papel: 'ALUNO',
      entrouEm: '2026-09-01T13:00:00Z',
    },
    {
      usuarioId: 'u3',
      nome: 'Bruno',
      papel: 'ALUNO',
      entrouEm: '2026-09-01T14:00:00Z',
    },
  ],
};

describe('convite', () => {
  it('a mensagem carrega o codigo e o nome da turma', () => {
    // Este e o defeito possivel: mensagem bonita que chega sem o codigo, e quem
    // recebe tem de voltar e perguntar como entra.
    const m = convite({ nome: 'Fans 2026.2', codigoConvite: '93EB9244' });

    expect(m.text).withContext('sem o codigo nao convida ninguem').toContain('93EB9244');
    expect(m.text).withContext('e precisa dizer de que turma se trata').toContain('Fans 2026.2');
    expect(m.title).toContain('Fans 2026.2');
  });
});

const eu = signal<{ id: string; nome: string; email: string } | null>({
  id: 'u1',
  nome: 'Otávio',
  email: 'voce@exemplo.com',
});

describe('TurmaPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<TurmaPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { usuario: eu } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TurmaPage);
  });

  afterEach(() => backend.verify());

  async function abrir(
    responder: (r: ReturnType<HttpTestingController['expectOne']>) => void,
  ): Promise<void> {
    fixture.detectChanges();
    responder(backend.expectOne(`${environment.apiUrl}/turmas/minha`));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function textos(seletor: string): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll(seletor)).map((e) =>
      (e as HTMLElement).textContent!.trim(),
    );
  }

  it('mostra o codigo de convite em destaque, com botao de copiar', async () => {
    // O codigo e a unica coisa que separa a turma de qualquer pessoa com o link,
    // e tambem a unica forma de entrar nela. Ele nao pode ficar so no POST.
    await abrir((r) => r.flush(TURMA));

    expect(
      fixture.nativeElement.querySelector('[data-testid="codigo-convite"]')!.textContent!.trim(),
    ).toBe('93EB9244');
    expect(textos('button')).toContain('Copiar código');
  });

  it('lista quem esta na turma, com o lider marcado', async () => {
    await abrir((r) => r.flush(TURMA));

    expect(textos('.membro .nome')).toEqual(['Otávio', 'Ana Beatriz', 'Bruno']);
    // Lider e papel, nao posto: uma marca so, na pessoa certa.
    expect(textos('.membro .papel')).toEqual(['líder']);
  });

  it('falha ao carregar NAO vira turma vazia', async () => {
    await abrir((r) => r.error(new ProgressEvent('error')));

    expect(fixture.nativeElement.querySelector('.pf-aviso')!.textContent).toContain('Sem conexão');
    expect(fixture.nativeElement.querySelector('.membro'))
      .withContext('sem resposta nao ha lista de membros a mostrar')
      .toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="codigo-convite"]'))
      .withContext('codigo inventado seria pior que codigo nenhum')
      .toBeNull();
  });

  it('ha um botao de compartilhar, e sem compartilhamento o codigo cai no clipboard', async () => {
    // No navegador do teste o `Share` do Capacitor nao existe e a chamada falha
    // — que e exatamente o caminho de fallback que precisa funcionar. Nao ha spy
    // aqui de proposito: `Share` e um proxy do registerPlugin e spyOn nao o
    // intercepta, entao um teste com spy passaria sem provar nada.
    const copia = spyOn(navigator.clipboard, 'writeText').and.resolveTo();
    await abrir((r) => r.flush(TURMA));

    const botao = (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
    ).find((b) => b.textContent!.includes('Compartilhar'));
    expect(botao).withContext('sem botao de compartilhar nao ha como convidar').toBeDefined();

    botao!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(copia)
      .withContext('falhar o compartilhamento tem de deixar a pessoa com o codigo mesmo assim')
      .toHaveBeenCalledWith('93EB9244');
    expect(fixture.nativeElement.textContent as string).toContain('Copiado');
  });

  it('so o lider ve a porta para passar a lideranca', async () => {
    // A própria tela diz que o líder "transfere a liderança". A frase estava lá
    // e não havia botão nenhum. E para quem não é líder o botão não aparece nem
    // desabilitado: cinza convida a perguntar "por que não posso?", e a resposta
    // já está escrita logo abaixo.
    await abrir((r) => r.flush(TURMA));
    expect(fixture.nativeElement.querySelector('a[href="/tabs/turma/transferir"]'))
      .withContext('sou o LIDER da fixture — a porta tem de estar aqui')
      .not.toBeNull();

    eu.set({ id: 'u2', nome: 'Ana Beatriz', email: 'ana@exemplo.com' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/tabs/turma/transferir"]')).toBeNull();
  });
});
