import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { AuthService } from '../../core/auth.service';
import { MaterialRepository } from '../../data/material.repository';
import type { Material, TipoMaterial } from '../../data/models';
import { Espera } from '../auth/espera';
import { mensagemDeErro } from '../auth/erro';

/**
 * Editar e apagar um material.
 *
 * Mesma promessa da prova, versão menor: "só você pode editar ou apagar depois".
 * `atualizar` e `excluir` existiam no repositório sem nenhum chamador, e
 * `GET /materiais/{id}` existia no servidor sem ninguém pedir.
 *
 * **Por que é tela e não um botão na linha.** A linha do material já tem uma
 * ação principal, e é a certa: abrir o arquivo. Pendurar editar ali disputaria
 * o toque com a única coisa que quase todo mundo quer fazer.
 *
 * **PATCH SUBSTITUI o objeto inteiro** (A13), então a tela abre preenchida e
 * manda todos os campos. Sem prefill, quem editasse só o título apagaria a data
 * da aula sem perceber — foi exatamente esse o defeito que apareceu no servidor
 * na semana passada, por outro caminho.
 */
@Component({
  selector: 'app-editar-material',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent],
  styleUrls: ['../auth/auth.scss'],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button [defaultHref]="voltarPara()" />
        </ion-buttons>
        <ion-title>Editar material</ion-title>
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
          @if (!souAutor()) {
            <div class="pf-vazio">
              <b>Este material não é seu.</b>
              <span>
                Editar e apagar é de quem criou — aqui, {{ m.autoria.autorNome }}. Se estiver
                errado, fale com quem cadastrou; se for impróprio, o líder pode ocultar.
              </span>
            </div>
          } @else {
            <p class="rot-campo">tipo</p>
            <div class="seg" role="group" aria-label="Tipo de material">
              <button
                type="button"
                [attr.aria-pressed]="tipo() === 'AULA'"
                (click)="tipo.set('AULA')">
                De aula
              </button>
              <button
                type="button"
                [attr.aria-pressed]="tipo() === 'ADICIONAL'"
                (click)="tipo.set('ADICIONAL')">
                Adicional
              </button>
            </div>

            <p class="rot-campo">o que é</p>
            <input
              #titulo
              class="campo--linha"
              type="text"
              name="titulo"
              maxlength="120"
              [value]="m.titulo"
              aria-label="Título do material" />

            <p class="rot-campo">link</p>
            <input
              #url
              class="campo--linha"
              type="url"
              name="url"
              inputmode="url"
              autocapitalize="off"
              [value]="m.url ?? ''"
              aria-label="Link do material" />

            <p class="rot-campo">de que aula <span class="opcional">— opcional</span></p>
            <input
              #dataAula
              class="campo--linha"
              type="date"
              name="dataAula"
              [value]="m.dataAula ?? ''"
              aria-label="Data da aula" />

            <button
              class="botao"
              type="button"
              [disabled]="enviando()"
              (click)="salvar(titulo.value, url.value, dataAula.value)">
              {{ rotulo() }}
            </button>

            @if (confirmando()) {
              <p class="alerta">Apagar mesmo? Some da matéria e das provas em que está anexado.</p>
              <button
                class="botao botao--fantasma"
                type="button"
                [disabled]="enviando()"
                (click)="apagar()">
                Sim, apagar
              </button>
              <button
                class="botao botao--fantasma"
                type="button"
                (click)="confirmando.set(false)">
                Cancelar
              </button>
            } @else {
              <button
                class="botao botao--fantasma"
                type="button"
                (click)="confirmando.set(true)">
                Apagar
              </button>
            }
          }
        }
      </div>
    </ion-content>
  `,
})
export class EditarMaterialPage {
  private readonly repo = inject(MaterialRepository);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly material = signal<Material | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly confirmando = signal(false);
  protected readonly tipo = signal<TipoMaterial>('AULA');

  private readonly espera = new Espera();

  protected readonly voltarPara = computed(() => {
    const m = this.material();
    return m === null ? '/tabs/materias' : `/tabs/materias/${m.materiaId}`;
  });

  protected readonly souAutor = computed(() => {
    const m = this.material();
    const eu = this.auth.usuario();
    return m !== null && eu !== null && m.autoria.autorId === eu.id;
  });

  protected readonly rotulo = computed(() => {
    if (!this.enviando()) {
      return 'Salvar';
    }
    return this.espera.demorando() ? 'Acordando o servidor…' : 'Salvando…';
  });

  constructor() {
    void this.carregar();
  }

  private async carregar(): Promise<void> {
    try {
      const m = await this.repo.detalhe(this.id);
      this.material.set(m);
      this.tipo.set(m.tipo);
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
    } finally {
      this.carregando.set(false);
    }
  }

  protected async salvar(titulo: string, url: string, dataAula: string): Promise<void> {
    const m = this.material();
    if (m === null || this.enviando()) {
      return;
    }
    const limpo = url.trim();
    if (titulo.trim() === '' || limpo === '') {
      this.erro.set('Preencha o que é e o link do material.');
      return;
    }
    // Mesma validação da tela de adicionar, pelo mesmo motivo: o servidor
    // devolve a frase genérica em inglês e não diz qual campo falhou.
    if (!/^https?:\/\/\S+$/i.test(limpo)) {
      this.erro.set('O link precisa começar com http:// ou https://');
      return;
    }

    this.enviando.set(true);
    this.erro.set(null);
    this.espera.comecar();
    try {
      await this.repo.atualizar(m.id, m.version, {
        materiaId: m.materiaId,
        tipo: this.tipo(),
        titulo: titulo.trim(),
        url: limpo,
        dataAula: dataAula === '' ? null : dataAula,
      });
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
      return;
    } finally {
      this.enviando.set(false);
      this.espera.terminar();
    }
    await this.router.navigateByUrl(this.voltarPara());
  }

  protected async apagar(): Promise<void> {
    const m = this.material();
    if (m === null || this.enviando()) {
      return;
    }
    this.enviando.set(true);
    this.erro.set(null);
    try {
      await this.repo.excluir(m.id, m.version);
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
      this.confirmando.set(false);
      return;
    } finally {
      this.enviando.set(false);
    }
    await this.router.navigateByUrl(this.voltarPara());
  }
}
