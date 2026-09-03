import type { ItemHome } from '../data/models';

/**
 * Um aviso local agendado no aparelho.
 *
 * Local, e nao empurrado pelo servidor, por decisao 2.3 do spec: host de tier
 * gratuito hiberna, e um job `@Scheduled` as 19h simplesmente nao roda num
 * servidor dormindo — o nao-negociavel falharia em silencio.
 */
export interface Agendamento {
  readonly eventoId: string;
  readonly dispararEm: Date;
  readonly titulo: string;
  readonly corpo: string;
}

/**
 * O minimo para agendar. `ItemHome` (de `/home`) satisfaz este shape, e
 * `Evento` (de `/sync`) satisfaz depois de renomear `id` para `eventoId`.
 *
 * `visivelTurma` e `excluidoEm` sao opcionais porque `/home` nao os manda — ela
 * ja filtrou. Quem manda e o `/sync`, que devolve oculto e excluido DE
 * PROPOSITO, para o aparelho poder desagendar o que sumiu da turma.
 */
export type EventoAgendavel = Pick<
  ItemHome,
  'eventoId' | 'tipo' | 'titulo' | 'data' | 'hora' | 'materiaSigla'
> & {
  readonly visivelTurma?: boolean;
  readonly excluidoEm?: string | null;
};

/** Horario fixo do aviso da vespera. Um lugar para mudar (decisao 2.6). */
export const NOTIFICACAO_HORA_VESPERA = '19:00';

/** A turma e local. Internacionalizar agora seria custo sem beneficiario. */
export const TIMEZONE_PADRAO = 'America/Sao_Paulo';

/**
 * Um agendamento por evento futuro, as `horaVespera` do dia anterior a `data`,
 * no fuso `timezone`. Ignora evento cujo disparo ja passou, e ignora evento
 * excluido ou oculto.
 *
 * Funcao pura de proposito: e aqui que um bug de notificacao moraria —
 * off-by-one de dia, fuso, evento hoje, hora nula. Como funcao pura, cada um
 * desses e um teste de duas linhas em vez de um teste de integracao com relogio
 * falso.
 *
 * A hora do EVENTO nao participa da conta: o aviso e as 19h tenha o evento hora
 * ou nao. Deixar `hora` vazar para o disparo faria a prova sem horario avisar a
 * meia-noite.
 */
export function calcularAgendamentos(
  eventos: readonly EventoAgendavel[],
  agora: Date,
  horaVespera: string,
  timezone: string,
): Agendamento[] {
  const agendamentos: Agendamento[] = [];
  for (const e of eventos) {
    if (!daTurma(e)) {
      continue;
    }
    const dispararEm = vespera(e.data, horaVespera, timezone);
    if (dispararEm === null || dispararEm.getTime() <= agora.getTime()) {
      continue;
    }
    agendamentos.push({
      eventoId: e.eventoId,
      dispararEm,
      titulo: `${e.tipo === 'PROVA' ? 'Prova' : 'Entrega'} de ${e.materiaSigla} amanhã`,
      corpo: e.hora === null ? e.titulo : `${e.titulo} · ${e.hora}`,
    });
  }
  return agendamentos;
}

/**
 * Oculto pelo lider ou excluido pelo autor nao gera aviso.
 *
 * Sem isto sobra o fantasma da A16: o lider oculta uma prova, ela some da Home
 * de todo mundo, e o celular de quem ja tinha sincronizado avisa as 19h assim
 * mesmo. `!== false` e proposital — quem nao manda o campo (a `/home`) ja filtrou.
 */
function daTurma(e: EventoAgendavel): boolean {
  return e.visivelTurma !== false && (e.excluidoEm ?? null) === null;
}

/** Instante de `horaVespera` no dia anterior a `data` (ISO `AAAA-MM-DD`). */
function vespera(
  data: string,
  horaVespera: string,
  timezone: string,
): Date | null {
  const [ano, mes, dia] = data.split('-').map(Number);
  const [h, min] = horaVespera.split(':').map(Number);
  if ([ano, mes, dia, h, min].some((n) => n === undefined || Number.isNaN(n))) {
    return null;
  }
  // `dia - 1` em cima de Date.UTC, nunca em cima da string: a vespera do dia 1
  // e o ultimo dia do mes anterior, e o Date.UTC resolve isso (e o ano bissexto)
  // sozinho. Aritmetica de string daria "2026-09-00".
  const anterior = new Date(Date.UTC(ano, mes - 1, dia - 1));
  return instante(
    anterior.getUTCFullYear(),
    anterior.getUTCMonth(),
    anterior.getUTCDate(),
    h,
    min,
    timezone,
  );
}

/**
 * Converte hora de parede num fuso para o instante absoluto correspondente.
 *
 * `new Date('2026-09-09T19:00')` seria uma linha, e e o bug classico: essa
 * construcao usa o fuso da MAQUINA. Passa no notebook de quem escreveu e avisa
 * na hora errada no celular de quem usa.
 *
 * Duas passadas porque o deslocamento depende do proprio instante que estamos
 * calculando: a primeira chuta, a segunda corrige. O Brasil nao tem horario de
 * verao desde 2019, entao hoje uma passada bastaria — a segunda e o que mantem
 * a funcao correta se ele voltar, ou se outro fuso entrar.
 */
function instante(
  ano: number,
  mesZeroBased: number,
  dia: number,
  h: number,
  min: number,
  timezone: string,
): Date {
  const parede = Date.UTC(ano, mesZeroBased, dia, h, min);
  const chute = parede - deslocamento(timezone, new Date(parede));
  return new Date(parede - deslocamento(timezone, new Date(chute)));
}

/** Quanto o relogio de `timezone` esta a frente do UTC naquele instante, em ms. */
function deslocamento(timezone: string, quando: Date): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(quando);

  const campos: Record<string, number> = {};
  for (const p of partes) {
    if (p.type !== 'literal') {
      campos[p.type] = Number(p.value);
    }
  }
  // `% 24` porque parte do ICU formata meia-noite como "24" com hour12:false.
  const relogio = Date.UTC(
    campos['year'],
    campos['month'] - 1,
    campos['day'],
    campos['hour'] % 24,
    campos['minute'],
    campos['second'],
  );
  return relogio - quando.getTime();
}
