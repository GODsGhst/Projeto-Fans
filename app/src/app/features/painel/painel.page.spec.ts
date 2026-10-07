import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { erroHttpInterceptor } from '../../core/http-error.interceptor';
import { StorageService } from '../../core/storage.service';
import { TurmaAtivaService } from '../../core/turma-ativa.service';
import type { TurmaRef } from '../../core/turma-ativa.service';
import type { Painel, TurmaDoPainel } from '../../data/docente.models';
import type { ItemHome, Usuario } from '../../data/models';
import { StorageFake, USUARIO } from '../auth/auth-teste';
import { PainelPage } from './painel.page';

const URL_PAINEL = `${environment.apiUrl}/painel`;

function item(id: string, data: string): ItemHome {
  return {
    eventoId: id,
    tipo: 'PROVA',
    titulo: `evento ${id}`,
    data,
    hora: null,
    materiaSigla: 'BD',
    materiaCorHex: '#0369A1',
    autoria: {
      autorId: 'u9',
      autorNome: 'Ana',
      criadoEm: '2026-10-01T12:00:00Z',
      atualizadoEm: '2026-10-01T12:00:00Z',
    },
    feitoPeloUsuario: false,
  };
}

const BD = { materiaId: 'm-bd', sigla: 'BD', corHex: '#0369A1' };
const ES = { materiaId: 'm-es', sigla: 'ENG SW', corHex: '#B45309' };

function turma(parcial: Partial<TurmaDoPainel> & { turmaId: string }): TurmaDoPainel {
  return {
    nome: `Turma ${parcial.turmaId}`,
    semestre: '2026.2',
    papel: 'PROFESSOR',
    selo: 'PROFESSOR',
    contestado: false,
    lecionadas: [BD],
    proximos: [],
    ...parcial,
  };
}

/** Faz o papel do servico de verdade, sem Preferences nem recarga de pagina. */
class TurmaAtivaFake {
  readonly turmaId = signal<string | null>('t1');
  readonly nome = signal<string | null>('Turma t1');
  readonly escolher = jasmine
    .createSpy('escolher')
    .and.callFake(async (t: TurmaRef) => {
      this.turmaId.set(t.turmaId);
      this.nome.set(t.nome);
    });
  readonly conciliar = jasmine.createSpy('conciliar').and.resolveTo();
}

describe('PainelPage', () => {
  let backend: HttpTestingController;
  let auth: AuthService;
  let ativa: TurmaAtivaFake;
  let fixture: ComponentFixture<PainelPage>;

  beforeEach(() => {
    ativa = new TurmaAtivaFake();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
        { provide: StorageService, useValue: new StorageFake() },
        { provide: TurmaAtivaService, useValue: ativa },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    entrarComo({});
    fixture = TestBed.createComponent(PainelPage);
  });

  afterEach(() => backend.verify());

  function entrarComo(conta: object): void {
    auth.definirSessao(
      'jwt',
      { ...USUARIO, tipoConta: 'PROFESSOR', docenteStatus: 'APROVADO', ...conta } as Usuario,
      't1',
    );
  }

  /** O Ionic chama isto ao entrar na aba; o TestBed nao chama sozinho. */
  async function abrir(painel: Painel): Promise<void> {
    const pronto = fixture.componentInstance.ionViewWillEnter();
    backend.expectOne(URL_PAINEL).flush(painel);
    await pronto;
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const texto = (): string => el().textContent!.replace(/\s+/g, ' ');
  const cartoes = (): HTMLButtonElement[] =>
    Array.from(el().querySelectorAll('button.tcard'));

  it('um cartao por turma, com o selo, o chip das materias declaradas e quantos proximos', async () => {
    await abrir({
      turmas: [
        turma({ turmaId: 't1', nome: 'ADS 3A', lecionadas: [BD, ES], proximos: [item('a', '2026-10-08')] }),
        turma({ turmaId: 't2', nome: 'ADS 3B', papel: 'COORDENADOR', selo: 'COORDENACAO', lecionadas: [] }),
      ],
    });

    expect(cartoes().length).toBe(2);
    const [tresA, tresB] = cartoes();
    expect(tresA.textContent).toContain('ADS 3A');
    expect(tresA.textContent).toContain('2026.2 · 1 próximo');
    expect(tresA.textContent).toContain('Professor');
    expect(tresA.querySelectorAll('app-materia-chip').length).toBe(2);
    expect(tresB.textContent).toContain('Coordenação');
    expect(tresB.textContent).toContain('0 próximos');
    expect(tresB.textContent).toContain('turma inteira');
    expect(tresB.querySelectorAll('app-materia-chip').length).toBe(0);
  });

  it('conta sem poder na turma (selo ausente) nao mostra selo nenhum', async () => {
    await abrir({ turmas: [turma({ turmaId: 't1', selo: null })] });

    expect(el().querySelector('.selo')).toBeNull();
  });

  it('tocar num cartao troca a turma ativa; a marcada e a ativa', async () => {
    await abrir({ turmas: [turma({ turmaId: 't1', nome: 'ADS 3A' }), turma({ turmaId: 't2', nome: 'ADS 3B' })] });
    expect(cartoes().map((c) => c.getAttribute('aria-pressed'))).toEqual(['true', 'false']);

    cartoes()[1].click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(ativa.escolher).toHaveBeenCalledOnceWith({ turmaId: 't2', nome: 'ADS 3B' });
    expect(cartoes().map((c) => c.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
  });

  it('proximos agrupados por turma, na ordem do servidor (sem reordenar nem cortar)', async () => {
    await abrir({
      turmas: [
        turma({ turmaId: 't1', nome: 'ADS 3A', proximos: [item('tarde', '2026-10-20'), item('cedo', '2026-10-08')] }),
        turma({ turmaId: 't2', nome: 'ADS 3B', papel: 'COORDENADOR', proximos: [item('b1', '2026-10-09')] }),
      ],
    });

    const titulos = Array.from(el().querySelectorAll('app-evento-card')).map(
      (c) => c.querySelector('.titulo')!.textContent!.trim(),
    );
    expect(titulos).toEqual(['evento tarde', 'evento cedo', 'evento b1']);
    expect(texto()).toContain('ADS 3A · próximos das minhas matérias');
    expect(texto()).toContain('ADS 3B · próximos da turma inteira');
    // O card leva a tela do evento.
    expect(el().querySelector('a.ir')!.getAttribute('href')).toBe('/tabs/eventos/tarde');
  });

  it('professor sem materia declarada ve o motivo, nao um "nada nos proximos 14 dias" mudo', async () => {
    await abrir({
      turmas: [
        turma({ turmaId: 't1', lecionadas: [] }),
        turma({ turmaId: 't2', lecionadas: [BD] }),
      ],
    });

    expect(texto()).toContain('Você ainda não declarou matérias aqui. Faça isso na aba Turma.');
    // Quem declarou e simplesmente nao tem nada na janela: outra frase.
    expect(texto()).toContain('Nada nos próximos 14 dias.');
  });

  describe('aviso de status da conta', () => {
    const turmas = { turmas: [turma({ turmaId: 't1' })] };

    it('aprovado: nenhum aviso', async () => {
      await abrir(turmas);
      expect(el().querySelector('.faixa')).toBeNull();
    });

    it('pendente: "Em análise", dizendo que ainda nao corrige nem tem selo', async () => {
      entrarComo({ docenteStatus: 'PENDENTE' });
      await abrir(turmas);

      expect(el().querySelector('.faixa')!.textContent).toContain('Em análise.');
      expect(texto()).toContain('Sua conta de professor espera aprovação');
    });

    it('pendente de coordenacao fala em coordenacao', async () => {
      entrarComo({ tipoConta: 'COORDENADOR', docenteStatus: 'PENDENTE' });
      await abrir(turmas);

      expect(texto()).toContain('Sua conta de coordenação espera aprovação');
    });

    it('recusado: "Não aprovado"', async () => {
      entrarComo({ docenteStatus: 'RECUSADO' });
      await abrir(turmas);

      expect(el().querySelector('.faixa')!.textContent).toContain('Não aprovado.');
    });

    it('contestado numa turma: aviso nomeia SO aquela turma e o cartao ganha a marca', async () => {
      await abrir({
        turmas: [
          turma({ turmaId: 't1', nome: 'ADS 3A', contestado: true, selo: null }),
          turma({ turmaId: 't2', nome: 'ADS 3B' }),
        ],
      });

      const faixas = Array.from(el().querySelectorAll('.faixa'));
      expect(faixas.length).toBe(1);
      expect(faixas[0].textContent).toContain('Contestado em ADS 3A.');
      expect(faixas[0].textContent).toContain('Nas outras turmas nada muda.');
      expect(cartoes()[0].querySelector('.tag')!.textContent).toContain('contestado');
      expect(cartoes()[1].querySelector('.tag')).toBeNull();
    });
  });

  describe('falhou x vazio', () => {
    it('falha de rede: aviso de erro, e NAO "Nenhuma turma ainda"', async () => {
      const pronto = fixture.componentInstance.ionViewWillEnter();
      backend.expectOne(URL_PAINEL).error(new ProgressEvent('error'));
      await pronto;
      fixture.detectChanges();

      expect(el().querySelector('.pf-aviso')).not.toBeNull();
      expect(texto()).not.toContain('Nenhuma turma ainda');
      expect(ativa.conciliar).not.toHaveBeenCalled();
    });

    it('zero turmas de verdade: "Nenhuma turma ainda" e o atalho para entrar numa', async () => {
      await abrir({ turmas: [] });

      expect(texto()).toContain('Nenhuma turma ainda');
      expect(el().querySelector('a[href="/entrar-turma"]')).not.toBeNull();
    });
  });

  describe('turma ativa', () => {
    it('com o painel carregado, confere a ativa contra as turmas que a pessoa tem', async () => {
      await abrir({ turmas: [turma({ turmaId: 't1', nome: 'ADS 3A' }), turma({ turmaId: 't2', nome: 'ADS 3B' })] });

      expect(ativa.conciliar).toHaveBeenCalledOnceWith([
        { turmaId: 't1', nome: 'ADS 3A' },
        { turmaId: 't2', nome: 'ADS 3B' },
      ]);
    });

    it('recarga que FALHA nao concilia de novo (painel velho, nao verdade nova)', async () => {
      await abrir({ turmas: [turma({ turmaId: 't1' })] });
      ativa.conciliar.calls.reset();

      const pronto = fixture.componentInstance.ionViewWillEnter();
      backend.expectOne(URL_PAINEL).error(new ProgressEvent('error'));
      await pronto;

      expect(ativa.conciliar).not.toHaveBeenCalled();
    });
  });

  describe('atalhos', () => {
    const link = (rotulo: string): HTMLAnchorElement =>
      (Array.from(el().querySelectorAll('.origem a')) as HTMLAnchorElement[]).find((a) =>
        a.textContent!.includes(rotulo),
      )!;

    it('dizem em qual turma criam e abrem as telas de criar ja existentes', async () => {
      await abrir({ turmas: [turma({ turmaId: 't1', nome: 'ADS 3A' })] });

      expect(texto()).toContain('criar em Turma t1');
      expect(link('Nova prova').getAttribute('href')).toBe('/tabs/eventos/novo?tipo=PROVA');
      expect(link('Nova entrega').getAttribute('href')).toBe('/tabs/eventos/novo?tipo=ENTREGA');
    });

    it('novo material: com UMA materia declarada vai direto nela', async () => {
      await abrir({ turmas: [turma({ turmaId: 't1', lecionadas: [BD] })] });

      expect(link('Novo material').getAttribute('href')).toBe('/tabs/materias/m-bd/material/novo');
    });

    it('novo material: com varias (ou nenhuma) a lista de materias deixa escolher', async () => {
      await abrir({ turmas: [turma({ turmaId: 't1', lecionadas: [BD, ES] })] });

      expect(link('Novo material').getAttribute('href')).toBe('/tabs/materias');
    });

    it('sem turma ativa, nao oferece criar (nao ha onde)', async () => {
      ativa.nome.set(null);
      await abrir({ turmas: [] });

      expect(el().querySelector('.origem')).toBeNull();
    });
  });
});
