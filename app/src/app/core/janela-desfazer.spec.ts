import { Component } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import { JANELA_DESFAZER_MS, JanelaDesfazer } from './janela-desfazer';

@Component({ selector: 'app-teste-janela', standalone: true, template: '' })
class HospedeComponent {
  readonly janela = new JanelaDesfazer();
}

describe('JanelaDesfazer', () => {
  function criar(): HospedeComponent {
    return TestBed.createComponent(HospedeComponent).componentInstance;
  }

  it('abre, e se fecha sozinha depois de ~8 s', fakeAsync(() => {
    const { janela } = criar();

    janela.abrir();
    expect(janela.aberta()).toBeTrue();

    tick(JANELA_DESFAZER_MS - 1);
    expect(janela.aberta())
      .withContext('ainda falta 1 ms: o desfazer nao pode sumir antes')
      .toBeTrue();

    tick(1);
    expect(janela.aberta()).toBeFalse();
  }));

  it('abrir de novo recomeca a contagem: ocultar duas vezes nao encurta a segunda', fakeAsync(() => {
    const { janela } = criar();

    janela.abrir();
    tick(JANELA_DESFAZER_MS - 1000);
    janela.abrir();
    tick(JANELA_DESFAZER_MS - 1);

    expect(janela.aberta()).toBeTrue();
    tick(1);
    expect(janela.aberta()).toBeFalse();
  }));

  it('fechar() cancela o relogio', fakeAsync(() => {
    const { janela } = criar();

    janela.abrir();
    janela.fechar();

    expect(janela.aberta()).toBeFalse();
    // Sem timer pendente, o fakeAsync nao reclama ao terminar.
  }));

  it('sair da tela cancela o relogio, sem timer solto', fakeAsync(() => {
    const fixture = TestBed.createComponent(HospedeComponent);
    fixture.componentInstance.janela.abrir();

    fixture.destroy();

    expect(fixture.componentInstance.janela.aberta()).toBeFalse();
  }));
});
