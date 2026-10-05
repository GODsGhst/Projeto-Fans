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

/** `GET /eu` — a conta de quem esta logado, com o que so a tela de perfil precisa. */
export interface Perfil extends Usuario {
  adminPlataforma: boolean;
  /**
   * `false` para conta que so entra pelo Google (sem `senha_hash`). A tela usa
   * isto para nao oferecer "trocar senha" a quem nao tem senha nenhuma.
   */
  temSenha: boolean;
}

/**
 * `PATCH /eu`. O JWT volta junto porque o token atual carrega o nome: sem trocar
 * o token, o nome antigo continuaria circulando em toda requisicao.
 */
export interface AtualizarNomeResponse {
  jwt: string;
  perfil: Perfil;
}

/** Resposta de `POST /auth/*`. */
export interface SessaoResponse {
  jwt: string;
  usuario: Usuario;
  /**
   * Nulo (ausente no JSON) para quem ainda nao entrou em turma nenhuma — que e o
   * estado normal de quem acabou de se cadastrar, nao um erro.
   *
   * O app precisa disto ANTES de abrir as abas: sem turma, toda rota protegida
   * responde 404 e as quatro telas viram erro sem explicacao.
   */
  turmaId?: string | null;
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
  /**
   * Sala habitual e quem da a materia.
   *
   * `?` alem de `| null` porque o backend OMITE campo nulo do JSON — ele chega
   * como `undefined`, nao `null`. Tipar so `| null` faria o compilador aceitar
   * `!== null` num valor que nunca e null, e a tela mostraria "undefined".
   */
  sala?: string | null;
  professor?: string | null;
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
  /** Sala DESTE evento quando difere da habitual. Ausente = na sala da materia. */
  sala?: string | null;
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
  /** De que aula este material e, em `AAAA-MM-DD`. Ausente = nao se aplica. */
  dataAula?: string | null;
  /**
   * Resumo por IA, gerado por alguem da turma e visivel para todos.
   *
   * Compartilhado de proposito: gerar custa dinheiro da chave de quem pediu, e
   * um resumo por pessoa faria os trinta pagarem pelo mesmo PDF.
   */
  resumo?: string | null;
  resumoEm?: string | null;
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

export interface CriarEventoRequest {
  materiaId: string;
  tipo: TipoEvento;
  titulo: string;
  data: string;
  hora: string | null;
  /** `null` = na sala de sempre. Preenchida so quando for a excecao daquele dia. */
  sala: string | null;
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
  /** De que aula, em `AAAA-MM-DD`. `null` para material que nao e de uma aula. */
  dataAula: string | null;
}

/** Substituicao por inteiro, pelo mesmo motivo de `AtualizarEventoRequest`. */
export type AtualizarMaterialRequest = CriarMaterialRequest;

export interface CriarMateriaRequest {
  nome: string;
  sigla: string;
  corHex: string;
  /** Opcional: quem cadastra nem sempre sabe a sala, e exigir faria inventar. */
  sala: string | null;
  professor: string | null;
}
