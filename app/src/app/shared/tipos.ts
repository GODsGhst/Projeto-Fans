/**
 * Vocabulario compartilhado dos componentes visuais.
 *
 * `Materia` existe como par indivisivel de proposito. O nao-negociavel visual e
 * "cor + sigla sempre juntas, nunca so a bolinha colorida" — se cor e sigla
 * fossem dois campos soltos, alguem passaria um sem o outro mais cedo ou mais
 * tarde. Como par, o tipo recusa.
 */
export interface Materia {
  readonly sigla: string;
  /** Uma das 12 hues da paleta. O aluno escolhe da lista; nao digita hex. */
  readonly cor: string;
}

/**
 * Prova pesa mais que entrega — por tinta, nunca por cor. A cor ja esta ocupada
 * identificando materia. Ver `evento-card.component.ts`.
 */
export type TipoEvento = 'PROVA' | 'ENTREGA';

/**
 * Anotacao da turma e anotacao pessoal nunca podem se parecer: confundir
 * "recado do lider" com "meu rabisco" faz alguem estudar a coisa errada.
 */
export type AlcanceNota = 'TURMA' | 'PESSOAL';

/** Estado do cartao no Meu quadro. Estado pessoal, nunca gravado no fato compartilhado. */
export type EstadoQuadro = 'A_FAZER' | 'FEITO';
