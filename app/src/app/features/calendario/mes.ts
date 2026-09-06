/**
 * A grade de um mês, como dados. Sem Angular e sem DOM.
 *
 * **Por que é função pura.** Calendário é onde mora o bug silencioso: o mês que
 * começa no domingo, o dia 31 que some, o fuso que joga a prova para a véspera.
 * Nenhum desses aparece olhando a tela — aparecem em fevereiro, ou no celular de
 * quem está em outro fuso. Como função pura, cada um é um teste de duas linhas.
 */

/** Um dia da grade. `dia = 0` é célula vazia antes do dia 1. */
export interface Celula {
  readonly dia: number;
  /** `AAAA-MM-DD`. Vazio na célula de preenchimento. */
  readonly data: string;
  readonly temProva: boolean;
  readonly temEntrega: boolean;
  readonly temNota: boolean;
  /** Cores das matérias do dia, para os pontinhos. Sem repetição. */
  readonly cores: readonly string[];
}

export interface Mes {
  readonly ano: number;
  /** 0-11, como no `Date`. */
  readonly mes: number;
  readonly nome: string;
  readonly de: string;
  readonly ate: string;
  readonly celulas: readonly Celula[];
}

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/** Iniciais na ordem em que a grade desenha, começando no domingo. */
export const DIAS_DA_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const;

export interface FonteDoDia {
  readonly data: string;
  readonly tipo?: 'PROVA' | 'ENTREGA';
  readonly cor?: string;
}

/**
 * Monta a grade.
 *
 * `new Date(ano, mes, 1)` e `new Date(ano, mes + 1, 0)` fazem o trabalho difícil:
 * o segundo é "dia zero do mês seguinte", que o próprio runtime resolve como o
 * último dia deste — inclusive fevereiro bissexto. Contar 28/30/31 à mão seria
 * reimplementar o calendário gregoriano por conta própria.
 */
export function montarMes(
  ano: number,
  mes: number,
  eventos: readonly FonteDoDia[] = [],
  diasComNota: readonly string[] = [],
): Mes {
  const primeiro = new Date(ano, mes, 1);
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const comNota = new Set(diasComNota);

  const celulas: Celula[] = [];

  // Espaços antes do dia 1, para o mês cair no dia certo da semana. Sem eles a
  // grade fica bonita e mente sobre a data inteira.
  for (let i = 0; i < primeiro.getDay(); i++) {
    celulas.push({
      dia: 0,
      data: '',
      temProva: false,
      temEntrega: false,
      temNota: false,
      cores: [],
    });
  }

  for (let dia = 1; dia <= ultimoDia; dia++) {
    const data = iso(ano, mes, dia);
    const doDia = eventos.filter((e) => e.data === data);
    celulas.push({
      dia,
      data,
      temProva: doDia.some((e) => e.tipo === 'PROVA'),
      temEntrega: doDia.some((e) => e.tipo === 'ENTREGA'),
      temNota: comNota.has(data),
      cores: [
        ...new Set(doDia.map((e) => e.cor).filter((c): c is string => !!c)),
      ],
    });
  }

  return {
    ano,
    mes,
    nome: MESES[mes],
    de: iso(ano, mes, 1),
    ate: iso(ano, mes, ultimoDia),
    celulas,
  };
}

/** Mês vizinho, atravessando a virada do ano sem aritmética manual. */
export function mesVizinho(
  ano: number,
  mes: number,
  passo: number,
): { ano: number; mes: number } {
  const d = new Date(ano, mes + passo, 1);
  return { ano: d.getFullYear(), mes: d.getMonth() };
}

/**
 * `AAAA-MM-DD` montado a partir dos números, nunca de `toISOString()`.
 *
 * `toISOString` converte para UTC: num fuso negativo, o dia 1 às 00:00 local
 * vira o último dia do mês anterior. O mês inteiro andaria um dia para trás.
 */
function iso(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}
