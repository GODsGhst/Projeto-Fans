import { eventoVm } from './evento-vm';
import type { ItemHome } from '../data/models';

/**
 * A unica logica desta camada de wiring e formatacao — e formatacao e
 * apresentacao, nao regra. Nada aqui ordena, filtra ou corta: isso e do
 * servidor (nao-negociavel 5).
 */
function item(parcial: Partial<ItemHome> = {}): ItemHome {
  return {
    eventoId: 'e1',
    tipo: 'ENTREGA',
    titulo: 'Lista 4 — normalização',
    data: '2026-08-21',
    hora: '23:59',
    materiaSigla: 'BD',
    materiaCorHex: '#0369A1',
    autoria: {
      autorId: 'u1',
      autorNome: 'Otávio',
      criadoEm: '2026-08-21T09:00:00Z',
      atualizadoEm: '2026-08-21T09:00:00Z',
    },
    feitoPeloUsuario: false,
    ...parcial,
  };
}

describe('eventoVm', () => {
  it('a data ISO vira dia e mes no fuso do aparelho, nunca um dia a menos', () => {
    // new Date('2026-08-21') e meia-noite UTC: no Brasil isso e dia 20. Este
    // teste existe para que a data do evento nunca ande para tras na tela.
    const vm = eventoVm(
      item({ data: '2026-08-21' }),
      new Date('2026-08-21T14:00:00Z'),
    );

    expect(vm.dia).toBe('21');
    expect(vm.mes).toBe('ago');
  });

  it('evento sem hora mostra o tipo em vez de horario inventado', () => {
    const semHora = eventoVm(
      item({ hora: null, tipo: 'PROVA' }),
      new Date('2026-08-21T14:00:00Z'),
    );
    const comHora = eventoVm(
      item({ hora: '19:00' }),
      new Date('2026-08-21T14:00:00Z'),
    );

    expect(semHora.quando).toBe('prova');
    expect(comHora.quando).toBe('19:00');
  });

  it('hora com segundos, como o backend serializa, mostra so HH:mm', () => {
    // O LocalTime do servidor chega como "19:00:00". Sem o corte o card mostrava
    // isso cru, e as quatro telas dependem deste unico mapeamento.
    const agora = new Date('2026-08-21T14:00:00Z');

    expect(eventoVm(item({ hora: '19:00:00' }), agora).quando).toBe('19:00');
    expect(eventoVm(item({ hora: '07:05:30' }), agora).quando).toBe('07:05');
    // Hora vazia e hora ausente se comportam igual: rotulo do tipo, nunca "".
    expect(eventoVm(item({ hora: '', tipo: 'PROVA' }), agora).quando).toBe(
      'prova',
    );
  });

  it('autoria sempre aparece, mesmo com timestamp ilegivel', () => {
    // Autoria e o unico mecanismo de confianca do app (nao-negociavel 1): a
    // linha nunca pode sumir nem virar "Otávio · NaN".
    const normal = eventoVm(item(), new Date('2026-08-21T14:00:00Z'));
    const quebrado = eventoVm(
      item({
        autoria: {
          autorId: 'u1',
          autorNome: 'Otávio',
          criadoEm: 'nao-e-data',
          atualizadoEm: 'nao-e-data',
        },
      }),
      new Date('2026-08-21T14:00:00Z'),
    );

    expect(normal.autoria).toContain('Otávio');
    expect(normal.autoria).toMatch(/5 h/);
    expect(quebrado.autoria).toBe('Otávio');
  });
});
