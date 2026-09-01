import type { Autoria, ItemHome } from '../data/models';
import type { Materia, TipoEvento } from '../shared/tipos';

/**
 * O que `EventoCardComponent` precisa para desenhar uma prova ou entrega.
 *
 * Existe para que a formatacao — e so ela — fique fora do template. Nada aqui
 * ordena, filtra ou corta: a ordem, a janela de 14 dias e o teto de 6 sao do
 * servidor (nao-negociavel 5), e a Home renderiza na ordem que veio.
 */
export interface EventoVm {
  readonly tipo: TipoEvento;
  readonly dia: string;
  readonly mes: string;
  readonly quando: string;
  readonly titulo: string;
  readonly materia: Materia;
  readonly autoria: string;
}

/**
 * O minimo que a Home (`ItemHome`) e o Calendario (`Evento`) tem em comum. Os
 * dois DTOs ja trazem sigla e cor da materia, entao um mapeamento serve aos
 * dois e nao ha como as duas telas divergirem na formatacao.
 */
export type FonteEvento = Pick<
  ItemHome,
  'tipo' | 'titulo' | 'data' | 'hora' | 'materiaSigla' | 'materiaCorHex' | 'autoria'
>;

const MESES = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

const DIAS_DA_SEMANA = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

export function eventoVm(e: FonteEvento, agora: Date): EventoVm {
  const [, mes, dia] = e.data.split('-');
  return {
    tipo: e.tipo,
    dia,
    // `-1` porque o mes do ISO e 1-based. Sem `new Date(e.data)`: essa
    // construcao le a string como UTC e, num fuso negativo, mostra o dia
    // anterior — a data do evento andaria para tras na tela.
    mes: MESES[Number(mes) - 1] ?? mes,
    // Horario quando existe; senao o rotulo do tipo. Hora e opcional por
    // decisao 2.6 do spec, e inventar "00:00" seria mentir sobre o combinado.
    quando: e.hora ?? (e.tipo === 'PROVA' ? 'prova' : 'entrega'),
    titulo: e.titulo,
    materia: { sigla: e.materiaSigla, cor: e.materiaCorHex },
    autoria: assinatura(e.autoria, agora),
  };
}

/** "Sexta, 21 ago" — o titulo da Home. */
export function diaPorExtenso(agora: Date): string {
  return `${DIAS_DA_SEMANA[agora.getDay()]}, ${agora.getDate()} ${MESES[agora.getMonth()]}`;
}

/** Nome do mes por extenso, para orientar a lista do Calendario. */
export function mesPorExtenso(agora: Date): string {
  return MESES[agora.getMonth()];
}

/** ISO `AAAA-MM-DD` do primeiro e do ultimo dia do mes de `agora`, no fuso local. */
export function limitesDoMes(agora: Date): { de: string; ate: string } {
  const ano = agora.getFullYear();
  const mes = agora.getMonth();
  return { de: iso(new Date(ano, mes, 1)), ate: iso(new Date(ano, mes + 1, 0)) };
}

function iso(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/**
 * "Otávio · há 5 h". Autoria e o unico mecanismo de confianca do app, entao o
 * nome aparece sempre: se o timestamp vier ilegivel, cai para so o nome em vez
 * de exibir "NaN" ou sumir com a linha.
 */
export function assinatura(a: Autoria, agora: Date): string {
  const quando = desde(a.criadoEm, agora);
  return quando === null ? a.autorNome : `${a.autorNome} · ${quando}`;
}

function desde(iso: string, agora: Date): string | null {
  const ms = agora.getTime() - Date.parse(iso);
  if (Number.isNaN(ms)) {
    return null;
  }
  const minutos = Math.round(ms / 60_000);
  if (minutos < 1) {
    return 'agora';
  }
  if (minutos < 60) {
    return `há ${minutos} min`;
  }
  const horas = Math.round(minutos / 60);
  if (horas < 24) {
    return `há ${horas} h`;
  }
  const dias = Math.round(horas / 24);
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}
