import { DIAS_DA_SEMANA, montarMes, mesVizinho } from './mes';

/**
 * Os casos que quebram calendário, e nenhum deles aparece olhando a tela.
 */
describe('montarMes', () => {
  it('fevereiro bissexto tem 29 dias; o comum, 28', () => {
    // Contar 28/30/31 a mao seria reimplementar o calendario gregoriano.
    const dias = (ano: number) =>
      montarMes(ano, 1).celulas.filter((c) => c.dia > 0).length;

    expect(dias(2024)).toBe(29);
    expect(dias(2026)).toBe(28);
    expect(dias(2100)).withContext('2100 nao e bissexto').toBe(28);
  });

  it('o dia 1 cai na coluna certa da semana', () => {
    // 1 de setembro de 2026 e uma terca (getDay 2), entao ha 2 celulas vazias.
    const set = montarMes(2026, 8);
    const vazias = set.celulas.findIndex((c) => c.dia === 1);
    expect(vazias).toBe(new Date(2026, 8, 1).getDay());
  });

  it('mes que comeca no domingo nao ganha celula vazia', () => {
    // O off-by-one classico: assumir que sempre ha preenchimento.
    const nov = montarMes(2026, 10); // 1/11/2026 e domingo
    expect(nov.celulas[0].dia).toBe(1);
  });

  it('a data sai como AAAA-MM-DD local, sem passar por UTC', () => {
    // `toISOString()` num fuso negativo devolve o dia anterior, e o mes inteiro
    // andaria um dia para tras.
    const jan = montarMes(2026, 0);
    expect(jan.de).toBe('2026-01-01');
    expect(jan.ate).toBe('2026-01-31');
    expect(jan.celulas.find((c) => c.dia === 1)!.data).toBe('2026-01-01');
  });

  it('marca prova, entrega e anotacao no dia certo', () => {
    const m = montarMes(
      2026,
      8,
      [
        { data: '2026-09-10', tipo: 'PROVA', cor: '#1D4ED8' },
        { data: '2026-09-12', tipo: 'ENTREGA', cor: '#0F766E' },
      ],
      ['2026-09-15'],
    );
    const dia = (n: number) => m.celulas.find((c) => c.dia === n)!;

    expect(dia(10).temProva).toBeTrue();
    expect(dia(10).temEntrega).toBeFalse();
    expect(dia(12).temEntrega).toBeTrue();
    expect(dia(15).temNota).toBeTrue();
    expect(dia(11).cores).toEqual([]);
  });

  it('o mesmo dia com prova E entrega marca os dois', () => {
    const m = montarMes(2026, 8, [
      { data: '2026-09-10', tipo: 'PROVA', cor: '#1D4ED8' },
      { data: '2026-09-10', tipo: 'ENTREGA', cor: '#0F766E' },
    ]);
    const d10 = m.celulas.find((c) => c.dia === 10)!;

    expect(d10.temProva).toBeTrue();
    expect(d10.temEntrega).toBeTrue();
    expect(d10.cores.length).toBe(2);
  });

  it('duas provas da mesma materia no dia dao UM pontinho, nao dois', () => {
    const m = montarMes(2026, 8, [
      { data: '2026-09-10', tipo: 'PROVA', cor: '#1D4ED8' },
      { data: '2026-09-10', tipo: 'PROVA', cor: '#1D4ED8' },
    ]);
    expect(m.celulas.find((c) => c.dia === 10)!.cores).toEqual(['#1D4ED8']);
  });

  it('a semana comeca no domingo, com sete colunas', () => {
    expect(DIAS_DA_SEMANA.length).toBe(7);
    expect(DIAS_DA_SEMANA[0]).toBe('D');
  });
});

describe('mesVizinho', () => {
  it('atravessa a virada do ano nos dois sentidos', () => {
    // `mes - 1` em janeiro daria -1; `mes + 1` em dezembro daria 12. As duas
    // contas a mao produzem um mes que nao existe.
    expect(mesVizinho(2026, 0, -1)).toEqual({ ano: 2025, mes: 11 });
    expect(mesVizinho(2026, 11, 1)).toEqual({ ano: 2027, mes: 0 });
  });

  it('anda dentro do ano sem mexer nele', () => {
    expect(mesVizinho(2026, 5, 1)).toEqual({ ano: 2026, mes: 6 });
    expect(mesVizinho(2026, 5, -1)).toEqual({ ano: 2026, mes: 4 });
  });
});
