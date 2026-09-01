import type { Material } from '../data/models';
import { assinatura } from './evento-vm';

/** O que `MaterialLinhaComponent` precisa para desenhar uma linha da lista. */
export interface MaterialVm {
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
