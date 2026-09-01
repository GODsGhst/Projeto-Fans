import { AVISA_APOS_MS, Espera } from './espera';

/**
 * Em 2026-09-01, na primeira vez que alguém tentou criar conta pelo APK, o botão
 * ficou em "Criando…" por quarenta e cinco segundos. O código estava certo — havia
 * `finally`, o botão destravaria sozinho —, mas o servidor gratuito estava
 * dormindo e ninguém espera 45 s olhando para um rótulo que não muda.
 *
 * Esta classe existe para a tela poder dizer a verdade nesse intervalo.
 */
describe('Espera', () => {
  let espera: Espera;

  beforeEach(() => {
    jasmine.clock().install();
    espera = new Espera();
  });

  afterEach(() => jasmine.clock().uninstall());

  it('não avisa antes da hora — espera curta é normal e não merece alarde', () => {
    espera.comecar();
    jasmine.clock().tick(AVISA_APOS_MS - 1);

    expect(espera.demorando()).toBeFalse();
  });

  it('avisa quando a espera passa do ponto em que parece travamento', () => {
    espera.comecar();
    jasmine.clock().tick(AVISA_APOS_MS);

    expect(espera.demorando()).toBeTrue();
  });

  it('terminar apaga o aviso — inclusive quando a chamada falhou', () => {
    // O `terminar()` vive no `finally` de quem espera, entao roda tambem no erro.
    // Deixar o aviso aceso depois da falha diria "ainda estou tentando" sobre algo
    // que ja desistiu.
    espera.comecar();
    jasmine.clock().tick(AVISA_APOS_MS);
    espera.terminar();

    expect(espera.demorando()).toBeFalse();
  });

  it('terminar antes da hora impede o aviso de acender depois', () => {
    // A resposta rapida nao pode acender o aviso quatro segundos depois, com a
    // tela ja em outro lugar.
    espera.comecar();
    jasmine.clock().tick(AVISA_APOS_MS - 100);
    espera.terminar();
    jasmine.clock().tick(AVISA_APOS_MS);

    expect(espera.demorando()).toBeFalse();
  });

  it('comecar de novo reinicia a contagem, sem somar temporizadores', () => {
    espera.comecar();
    jasmine.clock().tick(AVISA_APOS_MS - 100);
    espera.comecar();
    jasmine.clock().tick(200);

    expect(espera.demorando())
      .withContext('a segunda espera mal comecou; o aviso e da primeira')
      .toBeFalse();
  });
});
