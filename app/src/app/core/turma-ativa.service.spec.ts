import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Preferences } from '@capacitor/preferences';

import { AuthService } from './auth.service';
import { StorageService } from './storage.service';
import { RECARREGAR_APP, TurmaAtivaService } from './turma-ativa.service';

const CHAVE = 'pf.turmaAtiva';
const T3A = { turmaId: 't3a', nome: 'ADS 3A' };
const T3B = { turmaId: 't3b', nome: 'ADS 3B' };

describe('TurmaAtivaService', () => {
  const eu = signal<{ id: string } | null>({ id: 'u1' });
  let limparSnapshot: jasmine.Spy;
  let recarregar: jasmine.Spy;

  /** Um servico novo por chamada, para simular "fechei e reabri o app". */
  async function abrirApp(): Promise<TurmaAtivaService> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { usuario: eu.asReadonly() } },
        { provide: StorageService, useValue: { limpar: limparSnapshot } },
        { provide: RECARREGAR_APP, useValue: recarregar },
      ],
    });
    const servico = TestBed.inject(TurmaAtivaService);
    await servico.pronto;
    return servico;
  }

  beforeEach(async () => {
    await Preferences.remove({ key: CHAVE });
    eu.set({ id: 'u1' });
    limparSnapshot = jasmine.createSpy('limparSnapshot').and.resolveTo();
    recarregar = jasmine.createSpy('recarregar');
  });

  afterEach(async () => Preferences.remove({ key: CHAVE }));

  it('a primeira escolha grava, limpa o snapshot e NAO recarrega', async () => {
    const s = await abrirApp();

    await s.escolher(T3A);

    expect(s.turmaId()).toBe('t3a');
    expect(s.nome()).toBe('ADS 3A');
    expect(limparSnapshot).toHaveBeenCalledTimes(1);
    // Nao havia turma "antiga" com dados na tela: recarregar so piscaria.
    expect(recarregar).not.toHaveBeenCalled();
  });

  it('trocar de turma limpa o snapshot DA ANTIGA e recarrega o app ja com a nova', async () => {
    const s = await abrirApp();
    await s.escolher(T3A);
    limparSnapshot.calls.reset();
    const idsNaRecarga: (string | null)[] = [];
    recarregar.and.callFake(() => idsNaRecarga.push(s.turmaId()));

    await s.escolher(T3B);

    expect(limparSnapshot).toHaveBeenCalledTimes(1);
    expect(recarregar).toHaveBeenCalledTimes(1);
    // Se recarregasse antes de gravar, o app reabriria na turma antiga.
    expect(idsNaRecarga).toEqual(['t3b']);
    const reaberto = await abrirApp();
    expect(reaberto.turmaId()).withContext('sobrevive a fechar o app').toBe('t3b');
  });

  it('escolher a que ja e a ativa nao apaga nem recarrega nada', async () => {
    const s = await abrirApp();
    await s.escolher(T3A);
    limparSnapshot.calls.reset();

    await s.escolher(T3A);

    expect(limparSnapshot).not.toHaveBeenCalled();
    expect(recarregar).not.toHaveBeenCalled();
  });

  it('a turma ativa e de quem escolheu: outro docente no mesmo aparelho nao a herda', async () => {
    const s = await abrirApp();
    await s.escolher(T3A);

    eu.set({ id: 'u2' });

    // O id da turma do u1 indo no cabecalho do u2 seria 404 em tudo.
    expect(s.turmaId()).toBeNull();
    expect((await abrirApp()).turmaId()).toBeNull();
    eu.set({ id: 'u1' });
    expect((await abrirApp()).turmaId()).toBe('t3a');
  });

  describe('conciliar (o painel chegou)', () => {
    it('sem ativa, adota a primeira turma do painel, sem recarregar', async () => {
      const s = await abrirApp();

      await s.conciliar([T3B, T3A]);

      expect(s.turmaId()).toBe('t3b');
      expect(recarregar).not.toHaveBeenCalled();
    });

    it('a ativa continua sendo minha: nao muda e nao limpa o snapshot', async () => {
      const s = await abrirApp();
      await s.escolher(T3A);
      limparSnapshot.calls.reset();

      await s.conciliar([T3B, T3A]);

      expect(s.turmaId()).toBe('t3a');
      expect(limparSnapshot).not.toHaveBeenCalled();
    });

    it('sai da turma ativa (removido): cai para outra, em vez de mandar um id que e 404', async () => {
      const s = await abrirApp();
      await s.escolher(T3A);

      await s.conciliar([T3B]);

      expect(s.turmaId()).toBe('t3b');
    });

    it('turma renomeada atualiza o nome SEM apagar o cache offline', async () => {
      const s = await abrirApp();
      await s.escolher(T3A);
      limparSnapshot.calls.reset();

      await s.conciliar([{ turmaId: 't3a', nome: 'ADS 3A (noite)' }]);

      expect(s.nome()).toBe('ADS 3A (noite)');
      expect(limparSnapshot).not.toHaveBeenCalled();
    });

    it('painel sem turma nenhuma esquece a ativa, tambem do disco', async () => {
      const s = await abrirApp();
      await s.escolher(T3A);

      await s.conciliar([]);

      expect(s.turmaId()).toBeNull();
      expect((await abrirApp()).turmaId()).toBeNull();
    });
  });

  it('disco ilegivel vira "sem turma ativa", nao erro', async () => {
    spyOn(console, 'error');
    await Preferences.set({ key: CHAVE, value: '{nao e json' });

    const s = await abrirApp();

    expect(s.turmaId()).toBeNull();
  });
});
