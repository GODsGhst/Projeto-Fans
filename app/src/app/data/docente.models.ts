/**
 * Tipos do `GET /painel` (spec 7) e o que a sessao precisa dizer sobre uma conta
 * docente.
 *
 * Vive fora de `models.ts` de proposito: aquele arquivo e o espelho do que o
 * aluno ja usa, e esta onda nao pode brigar com quem o esta editando. Quando o
 * `Usuario` de la ganhar `tipoConta`/`docenteStatus`, estes tipos de conta podem
 * migrar para ca sem mudar nenhum chamador.
 */
import type { ItemHome } from './models';

/** O que a pessoa declarou ser no cadastro. Define a INTERFACE, nao o poder. */
export type TipoConta = 'ALUNO' | 'PROFESSOR' | 'COORDENADOR';
/** Define o PODER, e o servidor o le do banco a cada requisicao. */
export type DocenteStatus = 'PENDENTE' | 'APROVADO' | 'RECUSADO';
/** "Esta pessoa tem poder aqui": ausente (nulo) quando nao ha poder. */
export type Selo = 'PROFESSOR' | 'COORDENACAO';
/** Papel de um docente numa turma. Docente nunca e LIDER (spec 2.7). */
export type PapelDocente = 'PROFESSOR' | 'COORDENADOR';

export interface MateriaLecionada {
  materiaId: string;
  sigla: string;
  corHex: string;
}

export interface TurmaDoPainel {
  turmaId: string;
  nome: string;
  /** O backend OMITE campo nulo do JSON: chega `undefined`, nao `null`. */
  semestre?: string | null;
  papel: PapelDocente;
  /** Ausente = sem poder la (conta pendente/recusada ou contestado na turma). */
  selo?: Selo | null;
  contestado: boolean;
  lecionadas: MateriaLecionada[];
  /**
   * Ja vem filtrado, ordenado e cortado (14 dias, teto 6, mesma regra da Home):
   * professor so ve as materias que declarou, coordenador a turma toda. Quem
   * renderiza NAO reordena, NAO filtra e NAO corta.
   */
  proximos: ItemHome[];
}

export interface Painel {
  turmas: TurmaDoPainel[];
}

// ---- A conta na sessao -----------------------------------------------------
// `Usuario` (models.ts) ainda nao tem estes campos; ler por aqui compila antes e
// depois de eles existirem. Quando `AuthService.ehDocente` existir, os chamadores
// podem trocar `ehContaDocente(auth.usuario())` por `auth.ehDocente()` e este
// bloco inteiro some.

interface ContaNaSessao {
  tipoConta?: TipoConta;
  docenteStatus?: DocenteStatus | null;
}

function daConta(usuario: object | null | undefined): ContaNaSessao {
  return (usuario ?? {}) as ContaNaSessao;
}

export function tipoDaConta(
  usuario: object | null | undefined,
): TipoConta | undefined {
  return daConta(usuario).tipoConta;
}

/**
 * Tipo, nao status (spec 2.9): o professor pendente tambem usa o painel. Sessao
 * gravada antes desta onda nao tem `tipoConta`, e isso quer dizer aluno — por
 * isso `undefined` NAO e docente.
 */
export function ehContaDocente(usuario: object | null | undefined): boolean {
  const tipo = tipoDaConta(usuario);
  return tipo !== undefined && tipo !== 'ALUNO';
}

export function statusDocente(
  usuario: object | null | undefined,
): DocenteStatus | null {
  return daConta(usuario).docenteStatus ?? null;
}
