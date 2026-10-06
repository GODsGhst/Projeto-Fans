import type { ItemHome } from '../data/models';
import { MESES } from '../features/evento-vm';

/**
 * Um aviso local agendado no aparelho.
 *
 * Local, e nao empurrado pelo servidor, por decisao 2.3 do spec: host de tier
 * gratuito hiberna, e um job `@Scheduled` as 19h simplesmente nao roda num
 * servidor dormindo — o nao-negociavel falharia em silencio.
 */
export interface Agendamento {
  readonly eventoId: string;
  /** Entra no id da notificacao: o mesmo evento tem ate quatro avisos, e cada um precisa do seu. */
  readonly tipo: TipoLembrete;
  readonly dispararEm: Date;
  readonly titulo: string;
  readonly corpo: string;
}

/**
 * O minimo para agendar. `Evento` (de `/sync`) satisfaz este shape depois de
 * renomear `id` para `eventoId`.
 *
 * `visivelTurma` e `excluidoEm` sao opcionais porque a `/home` nao os manda — ela
 * ja filtrou. Quem manda e o `/sync`, que devolve oculto e excluido DE
 * PROPOSITO, para o aparelho poder desagendar o que sumiu da turma.
 *
 * `hora` aceita `undefined` porque e o que chega de verdade: o backend omite
 * campo nulo do JSON em vez de escrever null.
 */
export type EventoAgendavel = Pick<
  ItemHome,
  'eventoId' | 'tipo' | 'titulo' | 'data' | 'materiaSigla'
> & {
  readonly hora?: string | null;
  readonly visivelTurma?: boolean;
  readonly excluidoEm?: string | null;
};

/** Horario fixo do aviso da vespera. Um lugar para mudar (decisao 2.6). */
export const NOTIFICACAO_HORA_VESPERA = '19:00';

/**
 * Horario do aviso do proprio dia — e tambem a base do alarme personalizado
 * relativo quando o evento nao tem hora. Um numero so para as duas coisas: se
 * fossem diferentes, "36 horas antes" de uma prova sem hora contaria de um
 * horario que a pessoa nunca viu escrito em lugar nenhum.
 */
export const NOTIFICACAO_HORA_NO_DIA = '07:00';

/** A turma e local. Internacionalizar agora seria custo sem beneficiario. */
export const TIMEZONE_PADRAO = 'America/Sao_Paulo';

/**
 * Teto de avisos pendentes no aparelho.
 *
 * O Android recusa alarme novo quando o app passa de ~500 pendentes, e quem
 * recusa e o sistema — em silencio, no meio do lote. 400 deixa folga para o
 * aviso de teste e para o que outra biblioteca agendar. Como a lista e ordenada
 * por instante antes do corte, o que sobra de fora e o mais distante, e a
 * proxima sincronizacao o agenda quando ele chegar perto.
 */
export const LIMITE_AGENDAMENTOS = 400;

/** Os tres padrao mais o personalizado. O tipo entra no id da notificacao. */
export type TipoLembrete = 'NO_DIA' | 'VESPERA' | 'UMA_HORA' | 'PERSONALIZADO';

/** Os tres liga/desliga globais. Por aparelho: e preferencia, nao fato da turma. */
export interface PreferenciasLembrete {
  readonly noDia: boolean;
  readonly vespera: boolean;
  readonly umaHora: boolean;
}

/**
 * O alarme que a pessoa marca na tela de um evento. Um por evento.
 *
 * `horasAntes` em horas mesmo quando a pessoa digitou dias: "2 dias" e 48 h e
 * a conta e uma subtracao so. O Brasil nao tem horario de verao, entao 48 h
 * antes e "mesma hora, dois dias antes" — se voltar a ter, quem decide e esta
 * subtracao, e a tela mostra o instante calculado de qualquer jeito.
 *
 * `data`/`hora` do modo exato sao hora de PAREDE no fuso da turma, nunca um
 * instante serializado: e o que a pessoa digitou, e e o que `instante()` sabe
 * converter sem cair no fuso da maquina.
 */
export type AlarmePersonalizado =
  | { readonly modo: 'RELATIVO'; readonly horasAntes: number }
  | { readonly modo: 'EXATO'; readonly data: string; readonly hora: string };

/** Tudo o que o aparelho guarda sobre lembretes. */
export interface ConfigLembretes extends PreferenciasLembrete {
  /** eventoId -> alarme. Mapa, e nao lista: "so 1 por evento" fica garantido pelo tipo. */
  readonly personalizados: Readonly<Record<string, AlarmePersonalizado>>;
}

/** Os tres ligados: quem nunca abriu Ajustes recebe tudo. */
export const LEMBRETES_PADRAO: ConfigLembretes = {
  noDia: true,
  vespera: true,
  umaHora: true,
  personalizados: {},
};

/**
 * Todos os avisos de todos os eventos visiveis, no fuso `timezone`, do mais
 * proximo ao mais distante e no maximo `LIMITE_AGENDAMENTOS`. Ignora o que ja
 * passou, e ignora evento excluido ou oculto — inclusive o alarme personalizado
 * dele.
 *
 * Funcao pura de proposito: e aqui que um bug de notificacao moraria —
 * off-by-one de dia, fuso, evento hoje, hora nula. Como funcao pura, cada um
 * desses e um teste de duas linhas em vez de um teste de integracao com relogio
 * falso.
 *
 * - VESPERA: `horaVespera` do dia anterior. A hora do EVENTO nao participa: o
 *   aviso e as 19h tenha o evento hora ou nao. Deixar `hora` vazar para o
 *   disparo faria a prova sem horario avisar a meia-noite.
 * - NO_DIA: 07:00 do dia. Pulado quando a prova comeca antes disso — "hoje:
 *   prova" depois de a prova comecar e ruido, nao aviso — e quando o UMA_HORA
 *   esta ligado e cai ate as 07:00 (os dois tocariam juntos).
 * - UMA_HORA: so existe se o evento tem hora. Inventar uma hora para a prova sem
 *   horario seria mentir sobre o combinado (decisao 2.6).
 * - PERSONALIZADO: nao olha os tres liga/desliga. Quem desligou tudo e marcou um
 *   alarme a mao pediu exatamente aquele.
 */
export function calcularAgendamentos(
  eventos: readonly EventoAgendavel[],
  agora: Date,
  horaVespera: string,
  timezone: string,
  config: ConfigLembretes,
): Agendamento[] {
  const agendamentos: Agendamento[] = [];
  for (const e of eventos) {
    if (!daTurma(e)) {
      continue;
    }
    const hora = horaDe(e.hora);
    const tipo = e.tipo === 'PROVA' ? 'prova' : 'entrega';
    const comHora = hora === null ? e.titulo : `${e.titulo} · ${hora}`;
    const comeca = hora === null ? null : emParede(e.data, hora, timezone);
    const candidatos: [TipoLembrete, Date | null, string, string][] = [];

    if (config.noDia) {
      const noDia = emParede(e.data, NOTIFICACAO_HORA_NO_DIA, timezone);
      // Evento as 08:00 com "1 hora antes" ligado: os dois tocariam as 07:00, o
      // mesmo instante, com dois textos. Se o "1 hora antes" cai ate as 7h, ele
      // ja e o aviso do dia — o "no dia" ficaria so repetindo.
      const umaHoraJaAvisa =
        config.umaHora &&
        comeca !== null &&
        noDia !== null &&
        comeca.getTime() - HORA_MS <= noDia.getTime();
      if (
        !umaHoraJaAvisa &&
        (comeca === null || (noDia !== null && noDia < comeca))
      ) {
        candidatos.push([
          'NO_DIA',
          noDia,
          `Hoje: ${tipo} de ${e.materiaSigla}`,
          comHora,
        ]);
      }
    }
    if (config.vespera) {
      candidatos.push([
        'VESPERA',
        emParede(e.data, horaVespera, timezone, 1),
        `${e.tipo === 'PROVA' ? 'Prova' : 'Entrega'} de ${e.materiaSigla} amanhã`,
        comHora,
      ]);
    }
    if (config.umaHora && comeca !== null) {
      candidatos.push([
        'UMA_HORA',
        new Date(comeca.getTime() - HORA_MS),
        `Em 1 hora: ${tipo} de ${e.materiaSigla} · ${hora}`,
        e.titulo,
      ]);
    }
    const alarme = config.personalizados[e.eventoId];
    if (alarme !== undefined) {
      candidatos.push([
        'PERSONALIZADO',
        instantePersonalizado(alarme, e, timezone),
        `Lembrete: ${tipo} de ${e.materiaSigla}`,
        `${e.titulo} · ${rotuloDoEvento(e.data, hora)}`,
      ]);
    }

    for (const [qual, dispararEm, titulo, corpo] of candidatos) {
      if (dispararEm !== null && dispararEm.getTime() > agora.getTime()) {
        agendamentos.push({
          eventoId: e.eventoId,
          tipo: qual,
          dispararEm,
          titulo,
          corpo,
        });
      }
    }
  }
  return agendamentos
    .sort((a, b) => a.dispararEm.getTime() - b.dispararEm.getTime())
    .slice(0, LIMITE_AGENDAMENTOS);
}

/**
 * O instante em que o alarme personalizado toca, ou `null` se a data/hora e
 * ilegivel. Exportada porque a tela do evento mostra este instante ANTES de
 * salvar: "36 horas antes" de uma prova sem hora so nao surpreende se a tela
 * disser "vai tocar sex, 9 out, 19:00".
 *
 * Sem hora no evento, a base e 07:00 do dia — o mesmo horario do aviso NO_DIA.
 */
export function instantePersonalizado(
  alarme: AlarmePersonalizado,
  evento: Pick<EventoAgendavel, 'data' | 'hora'>,
  timezone: string,
): Date | null {
  if (alarme.modo === 'EXATO') {
    return emParede(alarme.data, alarme.hora, timezone);
  }
  const base = emParede(
    evento.data,
    horaDe(evento.hora) ?? NOTIFICACAO_HORA_NO_DIA,
    timezone,
  );
  return base === null
    ? null
    : new Date(base.getTime() - alarme.horasAntes * HORA_MS);
}

/**
 * Fica so o alarme personalizado de evento que existe e e da turma.
 *
 * A lista TEM de ser a do `/sync`, nunca a da Home. A Home tem janela de 14 dias
 * e teto de 6: a prova daqui a tres semanas nao vem nela e continua existindo, e
 * podar por ela apagaria, na primeira abertura do app, o alarme que a pessoa
 * acabou de marcar para a prova final. O `/sync` sem `desde` traz a turma
 * inteira, inclusive oculto e excluido — entao ali, e so ali, "nao veio" quer
 * dizer "nao existe".
 */
export function podarPersonalizados(
  personalizados: Readonly<Record<string, AlarmePersonalizado>>,
  eventosDoSync: readonly EventoAgendavel[],
): Record<string, AlarmePersonalizado> {
  const vivos = new Set(
    eventosDoSync.filter(daTurma).map((e) => e.eventoId),
  );
  const ficam: Record<string, AlarmePersonalizado> = {};
  for (const [id, alarme] of Object.entries(personalizados)) {
    if (vivos.has(id)) {
      ficam[id] = alarme;
    }
  }
  return ficam;
}

/**
 * UUID do evento + tipo do aviso -> inteiro, que e o unico id que o Android
 * aceita.
 *
 * djb2. Precisa ser ESTAVEL, nao unico no universo: o mesmo aviso tem de
 * receber o mesmo id em toda execucao, senao cancelar nao encontra o que
 * agendou. O tipo entra no hash porque o mesmo evento tem ate quatro avisos —
 * com o id so do evento, o segundo `schedule` substituiria o primeiro.
 *
 * `% 2_000_000_000` faz duas coisas: deixa o id do aviso de teste
 * (2_000_000_001) fora da faixa de verdade, e nao so "na pratica"; e evita
 * `Math.abs(-2^31)`, que da 2^31 — um a mais do que cabe no `int` do Android.
 */
export function idDoAviso(eventoId: string, tipo: TipoLembrete): number {
  const chave = `${eventoId}:${tipo}`;
  let h = 5381;
  for (let i = 0; i < chave.length; i++) {
    h = ((h << 5) + h + chave.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 2_000_000_000;
}

/**
 * "sex, 9 out, 19:00" — o instante como o relogio de `timezone` mostra.
 *
 * Montado a mao, e nao com `toLocaleString('pt-BR')`, porque o ICU escreve
 * "sex., 9 de out., 19:00" e o resto do app escreve "9 out" (`evento-vm`).
 */
export function rotuloInstante(quando: Date, timezone: string): string {
  const p = new Date(quando.getTime() + deslocamento(timezone, quando));
  const hh = String(p.getUTCHours()).padStart(2, '0');
  const mm = String(p.getUTCMinutes()).padStart(2, '0');
  return `${DIAS_CURTOS[p.getUTCDay()]}, ${p.getUTCDate()} ${MESES[p.getUTCMonth()]}, ${hh}:${mm}`;
}

const HORA_MS = 3_600_000;

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/**
 * `HH:mm`, ou null. O `LocalTime` do backend sai do Jackson como "19:00:00", e
 * campo nulo nem chega (vem `undefined`). Sem isto o aviso diria "· 19:00:00",
 * e o `undefined` passaria pelo `=== null` e viraria uma hora inventada.
 */
function horaDe(hora: string | null | undefined): string | null {
  return hora ? hora.slice(0, 5) : null;
}

/**
 * "sex, 9 out" (+ hora, se houver) do EVENTO, para o corpo do alarme
 * personalizado: ele pode tocar dias antes, e "Prova 2" sozinho nao diz quando.
 * Date.UTC so para achar o dia da semana — nenhum fuso entra numa data sem hora.
 */
function rotuloDoEvento(data: string, hora: string | null): string {
  const [ano, mes, dia] = data.split('-').map(Number);
  const semana = DIAS_CURTOS[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()];
  const quando = `${semana}, ${dia} ${MESES[mes - 1] ?? mes}`;
  return hora === null ? quando : `${quando}, ${hora}`;
}

/**
 * Oculto pelo lider ou excluido pelo autor nao gera aviso.
 *
 * Sem isto sobra o fantasma da A16: o lider oculta uma prova, ela some da Home
 * de todo mundo, e o celular de quem ja tinha sincronizado avisa as 19h assim
 * mesmo. `!== false` e proposital — quem nao manda o campo (a `/home`) ja filtrou.
 *
 * Vem ANTES de qualquer leitura de conteudo: para quem nao e o autor, o `/sync`
 * manda o oculto como lapide, sem titulo nem data.
 */
function daTurma(e: EventoAgendavel): boolean {
  return e.visivelTurma !== false && (e.excluidoEm ?? null) === null;
}

/**
 * Instante de `hora` (`HH:mm`) em `data` (ISO `AAAA-MM-DD`) menos `diasAntes`,
 * no relogio de `timezone`. `null` se a string e ilegivel.
 */
function emParede(
  data: string,
  hora: string,
  timezone: string,
  diasAntes = 0,
): Date | null {
  const [ano, mes, dia] = data.split('-').map(Number);
  const [h, min] = hora.split(':').map(Number);
  if ([ano, mes, dia, h, min].some((n) => n === undefined || Number.isNaN(n))) {
    return null;
  }
  // `dia - diasAntes` vai para o Date.UTC dentro de `instante`, nunca para a
  // string: a vespera do dia 1 e o ultimo dia do mes anterior, e o Date.UTC
  // resolve isso (e o ano bissexto) sozinho. Aritmetica de string daria
  // "2026-09-00".
  return instante(ano, mes - 1, dia - diasAntes, h, min, timezone);
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
