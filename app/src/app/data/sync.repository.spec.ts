import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { environment } from '../../environments/environment';
import { erroHttpInterceptor } from '../core/http-error.interceptor';
import { NotificacoesService } from '../notifications/notificacoes.service';
import { SyncRepository } from './sync.repository';

/** Daqui a muitos dias: todo aviso e futuro, em qualquer dia que se rode. */
function daquiA(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Como o backend manda: hora com segundos, e campo nulo AUSENTE do JSON. */
function eventoDoSync(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    tipo: 'PROVA',
    titulo: `Prova ${id}`,
    data: daquiA(10),
    hora: '14:00:00',
    materiaId: 'm1',
    materiaSigla: 'BD',
    materiaCorHex: '#0369A1',
    version: 1,
    visivelTurma: true,
    ...extra,
  };
}

describe('SyncRepository', () => {
  let backend: HttpTestingController;
  let avisos: jasmine.SpyObj<NotificacoesService> & {
    suportado: boolean;
    epoca: number;
  };

  function montar(suportado: boolean): SyncRepository {
    avisos = Object.assign(
      jasmine.createSpyObj<NotificacoesService>('avisos', [
        'sincronizar',
        'esquecer',
      ]),
      { suportado, epoca: 0 },
    );
    avisos.sincronizar.and.resolveTo();
    avisos.esquecer.and.resolveTo();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([erroHttpInterceptor])),
        provideHttpClientTesting(),
        { provide: NotificacoesService, useValue: avisos },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    return TestBed.inject(SyncRepository);
  }

  afterEach(() => backend.verify());

  it('404 SEM_TURMA: esquece os lembretes da turma antiga e leva para entrar-turma', async () => {
    // O removido que so abre a Home tem o /sync como unica pista: os avisos
    // agendados no aparelho seguiam tocando as provas de uma turma que nao e mais dele.
    spyOn(console, 'error');
    const repo = montar(true);
    const irPara = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

    const pronto = repo.reagendarAvisos();
    backend.expectOne(`${environment.apiUrl}/sync`).flush(
      { detail: 'Registro nao encontrado', codigo: 'SEM_TURMA' },
      { status: 404, statusText: 'Not Found' },
    );
    await pronto;

    expect(avisos.esquecer).toHaveBeenCalled();
    expect(irPara).toHaveBeenCalledWith('/entrar-turma');
    expect(avisos.sincronizar).not.toHaveBeenCalled();
  });

  it('404 do /sync SEM o codigo nao esquece nada: os avisos de antes continuam', async () => {
    spyOn(console, 'error');
    const repo = montar(true);
    const irPara = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

    const pronto = repo.reagendarAvisos();
    backend
      .expectOne(`${environment.apiUrl}/sync`)
      .flush('<html>Not Found</html>', { status: 404, statusText: 'Not Found' });
    await pronto;

    expect(avisos.esquecer).not.toHaveBeenCalled();
    expect(irPara).not.toHaveBeenCalled();
  });

  it('pede a turma INTEIRA (sem `desde`) e entrega aos lembretes', async () => {
    // A 7a prova da semana: a Home corta em 6, o /sync nao corta.
    const sete = Array.from({ length: 7 }, (_, i) => eventoDoSync(`e${i}`));
    const repo = montar(true);

    const pronto = repo.reagendarAvisos();
    backend
      .expectOne(`${environment.apiUrl}/sync`)
      .flush({ eventosAlterados: sete, materias: [], servidorEm: 'x' });
    await pronto;

    const lista = avisos.sincronizar.calls.mostRecent().args[0];
    expect(lista.length).toBe(7);
    expect(lista[0]).toEqual(
      jasmine.objectContaining({
        eventoId: 'e0',
        hora: '14:00:00',
        excluidoEm: null,
      }),
    );
  });

  it('a lapide do oculto chega como item — e e assim que o aparelho desagenda', async () => {
    // Para quem nao e o autor, oculto e excluido vem so com id e flags. O item
    // TEM de chegar ao servico: e por ele que o alarme personalizado sai do
    // disco e o aviso deixa de ser agendado.
    const repo = montar(true);

    const pronto = repo.reagendarAvisos();
    backend.expectOne(`${environment.apiUrl}/sync`).flush({
      eventosAlterados: [
        eventoDoSync('vivo'),
        { id: 'oculto', version: 2, visivelTurma: false },
        {
          id: 'excluido',
          version: 3,
          visivelTurma: true,
          excluidoEm: '2026-10-01T10:00:00Z',
        },
      ],
      materias: [],
      servidorEm: 'x',
    });
    await pronto;

    const lista = avisos.sincronizar.calls.mostRecent().args[0];
    expect(lista.map((e) => [e.eventoId, e.visivelTurma, e.excluidoEm])).toEqual(
      [
        ['vivo', true, null],
        ['oculto', false, null],
        ['excluido', true, '2026-10-01T10:00:00Z'],
      ],
    );
  });

  it('falha do /sync nao lanca e nao mexe no que ja estava agendado', async () => {
    // O servidor gratuito dorme. Falhar aqui nao pode virar "nenhum aviso": o
    // servico nem e chamado, entao nada e cancelado, e a proxima carga tenta.
    const repo = montar(true);
    spyOn(console, 'error');

    const pronto = repo.reagendarAvisos();
    backend
      .expectOne(`${environment.apiUrl}/sync`)
      .error(new ProgressEvent('error'));
    await expectAsync(pronto).toBeResolved();

    expect(avisos.sincronizar).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it('no navegador nem chama o /sync', async () => {
    const repo = montar(false);
    await repo.reagendarAvisos();

    backend.expectNone(`${environment.apiUrl}/sync`);
    expect(avisos.sincronizar).not.toHaveBeenCalled();
  });

  /** A resposta do /sync com estes ids de evento. */
  function corpo(...ids: string[]) {
    return {
      eventosAlterados: ids.map((id) => eventoDoSync(id)),
      materias: [],
      servidorEm: 'x',
    };
  }

  function idsEntregues(chamada: number): string[] {
    return avisos.sincronizar.calls
      .argsFor(chamada)[0]
      .map((e) => e.eventoId);
  }

  describe('sem repetir trabalho', () => {
    let agora: number;

    beforeEach(() => {
      agora = Date.UTC(2026, 9, 6, 12, 0, 0);
      spyOn(Date, 'now').and.callFake(() => agora);
    });

    it('duas chamadas juntas dividem a mesma ida ao servidor', async () => {
      // Home e `resume` caem quase juntos ao abrir o app: cada um baixava a
      // turma inteira.
      const repo = montar(true);

      const a = repo.reagendarAvisos();
      const b = repo.reagendarAvisos();
      backend.expectOne(`${environment.apiUrl}/sync`).flush(corpo('e0'));
      await Promise.all([a, b]);

      expect(avisos.sincronizar).toHaveBeenCalledTimes(1);
    });

    it('menos de 60 s depois de um /sync bom, nao sai de novo; passando disso, sai', async () => {
      const repo = montar(true);
      const primeiro = repo.reagendarAvisos();
      backend.expectOne(`${environment.apiUrl}/sync`).flush(corpo('e0'));
      await primeiro;

      agora += 59_000;
      await repo.reagendarAvisos();
      backend.expectNone(`${environment.apiUrl}/sync`);

      agora += 2_000;
      const depois = repo.reagendarAvisos();
      backend.expectOne(`${environment.apiUrl}/sync`).flush(corpo('e0'));
      await depois;
      expect(avisos.sincronizar).toHaveBeenCalledTimes(2);
    });

    it('um /sync que falhou nao abre a janela: a proxima chamada tenta de novo', async () => {
      // Se a falha contasse como "feito", um servidor que acordou tarde deixava
      // a pessoa sem aviso por um minuto inteiro.
      const repo = montar(true);
      spyOn(console, 'error');
      const falha = repo.reagendarAvisos();
      backend
        .expectOne(`${environment.apiUrl}/sync`)
        .error(new ProgressEvent('error'));
      await falha;

      const outra = repo.reagendarAvisos();
      backend.expectOne(`${environment.apiUrl}/sync`).flush(corpo('e0'));
      await outra;
      expect(avisos.sincronizar).toHaveBeenCalledTimes(1);
    });

    it('`forcar` ignora a janela de 60 s e a ida em voo', async () => {
      // Quem acabou de criar um evento ou salvar um alarme mudou o que o /sync
      // devolve: a lista velha deixaria o aviso novo de fora.
      const repo = montar(true);
      const primeiro = repo.reagendarAvisos();
      backend.expectOne(`${environment.apiUrl}/sync`).flush(corpo('e0'));
      await primeiro;

      agora += 5_000;
      const forcada = repo.reagendarAvisos(true);
      backend.expectOne(`${environment.apiUrl}/sync`).flush(corpo('e0', 'novo'));
      await forcada;
      expect(idsEntregues(1)).toEqual(['e0', 'novo']);

      // Com outra ida ainda no ar, a forcada tambem sai — e nao espera.
      const emVoo = repo.reagendarAvisos(true);
      const outraForcada = repo.reagendarAvisos(true);
      const pedidos = backend.match(`${environment.apiUrl}/sync`);
      expect(pedidos.length).toBe(2);
      pedidos[1].flush(corpo('e0', 'novo'));
      pedidos[0].flush(corpo('e0'));
      await Promise.all([emVoo, outraForcada]);
      // O primeiro, a forcada que o seguiu, e so a ULTIMA das duas simultaneas.
      expect(avisos.sincronizar).toHaveBeenCalledTimes(3);
    });

    it('resposta atrasada nao vira a lista: so a ida mais nova vale', async () => {
      // A velha, se aplicada, traria a turma SEM o evento criado depois dela —
      // e a poda do alarme personalizado apagaria o que a pessoa acabou de marcar.
      const repo = montar(true);
      const velha = repo.reagendarAvisos();
      const nova = repo.reagendarAvisos(true);
      const [pedidoVelho, pedidoNovo] = backend.match(
        `${environment.apiUrl}/sync`,
      );

      // Fora de ordem: a nova responde primeiro, a velha chega depois.
      pedidoNovo.flush(corpo('e0', 'novo'));
      await nova;
      pedidoVelho.flush(corpo('e0'));
      await velha;

      expect(avisos.sincronizar).toHaveBeenCalledTimes(1);
      expect(idsEntregues(0)).toEqual(['e0', 'novo']);
    });

    it('a velha que chega ANTES da nova tambem e descartada', async () => {
      const repo = montar(true);
      const velha = repo.reagendarAvisos();
      const nova = repo.reagendarAvisos(true);
      const [pedidoVelho, pedidoNovo] = backend.match(
        `${environment.apiUrl}/sync`,
      );

      pedidoVelho.flush(corpo('e0'));
      await velha;
      expect(avisos.sincronizar).not.toHaveBeenCalled();

      pedidoNovo.flush(corpo('e0', 'novo'));
      await nova;
      expect(avisos.sincronizar).toHaveBeenCalledTimes(1);
      expect(idsEntregues(0)).toEqual(['e0', 'novo']);
    });

    it('sair da conta com o /sync no ar descarta a resposta e zera a janela', async () => {
      // O servidor gratuito leva quase um minuto para acordar: dava tempo de
      // sair da conta no meio, e a lista da conta velha reagendava os avisos
      // dela. E a conta nova, entrando em seguida, nao pode herdar a janela de
      // 60 s da velha.
      const repo = montar(true);
      const antiga = repo.reagendarAvisos();
      avisos.epoca++; // `esquecer()` foi chamado
      backend.expectOne(`${environment.apiUrl}/sync`).flush(corpo('da-conta-velha'));
      await antiga;
      expect(avisos.sincronizar).not.toHaveBeenCalled();

      const nova = repo.reagendarAvisos();
      backend.expectOne(`${environment.apiUrl}/sync`).flush(corpo('da-conta-nova'));
      await nova;
      expect(idsEntregues(0)).toEqual(['da-conta-nova']);

      // E a janela de uma conta nao vale para a seguinte.
      agora += 1_000;
      avisos.epoca++;
      const outra = repo.reagendarAvisos();
      backend.expectOne(`${environment.apiUrl}/sync`).flush(corpo('terceira'));
      await outra;
      expect(avisos.sincronizar).toHaveBeenCalledTimes(2);
    });
  });
});
