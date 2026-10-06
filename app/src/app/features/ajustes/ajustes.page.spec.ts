import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { ChaveIaService } from '../../core/chave-ia.service';
import { NotificacoesService } from '../../notifications/notificacoes.service';
import { LEMBRETES_PADRAO } from '../../notifications/reagendador';
import { AjustesPage } from './ajustes.page';

type Avisos = jasmine.SpyObj<NotificacoesService> & { suportado: boolean };

function avisosFalsos(suportado: boolean, exato = 'denied'): Avisos {
  const a = Object.assign(
    jasmine.createSpyObj<NotificacoesService>('avisos', [
      'config',
      'salvarPreferencias',
      'estado',
      'estadoExato',
      'permitirExato',
      'testar',
    ]),
    { suportado },
  );
  a.config.and.resolveTo({ ...LEMBRETES_PADRAO, vespera: false });
  a.salvarPreferencias.and.resolveTo();
  a.estado.and.resolveTo('granted');
  a.estadoExato.and.resolveTo(exato as 'denied');
  a.permitirExato.and.resolveTo('granted');
  a.testar.and.resolveTo('agendado');
  return a;
}

describe('AjustesPage — lembretes', () => {
  let fixture: ComponentFixture<AjustesPage>;
  let avisos: Avisos;

  async function abrir(a: Avisos): Promise<HTMLElement> {
    avisos = a;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        { provide: NotificacoesService, useValue: a },
        {
          provide: ChaveIaService,
          useValue: { mascarada: async () => '', gravar: async () => {} },
        },
      ],
    });
    fixture = TestBed.createComponent(AjustesPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function caixa(tela: HTMLElement, campo: string): HTMLInputElement {
    return tela.querySelector(`input[data-lembrete="${campo}"]`)!;
  }

  it('no navegador diz que lembrete e coisa do app, e nao mostra controle nenhum', async () => {
    const tela = await abrir(avisosFalsos(false));

    expect(tela.textContent).toContain('Lembretes funcionam no app Android');
    expect(tela.querySelectorAll('input[type="checkbox"]').length).toBe(0);
    expect(tela.textContent).not.toContain('Testar agora');
  });

  it('os tres liga/desliga vem do aparelho, cada um com o seu rotulo', async () => {
    const tela = await abrir(avisosFalsos(true));

    expect(caixa(tela, 'noDia').checked).toBeTrue();
    expect(caixa(tela, 'vespera').checked).toBeFalse();
    expect(caixa(tela, 'umaHora').checked).toBeTrue();
    // Rotulo clicavel e nome acessivel: a caixa esta DENTRO do <label>.
    expect(caixa(tela, 'noDia').closest('label')!.textContent).toContain(
      'No dia · 7h',
    );
    expect(caixa(tela, 'vespera').closest('label')!.textContent).toContain(
      'Na véspera · 19h',
    );
    expect(caixa(tela, 'umaHora').closest('label')!.textContent).toContain(
      '1 hora antes · só com horário',
    );
  });

  it('mudar um liga/desliga grava os tres de uma vez', async () => {
    const tela = await abrir(avisosFalsos(true));

    const c = caixa(tela, 'umaHora');
    c.checked = false;
    c.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(avisos.salvarPreferencias).toHaveBeenCalledWith({
      noDia: true,
      vespera: false,
      umaHora: false,
    });
  });

  function botoes(tela: HTMLElement, texto: string): HTMLButtonElement[] {
    return Array.from(tela.querySelectorAll('button')).filter((b) =>
      b.textContent!.includes(texto),
    );
  }

  it('sem alarme exato: diz que o atraso pode chegar a 1 HORA e oferece o botao', async () => {
    // O texto antigo dizia "alguns minutos de folga". A documentacao do Android
    // 12+ fala em ate uma hora — e prometer minutos para quem agenda "1 hora
    // antes" e prometer o que o sistema nao cumpre.
    const tela = await abrir(avisosFalsos(true, 'denied'));
    expect(tela.textContent).toContain('pode atrasar o aviso em até 1 hora');
    expect(tela.textContent).not.toContain('minutos de folga');

    botoes(tela, 'Permitir horário exato')[0].click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(avisos.permitirExato).toHaveBeenCalled();
    expect(botoes(tela, 'Permitir horário exato').length).toBe(0);
  });

  it('com alarme exato permitido, nao oferece o botao', async () => {
    const tela = await abrir(avisosFalsos(true, 'granted'));
    expect(botoes(tela, 'Permitir horário exato').length).toBe(0);
    expect(tela.textContent).toContain('Testar agora');
  });

  describe('ao ligar "1 hora antes"', () => {
    /** `umaHora` comeca desligado: o teste liga. */
    function desligada(a: Avisos): Avisos {
      a.config.and.resolveTo({ ...LEMBRETES_PADRAO, umaHora: false });
      return a;
    }

    async function ligar(tela: HTMLElement): Promise<void> {
      const c = caixa(tela, 'umaHora');
      c.checked = true;
      c.dispatchEvent(new Event('change'));
      await fixture.whenStable();
      fixture.detectChanges();
    }

    const AVISO = 'pode atrasar este aviso em até 1 hora';

    it('com o exato negado, avisa ali mesmo e oferece o botao — que pede ao Android', async () => {
      const tela = await abrir(desligada(avisosFalsos(true, 'denied')));
      expect(tela.textContent).not.toContain(AVISO);

      await ligar(tela);

      expect(tela.textContent).toContain(AVISO);
      // Dois botoes na tela: o do aviso e o da secao "horario exato". Os dois
      // chamam a mesma coisa.
      expect(botoes(tela, 'Permitir horário exato').length).toBe(2);

      botoes(tela, 'Permitir horário exato')[0].click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(avisos.permitirExato).toHaveBeenCalled();
      expect(tela.textContent).not.toContain(AVISO);
      expect(botoes(tela, 'Permitir horário exato').length).toBe(0);
    });

    it('com o exato permitido, nao avisa nada', async () => {
      const tela = await abrir(desligada(avisosFalsos(true, 'granted')));
      await ligar(tela);

      expect(tela.textContent).not.toContain(AVISO);
    });

    it('desligar de novo tira o aviso: nao ha mais o que atrasar', async () => {
      const tela = await abrir(desligada(avisosFalsos(true, 'denied')));
      await ligar(tela);
      expect(tela.textContent).toContain(AVISO);

      const c = caixa(tela, 'umaHora');
      c.checked = false;
      c.dispatchEvent(new Event('change'));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(tela.textContent).not.toContain(AVISO);
    });

    it('ligar os OUTROS dois nao dispara o aviso', async () => {
      const tela = await abrir(avisosFalsos(true, 'denied'));
      const c = caixa(tela, 'vespera');
      c.checked = true;
      c.dispatchEvent(new Event('change'));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(tela.textContent).not.toContain(AVISO);
    });
  });
});
