import { signal } from '@angular/core';

/** Depois de quanto tempo a espera deixa de parecer normal e passa a parecer travamento. */
export const AVISA_APOS_MS = 4000;

/**
 * Um botão que diz "Criando…" por quarenta segundos não comunica espera, comunica
 * travamento — e quem está do outro lado fecha o app.
 *
 * Isso não é hipótese: aconteceu em 2026-09-01, na primeira vez que alguém tentou
 * criar conta pelo APK. O servidor estava dormindo (plano gratuito do Render
 * hiberna depois de 15 min parado) e levou 45 s para acordar. O código estava
 * correto — `try/catch/finally`, o botão destravaria sozinho —, mas ninguém espera
 * 45 s olhando para um rótulo que não muda.
 *
 * Esta classe só marca a passagem do tempo. Quem decide o que dizer é a tela, e
 * ela deve dizer a verdade: o servidor está acordando, e isso acaba.
 */
export class Espera {
  /** True quando a espera já passou do ponto em que parece travamento. */
  readonly demorando = signal(false);

  private temporizador: ReturnType<typeof setTimeout> | null = null;

  comecar(apos = AVISA_APOS_MS): void {
    this.terminar();
    this.temporizador = setTimeout(() => this.demorando.set(true), apos);
  }

  /**
   * Chamado no `finally` de quem espera — inclusive quando dá erro. Deixar o aviso
   * acesso depois da falha diria "ainda estou tentando" sobre algo que já desistiu.
   */
  terminar(): void {
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
    this.demorando.set(false);
  }
}
