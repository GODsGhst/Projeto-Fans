import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthService } from '../core/auth.service';
import {
  StorageFake,
  USUARIO,
  configurarTeste,
} from '../features/auth/auth-teste';
import { TabsPage } from './tabs.page';

describe('TabsPage', () => {
  let auth: AuthService;
  let fixture: ComponentFixture<TabsPage>;

  beforeEach(() => {
    configurarTeste(new StorageFake());
    auth = TestBed.inject(AuthService);
    auth.definirSessao('jwt', USUARIO, 't1');
    fixture = TestBed.createComponent(TabsPage);
    fixture.detectChanges();
  });

  function noPerfil(seletor: string): string {
    return fixture.nativeElement
      .querySelector(`.pf-aba-perfil ${seletor}`)!
      .textContent.trim();
  }

  it('o item de perfil mostra inicial, nome e e-mail da sessao', () => {
    expect(noPerfil('.pf-avatar')).toBe('O');
    expect(noPerfil('.pf-perfil-nome')).toBe('Otavio');
    expect(noPerfil('.pf-perfil-email')).toBe('voce@exemplo.com');
    // No PC ele e recortado, nao removido: e o que da nome ao item no leitor.
    expect(noPerfil('.pf-perfil-curto')).toBe('Perfil');
  });

  it('renomear troca a sessao e o menu acompanha, sem GET /eu', async () => {
    await auth.renovarSessao('jwt-novo', { ...USUARIO, nome: 'Éster' });
    fixture.detectChanges();

    expect(noPerfil('.pf-avatar')).toBe('É');
    expect(noPerfil('.pf-perfil-nome')).toBe('Éster');
  });

  it('nome que comeca com emoji vira a inicial inteira', async () => {
    await auth.renovarSessao('jwt', { ...USUARIO, nome: '🎓 Formanda' });
    fixture.detectChanges();

    expect(noPerfil('.pf-avatar')).toBe('🎓');
  });
});
