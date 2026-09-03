import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { TurmaRepository } from '../../data/turma.repository';
import { Espera } from '../auth/espera';
import { mensagemDeErro } from '../auth/erro';

/**
 * Renomear a turma e acertar o período.
 *
 * **Por que isto existe.** O período envelhece sozinho. A turma era criada como
 * "Fans 2026.2" e o campo era obrigatório e escrito uma única vez: no sétimo
 * período ela continuava se chamando isso, e ninguém tinha como corrigir. Dado
 * que envelhece e não pode ser atualizado é pior que dado ausente — ele parece
 * atual.
 *
 * **O código de convite não está aqui, e a ausência é a decisão.** Ele
 * identifica a turma e está anotado no celular de todo mundo; trocá-lo junto com
 * o semestre expulsaria a turma inteira do próprio grupo. A turma é o grupo de
 * pessoas; o período é só um rótulo do momento.
 *
 * O semestre pode ficar vazio. Quem virou de período e ainda não sabe o novo
 * fica sem — melhor que ficar com o antigo mentindo.
 */
@Component({
  selector: 'app-editar-turma',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
  ],
  styleUrls: ['../auth/auth.scss'],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/turma" />
        </ion-buttons>
        <ion-title>Editar turma</ion-title>
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

        @if (turma(); as t) {
          @if (!souLider()) {
            <div class="pf-vazio">
              <b>Isto é só o líder que faz.</b>
              <span>
                Renomear a turma muda o que todo mundo vê. Se o período está
                errado, peça a quem está com a liderança.
              </span>
            </div>
          } @else {
            <p class="rot-campo">nome da turma</p>
            <input
              #nome
              class="campo--linha"
              type="text"
              name="nome"
              maxlength="120"
              [value]="t.nome"
              aria-label="Nome da turma"
            />

            <p class="rot-campo">
              período <span class="opcional">— opcional</span>
            </p>
            <input
              #semestre
              class="campo--linha"
              type="text"
              name="semestre"
              maxlength="20"
              placeholder="2027.1"
              [value]="t.semestre ?? ''"
              aria-label="Período"
            />

            <p class="alerta">
              O código de convite <b>não muda</b>. Ele está anotado no celular
              de todo mundo — trocá-lo tiraria a turma inteira do grupo.
            </p>

            <button
              class="botao"
              type="button"
              [disabled]="enviando()"
              (click)="salvar(nome.value, semestre.value)"
            >
              {{ rotulo() }}
            </button>
          }
        }
      </div>
    </ion-content>
  `,
})
export class EditarTurmaPage {
  private readonly repo = inject(TurmaRepository);
  private readonly router = inject(Router);

  protected readonly turma = this.repo.turma;
  protected readonly carregando = this.repo.carregando;
  protected readonly souLider = this.repo.souLider;
  protected readonly erro = signal<string | null>(null);
  protected readonly enviando = signal(false);

  private readonly espera = new Espera();

  protected readonly rotulo = computed(() => {
    if (!this.enviando()) {
      return 'Salvar';
    }
    return this.espera.demorando() ? 'Acordando o servidor…' : 'Salvando…';
  });

  constructor() {
    void this.repo.carregar();
  }

  protected async salvar(nome: string, semestre: string): Promise<void> {
    if (this.enviando()) {
      return;
    }
    if (nome.trim() === '') {
      this.erro.set('A turma precisa de um nome.');
      return;
    }

    this.enviando.set(true);
    this.erro.set(null);
    this.espera.comecar();
    try {
      // Vazio vira `null`, não string vazia: o backend normaliza igual, e mandar
      // "" faria a tela mostrar um período em branco como se fosse um período.
      await this.repo.renomear(
        nome.trim(),
        semestre.trim() === '' ? null : semestre.trim(),
      );
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
      return;
    } finally {
      this.enviando.set(false);
      this.espera.terminar();
    }
    await this.router.navigateByUrl('/tabs/turma');
  }
}
