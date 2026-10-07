import { DestroyRef, NgZone, inject, signal } from '@angular/core';

/** Quanto tempo o "Ocultado. Desfazer" fica na tela. */
export const JANELA_DESFAZER_MS = 8000;

/**
 * A janela do "Desfazer": abre depois de uma ação reversível e se fecha sozinha.
 *
 * Existe porque ocultar é um toque só, sem a pergunta de antes — e quem toca
 * errado precisa de uma saída ao alcance do polegar, não de uma viagem até a
 * tela da turma. Depois que a janela fecha o caminho continua existindo (a
 * seção "Ocultados", na Turma); ela só tira da frente um aviso que já não é
 * urgente.
 *
 * Tem de ser criada em contexto de injeção (campo da classe), porque pede o
 * `DestroyRef`: sair da tela com o relógio correndo deixaria um timer vivo
 * escrevendo num sinal de tela que já não existe.
 */
export class JanelaDesfazer {
  readonly aberta = signal(false);

  private readonly zona = inject(NgZone);
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly ms = JANELA_DESFAZER_MS) {
    inject(DestroyRef).onDestroy(() => this.fechar());
  }

  /** Abre de novo do zero: ocultar duas coisas seguidas não encurta a segunda. */
  abrir(): void {
    this.fechar();
    this.aberta.set(true);
    // Fora da zona de propósito: o relógio de 8 s não é trabalho pendente da tela.
    // Dentro dela, `whenStable` (e qualquer coisa que espere a aplicação ficar
    // estável) esperaria os 8 s inteiros. O sinal basta para repintar.
    this.zona.runOutsideAngular(() => {
      this.temporizador = setTimeout(() => this.fechar(), this.ms);
    });
  }

  fechar(): void {
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
    this.aberta.set(false);
  }
}
