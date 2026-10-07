import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import type { DocenteAdmin } from '../../data/docente-admin.repository';
import { StorageFake, configurarTeste } from '../auth/auth-teste';
import { AdminPage } from './admin.page';

const API = `${environment.apiUrl}/admin/docentes`;

function docente(
  nome: string,
  status: DocenteAdmin['docenteStatus'],
  tipoConta: DocenteAdmin['tipoConta'] = 'PROFESSOR',
): DocenteAdmin {
  return {
    usuarioId: `id-${nome}`,
    nome,
    email: `${nome.toLowerCase()}@exemplo.edu.br`,
    tipoConta,
    docenteStatus: status,
    criadoEm: '2026-10-05T14:00:00Z',
    // O servidor devolve sempre false enquanto nao houver verificacao de e-mail.
    emailVerificado: false,
  };
}

const RENATA = docente('Renata', 'PENDENTE');
const PAULO = docente('Paulo', 'PENDENTE', 'COORDENADOR');
const MARCOS = docente('Marcos', 'APROVADO');
const DIEGO = docente('Diego', 'RECUSADO');

describe('AdminPage', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<AdminPage>;

  beforeEach(() => {
    backend = configurarTeste(new StorageFake());
    fixture = TestBed.createComponent(AdminPage);
    // O Ionic chama isto ao entrar na tela; o TestBed nao chama sozinho.
    fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
  });

  afterEach(() => backend.verify());

  // Uma volta de macrotarefa alem do whenStable: depois de um flush, o Promise.all
  // da tela ainda precisa de varios ticks de microtarefa para chegar nos signals.
  async function assentar(): Promise<void> {
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
  }

  /** Responde as tres listas (uma GET por status, na ordem em que a tela pede). */
  async function listas(
    pendentes: DocenteAdmin[],
    aprovados: DocenteAdmin[],
    recusados: DocenteAdmin[],
  ): Promise<void> {
    const por = { PENDENTE: pendentes, APROVADO: aprovados, RECUSADO: recusados };
    for (const status of ['PENDENTE', 'APROVADO', 'RECUSADO'] as const) {
      backend
        .expectOne((r) => r.url === API && r.params.get('status') === status)
        .flush(por[status]);
    }
    await assentar();
  }

  function el(): HTMLElement {
    return fixture.nativeElement;
  }

  function texto(): string {
    return el().textContent as string;
  }

  /** O cartao de uma pessoa: ancora todo clique no nome, nao na ordem dos botoes. */
  function cartao(nome: string): HTMLElement {
    return (Array.from(el().querySelectorAll('.pessoa')) as HTMLElement[]).find(
      (c) => c.querySelector('.nome')!.textContent!.trim() === nome,
    )!;
  }

  function clicar(nome: string, rotulo: string): void {
    (Array.from(cartao(nome).querySelectorAll('button')) as HTMLButtonElement[])
      .find((b) => b.textContent!.trim() === rotulo)!
      .click();
    fixture.detectChanges();
  }

  function rotulos(nome: string): string[] {
    return (
      Array.from(cartao(nome).querySelectorAll('button')) as HTMLButtonElement[]
    ).map((b) => b.textContent!.trim());
  }

  it('pede as tres listas e mostra cada pessoa na sua, com tipo, e-mail e contagem', async () => {
    await listas([RENATA, PAULO], [MARCOS], [DIEGO]);

    const secoes = Array.from(el().querySelectorAll('.pf-rotulo, summary')).map(
      (r) => r.textContent!.trim(),
    );
    expect(secoes).toEqual([
      'pendentes · 2',
      'aprovados · 1',
      'recusados · 1',
    ]);
    expect(cartao('Renata').textContent).toContain('Professor');
    expect(cartao('Paulo').textContent).toContain('Coordenação');
    expect(cartao('Renata').textContent).toContain('renata@exemplo.edu.br');
    // Recusados ficam recolhidos: aparecem a um toque, nao poluem a fila.
    expect(el().querySelector('details')!.open).toBeFalse();
  });

  it('cada pendente traz o aviso de e-mail nao verificado; aprovado e recusado nao', async () => {
    await listas([RENATA, PAULO], [MARCOS], [DIEGO]);

    const aviso = 'E-mail não verificado: confirme com a pessoa antes de aprovar';
    expect(cartao('Renata').textContent).toContain(aviso);
    expect(cartao('Paulo').textContent).toContain(aviso);
    expect(cartao('Marcos').textContent).not.toContain('E-mail não verificado');
    expect(cartao('Diego').textContent).not.toContain('E-mail não verificado');
  });

  it('pendente com e-mail verificado (quando o servidor passar a dizer) nao leva o aviso', async () => {
    await listas([{ ...RENATA, emailVerificado: true }], [], []);

    expect(cartao('Renata').textContent).not.toContain('E-mail não verificado');
  });

  it('fila vazia diz "Ninguém na fila", e so depois de carregar', async () => {
    expect(texto()).not.toContain('Ninguém na fila');
    expect(texto()).toContain('Carregando');

    await listas([], [MARCOS], []);

    expect(texto()).toContain('Ninguém na fila');
    expect(texto()).not.toContain('Carregando');
  });

  it('cada situacao oferece so o que faz sentido: aprovar/recusar, revogar, aprovar de novo', async () => {
    await listas([RENATA], [MARCOS], [DIEGO]);

    expect(rotulos('Renata')).toEqual(['Aprovar', 'Recusar']);
    expect(rotulos('Marcos')).toEqual(['Revogar']);
    expect(rotulos('Diego')).toEqual(['Aprovar']);
  });

  it('aprovar manda POST /aprovar e recarrega as listas', async () => {
    await listas([RENATA, PAULO], [], []);

    clicar('Renata', 'Aprovar');
    const req = backend.expectOne(`${API}/id-Renata/aprovar`);
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await assentar();

    // A lista nova vem do servidor, nao de mover o cartao na mao.
    await listas([PAULO], [{ ...RENATA, docenteStatus: 'APROVADO' }], []);
    expect(rotulos('Renata')).toEqual(['Revogar']);
    expect(texto()).toContain('pendentes · 1');
    expect(texto()).toContain('aprovados · 1');
  });

  it('recusar uma pendente manda POST /recusar e recarrega', async () => {
    await listas([RENATA], [], []);

    clicar('Renata', 'Recusar');
    backend
      .expectOne(`${API}/id-Renata/recusar`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await assentar();
    await listas([], [], [{ ...RENATA, docenteStatus: 'RECUSADO' }]);

    expect(texto()).toContain('recusados · 1');
  });

  it('aprovar de novo quem foi recusado usa a mesma rota de aprovar', async () => {
    await listas([], [], [DIEGO]);

    clicar('Diego', 'Aprovar');
    backend
      .expectOne(`${API}/id-Diego/aprovar`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await assentar();
    await listas([], [{ ...DIEGO, docenteStatus: 'APROVADO' }], []);

    expect(rotulos('Diego')).toEqual(['Revogar']);
  });

  it('revogar PEDE CONFIRMACAO: o primeiro toque nao chama a API', async () => {
    // Revogar tira o poder de todas as turmas na hora; um toque errado nao pode
    // bastar. (Recusar pendente e aprovar de novo se desfazem na propria tela.)
    await listas([], [MARCOS], []);

    clicar('Marcos', 'Revogar');

    backend.expectNone(`${API}/id-Marcos/recusar`);
    expect(cartao('Marcos').textContent).toContain('Revogar Marcos?');
    expect(cartao('Marcos').textContent).toContain('todas as turmas, na hora');
    expect(rotulos('Marcos')).toEqual(['Sim, revogar', 'Cancelar']);
  });

  it('confirmar a revogacao manda POST /recusar — a rota e uma so', async () => {
    await listas([], [MARCOS], []);

    clicar('Marcos', 'Revogar');
    clicar('Marcos', 'Sim, revogar');
    backend
      .expectOne(`${API}/id-Marcos/recusar`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await assentar();
    await listas([], [], [{ ...MARCOS, docenteStatus: 'RECUSADO' }]);

    // Depois de revogar, a confirmacao nao fica aberta na proxima lista.
    expect(el().textContent).not.toContain('Revogar Marcos?');
  });

  it('cancelar a revogacao fecha a confirmacao sem chamar a API', async () => {
    await listas([], [MARCOS], []);

    clicar('Marcos', 'Revogar');
    clicar('Marcos', 'Cancelar');

    backend.expectNone(`${API}/id-Marcos/recusar`);
    expect(rotulos('Marcos')).toEqual(['Revogar']);
  });

  it('falha na decisao aparece na tela, nao recarrega e deixa tentar de novo', async () => {
    await listas([RENATA], [], []);

    clicar('Renata', 'Aprovar');
    backend
      .expectOne(`${API}/id-Renata/aprovar`)
      .flush({ detail: 'Conta não encontrada' }, { status: 404, statusText: 'Not Found' });
    await assentar();

    const alerta = el().querySelector('.pf-erro')!;
    expect(alerta.textContent).toContain('Conta não encontrada');
    expect(alerta.getAttribute('role')).toBe('alert');
    // Nao recarregou: a fila continua como estava, e o botao voltou.
    expect(rotulos('Renata')).toEqual(['Aprovar', 'Recusar']);
    expect(
      (cartao('Renata').querySelector('button') as HTMLButtonElement).disabled,
    ).toBeFalse();
  });

  it('com uma decisao no ar os botoes travam: nao decide duas vezes', async () => {
    await listas([RENATA, PAULO], [], []);

    clicar('Renata', 'Aprovar');
    const travados = (
      Array.from(el().querySelectorAll('.pessoa button')) as HTMLButtonElement[]
    ).map((b) => b.disabled);
    expect(travados.every(Boolean)).toBeTrue();

    clicar('Paulo', 'Aprovar');
    backend.expectNone(`${API}/id-Paulo/aprovar`);

    backend
      .expectOne(`${API}/id-Renata/aprovar`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await assentar();
    await listas([PAULO], [RENATA], []);
  });

  it('falha ao carregar aparece com "Tentar de novo" e nao finge fila vazia', async () => {
    for (const status of ['PENDENTE', 'APROVADO', 'RECUSADO']) {
      backend
        .expectOne((r) => r.url === API && r.params.get('status') === status)
        .error(new ProgressEvent('error'));
    }
    await assentar();

    expect(el().querySelector('.pf-erro')!.textContent).toContain('Sem conexão');
    expect(texto()).not.toContain('Ninguém na fila');

    (
      Array.from(el().querySelectorAll('button')) as HTMLButtonElement[]
    )
      .find((b) => b.textContent!.trim() === 'Tentar de novo')!
      .click();
    await listas([RENATA], [], []);

    expect(el().querySelector('.pf-erro')).toBeNull();
    expect(texto()).toContain('pendentes · 1');
  });

  it('voltar para a tela recarrega: a fila anda sem o app aberto', async () => {
    await listas([], [], []);

    fixture.componentInstance.ionViewWillEnter();
    await listas([RENATA], [], []);

    expect(texto()).toContain('pendentes · 1');
  });
});
