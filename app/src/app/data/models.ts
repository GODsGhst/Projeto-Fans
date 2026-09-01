/**
 * Espelho dos DTOs do backend. Nomes identicos aos das Tasks 4-8 do plano.
 *
 * Este arquivo nao inventa vocabulario: `TipoEvento` e reexportado de
 * `shared/tipos.ts` de proposito, para que o tipo que os componentes visuais
 * aceitam e o tipo que a API devolve nao possam divergir em silencio.
 */
import type { TipoEvento } from '../shared/tipos';

export type { TipoEvento };

export type TipoMaterial = 'AULA' | 'ADICIONAL';
export type PapelMembro = 'ALUNO' | 'LIDER' | 'PROFESSOR';

/**
 * Autoria visivel em tudo. Nao existe registro anonimo neste app — autoria e o
 * unico mecanismo de confianca que ele tem.
 */
export interface Autoria {
  autorId: string;
  autorNome: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
}

/** Resposta de `POST /auth/*`. */
export interface SessaoResponse {
  jwt: string;
  usuario: Usuario;
}

export interface Membro {
  id: string;
  usuarioId: string;
  turmaId: string;
  papel: PapelMembro;
  entrouEm: string;
}

export interface Materia {
  id: string;
  nome: string;
  sigla: string;
  /** Uma das 12 hues validadas da paleta. Vem do servidor, nunca digitada aqui. */
  corHex: string;
}

/** Item de `GET /home`. Ja vem ordenado, dentro da janela e dentro do teto. */
export interface ItemHome {
  eventoId: string;
  tipo: TipoEvento;
  titulo: string;
  /** ISO `AAAA-MM-DD`. */
  data: string;
  /** `HH:mm`, ou null — hora e opcional. */
  hora: string | null;
  materiaSigla: string;
  materiaCorHex: string;
  autoria: Autoria;
  /** Vem de `estado_pessoal`, nunca de uma coluna em `evento`. */
  feitoPeloUsuario: boolean;
}

export interface Evento {
  id: string;
  tipo: TipoEvento;
  titulo: string;
  data: string;
  hora: string | null;
  materiaId: string;
  materiaSigla: string;
  materiaCorHex: string;
  autoria: Autoria;
  /** Usada no `If-Match` de PATCH e DELETE. Sem ela o backend devolve 428. */
  version: number;
  visivelTurma: boolean;
  excluidoEm: string | null;
}

export interface Material {
  id: string;
  tipo: TipoMaterial;
  titulo: string;
  url: string | null;
  arquivoRef: string | null;
  materiaId: string;
  autoria: Autoria;
  version: number;
  visivelTurma: boolean;
  excluidoEm: string | null;
}

/** `GET /eventos/{id}` — traz SOMENTE os materiais vinculados a este evento. */
export interface EventoDetalhe extends Evento {
  materiais: Material[];
}

/** `GET /materias/{id}` — materiais separados por tipo, mais os eventos da materia. */
export interface MateriaDetalhe {
  materia: Materia;
  materiaisAula: Material[];
  materiaisAdicionais: Material[];
  eventos: Evento[];
}

export interface MeuQuadro {
  aFazer: ItemHome[];
  feito: ItemHome[];
}

/** Registros do proprio autor que estao ocultos ou logicamente excluidos. */
export interface NaoListados {
  eventos: Evento[];
  materiais: Material[];
}

/** Delta de `GET /sync?desde=`. Inclui os ocultos para o app poder remove-los. */
export interface SyncResponse {
  eventosAlterados: Evento[];
  materias: Materia[];
  servidorEm: string;
}

export interface CriarEventoRequest {
  materiaId: string;
  tipo: TipoEvento;
  titulo: string;
  data: string;
  hora: string | null;
}

/**
 * PATCH SUBSTITUI os campos editaveis por inteiro — nao e merge parcial (A13).
 *
 * `Partial<>` aqui era uma armadilha: objeto parcial leva 400 com ProblemDetail.
 * O motivo do backend e `hora` — num merge, "campo ausente mantem o atual"
 * tornaria impossivel APAGAR a hora de um evento, e quem corrigisse "na verdade
 * nao tem horario" ficaria preso a um dado errado. Mande todos os campos,
 * inclusive os que nao mudaram.
 */
export type AtualizarEventoRequest = CriarEventoRequest;

export interface CriarMaterialRequest {
  materiaId: string;
  tipo: TipoMaterial;
  titulo: string;
  /** Obrigatoria no MVP: `arquivo_ref` so entra na Task 15. */
  url: string;
}

/** Substituicao por inteiro, pelo mesmo motivo de `AtualizarEventoRequest`. */
export type AtualizarMaterialRequest = CriarMaterialRequest;

export interface CriarMateriaRequest {
  nome: string;
  sigla: string;
  corHex: string;
}
