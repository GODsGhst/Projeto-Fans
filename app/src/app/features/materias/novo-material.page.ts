import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { MaterialRepository } from '../../data/material.repository';
import type { TipoMaterial } from '../../data/models';
import { Espera } from '../auth/espera';
import { mensagemDeErro } from '../auth/erro';

/**
 * Adicionar material a uma materia.
 *
 * Existe porque `POST /materiais` respondia desde sempre e nenhuma tela o
 * chamava: `MaterialRepository.criar` nao tinha um unico chamador no app. As
 * secoes "material de aula" e "material adicional" prometiam que alguem da turma
 * podia cadastrar, e nao havia por onde.
 *
 * **E link, nao arquivo, e isso e uma limitacao de hoje.** A coluna
 * `arquivo_ref` existe no banco e continua nula: subir arquivo depende de
 * armazenamento (a Task 15). Enquanto isso, link do Drive, do Classroom ou de
 * onde o professor publicou resolve o caso real — e o campo e obrigatorio,
 * porque material sem link nao serve para estudar.
 *
 * A materia vem da rota, nao de um seletor: so se chega aqui de dentro de uma
 * materia, e perguntar de novo qual e seria pedir o que ja se sabe.
 */
@Component({
  selector: 'app-novo-material',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent],
  styleUrls: ['../auth/auth.scss'],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button [defaultHref]="voltarPara" />
        </ion-buttons>
        <ion-title>Adicionar material</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="pf-auth">
        @if (erro(); as e) {
          <p class="pf-erro" role="alert">{{ e }}</p>
        }

        <p class="rot-campo">tipo</p>
        <div class="seg" role="group" aria-label="Tipo de material">
          <button
            type="button"
            data-tipo="AULA"
            [attr.aria-pressed]="tipo() === 'AULA'"
            (click)="tipo.set('AULA')">
            De aula
          </button>
          <button
            type="button"
            data-tipo="ADICIONAL"
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
          placeholder="Slides da aula 3"
          aria-label="Título do material" />

        <p class="rot-campo">link</p>
        <input
          #url
          class="campo--linha"
          type="url"
          name="url"
          inputmode="url"
          autocapitalize="off"
          placeholder="https://…"
          aria-label="Link do material" />

        <p class="rot-campo">de que aula <span class="opcional">— opcional</span></p>
        <input
          #dataAula
          class="campo--linha"
          type="date"
          name="dataAula"
          aria-label="Data da aula" />

        <p class="alerta">
          Cole o endereço de onde o material está — Drive, Classroom, site da matéria. Enviar o
          arquivo direto do celular ainda não dá; por enquanto é o link.
        </p>

        <button
          class="botao"
          type="button"
          [disabled]="enviando()"
          (click)="adicionar(titulo.value, url.value, dataAula.value)">
          {{ rotulo() }}
        </button>
      </div>
    </ion-content>
  `,
})
export class NovoMaterialPage {
  private readonly materiais = inject(MaterialRepository);
  private readonly router = inject(Router);

  private readonly materiaId = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly voltarPara = `/tabs/materias/${this.materiaId}`;
  protected readonly tipo = signal<TipoMaterial>('AULA');
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);

  private readonly espera = new Espera();

  protected rotulo(): string {
    if (!this.enviando()) {
      return 'Adicionar material';
    }
    return this.espera.demorando() ? 'Acordando o servidor…' : 'Adicionando…';
  }

  protected async adicionar(titulo: string, url: string, dataAula: string): Promise<void> {
    if (this.enviando()) {
      return;
    }
    const limpo = url.trim();
    if (titulo.trim() === '' || limpo === '') {
      this.erro.set('Preencha o que é e o link do material.');
      return;
    }
    // Validado aqui porque o servidor devolve a mesma frase generica em ingles
    // para todo campo invalido, e ela nao diz qual campo esta errado. "Colei sem
    // o https" e o engano mais comum de quem copia da barra do navegador.
    if (!/^https?:\/\/\S+$/i.test(limpo)) {
      this.erro.set('O link precisa começar com http:// ou https://');
      return;
    }

    this.enviando.set(true);
    this.erro.set(null);
    this.espera.comecar();
    try {
      await this.materiais.criar({
        materiaId: this.materiaId,
        tipo: this.tipo(),
        titulo: titulo.trim(),
        url: limpo,
        // Material adicional costuma nao pertencer a uma aula; vazio e resposta
        // valida, nao campo esquecido.
        dataAula: dataAula === '' ? null : dataAula,
      });
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
      return;
    } finally {
      this.enviando.set(false);
      this.espera.terminar();
    }

    // Sem recarregar nada aqui de proposito. Voltar destroi esta tela e recria a
    // tela da materia, que busca o detalhe no construtor — o material novo entra
    // por esse caminho. Um `carregar()` extra seria uma chamada a mais num
    // servidor que dorme, pelo mesmo resultado.
    await this.router.navigateByUrl(this.voltarPara);
  }
}
