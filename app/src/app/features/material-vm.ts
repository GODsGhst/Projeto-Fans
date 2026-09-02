import type { Material } from '../data/models';
import { assinatura } from './evento-vm';

/** O que `MaterialLinhaComponent` precisa para desenhar uma linha da lista. */
export interface MaterialVm {
  /**
   * Onde abrir, ou `null`. Os dois campos sao anulaveis no modelo, entao
   * material sem endereco e representavel — e a tela nao pode fingir que da para
   * abrir. Link com href vazio parece tocavel e nao vai a lugar nenhum.
   */
  readonly url: string | null;
  readonly id: string;
  /** "PDF", "JPG", "LINK" — rotulo de formato, nao o `tipo` AULA/ADICIONAL. */
  readonly tipo: string;
  readonly titulo: string;
  readonly autoria: string;
}

export function materialVm(m: Material, agora: Date): MaterialVm {
  return {
    id: m.id,
    tipo: formato(m.arquivoRef ?? m.url),
    titulo: m.titulo,
    // O endereco para abrir. Ele era descartado aqui, e o resultado era material
    // que aparecia na tela e nao abria — a unica coisa que material precisa
    // fazer. `arquivoRef` ainda e sempre nulo (upload e a Task 15), entao hoje e
    // sempre a url.
    url: m.arquivoRef ?? m.url,
    autoria: assinatura(m.autoria, agora),
  };
}

/**
 * O rotulo de formato sai da extensao do arquivo ou do link. O servidor nao
 * manda esse campo, e o componente exige um: "LINK" e a resposta honesta quando
 * nao da para saber, em vez de chutar "PDF".
 */
function formato(ref: string | null): string {
  const ext = /\.([a-z0-9]{1,5})(?:$|[?#])/i.exec(ref ?? '');
  return ext === null ? 'LINK' : ext[1].toUpperCase();
}
