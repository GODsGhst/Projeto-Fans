import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { ChaveIaService } from '../../core/chave-ia.service';
import { MaterialRepository } from '../../data/material.repository';
import type { Material } from '../../data/models';
import { mensagemDeErro } from '../auth/erro';

/**
 * O resumo por IA de um material.
 *
 * **O resumo é da turma, não de quem pediu.** Fica gravado no material: quem
 * tem chave gera uma vez, e os trinta leem. Um resumo por pessoa faria todo
 * mundo pagar de novo pelo mesmo PDF.
 *
 * **Por isso "Refazer" é um botão à parte, e não o mesmo.** Abrir a tela nunca
 * gera nada sozinho — gerar custa dinheiro de quem colou a chave, e uma tela
 * que gasta ao ser aberta é uma armadilha. Quando já existe resumo, ele
 * aparece; gastar de novo é uma decisão que se toma clicando.
 *
 * **A tela diz que o texto é de IA, sempre.** Sem isso ele passa a ser lido
 * como se fosse do professor — e o único jeito de usar resumo automático sem
 * ser enganado por ele é saber que é automático.
 */
@Component({
  selector: 'app-resumo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    RouterLink,
  ],
  styleUrls: ['../auth/auth.scss'],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button [defaultHref]="voltarPara()" />
        </ion-buttons>
        <ion-title>Resumo</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="pf-auth">
        @if (carregando()) {
          <p class="pf-aviso">Carregando…</p>
        }
        @if (erro(); as e) {
          <p class="pf-erro" role="alert">{{ e }}</p>
        }

        @if (material(); as m) {
          <div class="marca">
            <b>{{ m.titulo }}</b>
            @if (m.resumoEm) {
              <span>Resumo escrito por IA em {{ quando(m.resumoEm) }}.</span>
            } @else {
              <span
                >Ainda não tem resumo. Gerar usa a chave que está neste
                aparelho.</span
              >
            }
          </div>

          @if (m.resumo) {
            <p class="texto-resumo">{{ m.resumo }}</p>
          }

          @if (semChave()) {
            <p class="alerta">
              Este aparelho não tem chave de IA. Cole a sua em Ajustes — ela
              fica só aqui.
            </p>
            <a class="botao botao--fantasma" routerLink="/tabs/ajustes"
              >Ir para Ajustes</a
            >
          } @else {
            <button
              class="botao"
              type="button"
              [disabled]="gerando()"
              (click)="gerar(m.resumo !== null && m.resumo !== undefined)"
            >
              {{ rotulo() }}
            </button>
          }

          @if (m.resumo) {
            <p class="alerta">
              Isto foi escrito por uma IA a partir do arquivo do link. Confira
              antes de estudar só por ele.
            </p>
          }
        }
      </div>
    </ion-content>
  `,
  styles: `
    .texto-resumo {
      white-space: pre-wrap;
      font-size: 15px;
      line-height: 1.55;
      color: var(--ink);
      margin: 0;
    }
  `,
})
export class ResumoPage {
  private readonly repo = inject(MaterialRepository);
  private readonly chaves = inject(ChaveIaService);

  private readonly id =
    inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly material = signal<Material | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly gerando = signal(false);
  protected readonly semChave = signal(false);

  protected readonly voltarPara = computed(() => {
    const m = this.material();
    return m === null ? '/tabs/materias' : `/tabs/materias/${m.materiaId}`;
  });

  protected readonly rotulo = computed(() => {
    if (this.gerando()) {
      // Ler um PDF e escrever o resumo leva dezenas de segundos. Dizer só
      // "Gerando…" faria a tela parecer travada e o dedo tentar de novo — e
      // cada tentativa custa dinheiro.
      return 'Lendo o arquivo… isso demora';
    }
    return this.material()?.resumo ? 'Refazer o resumo' : 'Gerar resumo';
  });

  constructor() {
    void this.carregar();
  }

  private async carregar(): Promise<void> {
    try {
      const [m, chave] = await Promise.all([
        this.repo.detalhe(this.id),
        this.chaves.ler(),
      ]);
      this.material.set(m);
      this.semChave.set(chave === '');
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
    } finally {
      this.carregando.set(false);
    }
  }

  protected async gerar(refazer: boolean): Promise<void> {
    if (this.gerando()) {
      return;
    }
    const chave = await this.chaves.ler();
    if (chave === '') {
      this.semChave.set(true);
      return;
    }
    this.gerando.set(true);
    this.erro.set(null);
    try {
      this.material.set(await this.repo.resumir(this.id, chave, refazer));
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
    } finally {
      this.gerando.set(false);
    }
  }

  protected quando(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    });
  }
}
