import { TestBed } from '@angular/core/testing';
import { AulaCardComponent } from './aula-card.component';
import { EventoCardComponent } from './evento-card.component';
import { MateriaChipComponent } from './materia-chip.component';
import { NotaComponent } from './nota.component';

/**
 * Os nao-negociaveis visuais como assercao, nao como comentario.
 *
 * A Secao 9.1 do spec de design diz que a regra tem que deixar de depender de
 * disciplina e passar a depender do codigo. Comentario nao segura regra; teste
 * segura. Cada bloco aqui corresponde a uma regra escrita no spec.
 */
describe('design system — nao-negociaveis visuais', () => {
  const BD = { sigla: 'BD', cor: '#0369A1' };

  describe('chip de materia: cor + sigla, sempre juntas', () => {
    it('renderiza a sigla junto com a cor, nunca so a cor', () => {
      const f = TestBed.createComponent(MateriaChipComponent);
      f.componentRef.setInput('cor', BD.cor);
      f.componentRef.setInput('sigla', BD.sigla);
      f.detectChanges();

      const chip: HTMLElement = f.nativeElement.querySelector('.chip');
      expect(chip.textContent!.trim())
        .withContext('a sigla precisa aparecer')
        .toBe('BD');
      expect(getComputedStyle(chip).backgroundColor)
        .withContext('o preenchimento precisa ser a hue da materia')
        .toBe('rgb(3, 105, 161)');
    });

    it('texto branco em qualquer tema — uma regra so, sem variante', () => {
      const f = TestBed.createComponent(MateriaChipComponent);
      f.componentRef.setInput('cor', BD.cor);
      f.componentRef.setInput('sigla', BD.sigla);
      f.detectChanges();

      const chip: HTMLElement = f.nativeElement.querySelector('.chip');
      expect(getComputedStyle(chip).color).toBe('rgb(255, 255, 255)');
    });
  });

  describe('prova pesa mais que entrega — por tinta, nunca por cor', () => {
    function montar(tipo: 'PROVA' | 'ENTREGA') {
      const f = TestBed.createComponent(EventoCardComponent);
      f.componentRef.setInput('tipo', tipo);
      f.componentRef.setInput('dia', '12');
      f.componentRef.setInput('mes', 'ago');
      f.componentRef.setInput('quando', '19:00');
      f.componentRef.setInput('titulo', 'Prova 2 — normalização');
      f.componentRef.setInput('materia', BD);
      f.detectChanges();
      return f.nativeElement as HTMLElement;
    }

    it('o titulo da prova e mais pesado que o da entrega', () => {
      const peso = (el: HTMLElement) =>
        Number(getComputedStyle(el.querySelector('.titulo')!).fontWeight);

      expect(peso(montar('PROVA'))).toBeGreaterThan(peso(montar('ENTREGA')));
    });

    it('prova e bloco preenchido; entrega e contorno sem preenchimento', () => {
      const fundo = (el: HTMLElement) =>
        getComputedStyle(el.querySelector('.ev')!).backgroundColor;

      // entrega nao pinta fundo: transparente resolve para alpha 0
      expect(fundo(montar('ENTREGA'))).toBe('rgba(0, 0, 0, 0)');
      expect(fundo(montar('PROVA'))).not.toBe('rgba(0, 0, 0, 0)');
    });

    it('o glifo tem forma diferente: cheio e quadrado na prova, vazado e redondo na entrega', () => {
      const glifo = (el: HTMLElement) =>
        getComputedStyle(el.querySelector('.glifo')!);

      const prova = glifo(montar('PROVA'));
      const entrega = glifo(montar('ENTREGA'));

      expect(prova.borderRadius).not.toBe(entrega.borderRadius);
      // entrega e vazada: sem preenchimento proprio
      expect(entrega.backgroundColor).toBe('rgba(0, 0, 0, 0)');
      expect(prova.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    });

    it('o tipo tambem existe em texto, para quem usa leitor de tela', () => {
      expect(montar('PROVA').textContent).toContain('Prova');
      expect(montar('ENTREGA').textContent).toContain('Entrega');
    });

    it('sem materia o chip some, mas o cartao continua legivel', () => {
      const f = TestBed.createComponent(EventoCardComponent);
      f.componentRef.setInput('tipo', 'PROVA');
      f.componentRef.setInput('dia', '12');
      f.componentRef.setInput('mes', 'ago');
      f.componentRef.setInput('quando', 'prova · 2 materiais');
      f.componentRef.setInput('titulo', 'Prova 2');
      f.detectChanges();

      const el = f.nativeElement as HTMLElement;
      expect(el.querySelector('app-materia-chip')).toBeNull();
      expect(el.textContent).toContain('Prova 2');
    });
  });

  describe('nota da turma e nota pessoal nunca se parecem', () => {
    function montar(alcance: 'TURMA' | 'PESSOAL') {
      const f = TestBed.createComponent(NotaComponent);
      f.componentRef.setInput('alcance', alcance);
      f.componentRef.setInput('texto', 'cobra ate a aula de juncao');
      f.detectChanges();
      return f.nativeElement as HTMLElement;
    }

    it('cada uma diz em palavras quem vai ver', () => {
      expect(montar('TURMA').textContent).toContain('todos veem');
      expect(montar('PESSOAL').textContent).toContain('só você');
    });

    it('a regua tem estilo diferente — a distincao sobrevive a escala de cinza', () => {
      const estilo = (el: HTMLElement) =>
        getComputedStyle(el.querySelector('.nota')!);

      expect(estilo(montar('TURMA')).borderLeftStyle).toBe('solid');
      expect(estilo(montar('PESSOAL')).borderLeftStyle).toBe('dashed');
    });
  });

  describe('aula', () => {
    it('mostra a sala junto do vetor, e o quadrado carrega informacao', () => {
      const f = TestBed.createComponent(AulaCardComponent);
      f.componentRef.setInput('materia', BD);
      f.componentRef.setInput('nome', 'Banco de Dados');
      f.componentRef.setInput('hora', '19:00–20:40');
      f.componentRef.setInput('sala', 'B-204');
      f.detectChanges();

      const el = f.nativeElement as HTMLElement;
      expect(el.querySelector('.sala')!.textContent!.trim()).toBe('B-204');
      expect(el.querySelector('.sala svg'))
        .withContext('o vetor de sala de aula')
        .not.toBeNull();
    });

    it('so a aula em andamento recebe o trilho de accent', () => {
      const f = TestBed.createComponent(AulaCardComponent);
      f.componentRef.setInput('materia', BD);
      f.componentRef.setInput('nome', 'Banco de Dados');
      f.componentRef.setInput('hora', '19:00');
      f.componentRef.setInput('sala', 'B-204');
      f.detectChanges();
      expect(f.nativeElement.querySelector('.aula--agora')).toBeNull();

      f.componentRef.setInput('agora', true);
      f.detectChanges();
      expect(f.nativeElement.querySelector('.aula--agora')).not.toBeNull();
    });
  });
});
