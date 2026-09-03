import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

const CHAVE = 'projetofans.chave-ia';

/**
 * A chave da IA de cada pessoa, guardada só no aparelho dela.
 *
 * **Por que ela não está no app.** Chave dentro do APK é chave pública:
 * qualquer um que receba o arquivo extrai o conteúdo em um minuto — inclusive o
 * colega para quem o app foi mandado testar. Uma chave embutida "só para
 * testar" é uma conta de terceiros aberta para quem quiser.
 *
 * **Nem no servidor.** Ela vai no header da requisição, é usada e descartada.
 * Guardá-la no banco transformaria este servidor num alvo que hoje ele não é:
 * hoje o pior vazamento é conteúdo de turma; com chaves guardadas, seria a
 * conta de terceiros de trinta alunos.
 *
 * Então o único lugar que sobra é este: o `Preferences` do próprio aparelho,
 * que é onde a sessão já mora. Cada um usa a sua e paga a sua.
 *
 * **Isto é temporário por desenho.** Quando o resumo virar recurso pago do
 * projeto, a chave passa a sair da configuração do servidor e o caminho é
 * apagar um header — esta classe e a tela de Ajustes saem juntas, sem tocar em
 * mais nada.
 */
@Injectable({ providedIn: 'root' })
export class ChaveIaService {
  /**
   * `null` = ainda não foi lida do disco. `''` = lida, e não há nenhuma.
   *
   * A distinção importa: sem ela a tela mostraria "você ainda não colou uma
   * chave" no instante entre abrir e o disco responder, para quem tem chave.
   */
  private readonly cache = signal<string | null>(null);

  async ler(): Promise<string> {
    const emCache = this.cache();
    if (emCache !== null) {
      return emCache;
    }
    const { value } = await Preferences.get({ key: CHAVE });
    const chave = value ?? '';
    this.cache.set(chave);
    return chave;
  }

  async gravar(chave: string): Promise<void> {
    const limpa = chave.trim();
    this.cache.set(limpa);
    if (limpa === '') {
      await Preferences.remove({ key: CHAVE });
      return;
    }
    await Preferences.set({ key: CHAVE, value: limpa });
  }

  /** Só o começo e o fim. A tela confirma que há uma chave sem exibi-la. */
  async mascarada(): Promise<string> {
    const chave = await this.ler();
    if (chave === '') {
      return '';
    }
    return chave.length <= 12
      ? '••••'
      : `${chave.slice(0, 8)}…${chave.slice(-4)}`;
  }
}
