import { materialVm } from './material-vm';
import type { Material } from '../data/models';

function material(url: string | null): Material {
  return {
    id: 'm1',
    tipo: 'AULA',
    titulo: 'Slides aula 3',
    url,
    arquivoRef: null,
    materiaId: 'bd',
    autoria: {
      autorId: 'u1',
      autorNome: 'Otávio',
      criadoEm: '2026-09-02T09:00:00Z',
      atualizadoEm: '2026-09-02T09:00:00Z',
    },
    version: 0,
    visivelTurma: true,
    excluidoEm: null,
  };
}

describe('materialVm', () => {
  const agora = new Date('2026-09-03T12:00:00Z');

  it('link http(s) vira endereco para abrir', () => {
    expect(materialVm(material('https://ex.dev/a.pdf'), agora).url).toBe('https://ex.dev/a.pdf');
    expect(materialVm(material('HTTP://ex.dev/a'), agora).url).toBe('HTTP://ex.dev/a');
  });

  // Achado C1 da auditoria de 05/10/2026: o sanitizador do Angular so barra
  // javascript:, entao o filtro tem de acontecer antes do href.
  it('qualquer outro esquema nao vira link', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,<b>oi</b>',
      'intent://abrir#Intent;scheme=x;end',
      'file:///sdcard/a.pdf',
      'ex.dev/sem-esquema',
    ]) {
      expect(materialVm(material(url), agora).url).withContext(url).toBeNull();
    }
  });
});
